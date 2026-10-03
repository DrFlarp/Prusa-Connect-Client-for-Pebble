/**
 * Pebble Timeline Pin Manager.
 * Syncs print completion notifications to the Pebble timeline
 * and cleans up stale pins when prints are stopped, aborted, or finished.
 */

var TIMELINE_PIN_ID = "prusa-print-finish";
var STORAGE_KEY_PIN_TIME = "prusa_timeline_pin_time";

/**
 * Delete any timeline pin for this app.
 */
function removeTimelinePin(callback) {
    if (!Pebble.deleteTimelinePin) {
        if (typeof callback === "function") callback();
        return;
    }

    try {
        localStorage.removeItem(STORAGE_KEY_PIN_TIME);
    } catch (e) {}

    console.log("[Timeline] Deleting timeline pin: " + TIMELINE_PIN_ID);
    Pebble.deleteTimelinePin(TIMELINE_PIN_ID, function () {
        console.log("[Timeline] Pin deleted successfully.");
        if (typeof callback === "function") callback(null);
    }, function (err) {
        console.log("[Timeline] Pin delete callback: " + JSON.stringify(err));
        if (typeof callback === "function") callback(err);
    });
}

/**
 * Validate timeline pin location and remove any stale pins.
 * Called whenever the app is opened or when printer telemetry updates.
 *
 * @param {string} status - Printer status (e.g. "Printing", "Stopped", "Finished", "Idle")
 * @param {string} completionTime - Current ISO completion time string, if any.
 * @param {string} printerName - Name of the printer.
 * @param {string} fileName - Current file name.
 * @param {number} progress - Current progress percentage.
 */
function validateAndSyncTimelinePin(status, completionTime, printerName, fileName, progress) {
    var isPrinting = (status === "Printing") && (progress < 100) && !!completionTime;
    var storedPinTime = null;
    try {
        storedPinTime = localStorage.getItem(STORAGE_KEY_PIN_TIME);
    } catch (e) {}

    if (!isPrinting) {
        // Print is stopped, aborted, finished, or idle: pin should NOT be anywhere in timeline!
        if (storedPinTime || status === "Stopped" || status === "Finished" || status === "Idle") {
            console.log("[Timeline] Print is " + status + ". Deleting stale timeline pin...");
            removeTimelinePin();
        }
        return;
    }

    // Print is actively printing. Where SHOULD the pin be?
    // It should be at completionTime. If storedPinTime exists and differs from completionTime,
    // the pin is somewhere it shouldn't be (stale location). Delete it first!
    if (storedPinTime && storedPinTime !== completionTime) {
        console.log("[Timeline] Pin time shifted from " + storedPinTime + " to " + completionTime + ". Cleaning stale pin first...");
        removeTimelinePin(function () {
            insertPin(printerName, fileName, progress, completionTime);
        });
    } else {
        insertPin(printerName, fileName, progress, completionTime);
    }
}

function insertPin(printerName, fileName, progress, completionTime) {
    if (!Pebble.insertTimelinePin) {
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
        time: completionDate.toISOString(),
        layout: {
            type: "genericPin",
            title: "Print Finished!",
            subtitle: fileName,
            body: printerName + " has finished printing " + fileName + ".",
            tinyIcon: "system://images/NOTIFICATION_FLAG",
            largeIcon: "system://images/NOTIFICATION_FLAG",
            primaryColor: "#FF4F00",
            backgroundColor: "#000000"
        },
        reminders: [
            {
                time: reminderDate.toISOString(),
                layout: {
                    type: "genericReminder",
                    title: "5 Minutes Remaining",
                    subtitle: fileName,
                    tinyIcon: "system://images/NOTIFICATION_FLAG"
                }
            }
        ]
    };

    console.log("[Timeline] Inserting pin for: " + completionDate.toISOString());
    Pebble.insertTimelinePin(pin, function () {
        console.log("[Timeline] Pin inserted successfully.");
        try {
            localStorage.setItem(STORAGE_KEY_PIN_TIME, completionTime);
        } catch (e) {}
    }, function (err) {
        console.log("[Timeline] Pin insert error: " + JSON.stringify(err));
    });
}

module.exports = {
    validateAndSyncTimelinePin: validateAndSyncTimelinePin,
    syncTimelinePin: validateAndSyncTimelinePin,
    removeTimelinePin: removeTimelinePin
};
