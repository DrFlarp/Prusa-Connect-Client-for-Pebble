var moddableProxy = require("@moddable/pebbleproxy");
var Clay = require("@rebble/clay");
var clayConfig = require("./config");
var clay = new Clay(clayConfig, null, { autoHandleEvents: false });

var API_KEY = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkhTSU53OXQzalhZd0lGaUcxNWVleW1BNlJscFFwVW5veTFrOG0wTW4yM0EiLCJ0eXAiOiJKV1QifQ.eyJqdGkiOiI3ODkwYWU2OWMwNjA0NGEzYTFkOGJiODM5MGFkMzM1YyIsInN1YiI6IjE5NTk3NjQiLCJleHAiOjE3OTA5NDI1NTguMDg5OTgxLCJzaWQiOiI3MDg4MGJiZC03MjgyLTRkNmEtYmRkMC01ZDlhODdhNDg3NWMiLCJhcHAiOiJjb25uZWN0IiwidHlwZSI6ImFjY2VzcyIsInNjb3BlIjoiYmFzaWNfaW5mbyB1c2VyX29wZXJhdGlvbnMgZW1haWxfbGlzdHMgb3BlbmlkIGNvbm5lY3QiLCJjb25uZWN0X2lkIjoiNjg2MjUifQ.sK_UzqBSmDQXveEld8ouMbzxhpWjAbyQ50DA5k_d_dG9YcHmaBOLMKL9kw6emd3aFct-yS75FExFZx3dfh-CM843E3SlPVEe-_fx89m34pS9Y2lOft8Z98IrKOc9Y7c2P5WlQO5SHRxBmwbl5_V2P0888-PwNeXQ3N9eWl3e_H6MI9c1EDAqYHQyMQaoCui9BZSLS4kePC8e7BDIt65t2SiFdY21hG8cZCLUYxJ3UiPYVrjwQP98AI-puhBkIf_txwLJpcWfvVfAfFPduIoDCt7FMd_RJPhhChZIF3xE2uoh4k99kmpBTIERFEt1PFI3BbQVVgcUFxjvYRUFEMxG0w"
try {
    var storedSettings = JSON.parse(localStorage.getItem("clay-settings")) || {};
    if (storedSettings.ApiKey) {
        API_KEY = storedSettings.ApiKey;
        console.log("[PKJS] Loaded API key from stored Clay settings.");
    }
} catch (e) {
    console.log("[PKJS] Error reading stored settings: " + e);
}

var PRUSA_API_URL = "https://connect.prusa3d.com/app/printers";
var POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

var pollTimer = null;

var cachedPrinterId = null;
var cachedPrinterName = null;

function fetchPrusaData(callback) {
    console.log("[PKJS] Polling Prusa Connect...");
    var xhr = new XMLHttpRequest();
    xhr.open("GET", PRUSA_API_URL, true);
    xhr.setRequestHeader("Authorization", "Bearer " + API_KEY);
    xhr.setRequestHeader("Accept", "*/*");
    xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

    xhr.onload = function () {
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
    var stopUrl = "https://connect.prusa3d.com/app/printers/" + printerId + "/commands/sync";
    console.log("[PKJS] Sending STOP_PRINT POST request to: " + stopUrl);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", stopUrl, true);
    xhr.setRequestHeader("Authorization", "Bearer " + API_KEY);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json, */*");
    xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

    xhr.onload = function () {
        console.log("[PKJS] Stop print response status: " + xhr.status + " body: " + xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
            console.log("[PKJS] Stop print command succeeded!");
            removeTimelinePin();
            // Update watch telemetry to stopped
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
    clay.setSettings("ApiKey", API_KEY);
    Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener("webviewclosed", function (e) {
    console.log("[PKJS] Webview closed: " + (e ? e.response : "null"));
    if (!e || !e.response) {
        return;
    }

    try {
        var settings = clay.getSettings(e.response, false);
        console.log("[PKJS] Clay settings parsed: " + JSON.stringify(settings));
        if (settings && settings.ApiKey) {
            var newKey = (typeof settings.ApiKey === "object") ? settings.ApiKey.value : settings.ApiKey;
            if (newKey && typeof newKey === "string" && newKey.trim() !== "") {
                API_KEY = newKey.trim();
                console.log("[PKJS] Updated API_KEY from settings page. Polling Prusa Connect immediately...");
                fetchPrusaData();
            }
        }
    } catch (err) {
        console.log("[PKJS] Error parsing webviewclosed response: " + err);
    }
});