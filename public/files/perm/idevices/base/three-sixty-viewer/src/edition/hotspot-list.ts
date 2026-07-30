/**
 * Hotspot list: one row per hotspot of the active scene with inline editing
 * (label, coordinates for the scene's projection mode, action type and
 * payload). Rendering is separated from the delegated wiring so re-renders
 * never stack listeners.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { clamp, toFiniteNumber } from '../shared/geometry';
import { isKnownActionType } from '../shared/hotspot-actions';
import { escapeAttr } from '../shared/html';
import type { Translate } from './i18n';
import type { EditorState, MutableHotspot } from './state';
import { actionTypeOptionsHtml, payloadInputsHtml } from './hotspot-editor';

export interface HotspotListCallbacks {
    /** Anything changed that the preview overlay should reflect. */
    readonly onChanged: () => void;
    /** Structure changed (row added/removed/action switched): re-render. */
    readonly onStructureChanged: () => void;
    readonly onSelect: (index: number) => void;
    readonly onPickMedia: (index: number, kind: 'image' | 'video') => void;
}

export function renderHotspotList(container: HTMLElement, state: EditorState, tr: Translate): void {
    const scene = state.activeScene();
    const isFlat = scene.projection === 'flat';
    container.innerHTML = '';
    if (scene.hotspots.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-muted small';
        empty.textContent = tr('No hotspots in this scene yet.');
        container.appendChild(empty);
        return;
    }
    scene.hotspots.forEach((hotspot, index) => {
        const item = document.createElement('div');
        item.className = `three-sixty-hotspot-item${index === state.selectedHotspotIndex ? ' is-selected' : ''}`;
        item.setAttribute('role', 'listitem');
        item.setAttribute('data-hotspot-index', String(index));
        const coordinates = isFlat
            ? `<label>X (%): <input type="number" class="form-control hotspot-x" data-index="${index}" min="0" max="100" step="1" value="${hotspot.x}" /></label>` +
              `<label>Y (%): <input type="number" class="form-control hotspot-y" data-index="${index}" min="0" max="100" step="1" value="${hotspot.y}" /></label>`
            : `<label>${tr('Yaw')}: <input type="number" class="form-control hotspot-yaw" data-index="${index}" min="-180" max="180" step="1" value="${hotspot.yaw}" /></label>` +
              `<label>${tr('Pitch')}: <input type="number" class="form-control hotspot-pitch" data-index="${index}" min="-90" max="90" step="1" value="${hotspot.pitch}" /></label>`;
        item.innerHTML =
            '<div class="property-row">' +
            `<label>${tr('Label')}: <input type="text" class="form-control hotspot-label" data-index="${index}" value="${escapeAttr(hotspot.label)}" /></label>` +
            `<button type="button" class="btn btn-sm btn-link" data-hotspot-action="remove" data-index="${index}" aria-label="${escapeAttr(tr('Remove hotspot'))}">✕</button>` +
            '</div>' +
            `<div class="property-row">${coordinates}` +
            `<label>${tr('Action')}: <select class="form-control hotspot-action-type" data-index="${index}"` +
            `${hotspot.action.type === 'unsupported' ? ' disabled' : ''}>` +
            `${actionTypeOptionsHtml(hotspot, tr)}</select></label>` +
            '</div>' +
            `<div class="property-row hotspot-payload" data-index="${index}">` +
            payloadInputsHtml(state, hotspot, index, tr) +
            '</div>';
        container.appendChild(item);
    });
}

function updateFromInput(state: EditorState, target: HTMLInputElement | HTMLTextAreaElement, index: number): boolean {
    const hotspot = state.hotspotAt(index);
    if (!hotspot) return false;
    const value = String(target.value ?? '');
    const classes = target.classList;
    if (classes.contains('hotspot-label')) hotspot.label = value;
    else if (classes.contains('hotspot-yaw')) hotspot.yaw = clamp(toFiniteNumber(value, 0), -180, 180);
    else if (classes.contains('hotspot-pitch')) hotspot.pitch = clamp(toFiniteNumber(value, 0), -90, 90);
    else if (classes.contains('hotspot-x')) hotspot.x = clamp(toFiniteNumber(value, 50), 0, 100);
    else if (classes.contains('hotspot-y')) hotspot.y = clamp(toFiniteNumber(value, 50), 0, 100);
    else return updatePayloadFromInput(hotspot, classes, value);
    return true;
}

function updatePayloadFromInput(hotspot: MutableHotspot, classes: DOMTokenList, value: string): boolean {
    const action = hotspot.action;
    if (classes.contains('hotspot-payload-sceneId') && action.type === 'goToScene') {
        action.payload.sceneId = value;
    } else if (classes.contains('hotspot-payload-html') && action.type === 'text') {
        action.payload.html = value;
    } else if (classes.contains('hotspot-payload-src') && (action.type === 'image' || action.type === 'video')) {
        action.payload.src = value;
    } else if (classes.contains('hotspot-payload-alt') && action.type === 'image') {
        action.payload.alt = value;
    } else if (classes.contains('hotspot-payload-caption') && action.type === 'image') {
        action.payload.caption = value;
    } else if (classes.contains('hotspot-payload-url') && action.type === 'link') {
        action.payload.url = value;
    } else {
        return false;
    }
    return true;
}

/** Delegated input/change/click handling; attach ONCE per form build. */
export function wireHotspotList(container: HTMLElement, state: EditorState, callbacks: HotspotListCallbacks): void {
    container.addEventListener('input', event => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
        if (!target?.getAttribute) return;
        const index = Number.parseInt(target.getAttribute('data-index') ?? '', 10);
        if (Number.isNaN(index)) return;
        if (updateFromInput(state, target, index)) {
            state.selectedHotspotIndex = index;
            callbacks.onChanged();
        }
    });

    container.addEventListener('change', event => {
        const target = event.target as HTMLInputElement | null;
        if (!target?.getAttribute) return;
        const index = Number.parseInt(target.getAttribute('data-index') ?? '', 10);
        if (Number.isNaN(index)) return;
        if (target.classList.contains('hotspot-action-type')) {
            if (isKnownActionType(target.value)) {
                state.setHotspotActionType(index, target.value);
                state.selectedHotspotIndex = index;
                callbacks.onStructureChanged();
            }
        } else if (target.classList.contains('hotspot-payload-newTab')) {
            const hotspot = state.hotspotAt(index);
            if (hotspot?.action.type === 'link') {
                hotspot.action.payload.newTab = Boolean(target.checked);
                callbacks.onChanged();
            }
        } else if (target.classList.contains('hotspot-payload-url')) {
            // Re-render on commit so URL validation feedback appears.
            callbacks.onStructureChanged();
        }
    });

    container.addEventListener('click', event => {
        const origin = event.target as HTMLElement | null;
        if (!origin) return;
        const remove = origin.closest('button[data-hotspot-action="remove"]');
        if (remove) {
            const index = Number.parseInt(remove.getAttribute('data-index') ?? '', 10);
            if (!Number.isNaN(index)) {
                state.removeHotspot(index);
                callbacks.onStructureChanged();
            }
            return;
        }
        const pickImage = origin.closest('button.hotspot-payload-pickImage');
        if (pickImage) {
            const index = Number.parseInt(pickImage.getAttribute('data-index') ?? '', 10);
            if (!Number.isNaN(index)) callbacks.onPickMedia(index, 'image');
            return;
        }
        const pickVideo = origin.closest('button.hotspot-payload-pickVideo');
        if (pickVideo) {
            const index = Number.parseInt(pickVideo.getAttribute('data-index') ?? '', 10);
            if (!Number.isNaN(index)) callbacks.onPickMedia(index, 'video');
            return;
        }
        const row = origin.closest('.three-sixty-hotspot-item');
        if (row) {
            const index = Number.parseInt(row.getAttribute('data-hotspot-index') ?? '', 10);
            if (!Number.isNaN(index) && index !== state.selectedHotspotIndex) callbacks.onSelect(index);
        }
    });
}
