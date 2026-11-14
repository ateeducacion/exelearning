/**
 * Action-specific hotspot payload editors. Changing the action type shows
 * only the fields that action needs; validation issues render inline next to
 * the affected field (text + colour, never colour alone).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { ActionValidationIssue } from '../shared/hotspot-actions';
import { escapeAttr, escapeHtml } from '../shared/html';
import type { Hotspot } from '../shared/types';
import { HOTSPOT_ACTION_TYPES } from '../shared/types';
import type { Translate } from './i18n';
import type { EditorState } from './state';

export function actionTypeLabel(type: string, tr: Translate): string {
    switch (type) {
        case 'goToScene':
            return tr('Go to scene');
        case 'text':
            return tr('Text');
        case 'image':
            return tr('Image');
        case 'video':
            return tr('Video');
        case 'link':
            return tr('External link');
        default:
            return type;
    }
}

export function actionTypeOptionsHtml(hotspot: Hotspot, tr: Translate): string {
    const options = HOTSPOT_ACTION_TYPES.map(
        type =>
            `<option value="${type}"${hotspot.action.type === type ? ' selected' : ''}>` +
            `${escapeHtml(actionTypeLabel(type, tr))}</option>`,
    );
    if (hotspot.action.type === 'unsupported') {
        // Shown, never offered: keeps the original type visible and intact.
        options.push(
            `<option value="unsupported" selected disabled>` +
                `${escapeHtml(tr('Unsupported'))} (${escapeHtml(hotspot.action.originalType)})</option>`,
        );
    }
    return options.join('');
}

function issueHtml(field: string, issues: readonly ActionValidationIssue[]): string {
    const issue = issues.find(candidate => candidate.field === field);
    if (!issue) return '';
    return `<span class="hotspot-field-error small" role="alert">⚠ ${escapeHtml(issue.message)}</span>`;
}

/** The payload inputs for one hotspot row (index-scoped class hooks). */
export function payloadInputsHtml(
    state: EditorState,
    hotspot: Hotspot,
    index: number,
    tr: Translate,
): string {
    const issues = state.hotspotIssues(index);
    const action = hotspot.action;
    switch (action.type) {
        case 'goToScene': {
            const options = state.doc.scenes
                .map(scene => {
                    const label = scene.title || scene.id;
                    return (
                        `<option value="${escapeAttr(scene.id)}"${action.payload.sceneId === scene.id ? ' selected' : ''}>` +
                        `${escapeHtml(label)}</option>`
                    );
                })
                .join('');
            return (
                `<label>${tr('Target scene')}: ` +
                `<select class="form-control hotspot-payload-sceneId" data-index="${index}">` +
                `<option value="">--</option>${options}</select></label>` +
                issueHtml('sceneId', issues)
            );
        }
        case 'text':
            return (
                `<label>${tr('Text')}: ` +
                `<textarea class="form-control hotspot-payload-html" data-index="${index}" rows="3">` +
                `${escapeHtml(action.payload.html)}</textarea></label>`
            );
        case 'image':
            return (
                `<label>${tr('Image URL')}: ` +
                `<input type="text" class="form-control hotspot-payload-src" data-index="${index}" value="${escapeAttr(action.payload.src)}" /></label>` +
                `<button type="button" class="btn btn-sm btn-secondary hotspot-payload-pickImage" data-index="${index}">${tr('Choose image…')}</button>` +
                issueHtml('src', issues) +
                `<label>${tr('Alternative text')}: ` +
                `<input type="text" class="form-control hotspot-payload-alt" data-index="${index}" value="${escapeAttr(action.payload.alt)}" /></label>` +
                `<label>${tr('Caption')}: ` +
                `<input type="text" class="form-control hotspot-payload-caption" data-index="${index}" value="${escapeAttr(action.payload.caption)}" /></label>`
            );
        case 'video':
            return (
                `<label>${tr('Video URL')}: ` +
                `<input type="text" class="form-control hotspot-payload-src" data-index="${index}" value="${escapeAttr(action.payload.src)}" /></label>` +
                `<button type="button" class="btn btn-sm btn-secondary hotspot-payload-pickVideo" data-index="${index}">${tr('Choose video…')}</button>` +
                issueHtml('src', issues) +
                `<p class="exe-block-info small">${escapeHtml(
                    tr('Paste a YouTube, Vimeo or Educamadrid Mediateca page URL to embed it, or choose an uploaded video file.'),
                )}</p>`
            );
        case 'link':
            return (
                `<label>${tr('Link URL')}: ` +
                `<input type="url" class="form-control hotspot-payload-url" data-index="${index}" value="${escapeAttr(action.payload.url)}" placeholder="https://example.com" /></label>` +
                issueHtml('url', issues) +
                `<label class="toggle-label"><input type="checkbox" class="hotspot-payload-newTab" data-index="${index}"` +
                `${action.payload.newTab !== false ? ' checked' : ''} /> ${tr('Open in a new tab')}</label>`
            );
        case 'unsupported':
            return `<p class="exe-block-info small">${escapeHtml(
                tr('This hotspot uses a feature from a newer eXeLearning version. Its data is preserved and will be saved unchanged.'),
            )}</p>`;
    }
}
