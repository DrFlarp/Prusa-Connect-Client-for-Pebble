import { render, COLOR_WHITE, COLOR_BLACK, COLOR_CORAL } from "./theme";

/**
 * Perfectly symmetrical 21x19 pixel bitmap for the alarm clock icon.
 */
const ALARM_CLOCK_ICON = [
    "  ####         ####  ",  // Bells dome
    " ######       ###### ",  // Bells body
    " ######  ###  ###### ",  // Bells & center top hammer
    "  ####  #####  ####  ",  // Bells base & top button
    "   ##  #######  ##   ",  // Bell mounts & dial top
    "     ####   ####     ",  // Dial curve
    "    ###       ###    ",  // Dial
    "    ## #     # ##    ",  // Hands at 10:10
    "    ##  #   #  ##    ",
    "   ##    # #    ##   ",
    "   ##     #     ##   ",  // Center pivot
    "   ##           ##   ",
    "    ##         ##    ",
    "    ###       ###    ",
    "     ####   ####     ",  // Dial curve
    "    #  #######  #    ",  // Dial bottom & leg mounts
    "   ##           ##   ",  // Angled feet
    "  ###           ###  ",
    " ##               ## "   // Foot tips
];

/**
 * Render the symmetrical alarm clock icon.
 */
export function drawAlarmClock(x, y, color) {
    for (let r = 0; r < ALARM_CLOCK_ICON.length; r++) {
        const row = ALARM_CLOCK_ICON[r];
        let start = -1;
        for (let c = 0; c <= row.length; c++) {
            if (c < row.length && row[c] === "#") {
                if (start === -1) start = c;
            } else if (start !== -1) {
                render.fillRectangle(color, x + start, y + r, c - start, 1);
                start = -1;
            }
        }
    }
}

/**
 * Render stylized 3D printer graphic with spool, gantry, extruder, heatbed, and model.
 *
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number|null} objectColor - Color of the printed object on bed (e.g. COLOR_GREEN or COLOR_BLACK).
 * @param {boolean} isCoralBg - Whether the background is coral (for hole contrast).
 */
export function draw3DPrinter(x, y, objectColor, isCoralBg = false) {
    const bgColor = isCoralBg ? COLOR_CORAL : COLOR_BLACK;

    // Top filament spool (white ring with center hole)
    render.drawCircle(COLOR_WHITE, x + 20, y + 6, 5);
    render.drawCircle(bgColor, x + 20, y + 6, 2);

    // Filament guide line
    render.fillRectangle(COLOR_WHITE, x + 20, y + 11, 2, 4);

    // Gantry frame (White arch)
    render.fillRectangle(COLOR_WHITE, x, y + 15, 42, 4);      // Top horizontal beam
    render.fillRectangle(COLOR_WHITE, x, y + 15, 4, 30);      // Left upright pillar
    render.fillRectangle(COLOR_WHITE, x + 38, y + 15, 4, 30); // Right upright pillar

    // Gantry crossbar
    render.fillRectangle(COLOR_WHITE, x + 4, y + 25, 34, 2);

    // Extruder assembly & nozzle
    render.fillRectangle(COLOR_BLACK, x + 16, y + 21, 10, 8);
    render.fillRectangle(COLOR_WHITE, x + 19, y + 29, 4, 2);

    // Printed model on bed
    if (objectColor) {
        render.fillRectangle(objectColor, x + 16, y + 27, 10, 10);
    }

    // Heatbed
    render.fillRectangle(COLOR_CORAL, x + 3, y + 37, 36, 3);

    // Base & feet
    render.fillRectangle(COLOR_WHITE, x - 3, y + 40, 48, 4);
    render.fillRectangle(COLOR_WHITE, x + 2, y + 44, 4, 4);
    render.fillRectangle(COLOR_WHITE, x + 36, y + 44, 4, 4);
}

/**
 * Render a checkmark action icon (e.g. for confirm button).
 */
export function drawCheckmark(x, y, color) {
    render.drawLine(x, y + 6, x + 5, y + 12, color, 3);
    render.drawLine(x + 5, y + 12, x + 14, y, color, 3);
}

/**
 * Render a cross/X action icon (e.g. for cancel button).
 */
export function drawCross(x, y, color) {
    render.drawLine(x, y, x + 12, y + 12, color, 3);
    render.drawLine(x + 12, y, x, y + 12, color, 3);
}

/**
 * Render a stop square indicator (e.g. for abort print cue).
 */
export function drawStopSquare(x, y, color) {
    render.fillRectangle(color, x, y, 16, 2);
    render.fillRectangle(color, x, y + 14, 16, 2);
    render.fillRectangle(color, x, y, 2, 16);
    render.fillRectangle(color, x + 14, y, 2, 16);
}
