/**
 * Scene list rendering + delegated wiring: select, set-start, duplicate and
 * remove. Deleting a scene that goToScene hotspots point at asks for
 * confirmation, tells the author how many hotspots are affected, and repairs
 * them deterministically (their target is cleared and flagged).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { escapeAttr, escapeHtml } from '../shared/html';
import type { Translate } from './i18n';
import type { EditorState } from './state';

export interface SceneListCallbacks {
    readonly onSelect: (index: number) => void;
    readonly onSetStart: (index: number) => void;
    readonly onDuplicate: (index: number) => void;
    readonly onRemove: (index: number) => void;
}

export function renderSceneList(container: HTMLElement, state: EditorState, tr: Translate): void {
    container.innerHTML = '';
    state.doc.scenes.forEach((scene, index) => {
        const row = document.createElement('div');
        row.className = `three-sixty-scene-item${index === state.activeSceneIndex ? ' is-active' : ''}`;
        row.setAttribute('role', 'listitem');
        row.setAttribute('data-scene-index', String(index));
        const label = scene.title || `${tr('Scene')} ${index + 1}`;
        const isStart = scene.id === state.doc.startSceneId;
        const projectionBadge =
            scene.projection === 'flat'
                ? `<span class="badge three-sixty-scene-badge three-sixty-scene-badge--flat">${escapeHtml(tr('Flat'))}</span>`
                : `<span class="badge three-sixty-scene-badge three-sixty-scene-badge--pano">${escapeHtml(tr('360°'))}</span>`;
        row.innerHTML =
            `<button type="button" class="three-sixty-scene-select" data-action="select" data-index="${index}" aria-pressed="${index === state.activeSceneIndex ? 'true' : 'false'}">` +
            projectionBadge +
            `<span class="three-sixty-scene-label">${escapeHtml(label)}</span>` +
            (isStart ? ` <span class="badge three-sixty-scene-badge three-sixty-scene-badge--start">${escapeHtml(tr('Start'))}</span>` : '') +
            '</button>' +
            `<div class="three-sixty-scene-actions btn-group btn-group-sm" role="group" aria-label="${escapeAttr(tr('Scene actions'))}">` +
            `<button type="button" class="btn btn-secondary btn-sm" data-action="set-start" data-index="${index}" ` +
            `title="${escapeAttr(tr('Set as start scene'))}" aria-label="${escapeAttr(tr('Set as start scene'))}"${isStart ? ' disabled' : ''}>★</button>` +
            `<button type="button" class="btn btn-secondary btn-sm" data-action="duplicate" data-index="${index}" ` +
            `title="${escapeAttr(tr('Duplicate scene'))}" aria-label="${escapeAttr(tr('Duplicate scene'))}">` +
            `<span class="small-icon duplicate-icon-green" aria-hidden="true"></span></button>` +
            `<button type="button" class="btn btn-secondary btn-sm" data-action="remove" data-index="${index}" ` +
            `title="${escapeAttr(tr('Remove scene'))}" aria-label="${escapeAttr(tr('Remove scene'))}">` +
            `<span class="small-icon delete-icon-red" aria-hidden="true"></span></button>` +
            '</div>';
        container.appendChild(row);
    });
}

/** Delegated click handling; attach ONCE per form build. */
export function wireSceneList(container: HTMLElement, callbacks: SceneListCallbacks): void {
    container.addEventListener('click', event => {
        const button = (event.target as HTMLElement | null)?.closest('button[data-action]');
        if (!button) return;
        const index = Number.parseInt(button.getAttribute('data-index') ?? '', 10);
        if (Number.isNaN(index)) return;
        switch (button.getAttribute('data-action')) {
            case 'select':
                callbacks.onSelect(index);
                break;
            case 'set-start':
                callbacks.onSetStart(index);
                break;
            case 'duplicate':
                callbacks.onDuplicate(index);
                break;
            case 'remove':
                callbacks.onRemove(index);
                break;
            default:
                break;
        }
    });
}

/**
 * The confirmation text for deleting a scene. Mentions how many hotspots in
 * other scenes still point at it so the author decides with full knowledge.
 */
export function removeSceneConfirmation(state: EditorState, index: number, tr: Translate): string {
    const scene = state.doc.scenes[index];
    const label = scene?.title || scene?.id || '';
    const references = state.referencesToScene(index);
    if (references.length === 0) {
        return tr('Delete scene "%s"?').replace('%s', label);
    }
    return tr('Delete scene "%s"? %n hotspot(s) point at it; their target will be cleared and marked for review.')
        .replace('%s', label)
        .replace('%n', String(references.length));
}
