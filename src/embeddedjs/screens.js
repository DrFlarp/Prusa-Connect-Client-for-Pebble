/**
 * Screen Renderer Facade
 *
 * Dynamically delegates rendering to either the circular UI (Gabbro / Chalk)
 * or the rectangular UI (Emery / Basalt) depending on `screen.round`.
 */

import * as rectScreens from "./screens-rect";
import * as roundScreens from "./screens-round";

const isRound = screen.round;

export function renderMainScreen(state) {
    if (isRound) {
        roundScreens.renderMainScreen(state);
    } else {
        rectScreens.renderMainScreen(state);
    }
}

export function renderStopConfirmScreen(state) {
    if (isRound) {
        roundScreens.renderStopConfirmScreen(state);
    } else {
        rectScreens.renderStopConfirmScreen(state);
    }
}

export function renderPauseConfirmScreen(state) {
    if (isRound) {
        roundScreens.renderPauseConfirmScreen(state);
    } else {
        rectScreens.renderPauseConfirmScreen(state);
    }
}

export function renderResumeConfirmScreen(state) {
    if (isRound) {
        roundScreens.renderResumeConfirmScreen(state);
    } else {
        rectScreens.renderResumeConfirmScreen(state);
    }
}

export function renderReminderScreen(state) {
    if (isRound) {
        roundScreens.renderReminderScreen(state);
    } else {
        rectScreens.renderReminderScreen(state);
    }
}

export function renderFinishedScreen(state) {
    if (isRound) {
        roundScreens.renderFinishedScreen(state);
    } else {
        rectScreens.renderFinishedScreen(state);
    }
}

export function renderNotConfiguredScreen(state) {
    if (isRound) {
        roundScreens.renderNotConfiguredScreen(state);
    } else {
        rectScreens.renderNotConfiguredScreen(state);
    }
}
