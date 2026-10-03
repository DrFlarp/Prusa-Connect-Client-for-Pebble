/**
 * Prusa Connect API Client.
 * Handles fetching printer status and sending printer commands.
 */

var PRUSA_API_URL = "https://connect.prusa3d.com/app/printers";

/**
 * Fetch list of printers and their current job telemetry.
 */
function fetchPrinters(token, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", PRUSA_API_URL, true);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("Accept", "*/*");
    xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

    xhr.onload = function () {
        if (xhr.status === 401) {
            callback({ status: 401, error: "Token expired" });
            return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
            callback({ status: xhr.status, error: "HTTP error: " + xhr.status });
            return;
        }

        try {
            var data = JSON.parse(xhr.responseText);
            callback(null, data);
        } catch (e) {
            callback({ error: "JSON parse error: " + e });
        }
    };

    xhr.onerror = function () {
        callback({ error: "Network request failed" });
    };

    xhr.send();
}

/**
 * Sends a STOP_PRINT command to a given printer.
 */
function sendStopPrint(token, printerId, callback) {
    var stopUrl = PRUSA_API_URL + "/" + printerId + "/commands/sync";
    console.log("[API] Sending STOP_PRINT POST request to: " + stopUrl);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", stopUrl, true);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json, */*");
    xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

    xhr.onload = function () {
        console.log("[API] Stop print response status: " + xhr.status + " body: " + xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
            callback(null, xhr.responseText);
        } else {
            callback({ status: xhr.status, error: "Stop print failed: " + xhr.status });
        }
    };

    xhr.onerror = function () {
        callback({ error: "Stop print network request failed" });
    };

    var payload = JSON.stringify({
        command: "STOP_PRINT",
        kwargs: {}
    });

    xhr.send(payload);
}

/**
 * Sends a PAUSE_PRINT command to a given printer.
 */
function sendPausePrint(token, printerId, callback) {
    var pauseUrl = PRUSA_API_URL + "/" + printerId + "/commands/sync";
    console.log("[API] Sending PAUSE_PRINT POST request to: " + pauseUrl);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", pauseUrl, true);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json, */*");
    xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

    xhr.onload = function () {
        console.log("[API] Pause print response status: " + xhr.status + " body: " + xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
            callback(null, xhr.responseText);
        } else {
            callback({ status: xhr.status, error: "Pause print failed: " + xhr.status });
        }
    };

    xhr.onerror = function () {
        callback({ error: "Pause print network request failed" });
    };

    var payload = JSON.stringify({
        command: "PAUSE_PRINT",
        kwargs: {}
    });

    xhr.send(payload);
}

/**
 * Sends a RESUME_PRINT command to a given printer.
 */
function sendResumePrint(token, printerId, callback) {
    var resumeUrl = PRUSA_API_URL + "/" + printerId + "/commands/sync";
    console.log("[API] Sending RESUME_PRINT POST request to: " + resumeUrl);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", resumeUrl, true);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json, */*");
    xhr.setRequestHeader("User-Agent", "insomnia/13.3.0");

    xhr.onload = function () {
        console.log("[API] Resume print response status: " + xhr.status + " body: " + xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
            callback(null, xhr.responseText);
        } else {
            callback({ status: xhr.status, error: "Resume print failed: " + xhr.status });
        }
    };

    xhr.onerror = function () {
        callback({ error: "Resume print network request failed" });
    };

    var payload = JSON.stringify({
        command: "RESUME_PRINT",
        kwargs: {}
    });

    xhr.send(payload);
}

module.exports = {
    fetchPrinters: fetchPrinters,
    sendStopPrint: sendStopPrint,
    sendPausePrint: sendPausePrint,
    sendResumePrint: sendResumePrint
};
