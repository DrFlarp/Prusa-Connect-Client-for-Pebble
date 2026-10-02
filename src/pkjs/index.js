var moddableProxy = require("@moddable/pebbleproxy");
var Clay = require("@rebble/clay");
var clayConfig = require("./config");
var clay = new Clay(clayConfig, null, { autoHandleEvents: false });

var PRUSA_TOKEN_URL = "https://account.prusa3d.com/o/token/";
var PRUSA_CLIENT_ID = "MRHTlZhZqkNrrQ6FUPtjyusAz8nc59ErHXP8XkS4";
var PRUSA_API_URL = "https://connect.prusa3d.com/app/printers";
var POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

var prusaEmail = "";
var prusaPassword = "";
var accessToken = "";
var refreshToken = "";
var tokenExpiresAt = 0;

var isAuthenticating = false;
var authQueue = [];

var pollTimer = null;
var cachedPrinterId = null;
var cachedPrinterName = null;

function loadSettings() {
    try {
        var stored = JSON.parse(localStorage.getItem("clay-settings")) || {};
        prusaEmail = stored.Email ? (stored.Email.value || stored.Email) : "";
        prusaPassword = stored.Password ? (stored.Password.value || stored.Password) : "";
        accessToken = stored.AccessToken || "";
        refreshToken = stored.RefreshToken || "";
        tokenExpiresAt = stored.TokenExpiresAt || 0;

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
        console.log("[PKJS] Saved new tokens to storage. Expiry set to " + new Date(tokenExpiresAt).toLocaleTimeString());
    } catch (e) {
        console.log("[PKJS] Error saving tokens: " + e);
    }
}

function loginWithPassword(email, password, callback) {
    console.log("[PKJS] Authenticating with Prusa Account (email: " + email + ")...");
    var xhr = new XMLHttpRequest();
    xhr.open("POST", PRUSA_TOKEN_URL, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Accept", "application/json");

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                console.log("[PKJS] Login successful! Expires in " + data.expires_in + "s");
                saveTokens(data.access_token, data.refresh_token, data.expires_in);
                if (typeof callback === "function") callback(null, accessToken);
            } catch (e) {
                console.log("[PKJS] JSON parse error on login: " + e);
                if (typeof callback === "function") callback("Failed to parse login response: " + e);
            }
        } else {
            console.log("[PKJS] Login failed: " + xhr.status + " " + xhr.responseText);
            if (typeof callback === "function") callback("Login error: " + xhr.status + " (" + xhr.responseText + ")");
        }
    };

    xhr.onerror = function () {
        console.log("[PKJS] Network error during login.");
        if (typeof callback === "function") callback("Network error during login");
    };

    var body = "grant_type=password" +
        "&client_id=" + encodeURIComponent(PRUSA_CLIENT_ID) +
        "&username=" + encodeURIComponent(email) +
        "&password=" + encodeURIComponent(password) +
        "&scope=" + encodeURIComponent("basic_info user_operations email_lists openid connect");

    xhr.send(body);
}

function refreshAccessToken(callback) {
    if (!refreshToken) {
        if (prusaEmail && prusaPassword) {
            loginWithPassword(prusaEmail, prusaPassword, callback);
        } else if (typeof callback === "function") {
            callback("No refresh token or credentials configured.");
        }
        return;
    }

    console.log("[PKJS] Refreshing access token via refresh_token...");
    var xhr = new XMLHttpRequest();
    xhr.open("POST", PRUSA_TOKEN_URL, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Accept", "application/json");

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                console.log("[PKJS] Token refreshed successfully!");
                saveTokens(data.access_token, data.refresh_token, data.expires_in);
                if (typeof callback === "function") callback(null, accessToken);
            } catch (e) {
                console.log("[PKJS] JSON parse error on refresh: " + e);
                if (typeof callback === "function") callback("Failed to parse refresh response: " + e);
            }
        } else {
            console.log("[PKJS] Token refresh failed (status " + xhr.status + "). Retrying full password login...");
            if (prusaEmail && prusaPassword) {
                loginWithPassword(prusaEmail, prusaPassword, callback);
            } else if (typeof callback === "function") {
                callback("Refresh failed and no password available: " + xhr.status);
            }
        }
    };

    xhr.onerror = function () {
        console.log("[PKJS] Network error during token refresh.");
        if (typeof callback === "function") callback("Network error during token refresh");
    };

    var body = "grant_type=refresh_token" +
        "&client_id=" + encodeURIComponent(PRUSA_CLIENT_ID) +
        "&refresh_token=" + encodeURIComponent(refreshToken);

    xhr.send(body);
}

function ensureAuthenticated(callback) {
    // If we have an access token that hasn't expired yet, use it directly
    if (accessToken && Date.now() < tokenExpiresAt) {
        return callback(null, accessToken);
    }

    // Queue requests if an authentication or refresh is already running
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
        refreshAccessToken(finish);
    } else if (prusaEmail && prusaPassword) {
        loginWithPassword(prusaEmail, prusaPassword, finish);
    } else {
        finish("Not configured. Please enter your Prusa Account credentials in the phone app.");
    }
}

function fetchPrusaData(callback) {
    ensureAuthenticated(function (err, token) {
        if (err) {
            console.log("[PKJS] Cannot poll: " + err);
            if (typeof callback === "function") callback();
            return;
        }

        console.log("[PKJS] Polling Prusa Connect...");
        var xhr = new XMLHttpRequest();
        xhr.open("GET", PRUSA_API_URL, true);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("Accept", "*/*");
        xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

        xhr.onload = function () {
            if (xhr.status === 401) {
                console.log("[PKJS] Token expired (401). Forcing token refresh and retrying...");
                accessToken = "";
                tokenExpiresAt = 0;
                refreshAccessToken(function (refErr) {
                    if (!refErr) {
                        fetchPrusaData(callback);
                    } else if (typeof callback === "function") {
                        callback();
                    }
                });
                return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                console.log("[PKJS] HTTP error: " + xhr.status);
                if (typeof callback === "function") callback();
                return;
            }

            try {
                var data = JSON.parse(xhr.responseText);
                if (!data.printers || data.printers.length === 0) {
                    console.log("[PKJS] No printers found on account.");
                    if (typeof callback === "function") callback();
                    return;
                }

                var printer = data.printers[0];
                cachedPrinterId = printer.uuid || printer.id || printer.printer_id || "221f29ff-5a46-4410-bb43-ecdbae785068";
                cachedPrinterName = printer.name || printer.printer_type_name || "Prusa Printer";
                var printerName = cachedPrinterName;

                var progress = 0;
                var fileName = "No file";
                var completionTime = "";

                if (printer.job_info) {
                    progress = Math.round(printer.job_info.progress || 0);

                    if (printer.job_info.display_name) {
                        fileName = printer.job_info.display_name;
                    } else if (printer.job_info.path) {
                        fileName = printer.job_info.path.split("/").pop();
                    } else {
                        fileName = "Printing...";
                    }

                    var remainingSecs = printer.job_info.time_remaining || 0;
                    if (remainingSecs > 0) {
                        completionTime = new Date(Date.now() + remainingSecs * 1000).toISOString();
                    }
                }

                console.log("[PKJS] Sending update -> Printer: " + printerName + " (ID: " + cachedPrinterId + "), Progress: " + progress + "%, File: " + fileName + ", Completion: " + completionTime);

                moddableProxy.sendAppMessage({
                    Progress: progress,
                    FileName: fileName,
                    PrinterName: printerName,
                    CompletionTime: completionTime
                });

                if (completionTime && progress < 100) {
                    syncTimelinePin(printerName, fileName, progress, completionTime);
                } else if (progress >= 100) {
                    removeTimelinePin();
                }
            } catch (e) {
                console.log("[PKJS] JSON parse error: " + e);
            }

            if (typeof callback === "function") callback();
        };

        xhr.onerror = function () {
            console.log("[PKJS] Network request failed.");
            if (typeof callback === "function") callback();
        };

        xhr.send();
    });
}

var TIMELINE_PIN_ID = "prusa-print-finish";

function syncTimelinePin(printerName, fileName, progress, completionTime) {
    if (!Pebble.insertTimelinePin) {
        console.log("[PKJS] Pebble.insertTimelinePin is not supported in this environment.");
        return;
    }

    var completionDate = new Date(completionTime);
    var reminderDate = new Date(completionDate.getTime() - 5 * 60 * 1000);
    var now = new Date();
    if (reminderDate <= now) {
        reminderDate = completionDate;
    }

    var pin = {
        id: TIMELINE_PIN_ID,
        time: completionTime,
        layout: {
            type: "genericPin",
            title: "Print Complete",
            subtitle: printerName + " (" + progress + "%)",
            body: "File: " + fileName + "\nPrinter: " + printerName + "\nProgress: " + progress + "%",
            tinyIcon: "system://images/ALARM_CLOCK"
        },
        reminders: [
            {
                time: reminderDate.toISOString(),
                layout: {
                    type: "genericReminder",
                    title: "Print Finishes Soon",
                    locationName: printerName,
                    tinyIcon: "system://images/ALARM_CLOCK"
                }
            }
        ],
        actions: [
            {
                title: "Open App",
                type: "openWatchApp"
            }
        ]
    };

    console.log("[PKJS] Inserting timeline pin for " + completionTime);
    Pebble.insertTimelinePin(pin, function (resp) {
        console.log("[PKJS] Timeline pin synced successfully: " + JSON.stringify(resp));
    }, function (err) {
        console.log("[PKJS] Timeline pin sync error: " + JSON.stringify(err));
    });
}

function removeTimelinePin() {
    if (!Pebble.deleteTimelinePin) {
        return;
    }

    console.log("[PKJS] Deleting timeline pin: " + TIMELINE_PIN_ID);
    Pebble.deleteTimelinePin(TIMELINE_PIN_ID, function () {
        console.log("[PKJS] Timeline pin deleted successfully.");
    }, function (err) {
        console.log("[PKJS] Timeline pin delete error: " + JSON.stringify(err));
    });
}

/**
 * Sends a STOP_PRINT command via POST to Prusa Connect API
 * Endpoint: https://connect.prusa3d.com/app/printers/<printer_id>/commands/sync
 */
function sendStopPrintCommand(printerId) {
    ensureAuthenticated(function (err, token) {
        if (err) {
            console.log("[PKJS] Cannot stop print, auth failed: " + err);
            return;
        }

        var stopUrl = "https://connect.prusa3d.com/app/printers/" + printerId + "/commands/sync";
        console.log("[PKJS] Sending STOP_PRINT POST request to: " + stopUrl);

        var xhr = new XMLHttpRequest();
        xhr.open("POST", stopUrl, true);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Accept", "application/json, */*");
        xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

        xhr.onload = function () {
            console.log("[PKJS] Stop print response status: " + xhr.status + " body: " + xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
                console.log("[PKJS] Stop print command succeeded!");
                removeTimelinePin();
                moddableProxy.sendAppMessage({
                    Progress: 0,
                    FileName: "Print Stopped",
                    PrinterName: cachedPrinterName || "Prusa Printer",
                    CompletionTime: ""
                });
                setTimeout(fetchPrusaData, 2000);
            } else {
                console.log("[PKJS] Stop print request failed with status: " + xhr.status);
            }
        };

        xhr.onerror = function () {
            console.log("[PKJS] Stop print network request failed.");
        };

        var payload = JSON.stringify({
            command: "STOP_PRINT",
            kwargs: {}
        });

        xhr.send(payload);
    });
}

function handleStopSignal() {
    console.log("[PKJS] StopSignal received from watch! Initiating stop print API...");
    removeTimelinePin();

    if (cachedPrinterId) {
        sendStopPrintCommand(cachedPrinterId);
    } else {
        console.log("[PKJS] Printer ID not yet cached, fetching printers first...");
        fetchPrusaData(function () {
            var printerId = cachedPrinterId || "221f29ff-5a46-4410-bb43-ecdbae785068";
            sendStopPrintCommand(printerId);
        });
    }
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
    moddableProxy.readyReceived(e);
    startPolling();
});

Pebble.addEventListener("appmessage", function (e) {
    if (moddableProxy.appMessageReceived(e)) {
        return;
    }

    if (e.payload && e.payload.StopSignal !== undefined) {
        handleStopSignal();
    }
});

Pebble.addEventListener("showConfiguration", function (e) {
    console.log("[PKJS] Showing Clay configuration page...");
    clay.setSettings("Email", prusaEmail);
    clay.setSettings("Password", prusaPassword);
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
        var newEmail = settings.Email ? (settings.Email.value || settings.Email) : "";
        var newPassword = settings.Password ? (settings.Password.value || settings.Password) : "";

        if (newEmail && newPassword) {
            prusaEmail = newEmail.trim();
            prusaPassword = newPassword;

            // Persist credentials
            var stored = JSON.parse(localStorage.getItem("clay-settings")) || {};
            stored.Email = prusaEmail;
            stored.Password = prusaPassword;
            // Invalidate old tokens
            stored.AccessToken = "";
            stored.RefreshToken = "";
            stored.TokenExpiresAt = 0;
            accessToken = "";
            refreshToken = "";
            tokenExpiresAt = 0;
            localStorage.setItem("clay-settings", JSON.stringify(stored));

            console.log("[PKJS] Credentials saved. Authenticating immediately...");
            loginWithPassword(prusaEmail, prusaPassword, function (err) {
                if (!err) {
                    fetchPrusaData();
                }
            });
        }
    } catch (err) {
        console.log("[PKJS] Error parsing webviewclosed response: " + err);
    }
});