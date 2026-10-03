/**
 * Available screen views in the application.
 */
export const SCREEN_MAIN = 0;
export const SCREEN_STOP_CONFIRM = 1;
export const SCREEN_REMINDER = 2;
export const SCREEN_FINISHED = 3;
export const SCREEN_NOT_CONFIGURED = 4;

/**
 * Current printer telemetry and UI state.
 */
export const printerState = {
    printerName: "Prusa Connect",
    fileName: "Connecting...",
    status: "Idle",
    progress: 0,
    completionTime: "",
    finishClock: "--:--",
    isConfigured: false,
    isReminderSet: false
};
