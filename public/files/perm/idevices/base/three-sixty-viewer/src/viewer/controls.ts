/**
 * DOM controls shared by the runtime and the editor preview: pan-arrow
 * navigation, the fullscreen toggle and the drag-event capture that keeps the
 * surrounding workarea (draggable blocks, contenteditable wrappers) from
 * hijacking OrbitControls gestures.
 *
 * Every factory returns a `dispose()` that removes its DOM and listeners.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface Disposable {
    dispose: () => void;
}

export interface NavControlLabels {
    readonly group: string;
    readonly left: string;
    readonly up: string;
    readonly down: string;
    readonly right: string;
}

export const YAW_STEP = (15 * Math.PI) / 180;
export const PITCH_STEP = (10 * Math.PI) / 180;

/**
 * The four pan arrows. The camera lives inside an inverted sphere, so the
 * visible "right" pan corresponds to a decreasing azimuth — the deltas below
 * match the arrows' apparent direction.
 */
export function createNavControls(
    host: HTMLElement,
    labels: NavControlLabels,
    onNudge: (dYaw: number, dPitch: number) => void,
): Disposable & { element: HTMLElement } {
    const nav = document.createElement('div');
    nav.className = 'three-sixty-viewer-nav';
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', labels.group);
    const directions = [
        { key: 'left', glyph: '←', label: labels.left, dYaw: YAW_STEP, dPitch: 0 },
        { key: 'up', glyph: '↑', label: labels.up, dYaw: 0, dPitch: -PITCH_STEP },
        { key: 'down', glyph: '↓', label: labels.down, dYaw: 0, dPitch: PITCH_STEP },
        { key: 'right', glyph: '→', label: labels.right, dYaw: -YAW_STEP, dPitch: 0 },
    ] as const;
    for (const direction of directions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `three-sixty-viewer-nav-btn three-sixty-viewer-nav-${direction.key}`;
        button.setAttribute('aria-label', direction.label);
        button.setAttribute('title', direction.label);
        button.textContent = direction.glyph;
        button.addEventListener('click', () => onNudge(direction.dYaw, direction.dPitch));
        nav.appendChild(button);
    }
    host.appendChild(nav);
    return {
        element: nav,
        dispose() {
            nav.parentNode?.removeChild(nav);
        },
    };
}

interface FullscreenDocument extends Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => void;
}

interface FullscreenElement extends HTMLElement {
    webkitRequestFullscreen?: () => void;
}

export interface FullscreenLabels {
    readonly enter: string;
    readonly exit: string;
}

/** The ⛶ toggle button, tracking fullscreen state for its labels. */
export function createFullscreenButton(
    wrapper: HTMLElement,
    labels: FullscreenLabels,
): Disposable & { button: HTMLButtonElement } {
    const doc = document as FullscreenDocument;
    const target = wrapper as FullscreenElement;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'three-sixty-viewer-fullscreen-button';
    button.setAttribute('aria-label', labels.enter);
    button.textContent = '⛶';

    const isFullscreen = (): boolean =>
        doc.fullscreenElement === wrapper || doc.webkitFullscreenElement === wrapper;

    const onClick = (): void => {
        if (isFullscreen()) {
            if (doc.exitFullscreen) doc.exitFullscreen();
            else doc.webkitExitFullscreen?.();
        } else if (target.requestFullscreen) {
            target.requestFullscreen();
        } else {
            target.webkitRequestFullscreen?.();
        }
    };
    const syncLabel = (): void => {
        const label = isFullscreen() ? labels.exit : labels.enter;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
    };

    button.addEventListener('click', onClick);
    document.addEventListener('fullscreenchange', syncLabel);
    document.addEventListener('webkitfullscreenchange', syncLabel);
    wrapper.appendChild(button);

    return {
        button,
        dispose() {
            document.removeEventListener('fullscreenchange', syncLabel);
            document.removeEventListener('webkitfullscreenchange', syncLabel);
            button.parentNode?.removeChild(button);
        },
    };
}

/**
 * Stop drag/touch events on the canvas from being captured by the
 * surrounding workarea editor or contenteditable wrappers, so OrbitControls
 * can rotate. dragstart MUST be preventDefault'd to abort native HTML5 drag.
 */
export function captureDragEvents(canvas: HTMLElement): void {
    try {
        canvas.setAttribute('contenteditable', 'false');
        canvas.setAttribute('draggable', 'false');
    } catch {
        // Non-element hosts (tests) simply skip the attributes.
    }
    const stop = (event: Event): void => {
        event.stopPropagation();
    };
    const stopAndPrevent = (event: Event): void => {
        event.stopPropagation();
        event.preventDefault();
    };
    for (const type of ['mousedown', 'pointerdown', 'touchstart', 'wheel']) {
        canvas.addEventListener(type, stop, { passive: false });
    }
    canvas.addEventListener('dragstart', stopAndPrevent, { capture: true });
    canvas.addEventListener('dragstart', stopAndPrevent);
    // selectstart can fire on contenteditable parents and abort our drag.
    canvas.addEventListener('selectstart', stopAndPrevent);
}

/**
 * Document-capture-level kill switch for native HTML5 dragstart originating
 * inside the wrapper — this beats jQuery-delegated handlers the eXeLearning
 * workarea attaches on iDevice content blocks.
 */
export function blockNativeDragInside(wrapper: HTMLElement): Disposable {
    const handler = (event: Event): void => {
        let node = event.target as Node | null;
        while (node) {
            if (node === wrapper) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            node = node.parentNode;
        }
    };
    document.addEventListener('dragstart', handler, true);
    document.addEventListener('selectstart', handler, true);
    return {
        dispose() {
            document.removeEventListener('dragstart', handler, true);
            document.removeEventListener('selectstart', handler, true);
        },
    };
}
