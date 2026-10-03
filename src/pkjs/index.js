var Clay = require("@rebble/clay");
var clayConfig = require("./config");
var auth = require("./prusa-auth");
var api = require("./prusa-api");
var timeline = require("./timeline");

var clay = new Clay(clayConfig, null, { autoHandleEvents: false });

var POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

var accessToken = "";
var refreshToken = "";
var tokenExpiresAt = 0;

var isAuthenticating = false;
var authQueue = [];

var pollTimer = null;
var cachedPrinterId = null;
var cachedPrinterName = null;
var cachedFileName = null;
var cachedProgress = 0;

function loadSettings() {
    try {
        var stored = JSON.parse(localStorage.getItem("clay-settings")) || {};
        refreshToken = stored.RefreshToken ? (stored.RefreshToken.value || stored.RefreshToken) : "";
        accessToken = stored.AccessToken || "";
        tokenExpiresAt = stored.TokenExpiresAt || 0;

        if (refreshToken) {
            console.log("[PKJS] Loaded refresh token from storage (" + refreshToken.substring(0, 15) + "...)");
        }
        if (accessToken) {
            console.log("[PKJS] Restored access token from storage. Expires at: " + new Date(tokenExpiresAt).toLocaleTimeString());
        }
    } catch (e) {
        console.log("[PKJS] Error reading stored settings: " + e);
    }
}

function saveTokens(access, refresh, expiresIn) {
    accessToken = access;
    if (refresh) {
        refreshToken = refresh;
    }
    // Set expiry 2 minutes before actual expiration
    tokenExpiresAt = Date.now() + ((expiresIn || 7200) - 120) * 1000;

    try {
        var stored = JSON.parse(localStorage.getItem("clay-settings")) || {};
        stored.AccessToken = accessToken;
        stored.RefreshToken = refreshToken;
        stored.TokenExpiresAt = tokenExpiresAt;
        localStorage.setItem("clay-settings", JSON.stringify(stored));
        console.log("[PKJS] Saved tokens. Expiry: " + new Date(tokenExpiresAt).toLocaleTimeString());
    } catch (e) {
        console.log("[PKJS] Error saving tokens: " + e);
    }
}

function sendToWatch(dict, callback) {
    console.log("[PKJS] Sending AppMessage to watch: " + JSON.stringify(dict));
    Pebble.sendAppMessage(dict, function () {
        console.log("[PKJS] AppMessage delivered to watch successfully.");
        if (typeof callback === "function") callback(null);
    }, function (err) {
        console.log("[PKJS] AppMessage delivery failed: " + JSON.stringify(err) + ", retrying in 1s...");
        setTimeout(function () {
            Pebble.sendAppMessage(dict, function () {
                console.log("[PKJS] AppMessage retry delivered successfully.");
            }, function (retryErr) {
                console.log("[PKJS] AppMessage retry failed: " + JSON.stringify(retryErr));
            });
        }, 1000);
        if (typeof callback === "function") callback(err);
    });
}

function ensureAuthenticated(callback) {
    // Return existing token if still valid
    if (accessToken && Date.now() < tokenExpiresAt) {
        return callback(null, accessToken);
    }

    // Queue requests if an authentication attempt is already in flight
    authQueue.push(callback);
    if (isAuthenticating) {
        return;
    }
    isAuthenticating = true;

    function finish(err, token) {
        isAuthenticating = false;
        var q = authQueue.slice();
        authQueue = [];
        q.forEach(function (cb) {
            try { cb(err, token); } catch (e) { console.log(e); }
        });
    }

    if (refreshToken) {
        auth.refresh(refreshToken, function (err, data) {
            if (!err && data && data.access_token) {
                console.log("[PKJS] Token refreshed successfully!");
                saveTokens(data.access_token, data.refresh_token, data.expires_in);
                finish(null, data.access_token);
            } else {
                console.log("[PKJS] Token refresh failed: " + err);
                finish("Token refresh failed: " + err);
            }
        });
    } else {
        finish("Not configured. Please enter your Prusa refresh token in the phone app.");
    }
}

function fetchPrusaData(callback) {
    ensureAuthenticated(function (err, token) {
        if (err) {
            console.log("[PKJS] Cannot poll: " + err);
            var isMissingToken = !refreshToken && !accessToken;
            sendToWatch({
                Configured: 0,
                Progress: 0,
                FileName: isMissingToken ? "Setup Required" : "Token Invalid",
                PrinterName: "Prusa Connect",
                CompletionTime: ""
            });
            if (typeof callback === "function") callback();
            return;
        }

        console.log("[PKJS] Polling Prusa Connect...");
        api.fetchPrinters(token, function (apiErr, data) {
            if (apiErr) {
                if (apiErr.status === 401) {
                    console.log("[PKJS] Token expired (401). Retrying with token refresh...");
                    accessToken = "";
                    tokenExpiresAt = 0;
                    ensureAuthenticated(function (retryErr) {
                        if (!retryErr) {
                            fetchPrusaData(callback);
                        } else {
                            if (typeof callback === "function") callback();
                        }
                    });
                    return;
                }

                console.log("[PKJS] API error: " + (apiErr.error || JSON.stringify(apiErr)));
                if (typeof callback === "function") callback();
                return;
            }

            try {
                if (!data.printers || data.printers.length === 0) {
                    console.log("[PKJS] No printers found on account.");
                    sendToWatch({
                        Configured: 1,
                        Progress: 0,
                        FileName: "No Printers",
                        PrinterName: "Prusa Connect",
                        CompletionTime: ""
                    });
                    if (typeof callback === "function") callback();
                    return;
                }

                var printer = data.printers[0];
                cachedPrinterId = printer.uuid || printer.id || printer.printer_id || "221f29ff-5a46-4410-bb43-ecdbae785068";
                cachedPrinterName = printer.name || printer.printer_type_name || "Prusa Printer";
                var printerName = cachedPrinterName;

                var printerStateRaw = (printer.state || printer.printer_state || printer.status || "").toUpperCase();
                var jobStateRaw = (printer.job_info && (printer.job_info.state || printer.job_info.status) || "").toUpperCase();

                var isStopped = (printerStateRaw === "STOPPED" || printerStateRaw === "CANCELLED" || printerStateRaw === "ABORTED" ||
                                 jobStateRaw === "STOPPED" || jobStateRaw === "CANCELLED" || jobStateRaw === "ABORTED");
                var isPaused = (printerStateRaw === "PAUSED" || printerStateRaw === "PAUSE" || printerStateRaw === "ATTENTION" ||
                                jobStateRaw === "PAUSED" || jobStateRaw === "PAUSE" || jobStateRaw === "ATTENTION");

                var progress = 0;
                var fileName = "Idle";
                var completionTime = "";
                var status = "Idle";

                if (printer.job_info) {
                    progress = Math.round(printer.job_info.progress || 0);

                    if (printer.job_info.display_name) {
                        fileName = printer.job_info.display_name;
                    } else if (printer.job_info.path) {
                        fileName = printer.job_info.path.split("/").pop();
                    } else {
                        fileName = isStopped ? "Stopped" : (isPaused ? "Paused" : "Printing...");
                    }

                    var remainingSecs = printer.job_info.time_remaining || 0;
                    if (remainingSecs > 0 && !isStopped) {
                        completionTime = new Date(Date.now() + remainingSecs * 1000).toISOString();
                    }
                }

                if (isStopped) {
                    status = "Stopped";
                    completionTime = "";
                    if (fileName === "Idle" || !fileName) {
                        fileName = cachedFileName || "Print Stopped";
                    }
                } else if (isPaused) {
                    status = "Paused";
                } else if (progress >= 100) {
                    status = "Finished";
                } else if (progress > 0) {
                    status = "Printing";
                } else {
                    status = "Idle";
                }

                cachedFileName = fileName;
                cachedProgress = progress;

                console.log("[PKJS] Update -> Printer: " + printerName + " (" + cachedPrinterId + "), " + progress + "%, Status: " + status + ", File: " + fileName);

                sendToWatch({
                    Configured: 1,
                    Progress: progress,
                    FileName: fileName,
                    PrinterName: printerName,
                    CompletionTime: completionTime,
                    Status: status
                });

                // Validate timeline pin: delete stale pin if stopped/aborted/finished or if time shifted
                timeline.validateAndSyncTimelinePin(status, completionTime, printerName, fileName, progress);
            } catch (e) {
                console.log("[PKJS] JSON parse/handling error: " + e);
            }

            if (typeof callback === "function") callback();
        });
    });
}

function handleStopSignal() {
    console.log("[PKJS] StopSignal received from watch! Initiating stop print API...");
    timeline.removeTimelinePin();

    ensureAuthenticated(function (err, token) {
        if (err) {
            console.log("[PKJS] Cannot stop print, auth failed: " + err);
            return;
        }

        var printerId = cachedPrinterId || "221f29ff-5a46-4410-bb43-ecdbae785068";
        api.sendStopPrint(token, printerId, function (stopErr) {
            if (!stopErr) {
                console.log("[PKJS] Stop print succeeded! Refetching printer state immediately...");
            } else {
                console.log("[PKJS] Stop print request failed: " + JSON.stringify(stopErr));
            }
            fetchPrusaData();
            setTimeout(fetchPrusaData, 2000);
            setTimeout(fetchPrusaData, 5000);
        });
    });
}

function handlePauseSignal() {
    console.log("[PKJS] PauseSignal received from watch! Initiating pause print API...");
    ensureAuthenticated(function (err, token) {
        if (err) {
            console.log("[PKJS] Cannot pause print, auth failed: " + err);
            return;
        }

        var printerId = cachedPrinterId || "221f29ff-5a46-4410-bb43-ecdbae785068";
        api.sendPausePrint(token, printerId, function (pauseErr) {
            if (!pauseErr) {
                console.log("[PKJS] Pause print succeeded! Refetching printer state immediately...");
            } else {
                console.log("[PKJS] Pause print request failed: " + JSON.stringify(pauseErr));
            }
            fetchPrusaData();
            setTimeout(fetchPrusaData, 2000);
            setTimeout(fetchPrusaData, 5000);
        });
    });
}

function handleResumeSignal() {
    console.log("[PKJS] ResumeSignal received from watch! Initiating resume print API...");
    ensureAuthenticated(function (err, token) {
        if (err) {
            console.log("[PKJS] Cannot resume print, auth failed: " + err);
            return;
        }

        var printerId = cachedPrinterId || "221f29ff-5a46-4410-bb43-ecdbae785068";
        api.sendResumePrint(token, printerId, function (resumeErr) {
            if (!resumeErr) {
                console.log("[PKJS] Resume print succeeded! Refetching printer state immediately...");
            } else {
                console.log("[PKJS] Resume print request failed: " + JSON.stringify(resumeErr));
            }
            fetchPrusaData();
            setTimeout(fetchPrusaData, 2000);
            setTimeout(fetchPrusaData, 5000);
        });
    });
}

function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    fetchPrusaData();
    pollTimer = setInterval(fetchPrusaData, POLL_INTERVAL_MS);
}

Pebble.addEventListener("ready", function (e) {
    console.log("[PKJS] PebbleKit JS ready.");
    loadSettings();

    // Check if there is an expired or stale pin on app launch
    try {
        var storedPinTime = localStorage.getItem("prusa_timeline_pin_time");
        if (storedPinTime && new Date(storedPinTime).getTime() < Date.now()) {
            console.log("[Timeline] Stored pin time has passed on app open. Deleting stale pin...");
            timeline.removeTimelinePin();
        }
    } catch (err) {}

    var isMissingToken = !refreshToken && !accessToken;
    if (isMissingToken) {
        console.log("[PKJS] No refresh token configured. Sending Configured: 0 to watch...");
        sendToWatch({
            Configured: 0,
            Progress: 0,
            FileName: "Setup Required",
            PrinterName: "Prusa Connect",
            CompletionTime: ""
        });
        timeline.removeTimelinePin();
    }

    startPolling();
});

Pebble.addEventListener("appmessage", function (e) {
    var payload = e.payload || {};
    console.log("[PKJS] AppMessage received from watch: " + JSON.stringify(payload));

    var isStop = (payload.StopSignal !== undefined) || (payload[10004] !== undefined) || (payload["10004"] !== undefined);
    var isPause = (payload.PauseSignal !== undefined) || (payload[10009] !== undefined) || (payload["10009"] !== undefined);
    var isResume = (payload.ResumeSignal !== undefined) || (payload[10010] !== undefined) || (payload["10010"] !== undefined);
    var isRefresh = (payload.Refresh !== undefined) || (payload[10006] !== undefined) || (payload["10006"] !== undefined);

    if (isStop) {
        handleStopSignal();
    }
    if (isPause) {
        handlePauseSignal();
    }
    if (isResume) {
        handleResumeSignal();
    }
    if (isRefresh) {
        console.log("[PKJS] Refresh requested by watch.");
        fetchPrusaData();
    }
});

Pebble.addEventListener("showConfiguration", function (e) {
    console.log("[PKJS] Showing Clay configuration page...");
    clay.setSettings("RefreshToken", refreshToken);
    Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener("webviewclosed", function (e) {
    console.log("[PKJS] Webview closed: " + (e ? e.response : "null"));
    if (!e || !e.response) {
        return;
    }

    try {
        var settings = clay.getSettings(e.response, false);
        console.log("[PKJS] Clay settings parsed.");
        var newRefreshToken = settings.RefreshToken ? (settings.RefreshToken.value || settings.RefreshToken) : "";

        if (newRefreshToken) {
            refreshToken = newRefreshToken.trim();

            // Persist token and invalidate old access token
            var stored = JSON.parse(localStorage.getItem("clay-settings")) || {};
            stored.RefreshToken = refreshToken;
            stored.AccessToken = "";
            stored.TokenExpiresAt = 0;
            accessToken = "";
            tokenExpiresAt = 0;
            localStorage.setItem("clay-settings", JSON.stringify(stored));

            console.log("[PKJS] Refresh token saved. Authenticating immediately...");
            ensureAuthenticated(function (err) {
                if (!err) {
                    fetchPrusaData();
                }
            });
        }
    } catch (err) {
        console.log("[PKJS] Error parsing webviewclosed response: " + err);
    }
});