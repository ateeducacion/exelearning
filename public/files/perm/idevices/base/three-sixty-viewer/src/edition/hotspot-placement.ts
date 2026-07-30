/**
 * Direct hotspot placement: the author presses "Place hotspot by clicking",
 * the editor enters placement mode, the next click on the preview creates a
 * hotspot at the computed position and opens its row for editing.
 *
 * The mode is cancelable with Escape, exposed through aria-pressed (never
 * colour alone), and announced via the aria-live status region. List-based
 * creation stays available as the alternative path.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface PlacementUi {
    readonly button: () => HTMLElement | null;
    readonly stage: () => HTMLElement | null;
    readonly hint: () => HTMLElement | null;
    readonly announce: (message: string) => void;
}

export interface PlacementLabels {
    readonly started: string;
    readonly cancelled: string;
    readonly placed: string;
}

export interface PlacementController {
    readonly active: boolean;
    toggle: () => void;
    cancel: () => void;
    /** Called by the preview when a placement click succeeded. */
    complete: () => void;
    dispose: () => void;
}

export function createPlacementController(ui: PlacementUi, labels: PlacementLabels): PlacementController {
    let active = false;

    const reflect = (): void => {
        const button = ui.button();
        if (button) {
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
        const stage = ui.stage();
        stage?.classList.toggle('three-sixty-preview-stage--placing', active);
        const hint = ui.hint();
        if (hint) hint.hidden = !active;
    };

    const setActive = (next: boolean, announcement: string | null): void => {
        if (active === next) return;
        active = next;
        reflect();
        if (announcement) ui.announce(announcement);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && active) {
            event.stopPropagation();
            setActive(false, labels.cancelled);
        }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return {
        get active() {
            return active;
        },
        toggle() {
            setActive(!active, active ? labels.cancelled : labels.started);
        },
        cancel() {
            setActive(false, labels.cancelled);
        },
        complete() {
            setActive(false, labels.placed);
        },
        dispose() {
            document.removeEventListener('keydown', onKeyDown, true);
        },
    };
}
