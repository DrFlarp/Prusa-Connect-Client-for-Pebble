import {
    render,
    COLOR_CORAL,
    COLOR_BLACK,
    COLOR_WHITE,
    COLOR_GREEN,
    COLOR_GRAY,
    fontHeader,
    fontTitle,
    fontBody,
    fontSmall,
    truncateText
} from "./theme";

import {
    draw3DPrinter,
    drawCheckmark,
    drawCross,
    drawStopSquare,
    drawAlarmClock,
    drawKey
} from "./icons";

/**
 * 1. MAIN MONITORING SCREEN (Active print / Idle status)
 */
export function renderMainScreen(state) {
    const isStopped = state.status.toLowerCase() === "stopped";
    const isPrinting = state.status.toLowerCase() === "printing";

    // Background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Coral header bar with printer name
    render.fillRectangle(COLOR_CORAL, 0, 0, screen.width, 32);
    render.drawText(state.printerName, fontHeader, COLOR_BLACK, 6, 7);

    // File name
    const displayFile = truncateText(state.fileName, fontTitle, 160);
    render.drawText(displayFile, fontTitle, COLOR_WHITE, 6, 38);

    // Status label
    render.drawText(`Status: ${state.status}`, fontBody, COLOR_WHITE, 6, 66);

    // Progress bar frame
    const barX = 6;
    const barY = 92;
    const barW = 144;
    const barH = 16;
    render.fillRectangle(COLOR_WHITE, barX, barY, barW, 2);
    render.fillRectangle(COLOR_WHITE, barX, barY + barH - 2, barW, 2);
    render.fillRectangle(COLOR_WHITE, barX, barY, 2, barH);
    render.fillRectangle(COLOR_WHITE, barX + barW - 2, barY, 2, barH);

    // Fill progress bar according to percentage
    const fillWidth = Math.max(0, Math.min(barW - 4, Math.round((barW - 4) * (state.progress / 100))));
    if (fillWidth > 0) {
        render.fillRectangle(COLOR_CORAL, barX + 2, barY + 2, fillWidth, barH - 4);
    }

    // Centered percentage text below progress bar
    const percentStr = `${state.progress}%`;
    const percentW = render.getTextWidth(percentStr, fontBody);
    const percentX = barX + Math.round((barW - percentW) / 2);
    render.drawText(percentStr, fontBody, COLOR_WHITE, percentX, 114);

    // Estimated finish time
    let finishStr = !isPrinting ? "Finish: --:--" : `Finish: ${state.finishClock}`;
    if (isPrinting && state.isReminderSet) {
        finishStr += " (Set)";
    }
    render.drawText(finishStr, fontBody, COLOR_WHITE, 6, 138);

    // Hardware button action cues
    if (isPrinting) {
        // UP button -> Stop Square (active printing only)
        drawStopSquare(176, 38, COLOR_CORAL);
    }
    if (isPrinting || isStopped) {
        // DOWN button -> Alarm clock (Green when active/set, White otherwise)
        const clockColor = state.isReminderSet ? COLOR_GREEN : COLOR_WHITE;
        drawAlarmClock(174, 192, clockColor);
    }
}

/**
 * 2. STOP PRINT CONFIRMATION SCREEN
 */
export function renderStopConfirmScreen(state) {
    // Full coral background
    render.fillRectangle(COLOR_CORAL, 0, 0, screen.width, screen.height);

    // Header title
    render.drawText("STOP PRINT?", fontTitle, COLOR_WHITE, 8, 12);

    // 3D Printer Graphic with black printed model on coral background
    draw3DPrinter(20, 48, COLOR_BLACK, true);

    // Abort prompt
    render.drawText("Abort print job?", fontBody, COLOR_WHITE, 8, 114);

    const displayFile = truncateText(state.fileName, fontSmall, 155);
    render.drawText(displayFile, fontSmall, COLOR_WHITE, 8, 140);

    // Action cues: UP = confirm (checkmark), DOWN = cancel (cross)
    drawCheckmark(176, 38, COLOR_GREEN);
    drawCross(176, 174, COLOR_WHITE);
}

/**
 * 3. SET REMINDER SCREEN
 */
export function renderReminderScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    if (state.isReminderSet) {
        // Coral header
        render.fillRectangle(COLOR_CORAL, 0, 0, screen.width, 32);
        render.drawText("REMINDER ACTIVE", fontHeader, COLOR_BLACK, 8, 7);

        // 3D Printer Graphic with green completed model
        draw3DPrinter(20, 48, COLOR_GREEN, false);

        // Reminder prompt
        render.drawText("Alarm already set!", fontBody, COLOR_GREEN, 8, 114);
        render.drawText(`Est: ${state.finishClock}`, fontBody, COLOR_WHITE, 8, 136);
        render.drawText("Cancel alarm?", fontSmall, COLOR_GRAY, 8, 160);

        // Action cues: UP = turn off (cross), DOWN = keep (checkmark)
        drawCross(176, 38, COLOR_CORAL);
        drawCheckmark(176, 174, COLOR_GREEN);
    } else {
        // Coral header
        render.fillRectangle(COLOR_CORAL, 0, 0, screen.width, 32);
        render.drawText("SET REMINDER", fontHeader, COLOR_BLACK, 8, 7);

        // 3D Printer Graphic
        draw3DPrinter(20, 48, COLOR_CORAL, false);

        // Reminder prompt
        render.drawText("Notify when done?", fontBody, COLOR_WHITE, 8, 114);
        render.drawText(`Est: ${state.finishClock}`, fontBody, COLOR_CORAL, 8, 140);

        // Action cues: UP = confirm (checkmark), DOWN = cancel (cross)
        drawCheckmark(176, 38, COLOR_GREEN);
        drawCross(176, 174, COLOR_WHITE);
    }
}

/**
 * 4. PRINT FINISHED SCREEN
 */
export function renderFinishedScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Coral header
    render.fillRectangle(COLOR_CORAL, 0, 0, screen.width, 32);
    render.drawText("PRINT FINISHED!", fontHeader, COLOR_BLACK, 8, 7);

    // 3D Printer Graphic with green completed model
    draw3DPrinter(20, 48, COLOR_GREEN, false);

    // File name
    const displayFile = truncateText(state.fileName, fontBody, 155);
    render.drawText(displayFile, fontBody, COLOR_WHITE, 8, 108);

    // Status in vibrant green
    render.drawText("Ready to remove!", fontBody, COLOR_GREEN, 8, 134);

    // Subtitle in gray
    render.drawText("Bed cooling down", fontSmall, COLOR_GRAY, 8, 158);

    // Action cue: SELECT = dismiss (checkmark)
    drawCheckmark(176, 106, COLOR_GREEN);
}

/**
 * 5. NOT CONFIGURED / MISSING KEYS SCREEN
 */
export function renderNotConfiguredScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Coral header bar
    render.fillRectangle(COLOR_CORAL, 0, 0, screen.width, 32);
    render.drawText("PRUSA CONNECT", fontHeader, COLOR_BLACK, 8, 7);

    // Key icon in coral
    const keyX = Math.round((screen.width - 40) / 2);
    drawKey(keyX, 42, COLOR_CORAL);

    // Setup title
    const titleText = "Setup Required";
    const titleW = render.getTextWidth(titleText, fontTitle);
    const titleX = Math.max(6, Math.round((screen.width - titleW) / 2));
    render.drawText(titleText, fontTitle, COLOR_WHITE, titleX, 74);

    // Setup instructions
    render.drawText("Open Pebble app on", fontSmall, COLOR_WHITE, 12, 108);
    render.drawText("phone, go to Settings,", fontSmall, COLOR_WHITE, 12, 128);
    render.drawText("and enter your Prusa", fontSmall, COLOR_WHITE, 12, 148);
    render.drawText("Account credentials.", fontSmall, COLOR_WHITE, 12, 168);

    render.drawText("Press SELECT to retry", fontSmall, COLOR_GRAY, 12, 198);
}
