/**
 * Active-scene field wiring (title, image, projection toggle, alt,
 * description, initial view) and the refresh that re-points those inputs at a
 * newly-activated scene without rebuilding the whole form.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { clamp, toFiniteNumber } from '../shared/geometry';
import { truncateLabel } from '../shared/html';
import type { Translate } from './i18n';
import type { EditorState } from './state';

export interface SceneEditorCallbacks {
    /** Scene data changed in a way the preview should reflect. */
    readonly onChanged: () => void;
    /** The scene list labels need re-rendering (title edits). */
    readonly onTitleChanged: () => void;
    /** Projection changed: rebuild form + preview wholesale. */
    readonly onProjectionChanged: () => void;
    readonly onPickImage: () => void;
    readonly onImageFile: (file: File) => void;
}

function input<T extends HTMLElement>(body: HTMLElement, selector: string): T | null {
    return body.querySelector<T>(selector);
}

export function wireActiveSceneFields(body: HTMLElement, state: EditorState, callbacks: SceneEditorCallbacks): void {
    input<HTMLButtonElement>(body, '#threeSixtyImageButton')?.addEventListener('click', () => callbacks.onPickImage());
    input<HTMLButtonElement>(body, '#threeSixtyImageClear')?.addEventListener('click', () => {
        state.activeScene().src = '';
        callbacks.onChanged();
    });
    input<HTMLInputElement>(body, '#threeSixtyImageFile')?.addEventListener('change', event => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) callbacks.onImageFile(file);
    });

    input<HTMLInputElement>(body, '#threeSixtySceneTitle')?.addEventListener('input', event => {
        state.activeScene().title = String((event.target as HTMLInputElement).value ?? '');
        callbacks.onTitleChanged();
    });
    input<HTMLInputElement>(body, '#threeSixtyAlt')?.addEventListener('input', event => {
        state.activeScene().alt = String((event.target as HTMLInputElement).value ?? '');
    });
    input<HTMLTextAreaElement>(body, '#threeSixtySceneDescription')?.addEventListener('input', event => {
        state.activeScene().description = String((event.target as HTMLTextAreaElement).value ?? '');
    });

    input<HTMLInputElement>(body, '#threeSixtyIsPanorama')?.addEventListener('change', event => {
        state.activeScene().projection = (event.target as HTMLInputElement).checked ? 'equirectangular' : 'flat';
        // Mode change swaps the renderer (WebGL sphere ↔ flat <img>) and the
        // per-scene fields, so the editor rebuilds form + preview wholesale.
        callbacks.onProjectionChanged();
    });

    const numericFields: Array<[string, (value: number) => void, number, number]> = [
        ['#threeSixtyYaw', value => void (state.activeScene().initialView.yaw = value), -180, 180],
        ['#threeSixtyPitch', value => void (state.activeScene().initialView.pitch = value), -90, 90],
        ['#threeSixtyFov', value => void (state.activeScene().initialView.fov = value), 30, 120],
    ];
    for (const [selector, assign, min, max] of numericFields) {
        const element = input<HTMLInputElement>(body, selector);
        element?.addEventListener('input', () => {
            assign(clamp(toFiniteNumber(element.value, 0), min, max));
            callbacks.onChanged();
        });
    }
}

/** Wire the viewer-behaviour controls (autorotate, zoom, fullscreen…). */
export function wireBehaviourFields(body: HTMLElement, state: EditorState, onChanged: () => void): void {
    const behaviour = state.doc.behaviour;
    const checkboxes: Array<[string, (checked: boolean) => void]> = [
        ['#threeSixtyAutorotate', checked => void (behaviour.autorotate.enabled = checked)],
        ['#threeSixtyZoom', checked => void (behaviour.zoomEnabled = checked)],
        ['#threeSixtyFullscreen', checked => void (behaviour.fullscreenEnabled = checked)],
        ['#threeSixtyShowLabels', checked => void (behaviour.showLabels = checked)],
        ['#threeSixtyNavControls', checked => void (behaviour.showNavControls = checked)],
    ];
    for (const [selector, assign] of checkboxes) {
        const element = input<HTMLInputElement>(body, selector);
        element?.addEventListener('change', () => {
            assign(Boolean(element.checked));
            onChanged();
        });
    }
    const speed = input<HTMLInputElement>(body, '#threeSixtyAutorotateSpeed');
    speed?.addEventListener('input', () => {
        behaviour.autorotate.speed = clamp(toFiniteNumber(speed.value, 0), 0, 10);
        onChanged();
    });
}

/** Point the active-scene inputs at the (new) active scene's values. */
export function refreshActiveSceneInputs(body: HTMLElement, state: EditorState, tr: Translate): void {
    const scene = state.activeScene();
    const fields: Record<string, string | number> = {
        '#threeSixtySceneTitle': scene.title,
        '#threeSixtyAlt': scene.alt,
        '#threeSixtySceneDescription': scene.description,
        '#threeSixtyYaw': scene.initialView.yaw,
        '#threeSixtyPitch': scene.initialView.pitch,
        '#threeSixtyFov': scene.initialView.fov,
    };
    for (const [selector, value] of Object.entries(fields)) {
        const element = body.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
        if (element && element.value !== String(value)) element.value = String(value);
    }
    refreshImageLabel(body, state, tr);
    const legend = body.querySelector('#threeSixtyActiveSceneLegend');
    if (legend) legend.textContent = scene.title || `${tr('Scene')} ${state.activeSceneIndex + 1}`;
}

export function refreshImageLabel(body: HTMLElement, state: EditorState, tr: Translate): void {
    const name = body.querySelector('#threeSixtyImageName');
    const clearButton = body.querySelector('#threeSixtyImageClear');
    const src = state.activeScene().src;
    if (name) name.textContent = src ? truncateLabel(src) : tr('No image selected');
    if (clearButton) {
        if (src) clearButton.removeAttribute('hidden');
        else clearButton.setAttribute('hidden', 'hidden');
    }
}
