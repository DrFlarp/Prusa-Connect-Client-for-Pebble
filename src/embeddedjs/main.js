import PebbleButton from "pebble/button";
import Vibes from "pebble/vibes";
import WakeUp from "pebble/wakeup";

import { render } from "./theme";
import {
    SCREEN_MAIN,
    SCREEN_STOP_CONFIRM,
    SCREEN_REMINDER,
    SCREEN_FINISHED,
    SCREEN_NOT_CONFIGURED,
    SCREEN_PAUSE_CONFIRM,
    SCREEN_RESUME_CONFIRM,
    printerState
} from "./state";
import {
    renderMainScreen,
    renderStopConfirmScreen,
    renderReminderScreen,
    renderFinishedScreen,
    renderNotConfiguredScreen,
    renderPauseConfirmScreen,
    renderResumeConfirmScreen
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
        localStorage.removeItem(STORAGE_KEY_REMINDER);
        reminderActive = false;
        printerState.isReminderSet = false;
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
            localStorage.setItem(STORAGE_KEY_REMINDER, "1");
            reminderActive = true;
            printerState.isReminderSet = true;
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

const STORAGE_KEY_CONFIGURED = "prusa_is_configured";
const STORAGE_KEY_STATUS = "prusa_last_status";
const STORAGE_KEY_FILE = "prusa_last_file";
const STORAGE_KEY_PRINTER = "prusa_last_printer";
const STORAGE_KEY_PROGRESS = "prusa_last_progress";
const STORAGE_KEY_REMINDER = "prusa_reminder_active";

function persistPrinterState() {
    try {
        if (typeof localStorage !== "undefined" && localStorage && localStorage.setItem) {
            localStorage.setItem(STORAGE_KEY_STATUS, printerState.status);
            localStorage.setItem(STORAGE_KEY_FILE, printerState.fileName);
            localStorage.setItem(STORAGE_KEY_PRINTER, printerState.printerName);
            localStorage.setItem(STORAGE_KEY_PROGRESS, String(printerState.progress));
        }
    } catch (e) {}
}

let previouslyConfigured = false;
try {
    if (typeof localStorage !== "undefined" && localStorage && localStorage.getItem) {
        previouslyConfigured = (localStorage.getItem(STORAGE_KEY_CONFIGURED) === "1");
        const lastStatus = localStorage.getItem(STORAGE_KEY_STATUS);
        const lastFile = localStorage.getItem(STORAGE_KEY_FILE);
        const lastPrinter = localStorage.getItem(STORAGE_KEY_PRINTER);
        const lastProgress = localStorage.getItem(STORAGE_KEY_PROGRESS);

        if (lastStatus) {
            printerState.status = lastStatus;
        }
        if (lastFile) {
            printerState.fileName = lastFile;
        }
        if (lastPrinter) {
            printerState.printerName = lastPrinter;
        }
        if (lastProgress !== null && lastProgress !== undefined) {
            printerState.progress = parseInt(lastProgress, 10) || 0;
        }
    }
} catch (e) {}

// Check if app was launched by a wakeup event or if credentials need configuration
let initialScreen = previouslyConfigured ? SCREEN_MAIN : SCREEN_NOT_CONFIGURED;
try {
    if (typeof watch !== "undefined" && watch.wake) {
        console.log(`App launched by WakeUp id=${watch.wake.id}, cookie=${watch.wake.cookie}`);
        cancelReminder();
        playReminderAlarm();
        initialScreen = SCREEN_FINISHED;
    }
} catch (e) {
    console.log("Wakeup launch check error: " + e);
}

let currentScreen = initialScreen;
let reminderActive = false;
try {
    const storedWakeup = localStorage.getItem(STORAGE_KEY_WAKEUP_ID);
    const storedActive = localStorage.getItem(STORAGE_KEY_REMINDER);
    if (storedWakeup && storedActive === "1") {
        reminderActive = true;
        printerState.isReminderSet = true;
    }
} catch (e) {}

const SCREENSHOT_MODE = false;
const SCREENSHOT_SCREEN = "MAIN";
if (SCREENSHOT_MODE) {
    printerState.printerName = "Original Prusa MK4S";
    printerState.fileName = "gear_bearing.bgcode";
    printerState.status = (SCREENSHOT_SCREEN === "PAUSED" || SCREENSHOT_SCREEN === "RESUME") ? "Paused" : "Printing";
    printerState.progress = 68;
    printerState.finishClock = "23:45";
    printerState.isConfigured = true;
    printerState.isReminderSet = true;
    reminderActive = true;
    if (SCREENSHOT_SCREEN === "MAIN" || SCREENSHOT_SCREEN === "PAUSED") {
        currentScreen = SCREEN_MAIN;
    } else if (SCREENSHOT_SCREEN === "STOP") {
        currentScreen = SCREEN_STOP_CONFIRM;
    } else if (SCREENSHOT_SCREEN === "RESUME") {
        currentScreen = SCREEN_RESUME_CONFIRM;
    } else if (SCREENSHOT_SCREEN === "REMINDER") {
        currentScreen = SCREEN_REMINDER;
    } else if (SCREENSHOT_SCREEN === "FINISHED") {
        currentScreen = SCREEN_FINISHED;
    }
}

let currentButtonHandler = null;

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
            setScreen(SCREEN_FINISHED);
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
        case SCREEN_NOT_CONFIGURED:
            renderNotConfiguredScreen(printerState);
            break;
        case SCREEN_PAUSE_CONFIRM:
            renderPauseConfirmScreen(printerState);
            break;
        case SCREEN_RESUME_CONFIRM:
            renderResumeConfirmScreen(printerState);
            break;
    }
    render.end();
}

/**
 * Configure hardware buttons dynamically based on active screen.
 * On SCREEN_MAIN and SCREEN_NOT_CONFIGURED, "back" is omitted so the Pebble OS
 * default action (pop window and close app) runs. On confirmation screens,
 * "back" is captured to decline and return to the main screen.
 */
function setupButtonsForScreen(screenId) {
    if (currentButtonHandler) {
        currentButtonHandler.close();
        currentButtonHandler = null;
    }

    if (screenId === SCREEN_MAIN) {
        currentButtonHandler = new PebbleButton({
            types: ["up", "down", "select"],
            single: true,
            onPush(pushed, button) {
                const isPrinting = printerState.status.toLowerCase() === "printing";
                const isPaused = printerState.status.toLowerCase() === "paused";
                const isStopped = printerState.status.toLowerCase() === "stopped";
                if (button === "up") {
                    if (isPrinting || isPaused) {
                        setScreen(SCREEN_STOP_CONFIRM);
                    } else {
                        prusa.requestRefresh();
                    }
                } else if (button === "select") {
                    if (isPrinting) {
                        setScreen(SCREEN_PAUSE_CONFIRM);
                    } else if (isPaused) {
                        setScreen(SCREEN_RESUME_CONFIRM);
                    } else {
                        prusa.requestRefresh();
                    }
                } else if (button === "down" && (isPrinting || isPaused || isStopped)) {
                    setScreen(SCREEN_REMINDER);
                }
            }
        });
    } else if (screenId === SCREEN_NOT_CONFIGURED) {
        // Allow back to exit cleanly to watchface; select/up triggers refresh
        currentButtonHandler = new PebbleButton({
            types: ["up", "down", "select"],
            single: true,
            onPush(pushed, button) {
                if (button === "select" || button === "up") {
                    try { Vibes.shortPulse(); } catch {}
                    prusa.requestRefresh();
                }
            }
        });
    } else {
        currentButtonHandler = new PebbleButton({
            types: ["up", "down", "select", "back"],
            single: true,
            onPush(pushed, button) {
                switch (currentScreen) {
                    case SCREEN_STOP_CONFIRM:
                        if (button === "up") {
                            // Confirm abort print: notify companion phone app, cancel reminder & vibrate
                            prusa.sendStopSignal();
                            cancelReminder();
                            reminderActive = false;
                            printerState.status = "Stopped";
                            persistPrinterState();
                            try { Vibes.shortPulse(); } catch {}
                            setScreen(SCREEN_MAIN);
                        } else if (button === "down" || button === "back") {
                            // Decline abort print confirmation
                            setScreen(SCREEN_MAIN);
                        }
                        break;

                    case SCREEN_PAUSE_CONFIRM:
                        if (button === "up") {
                            // Confirm pause print
                            console.log("User confirmed pause print.");
                            prusa.sendPauseSignal();
                            printerState.status = "Paused";
                            persistPrinterState();
                            try { Vibes.shortPulse(); } catch {}
                            setScreen(SCREEN_MAIN);
                        } else if (button === "down" || button === "back") {
                            // Decline pause confirmation
                            setScreen(SCREEN_MAIN);
                        }
                        break;

                    case SCREEN_RESUME_CONFIRM:
                        if (button === "up") {
                            // Confirm resume print
                            console.log("User confirmed resume print.");
                            prusa.sendResumeSignal();
                            printerState.status = "Printing";
                            persistPrinterState();
                            try { Vibes.shortPulse(); } catch {}
                            setScreen(SCREEN_MAIN);
                        } else if (button === "down" || button === "back") {
                            // Decline resume confirmation
                            setScreen(SCREEN_MAIN);
                        }
                        break;

                    case SCREEN_REMINDER:
                        if (button === "up") {
                            if (reminderActive) {
                                // Turn off / cancel active reminder
                                console.log("User turned off active reminder.");
                                cancelReminder();
                                reminderActive = false;
                                printerState.isReminderSet = false;
                                try { Vibes.shortPulse(); } catch {}
                                setScreen(SCREEN_MAIN);
                            } else {
                                // Confirm reminder
                                console.log("User confirmed reminder. Scheduling WakeUp...");
                                const id = scheduleReminder(printerState.completionTime);
                                reminderActive = (id !== null);
                                printerState.isReminderSet = reminderActive;
                                try { Vibes.shortPulse(); } catch {}
                                setScreen(SCREEN_MAIN);
                            }
                        } else if (button === "down" || button === "back") {
                            // Decline reminder confirmation
                            setScreen(SCREEN_MAIN);
                        }
                        break;

                    case SCREEN_FINISHED:
                        if (button === "select" || button === "back") {
                            // Dismiss finished view
                            setScreen(SCREEN_MAIN);
                        }
                        break;
                }
            }
        });
    }
}

/**
 * Transitions to a new screen and reconfigures buttons and graphics.
 */
function setScreen(newScreen) {
    currentScreen = newScreen;
    setupButtonsForScreen(currentScreen);
    drawCurrentScreen();
}

/**
 * Handle incoming telemetry updates from Prusa Connect via PKJS.
 */
prusa.addEventListener((state) => {
    if (SCREENSHOT_MODE) return;
    if (state.configured !== undefined) {
        if (state.configured === 0) {
            printerState.isConfigured = false;
            try { localStorage.setItem(STORAGE_KEY_CONFIGURED, "0"); } catch {}
            if (currentScreen !== SCREEN_NOT_CONFIGURED) {
                setScreen(SCREEN_NOT_CONFIGURED);
            }
            return;
        } else if (state.configured === 1) {
            printerState.isConfigured = true;
            try { localStorage.setItem(STORAGE_KEY_CONFIGURED, "1"); } catch {}
            if (currentScreen === SCREEN_NOT_CONFIGURED) {
                setScreen(SCREEN_MAIN);
            }
        }
    } else if (state.fileName && state.fileName !== "Setup Required" && state.fileName !== "Token Invalid" && state.fileName !== "Connecting...") {
        printerState.isConfigured = true;
        try { localStorage.setItem(STORAGE_KEY_CONFIGURED, "1"); } catch {}
        if (currentScreen === SCREEN_NOT_CONFIGURED) {
            setScreen(SCREEN_MAIN);
        }
    }

    printerState.printerName = state.printerName || printerState.printerName;
    printerState.fileName = state.fileName || printerState.fileName;
    printerState.progress = (state.progress !== undefined) ? state.progress : printerState.progress;
    printerState.completionTime = state.completionTime || "";

    if (state.completionTime) {
        printerState.finishClock = PrusaConnect.formatCompletionClock(state.completionTime);
    } else {
        printerState.finishClock = "--:--";
    }

    if (state.status) {
        printerState.status = state.status;
    } else if (state.fileName === "Print Stopped" || state.fileName === "Stopped") {
        printerState.status = "Stopped";
    } else if (printerState.progress > 0 && printerState.progress < 100) {
        printerState.status = "Printing";
    } else if (printerState.progress >= 100) {
        printerState.status = "Finished";
        if (currentScreen === SCREEN_MAIN) {
            try { Vibes.doublePulse(); } catch {}
            setScreen(SCREEN_FINISHED);
            return;
        }
    } else {
        printerState.status = "Idle";
    }

    if (printerState.status === "Stopped" || printerState.status === "Finished" || printerState.status === "Idle") {
        cancelReminder();
        reminderActive = false;
    }

    persistPrinterState();
    drawCurrentScreen();
});

// Initialize screen and buttons on app launch
setScreen(currentScreen);

export { prusa, drawCurrentScreen, currentScreen, reminderActive, setScreen };