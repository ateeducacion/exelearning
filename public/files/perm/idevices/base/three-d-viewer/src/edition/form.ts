/**
 * Form ↔ document plumbing, split so each direction is independently testable:
 * `applyDocumentToForm` writes state into the DOM, `readDisplaySettings` reads
 * it back. Neither one touches the preview or the interaction layer.
 */

import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR, normalizeColor } from '../shared/colors';
import { isStlSource } from '../shared/model-source';
import type { AnimationSettings, ThreeDViewerDocumentV2 } from '../shared/types';
import type { EditorElements, Translate } from './editor';

/** The subset of the document the display form owns. */
export interface DisplaySettings {
    src: string;
    alt: string;
    modelColor: string;
    backgroundColor: string;
    cameraControls: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    showNavControls: boolean;
    animation: AnimationSettings;
}

/** Push a document into the form controls. */
export function applyDocumentToForm(elements: EditorElements, document: ThreeDViewerDocumentV2): void {
    elements.src.value = document.src;
    elements.alt.value = document.alt;
    elements.modelColor.value = document.modelColor || DEFAULT_MODEL_COLOR;
    elements.backgroundColor.value = document.backgroundColor || DEFAULT_BACKGROUND_COLOR;
    elements.cameraControls.checked = document.cameraControls;
    elements.autoRotate.checked = document.autoRotate;
    elements.autoRotateSpeed.value = String(document.autoRotateSpeed || 30);
    elements.showNavControls.checked = document.showNavControls;
    elements.animationToggle.checked = document.animation.enabled;
    elements.animationSpeed.value = String(document.animation.speed || 1);
    elements.animationName.value = document.animation.name;

    elements.interactionsEnable.checked = document.interaction.enabled;
    elements.guidedMode.checked = document.interaction.guidedMode;
    elements.wrapNavigation.checked = document.interaction.wrapNavigation;
    elements.showMarkerLabels.checked = document.interaction.showMarkerLabels;
}

/** Read the display settings back out of the form. */
export function readDisplaySettings(elements: EditorElements, currentSrc: string): DisplaySettings {
    const showNavControls = elements.showNavControls.checked;
    const speed = Number.parseFloat(elements.animationSpeed.value);
    return {
        // The picker writes the source; the text box is read-only, so the
        // document's value stays authoritative when the field is empty.
        src: elements.src.value.trim() || currentSrc,
        alt: elements.alt.value.trim(),
        modelColor: normalizeColor(elements.modelColor.value, DEFAULT_MODEL_COLOR),
        backgroundColor: normalizeColor(elements.backgroundColor.value, DEFAULT_BACKGROUND_COLOR),
        cameraControls: elements.cameraControls.checked,
        // Mutually exclusive: manual nav controls win over auto-rotation.
        autoRotate: !showNavControls && elements.autoRotate.checked,
        autoRotateSpeed: Number.parseFloat(elements.autoRotateSpeed.value) || 30,
        showNavControls,
        animation: {
            enabled: elements.animationToggle.checked,
            name: elements.animationName.value,
            speed: Number.isFinite(speed) ? Math.min(Math.max(speed, 0.1), 3) : 1,
        },
    };
}

/** Show or hide the auto-rotate speed control. */
export function updateAutoRotateSpeedState(elements: EditorElements): void {
    const enabled = elements.autoRotate.checked;
    elements.autoRotateSpeed.disabled = !enabled;
    elements.autoRotateSpeedRow.style.display = enabled ? '' : 'none';
}

/**
 * Enable the STL colour picker only for STL models. The stored value survives
 * a swap to GLB and back, so the author's preference is never lost.
 */
export function updateModelColorFieldState(elements: EditorElements, src: string, t: Translate): void {
    const isStl = isStlSource(src);
    elements.modelColor.disabled = !isStl;
    elements.modelColor.title = isStl
        ? t('Choose STL model color')
        : t('Only STL files use this color; the current file is not STL');
    elements.modelColorHint.classList.toggle('text-muted', !isStl);
}

/** Show the preview's fullscreen and nav controls only when the author enabled them. */
export function updateNavControlsVisibility(elements: EditorElements, visible: boolean): void {
    const fullscreen = elements.preview.querySelector<HTMLElement>('[data-fullscreen]');
    const nav = elements.preview.querySelector<HTMLElement>('.three-d-viewer-nav');
    if (fullscreen) {
        fullscreen.style.display = visible ? '' : 'none';
    }
    if (nav) {
        nav.style.display = visible ? '' : 'none';
    }
}

/** Show the "select a model" overlay whenever there is no configured source. */
export function updateEmptyState(elements: EditorElements, src: string): void {
    const empty = elements.preview.querySelector<HTMLElement>('[data-empty-state]');
    if (empty) {
        // `state.src` is the single source of truth here: the custom element's
        // own `src` property can report a stale or resolved page URL.
        empty.style.display = src ? 'none' : 'grid';
    }
}

/** Populate the animation picker from the model's available animations. */
export function updateAnimationOptions(
    elements: EditorElements,
    available: readonly string[],
    animation: AnimationSettings,
): AnimationSettings {
    elements.animationName.innerHTML = '';
    for (const name of available) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        elements.animationName.appendChild(option);
    }
    if (available.length === 0) {
        elements.animationToggle.checked = false;
        elements.animationToggle.disabled = true;
        elements.animationName.disabled = true;
        elements.animationSpeed.disabled = true;
        elements.animationRow.hidden = true;
        return { ...animation, enabled: false, name: '' };
    }
    const selected = available.includes(animation.name) ? animation.name : (available[0] ?? '');
    elements.animationName.value = selected;
    elements.animationRow.hidden = false;
    elements.animationToggle.disabled = false;
    elements.animationName.disabled = false;
    elements.animationSpeed.disabled = false;
    return { ...animation, name: selected };
}
