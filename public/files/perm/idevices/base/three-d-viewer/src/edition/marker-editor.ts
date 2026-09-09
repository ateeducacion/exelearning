/**
 * The marker editor panel.
 *
 * It edits a DRAFT copy and only writes back through `onSave`, so cancelling
 * genuinely discards changes. Validation returns a typed result instead of
 * throwing or silently saving something invalid.
 */

import { normalizeAction, normalizeMarker } from '../shared/schema';
import type { IdFactory, Marker, MarkerActionType, MarkerCamera, SingleChoiceQuestion } from '../shared/types';
import { MARKER_ACTION_TYPES, MARKER_ICONS } from '../shared/types';
import type { Translate } from './editor';

/** Upper bound the authoring UI allows; storage tolerates more. */
const MAX_AUTHORED_OPTIONS = 8;

export type ValidationResult = { valid: true } | { valid: false; message: string };

export interface MarkerEditorCallbacks {
    onSave: (marker: Marker) => void;
    onCancel: () => void;
    onDelete: (markerId: string) => void;
    /** Capture the current camera; returns null when no renderer is live. */
    captureCamera: () => MarkerCamera | null;
}

export interface MarkerEditorHandle {
    readonly markerId: string;
    /** The draft being edited, exposed for tests and the placement flow. */
    readonly draft: Marker;
    close(): void;
}

/** A marker is saveable when its action is complete enough to be useful. */
export function validateMarker(marker: Marker, t: Translate): ValidationResult {
    if (marker.action.type !== 'question') {
        return { valid: true };
    }
    const question = marker.action.payload;
    if (!question.prompt.trim()) {
        return { valid: false, message: t('Enter the question prompt.') };
    }
    const answered = question.options.filter(option => option.text.trim().length > 0);
    if (answered.length < 2) {
        return { valid: false, message: t('Enter at least two answer options.') };
    }
    if (question.options.filter(option => option.correct).length !== 1) {
        return { valid: false, message: t('Mark exactly one option as correct.') };
    }
    return { valid: true };
}

function labelledInput(
    container: HTMLElement,
    id: string,
    labelText: string,
    element: HTMLInputElement | HTMLTextAreaElement,
): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-2';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', id);
    label.textContent = labelText;
    element.id = id;
    wrapper.append(label, element);
    container.appendChild(wrapper);
}

function textInput(value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control';
    input.value = value;
    return input;
}

function textArea(value: string, rows = 3): HTMLTextAreaElement {
    const area = document.createElement('textarea');
    area.className = 'form-control';
    area.rows = rows;
    area.value = value;
    return area;
}

function renderQuestionFields(
    container: HTMLElement,
    question: SingleChoiceQuestion,
    t: Translate,
    createId: IdFactory,
): void {
    const prompt = textArea(question.prompt, 2);
    prompt.classList.add('mb-2');
    prompt.setAttribute('aria-label', t('Question prompt'));
    prompt.placeholder = t('Question prompt');
    prompt.addEventListener('input', () => {
        question.prompt = prompt.value;
    });
    container.appendChild(prompt);

    const optionsHost = document.createElement('div');
    optionsHost.className = 'tdv-q-options';
    container.appendChild(optionsHost);

    const renderOptions = (): void => {
        optionsHost.innerHTML = '';
        question.options.forEach((option, index) => {
            const row = document.createElement('div');
            row.className = 'input-group input-group-sm mb-1';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'tdvMkCorrect';
            radio.className = 'form-check-input mt-2 me-2';
            radio.checked = option.correct;
            radio.setAttribute('aria-label', `${t('Correct answer')} ${index + 1}`);
            radio.addEventListener('change', () => {
                for (const other of question.options) {
                    other.correct = other === option;
                }
            });

            const text = textInput(option.text);
            text.placeholder = `${t('Option')} ${index + 1}`;
            text.addEventListener('input', () => {
                option.text = text.value;
            });

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn btn-outline-secondary';
            remove.textContent = '✕';
            remove.setAttribute('aria-label', `${t('Remove option')} ${index + 1}`);
            remove.disabled = question.options.length <= 2;
            remove.addEventListener('click', () => {
                question.options = question.options.filter(other => other !== option);
                if (!question.options.some(other => other.correct) && question.options[0]) {
                    question.options[0].correct = true;
                }
                renderOptions();
            });

            row.append(radio, text, remove);
            optionsHost.appendChild(row);
        });
    };
    renderOptions();

    const addOption = document.createElement('button');
    addOption.type = 'button';
    addOption.className = 'btn btn-outline-secondary btn-sm mb-2';
    addOption.textContent = t('Add option');
    addOption.addEventListener('click', () => {
        if (question.options.length >= MAX_AUTHORED_OPTIONS) {
            return;
        }
        question.options.push({ id: createId('option'), text: '', correct: false });
        renderOptions();
    });
    container.appendChild(addOption);

    const feedbackCorrect = textInput(question.feedbackCorrect);
    feedbackCorrect.classList.add('mb-2');
    feedbackCorrect.placeholder = t('Feedback when correct');
    feedbackCorrect.addEventListener('input', () => {
        question.feedbackCorrect = feedbackCorrect.value;
    });
    container.appendChild(feedbackCorrect);

    const feedbackIncorrect = textInput(question.feedbackIncorrect);
    feedbackIncorrect.classList.add('mb-2');
    feedbackIncorrect.placeholder = t('Feedback when incorrect');
    feedbackIncorrect.addEventListener('input', () => {
        question.feedbackIncorrect = feedbackIncorrect.value;
    });
    container.appendChild(feedbackIncorrect);

    const attemptsWrapper = document.createElement('div');
    attemptsWrapper.className = 'mb-1';
    const attempts = document.createElement('input');
    attempts.type = 'number';
    attempts.className = 'form-control';
    attempts.min = '0';
    attempts.max = '20';
    attempts.value = String(question.attemptsAllowed);
    attempts.addEventListener('input', () => {
        question.attemptsAllowed = Number.parseInt(attempts.value, 10) || 0;
    });
    labelledInput(attemptsWrapper, 'tdvMkAttempts', t('Attempts allowed (0 = unlimited)'), attempts);
    container.appendChild(attemptsWrapper);
}

/** Render the fields specific to the draft's current action type. */
export function renderActionFields(container: HTMLElement, draft: Marker, t: Translate, createId: IdFactory): void {
    container.innerHTML = '';
    const action = draft.action;
    switch (action.type) {
        case 'information': {
            const html = textArea(action.payload.html);
            html.addEventListener('input', () => {
                action.payload.html = html.value;
            });
            labelledInput(container, 'tdvMkHtml', t('Content (HTML allowed)'), html);
            return;
        }
        case 'image': {
            const src = textInput(action.payload.src);
            src.addEventListener('input', () => {
                action.payload.src = src.value;
            });
            labelledInput(container, 'tdvMkImgSrc', t('Image URL'), src);
            const alt = textInput(action.payload.alt);
            alt.addEventListener('input', () => {
                action.payload.alt = alt.value;
            });
            labelledInput(container, 'tdvMkImgAlt', t('Alternative text'), alt);
            const caption = textInput(action.payload.caption);
            caption.addEventListener('input', () => {
                action.payload.caption = caption.value;
            });
            labelledInput(container, 'tdvMkImgCap', t('Caption'), caption);
            return;
        }
        case 'video': {
            const src = textInput(action.payload.src);
            src.addEventListener('input', () => {
                action.payload.src = src.value;
            });
            labelledInput(container, 'tdvMkVidSrc', t('Video URL'), src);
            const poster = textInput(action.payload.poster);
            poster.addEventListener('input', () => {
                action.payload.poster = poster.value;
            });
            labelledInput(container, 'tdvMkVidPoster', t('Poster URL'), poster);
            return;
        }
        case 'link': {
            const url = textInput(action.payload.url);
            url.addEventListener('input', () => {
                action.payload.url = url.value;
            });
            labelledInput(container, 'tdvMkLinkUrl', t('Link URL'), url);
            const check = document.createElement('div');
            check.className = 'form-check';
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.className = 'form-check-input';
            box.id = 'tdvMkNewTab';
            box.checked = action.payload.newTab;
            box.addEventListener('change', () => {
                action.payload.newTab = box.checked;
            });
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.setAttribute('for', 'tdvMkNewTab');
            label.textContent = t('Open in a new tab');
            check.append(box, label);
            container.appendChild(check);
            return;
        }
        case 'question':
            renderQuestionFields(container, action.payload, t, createId);
            return;
    }
}

function buildPanelMarkup(t: Translate): string {
    return `
                <div class="tdv-marker-editor" role="dialog" aria-modal="false" aria-label="${t('Edit marker')}">
                    <div class="tdv-marker-editor-head d-flex justify-content-between align-items-center mb-2">
                        <h3 class="h6 mb-0">${t('Edit marker')}</h3>
                        <button type="button" class="btn-close" data-close aria-label="${t('Close')}"></button>
                    </div>
                    <div class="mb-2">
                        <label class="form-label" for="tdvMkLabel">${t('Label')}</label>
                        <input type="text" class="form-control" id="tdvMkLabel" maxlength="120" />
                    </div>
                    <div class="row g-2 mb-2">
                        <div class="col">
                            <label class="form-label" for="tdvMkIcon">${t('Icon')}</label>
                            <select class="form-select" id="tdvMkIcon"></select>
                        </div>
                        <div class="col">
                            <label class="form-label" for="tdvMkType">${t('Action type')}</label>
                            <select class="form-select" id="tdvMkType"></select>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label" for="tdvMkDesc">${t('Short description')}</label>
                        <input type="text" class="form-control" id="tdvMkDesc" maxlength="200" />
                    </div>
                    <div class="tdv-action-fields mb-2" id="tdvActionFields"></div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-capture-camera>${t('Capture current camera')}</button>
                        <span class="form-text text-muted mb-0" data-camera-note></span>
                    </div>
                    <p class="tdv-marker-editor-error text-danger mb-2" data-error role="alert" hidden></p>
                    <div class="d-flex justify-content-between mt-2">
                        <button type="button" class="btn btn-outline-danger btn-sm" data-delete>${t('Delete marker')}</button>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-secondary btn-sm" data-cancel>${t('Cancel')}</button>
                            <button type="button" class="btn btn-primary btn-sm" data-save>${t('Save marker')}</button>
                        </div>
                    </div>
                </div>`;
}

/** Open the editor panel for a marker and wire it to the callbacks. */
export function openMarkerEditor(
    host: HTMLElement,
    marker: Marker,
    t: Translate,
    createId: IdFactory,
    callbacks: MarkerEditorCallbacks,
): MarkerEditorHandle {
    // Deep-copy through the schema: the draft is fully normalized and shares no
    // structure with the stored marker, so cancelling really discards.
    const draft = normalizeMarker(JSON.parse(JSON.stringify(marker)) as unknown, marker.order, createId);
    host.innerHTML = buildPanelMarkup(t);

    const panel = host.querySelector<HTMLElement>('.tdv-marker-editor');
    if (!panel) {
        throw new Error('[3D Viewer] Marker editor panel failed to render');
    }
    const query = <T extends Element>(selector: string): T => {
        const element = panel.querySelector<T>(selector);
        if (!element) {
            throw new Error(`[3D Viewer] Marker editor element not found: ${selector}`);
        }
        return element;
    };

    const iconSelect = query<HTMLSelectElement>('#tdvMkIcon');
    for (const icon of MARKER_ICONS) {
        const option = document.createElement('option');
        option.value = icon;
        option.textContent = icon;
        iconSelect.appendChild(option);
    }
    const typeLabels: Record<MarkerActionType, string> = {
        information: t('Information'),
        image: t('Image'),
        video: t('Video'),
        link: t('Link'),
        question: t('Question'),
    };
    const typeSelect = query<HTMLSelectElement>('#tdvMkType');
    for (const type of MARKER_ACTION_TYPES) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = typeLabels[type];
        typeSelect.appendChild(option);
    }

    const labelInput = query<HTMLInputElement>('#tdvMkLabel');
    const descriptionInput = query<HTMLInputElement>('#tdvMkDesc');
    labelInput.value = draft.label;
    descriptionInput.value = draft.description;
    iconSelect.value = draft.icon;
    typeSelect.value = draft.action.type;

    const cameraNote = query<HTMLElement>('[data-camera-note]');
    if (draft.camera.orbit || draft.camera.target) {
        cameraNote.textContent = t('Camera captured');
    }
    const errorNote = query<HTMLElement>('[data-error]');
    const actionFields = query<HTMLElement>('#tdvActionFields');
    const renderFields = (): void => renderActionFields(actionFields, draft, t, createId);
    renderFields();

    typeSelect.addEventListener('change', () => {
        draft.action = normalizeAction({ type: typeSelect.value, payload: {} }, createId);
        if (typeSelect.value === 'question') {
            iconSelect.value = 'question';
        }
        renderFields();
    });

    query<HTMLElement>('[data-capture-camera]').addEventListener('click', () => {
        const camera = callbacks.captureCamera();
        if (camera) {
            draft.camera = camera;
            cameraNote.textContent = t('Camera captured');
        }
    });

    let closed = false;
    const close = (): void => {
        if (closed) {
            return;
        }
        closed = true;
        host.innerHTML = '';
    };

    const cancel = (): void => {
        close();
        callbacks.onCancel();
    };
    query<HTMLElement>('[data-close]').addEventListener('click', cancel);
    query<HTMLElement>('[data-cancel]').addEventListener('click', cancel);
    query<HTMLElement>('[data-delete]').addEventListener('click', () => {
        close();
        callbacks.onDelete(marker.id);
    });
    query<HTMLElement>('[data-save]').addEventListener('click', () => {
        draft.label = labelInput.value;
        draft.description = descriptionInput.value;
        draft.icon = (iconSelect.value as Marker['icon']) || 'circle';
        const normalized = normalizeMarker(draft, draft.order, createId);
        const validation = validateMarker(normalized, t);
        if (!validation.valid) {
            errorNote.hidden = false;
            errorNote.textContent = validation.message;
            return;
        }
        errorNote.hidden = true;
        errorNote.textContent = '';
        close();
        callbacks.onSave(normalized);
    });

    try {
        labelInput.focus();
    } catch {
        // happy-dom refuses focus on detached nodes; not fatal.
    }

    return { markerId: marker.id, draft, close };
}
