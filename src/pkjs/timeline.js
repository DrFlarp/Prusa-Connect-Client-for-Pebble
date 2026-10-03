/**
 * Pebble Timeline Pin Manager.
 * Syncs print completion notifications to the Pebble timeline.
 */

var TIMELINE_PIN_ID = "prusa-print-finish";

function syncTimelinePin(printerName, fileName, progress, completionTime) {
    if (!Pebble.insertTimelinePin) {
        console.log("[Timeline] Pebble.insertTimelinePin is not supported in this environment.");
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

    console.log("[Timeline] Syncing pin for: " + completionDate.toISOString());
    Pebble.insertTimelinePin(pin, function () {
        console.log("[Timeline] Pin inserted successfully.");
    }, function (err) {
        console.log("[Timeline] Pin insert error: " + JSON.stringify(err));
    });
}

function removeTimelinePin() {
    if (!Pebble.deleteTimelinePin) {
        return;
    }

    console.log("[Timeline] Deleting timeline pin: " + TIMELINE_PIN_ID);
    Pebble.deleteTimelinePin(TIMELINE_PIN_ID, function () {
        console.log("[Timeline] Pin deleted successfully.");
    }, function (err) {
        console.log("[Timeline] Pin delete error: " + JSON.stringify(err));
    });
}

module.exports = {
    syncTimelinePin: syncTimelinePin,
    removeTimelinePin: removeTimelinePin
};
