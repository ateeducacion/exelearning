/**
 * Hotspot list: Interactive Video–style single-editor accordion.
 *
 * Collapsed rows show a type badge, label summary and validity warning.
 * Only the selected row expands and hosts the full editor (label, coordinates,
 * action type and payload). Delete uses an inline Yes/No confirmation — no
 * modal. Edits flash a transient "Saved ✓" chip (the iDevice Save still
 * persists the whole document).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { clamp, toFiniteNumber } from '../shared/geometry';
import { isKnownActionType } from '../shared/hotspot-actions';
import { escapeAttr, escapeHtml } from '../shared/html';
import type { Hotspot } from '../shared/types';
import type { Translate } from './i18n';
import type { EditorState, MutableHotspot } from './state';
import { actionTypeLabel, actionTypeOptionsHtml, payloadInputsHtml } from './hotspot-editor';

/** How long the per-row "Saved" confirmation stays visible. */
const SAVED_STATUS_MS = 1800;

export interface HotspotListCallbacks {
    /** Anything changed that the preview overlay should reflect. */
    readonly onChanged: () => void;
    /** Structure changed (row added/removed/action switched): re-render. */
    readonly onStructureChanged: () => void;
    readonly onSelect: (index: number) => void;
    /** Collapse the open editor (Done / re-click selected). */
    readonly onDeselect: () => void;
    readonly onPickMedia: (index: number, kind: 'image' | 'video') => void;
}

/** One-line summary for a collapsed row (label, never colour alone). */
export function hotspotSummary(hotspot: Hotspot, tr: Translate): string {
    const label = hotspot.label.trim();
    if (label) return label;
    const action = hotspot.action;
    switch (action.type) {
        case 'goToScene':
            return action.payload.sceneId ? tr('Go to scene') : tr('Go to scene (no target)');
        case 'text':
            return action.payload.html.trim()
                ? action.payload.html.replace(/<[^>]+>/g, ' ').trim().slice(0, 48)
                : tr('Text (empty)');
        case 'image':
            return action.payload.src ? tr('Image') : tr('Image (no source)');
        case 'video':
            return action.payload.src ? tr('Video') : tr('Video (no source)');
        case 'link':
            return action.payload.url ? action.payload.url : tr('Link (no URL)');
        case 'unsupported':
            return tr('Unsupported') + ` (${action.originalType})`;
    }
}

function kindClass(type: string): string {
    switch (type) {
        case 'goToScene':
            return 'go-to-scene';
        case 'text':
        case 'image':
        case 'video':
        case 'link':
            return type;
        default:
            return 'unsupported';
    }
}

function coordinatesHtml(hotspot: Hotspot, index: number, isFlat: boolean, tr: Translate): string {
    if (isFlat) {
        return (
            `<div class="exe-form-group three-sixty-hotspot-coords">` +
            `<label for="hotspot-x-${index}">X (%):</label>` +
            `<input type="number" id="hotspot-x-${index}" class="form-control hotspot-x" data-index="${index}" min="0" max="100" step="1" value="${hotspot.x}" />` +
            `<label for="hotspot-y-${index}">Y (%):</label>` +
            `<input type="number" id="hotspot-y-${index}" class="form-control hotspot-y" data-index="${index}" min="0" max="100" step="1" value="${hotspot.y}" />` +
            `</div>`
        );
    }
    return (
        `<div class="exe-form-group three-sixty-hotspot-coords">` +
        `<label for="hotspot-yaw-${index}">${tr('Yaw')}:</label>` +
        `<input type="number" id="hotspot-yaw-${index}" class="form-control hotspot-yaw" data-index="${index}" min="-180" max="180" step="1" value="${hotspot.yaw}" />` +
        `<label for="hotspot-pitch-${index}">${tr('Pitch')}:</label>` +
        `<input type="number" id="hotspot-pitch-${index}" class="form-control hotspot-pitch" data-index="${index}" min="-90" max="90" step="1" value="${hotspot.pitch}" />` +
        `</div>`
    );
}

function detailHtml(state: EditorState, hotspot: Hotspot, index: number, isFlat: boolean, tr: Translate): string {
    return (
        `<div class="three-sixty-hotspot-detail" id="threeSixtyHotspotDetail">` +
        `<h4 class="three-sixty-hotspot-detail-heading">${escapeHtml(actionTypeLabel(hotspot.action.type, tr))}</h4>` +
        `<div class="exe-form-group">` +
        `<label for="hotspot-label-${index}">${tr('Label')}:</label>` +
        `<input type="text" id="hotspot-label-${index}" class="form-control hotspot-label" data-index="${index}" value="${escapeAttr(hotspot.label)}" />` +
        `</div>` +
        coordinatesHtml(hotspot, index, isFlat, tr) +
        `<div class="exe-form-group">` +
        `<label for="hotspot-action-${index}">${tr('Action')}:</label>` +
        `<select id="hotspot-action-${index}" class="form-control hotspot-action-type" data-index="${index}"` +
        `${hotspot.action.type === 'unsupported' ? ' disabled' : ''}>` +
        `${actionTypeOptionsHtml(hotspot, tr)}</select>` +
        `</div>` +
        `<div class="exe-form-group hotspot-payload" data-index="${index}">` +
        payloadInputsHtml(state, hotspot, index, tr) +
        `</div>` +
        `</div>`
    );
}

function rowActionsHtml(index: number, isSelected: boolean, tr: Translate): string {
    const done = isSelected
        ? `<button type="button" class="btn btn-secondary btn-sm three-sixty-hotspot-done" data-index="${index}" title="${escapeAttr(tr('Done'))}" aria-label="${escapeAttr(tr('Done (collapse this editor)'))}">` +
          `<span class="exe-icon" aria-hidden="true">check</span></button>`
        : '';
    return (
        `<span class="three-sixty-hotspot-saved" role="status" aria-live="polite"></span>` +
        `<span class="btn-group btn-group-sm three-sixty-hotspot-actions" role="group">` +
        done +
        `<button type="button" class="btn btn-secondary btn-sm three-sixty-hotspot-del" data-hotspot-action="remove" data-index="${index}" title="${escapeAttr(tr('Delete'))}" aria-label="${escapeAttr(tr('Remove hotspot'))}">` +
        `<span class="small-icon delete-icon-red" aria-hidden="true"></span>` +
        `<span class="visually-hidden">${escapeHtml(tr('Delete'))}</span>` +
        `</button>` +
        `</span>`
    );
}

function confirmDeleteHtml(index: number, tr: Translate): string {
    return (
        `<div class="three-sixty-hotspot-item is-confirming" role="listitem" data-hotspot-index="${index}">` +
        `<div class="three-sixty-delete-confirm" role="group" aria-label="${escapeAttr(tr('Delete this hotspot?'))}">` +
        `<span class="three-sixty-delete-confirm-text">${escapeHtml(tr('Delete this hotspot?'))}</span>` +
        `<div class="three-sixty-delete-confirm-actions">` +
        `<button type="button" class="btn btn-sm btn-danger three-sixty-hotspot-del-yes" data-index="${index}">${escapeHtml(tr('Delete'))}</button>` +
        `<button type="button" class="btn btn-sm btn-secondary three-sixty-hotspot-del-no" data-index="${index}">${escapeHtml(tr('Cancel'))}</button>` +
        `</div></div></div>`
    );
}

export function renderHotspotList(container: HTMLElement, state: EditorState, tr: Translate): void {
    const scene = state.activeScene();
    const isFlat = scene.projection === 'flat';
    container.innerHTML = '';

    if (scene.hotspots.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'three-sixty-empty three-sixty-hint';
        empty.setAttribute('role', 'note');
        empty.textContent = tr('No hotspots in this scene yet. Use the buttons above to place or add one.');
        container.appendChild(empty);
        return;
    }

    scene.hotspots.forEach((hotspot, index) => {
        if (state.confirmDeleteHotspotIndex === index) {
            const wrap = document.createElement('div');
            wrap.innerHTML = confirmDeleteHtml(index, tr);
            const node = wrap.firstElementChild;
            if (node) container.appendChild(node);
            return;
        }

        const isSelected = index === state.selectedHotspotIndex;
        const issues = state.hotspotIssues(index);
        const validity = issues[0]
            ? `<span class="three-sixty-hotspot-validity" title="${escapeAttr(issues[0].message)}" aria-label="${escapeAttr(issues[0].message)}">⚠</span>`
            : '';

        const item = document.createElement('div');
        item.className =
            `three-sixty-hotspot-item three-sixty-kind--${kindClass(hotspot.action.type)}` +
            (isSelected ? ' is-selected' : '');
        item.setAttribute('role', 'listitem');
        item.setAttribute('data-hotspot-index', String(index));

        item.innerHTML =
            `<div class="three-sixty-hotspot-row">` +
            `<button type="button" class="three-sixty-hotspot-select" data-index="${index}" aria-expanded="${isSelected ? 'true' : 'false'}" tabindex="${isSelected ? '0' : '-1'}">` +
            `<span class="badge three-sixty-hotspot-badge">${escapeHtml(actionTypeLabel(hotspot.action.type, tr))}</span>` +
            `<span class="three-sixty-hotspot-summary">${escapeHtml(hotspotSummary(hotspot, tr))}</span>` +
            validity +
            `</button>` +
            rowActionsHtml(index, isSelected, tr) +
            `</div>` +
            (isSelected ? detailHtml(state, hotspot, index, isFlat, tr) : '');

        container.appendChild(item);
    });

    // Roving tabindex: when nothing is selected, the first row is tabbable.
    if (state.selectedHotspotIndex < 0) {
        const first = container.querySelector<HTMLElement>('.three-sixty-hotspot-select');
        if (first) first.setAttribute('tabindex', '0');
    }
}

/** Update the Hotspots count next to the section title (if present). */
export function refreshHotspotCount(root: HTMLElement, state: EditorState, tr: Translate): void {
    const countEl = root.querySelector('#threeSixtyHotspotsCount');
    if (!countEl) return;
    const count = state.activeScene().hotspots.length;
    countEl.textContent = count
        ? `${count} ${tr(count === 1 ? 'hotspot' : 'hotspots')}`
        : '';
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

function flashSavedStatus(row: Element | null, tr: Translate): void {
    const status = row?.querySelector('.three-sixty-hotspot-saved');
    if (!(status instanceof HTMLElement)) return;
    status.classList.remove('is-saved');
    // Force reflow so the fade-in restarts even on rapid consecutive edits.
    void status.offsetWidth;
    status.innerHTML = `<span class="exe-icon" aria-hidden="true">check</span> ${escapeHtml(tr('Saved'))}`;
    status.classList.add('is-saved');
    const previous = Number(status.dataset.timerId || 0);
    if (previous) window.clearTimeout(previous);
    const timerId = window.setTimeout(() => {
        status.classList.remove('is-saved');
        delete status.dataset.timerId;
    }, SAVED_STATUS_MS);
    status.dataset.timerId = String(timerId);
}

/** Delegated input/change/click/keyboard handling; attach ONCE per form build. */
export function wireHotspotList(
    container: HTMLElement,
    state: EditorState,
    callbacks: HotspotListCallbacks,
    tr: Translate = text => text,
): void {
    container.addEventListener('input', event => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
        if (!target?.getAttribute) return;
        const index = Number.parseInt(target.getAttribute('data-index') ?? '', 10);
        if (Number.isNaN(index)) return;
        if (updateFromInput(state, target, index)) {
            state.selectedHotspotIndex = index;
            callbacks.onChanged();
            const row = container.querySelector(`.three-sixty-hotspot-item[data-hotspot-index="${index}"]`);
            flashSavedStatus(row, tr);
            // Keep the collapsed summary in sync while typing the label.
            const summary = row?.querySelector('.three-sixty-hotspot-summary');
            const hotspot = state.hotspotAt(index);
            if (summary && hotspot && target.classList.contains('hotspot-label')) {
                summary.textContent = target.value.trim() || hotspotSummary(hotspot, tr);
            }
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
                state.confirmDeleteHotspotIndex = null;
                callbacks.onStructureChanged();
            }
        } else if (target.classList.contains('hotspot-payload-newTab')) {
            const hotspot = state.hotspotAt(index);
            if (hotspot?.action.type === 'link') {
                hotspot.action.payload.newTab = Boolean(target.checked);
                callbacks.onChanged();
                flashSavedStatus(
                    container.querySelector(`.three-sixty-hotspot-item[data-hotspot-index="${index}"]`),
                    tr,
                );
            }
        } else if (target.classList.contains('hotspot-payload-url') || target.classList.contains('hotspot-payload-sceneId')) {
            // Re-render on commit so validation feedback / summary updates.
            callbacks.onStructureChanged();
        }
    });

    container.addEventListener('click', event => {
        const origin = event.target as HTMLElement | null;
        if (!origin) return;

        const delYes = origin.closest('button.three-sixty-hotspot-del-yes');
        if (delYes) {
            const index = Number.parseInt(delYes.getAttribute('data-index') ?? '', 10);
            if (!Number.isNaN(index)) {
                state.confirmDeleteHotspotIndex = null;
                state.removeHotspot(index);
                callbacks.onStructureChanged();
            }
            return;
        }
        const delNo = origin.closest('button.three-sixty-hotspot-del-no');
        if (delNo) {
            state.confirmDeleteHotspotIndex = null;
            callbacks.onStructureChanged();
            return;
        }

        const done = origin.closest('button.three-sixty-hotspot-done');
        if (done) {
            callbacks.onDeselect();
            return;
        }

        const remove = origin.closest('button[data-hotspot-action="remove"]');
        if (remove) {
            const index = Number.parseInt(remove.getAttribute('data-index') ?? '', 10);
            if (!Number.isNaN(index)) {
                // Inline confirm (no modal). Collapse the editor while confirming.
                state.selectedHotspotIndex = -1;
                state.confirmDeleteHotspotIndex = index;
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

        const selectBtn = origin.closest('button.three-sixty-hotspot-select');
        if (selectBtn) {
            const index = Number.parseInt(selectBtn.getAttribute('data-index') ?? '', 10);
            if (Number.isNaN(index)) return;
            if (index === state.selectedHotspotIndex) {
                callbacks.onDeselect();
            } else {
                state.confirmDeleteHotspotIndex = null;
                callbacks.onSelect(index);
            }
            return;
        }
    });

    container.addEventListener('keydown', event => {
        const key = event.key;
        if (key === 'Escape' && state.selectedHotspotIndex >= 0) {
            event.preventDefault();
            callbacks.onDeselect();
            return;
        }
        if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
        const selects = Array.from(container.querySelectorAll<HTMLButtonElement>('.three-sixty-hotspot-select'));
        if (selects.length === 0) return;
        const active = document.activeElement;
        const current = selects.findIndex(button => button === active);
        if (current < 0 && key !== 'Home' && key !== 'End') return;
        event.preventDefault();
        let next = current;
        if (key === 'ArrowDown') next = Math.min(selects.length - 1, current + 1);
        else if (key === 'ArrowUp') next = Math.max(0, current - 1);
        else if (key === 'Home') next = 0;
        else next = selects.length - 1;
        selects[next]?.focus();
    });
}
