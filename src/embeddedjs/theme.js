import Poco from "commodetto/Poco";

/**
 * Shared Poco renderer instance on the Pebble screen framebuffer.
 */
export const render = new Poco(screen);

/**
 * Color palette matching Pebble Emery / Gabbro 64-color display and reference designs.
 */
export const COLOR_ORANGE = render.makeColor(255, 85, 0);       // Header & accent Prusa Orange
export const COLOR_CORAL = COLOR_ORANGE;                         // Retained alias for backwards compatibility
export const COLOR_BLACK = render.makeColor(0, 0, 0);           // Background
export const COLOR_WHITE = render.makeColor(255, 255, 255);     // Text & primary outlines
export const COLOR_GREEN = render.makeColor(85, 255, 85);       // Success & affirmative cues
export const COLOR_GRAY = render.makeColor(130, 130, 130);      // Subtitle & secondary details
export const COLOR_DARK_GRAY = render.makeColor(50, 50, 50);    // Contrast details
export const COLOR_AMBER = render.makeColor(255, 170, 0);        // Warning & paused accent

/**
 * System typography.
 */
export const fontHeader = new render.Font("Gothic-Bold", 18);
export const fontTitle = new render.Font("Gothic-Bold", 24);
export const fontBody = new render.Font("Gothic-Regular", 18);
export const fontSmall = new render.Font("Gothic-Regular", 14);

/**
 * Truncate a text string with an ellipsis ("...") if its rendered pixel width exceeds maxWidth.
 *
 * @param {string} text - The input text to measure.
 * @param {Font} font - The font used for measurement.
 * @param {number} maxWidth - Maximum allowable width in pixels.
 * @returns {string} Truncated string or original if within limits.
 */
export function truncateText(text, font, maxWidth) {
    if (!text) return "";
    if (render.getTextWidth(text, font) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 3 && render.getTextWidth(truncated + "...", font) > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + "...";
}
