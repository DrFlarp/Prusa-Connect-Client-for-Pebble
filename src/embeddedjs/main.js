import PebbleButton from "pebble/button";
import Vibes from "pebble/vibes";

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
// Application Controller & State
// ---------------------------------------------------------------------------

let currentScreen = SCREEN_MAIN;
let reminderActive = false;

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
                if (button === "select" && printerState.status.toLowerCase() !== "stopped") {
                    // Navigate to Stop Print confirmation
                    currentScreen = SCREEN_STOP_CONFIRM;
                    drawCurrentScreen();
                } else if (button === "down") {
                    // Navigate to Set Reminder
                    currentScreen = SCREEN_REMINDER;
                    drawCurrentScreen();
                }
                break;

            case SCREEN_STOP_CONFIRM:
                if (button === "up") {
                    // Confirm abort print: notify companion phone app & vibrate
                    prusa.sendStopSignal();
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
                    // Confirm completion reminder
                    reminderActive = true;
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