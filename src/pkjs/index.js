var moddableProxy = require("@moddable/pebbleproxy");

var API_KEY = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkhTSU53OXQzalhZd0lGaUcxNWVleW1BNlJscFFwVW5veTFrOG0wTW4yM0EiLCJ0eXAiOiJKV1QifQ.eyJqdGkiOiI3ODkwYWU2OWMwNjA0NGEzYTFkOGJiODM5MGFkMzM1YyIsInN1YiI6IjE5NTk3NjQiLCJleHAiOjE3OTA5NDI1NTguMDg5OTgxLCJzaWQiOiI3MDg4MGJiZC03MjgyLTRkNmEtYmRkMC01ZDlhODdhNDg3NWMiLCJhcHAiOiJjb25uZWN0IiwidHlwZSI6ImFjY2VzcyIsInNjb3BlIjoiYmFzaWNfaW5mbyB1c2VyX29wZXJhdGlvbnMgZW1haWxfbGlzdHMgb3BlbmlkIGNvbm5lY3QiLCJjb25uZWN0X2lkIjoiNjg2MjUifQ.sK_UzqBSmDQXveEld8ouMbzxhpWjAbyQ50DA5k_d_dG9YcHmaBOLMKL9kw6emd3aFct-yS75FExFZx3dfh-CM843E3SlPVEe-_fx89m34pS9Y2lOft8Z98IrKOc9Y7c2P5WlQO5SHRxBmwbl5_V2P0888-PwNeXQ3N9eWl3e_H6MI9c1EDAqYHQyMQaoCui9BZSLS4kePC8e7BDIt65t2SiFdY21hG8cZCLUYxJ3UiPYVrjwQP98AI-puhBkIf_txwLJpcWfvVfAfFPduIoDCt7FMd_RJPhhChZIF3xE2uoh4k99kmpBTIERFEt1PFI3BbQVVgcUFxjvYRUFEMxG0w"
var PRUSA_API_URL = "https://connect.prusa3d.com/app/printers";
var POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

var pollTimer = null;

function fetchPrusaData() {
    console.log("[PKJS] Polling Prusa Connect...");
    var xhr = new XMLHttpRequest();
    xhr.open("GET", PRUSA_API_URL, true);
    xhr.setRequestHeader("Authorization", "Bearer " + API_KEY);
    xhr.setRequestHeader("Accept", "*/*");
    xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

    xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
            console.log("[PKJS] HTTP error: " + xhr.status);
            return;
        }

        try {
            var data = JSON.parse(xhr.responseText);
            if (!data.printers || data.printers.length === 0) {
                console.log("[PKJS] No printers found on account.");
                return;
            }

            var printer = data.printers[0];
            var printerName = printer.name || printer.printer_type_name || "Prusa Printer";

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

            console.log("[PKJS] Sending update -> Printer: " + printerName + ", Progress: " + progress + "%, File: " + fileName + ", Completion: " + completionTime);

            moddableProxy.sendAppMessage({
                Progress: progress,
                FileName: fileName,
                PrinterName: printerName,
                CompletionTime: completionTime
            });
        } catch (e) {
            console.log("[PKJS] JSON parse error: " + e);
        }
    };

    xhr.onerror = function () {
        console.log("[PKJS] Network request failed.");
    };

    xhr.send();
}

function handleStopSignal() {
    console.log("[PKJS] StopSignal received from watch! Triggering stop print API...");
    // TODO: Connect this to Prusa Connect stop print API endpoint when ready
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