import {
    render,
    COLOR_CORAL,
    COLOR_ORANGE,
    COLOR_BLACK,
    COLOR_WHITE,
    COLOR_GREEN,
    COLOR_GRAY,
    COLOR_AMBER,
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
    drawPauseBars,
    drawPlayTriangle,
    drawKey
} from "./icons";

/**
 * Helper to compute centered X coordinate on a 260-pixel round display.
 */
function centerX(text, font) {
    const textW = render.getTextWidth(text, font);
    return Math.max(0, Math.round((screen.width - textW) / 2));
}

/**
 * Draws a curved arc banner along the top circular rim with text wrapped along the curve.
 */
function drawCurvedHeader(text, font, bgColor, textColor) {
    if (!text) return;
    const displayName = truncateText(text, font, 160);
    const cx = 130;
    const cy = 130;
    const R_out = 128;
    const R_in = 103;
    const R_text = 114;

    const len = displayName.length;
    const widths = new Array(len);
    let totalW = 0;
    for (let i = 0; i < len; i++) {
        const ch = displayName[i];
        const w = ch === " " ? 6 : render.getTextWidth(ch, font) + 1;
        widths[i] = w;
        totalW += w;
    }

    // Angular half-span of the banner with padding
    const bannerHalfSpan = totalW / 2 + 12;
    const maxAngle = bannerHalfSpan / R_text;
    const tanMax = Math.tan(maxAngle);

    // Render curved banner background using scanlines
    const startY = cy - R_out + 1;
    const maxY = Math.min(cy - 1, Math.ceil(cy - R_in * Math.cos(maxAngle)) + 1);
    for (let y = startY; y <= maxY; y++) {
        const dy = cy - y;
        if (dy <= 0) continue;
        const dySq = dy * dy;

        const xOut = Math.floor(Math.sqrt(Math.max(0, R_out * R_out - dySq)));
        const xAngle = Math.floor(dy * tanMax);
        const xMax = Math.min(xOut, xAngle);
        if (xMax <= 1) continue;

        if (dy >= R_in) {
            render.fillRectangle(bgColor, cx - xMax, y, 2 * xMax + 1, 1);
        } else {
            const xIn = Math.ceil(Math.sqrt(Math.max(0, R_in * R_in - dySq)));
            const segW = xMax - xIn;
            if (segW > 0) {
                render.fillRectangle(bgColor, cx - xMax, y, segW, 1);
                render.fillRectangle(bgColor, cx + xIn, y, segW, 1);
            }
        }
    }

    // Render characters along the circular arc
    let curArc = 0;
    for (let i = 0; i < len; i++) {
        const ch = displayName[i];
        const w = widths[i];
        if (ch !== " ") {
            const charCenterArc = curArc + w / 2;
            const theta = (charCenterArc - totalW / 2) / R_text;
            const charCenterX = cx + R_text * Math.sin(theta);
            const charCenterY = cy - R_text * Math.cos(theta);

            const charX = Math.round(charCenterX - (w - 1) / 2);
            const charY = Math.round(charCenterY - 7);

            render.drawText(ch, font, textColor, charX, charY);
        }
        curArc += w;
    }
}

/**
 * 1. MAIN MONITORING SCREEN (Active print / Idle status) - Round (Gabbro)
 */
export function renderMainScreen(state) {
    const isStopped = state.status.toLowerCase() === "stopped";
    const isPrinting = state.status.toLowerCase() === "printing";
    const isPaused = state.status.toLowerCase() === "paused";

    // Black background across entire circular screen
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Top Header Banner wrapping along the circular curve
    const headerBg = isPaused ? COLOR_AMBER : COLOR_ORANGE;
    drawCurvedHeader(state.printerName, fontHeader, headerBg, COLOR_BLACK);

    // Centered File Name
    const displayFile = truncateText(state.fileName, fontTitle, 180);
    render.drawText(displayFile, fontTitle, COLOR_WHITE, centerX(displayFile, fontTitle), 52);

    // Centered Status Label
    const statusColor = isPaused ? COLOR_AMBER : COLOR_WHITE;
    const statusText = `Status: ${state.status}`;
    render.drawText(statusText, fontBody, statusColor, centerX(statusText, fontBody), 78);

    // Centered Progress Bar
    const barW = 170;
    const barH = 18;
    const barX = Math.round((screen.width - barW) / 2);
    const barY = 108;
    render.fillRectangle(COLOR_WHITE, barX, barY, barW, 2);
    render.fillRectangle(COLOR_WHITE, barX, barY + barH - 2, barW, 2);
    render.fillRectangle(COLOR_WHITE, barX, barY, 2, barH);
    render.fillRectangle(COLOR_WHITE, barX + barW - 2, barY, 2, barH);

    // Progress Bar Fill
    const fillWidth = Math.max(0, Math.min(barW - 4, Math.round((barW - 4) * (state.progress / 100))));
    if (fillWidth > 0) {
        const barFillColor = isPaused ? COLOR_AMBER : COLOR_ORANGE;
        render.fillRectangle(barFillColor, barX + 2, barY + 2, fillWidth, barH - 4);
    }

    // Centered Progress Percentage
    const percentStr = `${state.progress}%`;
    render.drawText(percentStr, fontTitle, COLOR_WHITE, centerX(percentStr, fontTitle), 134);

    // Centered Estimated Finish Time
    let finishStr = (!isPrinting && !isPaused) ? "Finish: --:--" : `Finish: ${state.finishClock}`;
    if ((isPrinting || isPaused) && state.isReminderSet) {
        finishStr += " (Set)";
    }
    render.drawText(finishStr, fontBody, COLOR_WHITE, centerX(finishStr, fontBody), 170);

    // Radial Hardware Button Action Cues (hugging circular right perimeter)
    if (isPrinting || isPaused) {
        // UP button -> Stop Square (abort print)
        drawStopSquare(214, 48, COLOR_ORANGE);
    }
    if (isPrinting) {
        // SELECT button -> Pause bars
        drawPauseBars(238, 122, COLOR_WHITE);
    } else if (isPaused) {
        // SELECT button -> Play triangle (resume)
        drawPlayTriangle(238, 122, COLOR_GREEN);
    }
    if (isPrinting || isPaused || isStopped) {
        // DOWN button -> Alarm clock (Green when active/set, White otherwise)
        const clockColor = state.isReminderSet ? COLOR_GREEN : COLOR_WHITE;
        drawAlarmClock(214, 192, clockColor);
    }
}

/**
 * 2. STOP PRINT CONFIRMATION SCREEN - Round (Gabbro)
 */
export function renderStopConfirmScreen(state) {
    // Full orange background across circular display
    render.fillRectangle(COLOR_ORANGE, 0, 0, screen.width, screen.height);

    // Centered Title
    render.drawText("STOP PRINT?", fontTitle, COLOR_WHITE, centerX("STOP PRINT?", fontTitle), 24);

    // Centered 3D Printer Graphic with black model
    const printerX = Math.round((screen.width - 42) / 2);
    draw3DPrinter(printerX, 62, COLOR_BLACK, true);

    // Centered Abort prompt
    render.drawText("Abort print job?", fontBody, COLOR_WHITE, centerX("Abort print job?", fontBody), 118);

    // Centered File Name
    const displayFile = truncateText(state.fileName, fontSmall, 180);
    render.drawText(displayFile, fontSmall, COLOR_WHITE, centerX(displayFile, fontSmall), 146);

    // Radial Action cues: UP = confirm (checkmark), DOWN = cancel (cross)
    drawCheckmark(214, 48, COLOR_GREEN);
    drawCross(214, 192, COLOR_WHITE);
}

/**
 * 3. PAUSE PRINT CONFIRMATION SCREEN - Round (Gabbro)
 */
export function renderPauseConfirmScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Orange header pill
    const badgeW = 160;
    const badgeH = 26;
    const badgeX = Math.round((screen.width - badgeW) / 2);
    render.fillRectangle(COLOR_ORANGE, badgeX, 14, badgeW, badgeH);
    render.drawText("PAUSE PRINT?", fontHeader, COLOR_BLACK, centerX("PAUSE PRINT?", fontHeader), 18);

    // Centered 3D Printer Graphic with amber model
    const printerX = Math.round((screen.width - 42) / 2);
    draw3DPrinter(printerX, 56, COLOR_AMBER, false);

    // Centered Pause prompt
    render.drawText("Pause print job?", fontBody, COLOR_WHITE, centerX("Pause print job?", fontBody), 114);

    // Centered File name
    const displayFile = truncateText(state.fileName, fontSmall, 180);
    render.drawText(displayFile, fontSmall, COLOR_AMBER, centerX(displayFile, fontSmall), 142);

    // Action cues: UP = confirm (checkmark), DOWN = cancel (cross)
    drawCheckmark(214, 48, COLOR_GREEN);
    drawCross(214, 192, COLOR_WHITE);
}

/**
 * 4. RESUME PRINT CONFIRMATION SCREEN - Round (Gabbro)
 */
export function renderResumeConfirmScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Green header pill
    const badgeW = 160;
    const badgeH = 26;
    const badgeX = Math.round((screen.width - badgeW) / 2);
    render.fillRectangle(COLOR_GREEN, badgeX, 14, badgeW, badgeH);
    render.drawText("RESUME PRINT?", fontHeader, COLOR_BLACK, centerX("RESUME PRINT?", fontHeader), 18);

    // Centered 3D Printer Graphic with green model
    const printerX = Math.round((screen.width - 42) / 2);
    draw3DPrinter(printerX, 56, COLOR_GREEN, false);

    // Centered Resume prompt
    render.drawText("Resume print job?", fontBody, COLOR_WHITE, centerX("Resume print job?", fontBody), 114);

    // Centered File name
    const displayFile = truncateText(state.fileName, fontSmall, 180);
    render.drawText(displayFile, fontSmall, COLOR_GREEN, centerX(displayFile, fontSmall), 142);

    // Action cues: UP = confirm (checkmark), DOWN = cancel (cross)
    drawCheckmark(214, 48, COLOR_GREEN);
    drawCross(214, 192, COLOR_WHITE);
}

/**
 * 5. SET REMINDER SCREEN - Round (Gabbro)
 */
export function renderReminderScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    const badgeW = 170;
    const badgeH = 26;
    const badgeX = Math.round((screen.width - badgeW) / 2);
    render.fillRectangle(COLOR_ORANGE, badgeX, 14, badgeW, badgeH);

    const printerX = Math.round((screen.width - 42) / 2);

    if (state.isReminderSet) {
        render.drawText("REMINDER ACTIVE", fontHeader, COLOR_BLACK, centerX("REMINDER ACTIVE", fontHeader), 18);

        // Centered 3D Printer Graphic with green model
        draw3DPrinter(printerX, 54, COLOR_GREEN, false);

        // Reminder prompt
        render.drawText("Alarm already set!", fontBody, COLOR_GREEN, centerX("Alarm already set!", fontBody), 110);
        const estStr = `Est: ${state.finishClock}`;
        render.drawText(estStr, fontBody, COLOR_WHITE, centerX(estStr, fontBody), 134);
        render.drawText("Cancel alarm?", fontSmall, COLOR_GRAY, centerX("Cancel alarm?", fontSmall), 160);

        // Action cues: UP = turn off (cross), DOWN = keep (checkmark)
        drawCross(214, 48, COLOR_ORANGE);
        drawCheckmark(214, 192, COLOR_GREEN);
    } else {
        render.drawText("SET REMINDER", fontHeader, COLOR_BLACK, centerX("SET REMINDER", fontHeader), 18);

        // Centered 3D Printer Graphic
        draw3DPrinter(printerX, 54, COLOR_ORANGE, false);

        // Reminder prompt
        render.drawText("Notify when done?", fontBody, COLOR_WHITE, centerX("Notify when done?", fontBody), 114);
        const estStr = `Est: ${state.finishClock}`;
        render.drawText(estStr, fontBody, COLOR_ORANGE, centerX(estStr, fontBody), 138);

        // Action cues: UP = confirm (checkmark), DOWN = cancel (cross)
        drawCheckmark(214, 48, COLOR_GREEN);
        drawCross(214, 192, COLOR_WHITE);
    }
}

/**
 * 6. PRINT FINISHED SCREEN - Round (Gabbro)
 */
export function renderFinishedScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Orange header pill
    const badgeW = 170;
    const badgeH = 26;
    const badgeX = Math.round((screen.width - badgeW) / 2);
    render.fillRectangle(COLOR_ORANGE, badgeX, 14, badgeW, badgeH);
    render.drawText("PRINT FINISHED!", fontHeader, COLOR_BLACK, centerX("PRINT FINISHED!", fontHeader), 18);

    // Centered 3D Printer Graphic with green model
    const printerX = Math.round((screen.width - 42) / 2);
    draw3DPrinter(printerX, 52, COLOR_GREEN, false);

    // Centered File name
    const displayFile = truncateText(state.fileName, fontBody, 180);
    render.drawText(displayFile, fontBody, COLOR_WHITE, centerX(displayFile, fontBody), 106);

    // Centered Status
    render.drawText("Ready to remove!", fontBody, COLOR_GREEN, centerX("Ready to remove!", fontBody), 132);

    // Centered Subtitle
    render.drawText("Bed cooling down", fontSmall, COLOR_GRAY, centerX("Bed cooling down", fontSmall), 158);

    // Action cue: SELECT = dismiss (checkmark)
    drawCheckmark(240, 122, COLOR_GREEN);
}

/**
 * 7. NOT CONFIGURED / MISSING KEYS SCREEN - Round (Gabbro)
 */
export function renderNotConfiguredScreen(state) {
    // Black background
    render.fillRectangle(COLOR_BLACK, 0, 0, screen.width, screen.height);

    // Orange header pill
    const badgeW = 160;
    const badgeH = 26;
    const badgeX = Math.round((screen.width - badgeW) / 2);
    render.fillRectangle(COLOR_ORANGE, badgeX, 14, badgeW, badgeH);
    render.drawText("PRUSA CONNECT", fontHeader, COLOR_BLACK, centerX("PRUSA CONNECT", fontHeader), 18);

    // Centered Key icon
    const keyX = Math.round((screen.width - 40) / 2);
    drawKey(keyX, 48, COLOR_ORANGE);

    // Setup title
    render.drawText("Setup Required", fontTitle, COLOR_WHITE, centerX("Setup Required", fontTitle), 78);

    // Setup instructions centered within round safe width
    const line1 = "Open Pebble app on phone,";
    const line2 = "go to Settings, and enter";
    const line3 = "Prusa Connect credentials.";
    const line4 = "Press SELECT to retry";

    render.drawText(line1, fontSmall, COLOR_WHITE, centerX(line1, fontSmall), 112);
    render.drawText(line2, fontSmall, COLOR_WHITE, centerX(line2, fontSmall), 132);
    render.drawText(line3, fontSmall, COLOR_WHITE, centerX(line3, fontSmall), 152);
    render.drawText(line4, fontSmall, COLOR_GRAY, centerX(line4, fontSmall), 184);
}
