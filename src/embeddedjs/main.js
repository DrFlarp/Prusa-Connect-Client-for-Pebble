import PebbleButton from "pebble/button";
import Vibes from "pebble/vibes";
import WakeUp from "pebble/wakeup";

import { render } from "./theme";
import {
    SCREEN_MAIN,
    SCREEN_STOP_CONFIRM,
    SCREEN_REMINDER,
    SCREEN_FINISHED,
    printerState
} from "./state";
import {
    renderMainScreen,
    renderStopConfirmScreen,
    renderReminderScreen,
    renderFinishedScreen
} from "./screens";
import PrusaConnect from "./prusa-api";

// ---------------------------------------------------------------------------
// WakeUp Reminder & Vibration Alarm
// ---------------------------------------------------------------------------

const REMINDER_COOKIE = 42;
const STORAGE_KEY_WAKEUP_ID = "prusa_wakeup_id";

/**
 * Perform a short vibration alarm when the reminder fires.
 */
function playReminderAlarm() {
    console.log("Playing reminder vibration alarm!");
    try {
        // Short distinctive alarm vibration: pulse 200ms, pause 100ms, pulse 200ms
        Vibes.pattern([200, 100, 200]);
    } catch {
        try {
            Vibes.shortPulse();
        } catch {}
    }
}

/**
 * Cancel any pending reminder wakeup.
 */
function cancelReminder() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_WAKEUP_ID);
        if (stored) {
            const id = parseInt(stored, 10);
            if (!isNaN(id)) {
                WakeUp.cancel(id);
                console.log(`Cancelled previous wakeup id=${id}`);
            }
            localStorage.removeItem(STORAGE_KEY_WAKEUP_ID);
        }
    } catch (err) {
        console.log("Cancel wakeup error: " + err);
    }
}

/**
 * Schedule a wakeup for when the print is estimated to finish.
 *
 * @param {string|number} completionTime - ISO date string or timestamp in ms.
 * @returns {number|null} The scheduled wakeup ID, or null on error.
 */
function scheduleReminder(completionTime) {
    cancelReminder();

    let targetMs = 0;
    if (typeof completionTime === "number" && !isNaN(completionTime)) {
        targetMs = completionTime;
    } else if (typeof completionTime === "string" && completionTime.length > 0) {
        const parsed = new Date(completionTime).getTime();
        targetMs = isNaN(parsed) ? 0 : parsed;
    }

    const now = Date.now();
    // Pebble WakeUp API requirement: timestamp must be at least 30 seconds into the future
    if (targetMs <= now + 30000) {
        // Fallback: 35 seconds from now if completion time is missing, in the past, or < 30s
        targetMs = now + 35000;
    }

    try {
        const id = WakeUp.schedule(targetMs, REMINDER_COOKIE, true);
        console.log(`Scheduled reminder wakeup id=${id} for ${new Date(targetMs).toISOString()}`);
        if (id !== undefined && id >= 0) {
            localStorage.setItem(STORAGE_KEY_WAKEUP_ID, String(id));
            return id;
        }
    } catch (err) {
        console.log("Failed to schedule wakeup: " + err);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Application Controller & State
// ---------------------------------------------------------------------------

let currentScreen = SCREEN_MAIN;
let reminderActive = false;

// Check if app was launched by a wakeup event
try {
    if (typeof watch !== "undefined" && watch.wake) {
        console.log(`App launched by WakeUp id=${watch.wake.id}, cookie=${watch.wake.cookie}`);
        cancelReminder();
        playReminderAlarm();
        currentScreen = SCREEN_FINISHED;
    }
} catch (e) {
    console.log("Wakeup launch check error: " + e);
}

// Listen for wakeup events while app is open in foreground
try {
    if (typeof watch !== "undefined" && watch.addEventListener) {
        watch.addEventListener("wakeup", (wake) => {
            console.log(`WakeUp event received while running: id=${wake.id}, cookie=${wake.cookie}`);
            try {
                WakeUp.cancel(wake.id);
            } catch {}
            cancelReminder();
            playReminderAlarm();
            reminderActive = false;
            currentScreen = SCREEN_FINISHED;
            drawCurrentScreen();
        });
    }
} catch (e) {
    console.log("Wakeup listener error: " + e);
}

const prusa = new PrusaConnect();

/**
 * Dispatch rendering of the currently active screen.
 */
function drawCurrentScreen() {
    render.begin();
    switch (currentScreen) {
        case SCREEN_MAIN:
            renderMainScreen(printerState);
            break;
        case SCREEN_STOP_CONFIRM:
            renderStopConfirmScreen(printerState);
            break;
        case SCREEN_REMINDER:
            renderReminderScreen(printerState);
            break;
        case SCREEN_FINISHED:
            renderFinishedScreen(printerState);
            break;
    }
    render.end();
}

/**
 * Handle incoming telemetry updates from Prusa Connect via PKJS.
 */
prusa.addEventListener((state) => {
    printerState.printerName = state.printerName || printerState.printerName;
    printerState.fileName = state.fileName || printerState.fileName;
    printerState.progress = (state.progress !== undefined) ? state.progress : printerState.progress;
    printerState.completionTime = state.completionTime || "";

    if (state.completionTime) {
        printerState.finishClock = PrusaConnect.formatCompletionClock(state.completionTime);
    }

    if (state.fileName === "Print Stopped" || state.fileName === "Stopped") {
        printerState.status = "Stopped";
        cancelReminder();
        reminderActive = false;
    }

    if (printerState.progress >= 100) {
        printerState.status = "Finished";
        if (currentScreen === SCREEN_MAIN) {
            currentScreen = SCREEN_FINISHED;
            try { Vibes.doublePulse(); } catch {}
        }
    }

    drawCurrentScreen();
});

// ---------------------------------------------------------------------------
// Hardware Button Navigation
// ---------------------------------------------------------------------------

new PebbleButton({
    types: ["up", "down", "select", "back"],
    single: true,
    onPush(pushed, button) {
        switch (currentScreen) {
            case SCREEN_MAIN:
                const isStopped = printerState.status.toLowerCase() === "stopped";
                if (button === "select" && !isStopped) {
                    // Navigate to Stop Print confirmation
                    currentScreen = SCREEN_STOP_CONFIRM;
                    drawCurrentScreen();
                } else if (button === "down" && !isStopped) {
                    // Navigate to Set Reminder
                    currentScreen = SCREEN_REMINDER;
                    drawCurrentScreen();
                }
                break;

            case SCREEN_STOP_CONFIRM:
                if (button === "up") {
                    // Confirm abort print: notify companion phone app, cancel reminder & vibrate
                    prusa.sendStopSignal();
                    cancelReminder();
                    reminderActive = false;
                    printerState.status = "Stopped";
                    try { Vibes.shortPulse(); } catch {}
                    currentScreen = SCREEN_MAIN;
                    drawCurrentScreen();
                } else if (button === "down" || button === "back") {
                    // Cancel abort print
                    currentScreen = SCREEN_MAIN;
                    drawCurrentScreen();
                }
                break;

            case SCREEN_REMINDER:
                if (button === "up") {
                    // Schedule WakeUp reminder for print finish
                    console.log("User confirmed reminder. Scheduling WakeUp...");
                    const id = scheduleReminder(printerState.completionTime);
                    reminderActive = (id !== null);
                    try { Vibes.shortPulse(); } catch {}
                    currentScreen = SCREEN_MAIN;
                    drawCurrentScreen();
                } else if (button === "down" || button === "back") {
                    // Dismiss reminder screen
                    currentScreen = SCREEN_MAIN;
                    drawCurrentScreen();
                }
                break;

            case SCREEN_FINISHED:
                if (button === "select" || button === "back") {
                    // Dismiss finished view
                    currentScreen = SCREEN_MAIN;
                    drawCurrentScreen();
                }
                break;
        }
    }
});

// Initial draw on app boot
drawCurrentScreen();

export { prusa, drawCurrentScreen, currentScreen, reminderActive };