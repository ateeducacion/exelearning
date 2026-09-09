/**
 * The single-choice question renderer.
 *
 * Attempt and answer state come from the controller's `AnswerStore`, so
 * reopening a marker restores what the learner already did instead of handing
 * them a fresh attempt allowance.
 */

import { gradeSingleChoice } from '../shared/scoring';
import type { Marker, SingleChoiceQuestion } from '../shared/types';
import type { AnswerStore } from './state';

export interface QuestionRenderDeps {
    answers: AnswerStore;
    t: (key: string) => string;
    onAnswered?: (markerId: string, correct: boolean) => void;
}

function lockQuestion(inputs: readonly HTMLInputElement[], checkButton: HTMLButtonElement): void {
    checkButton.disabled = true;
    for (const input of inputs) {
        input.disabled = true;
    }
}

/**
 * Render a question into `body` and wire its Check button.
 *
 * The marker is passed whole (not just its payload) because the answer store is
 * keyed by marker id — that key is what survives the dialog.
 */
export function renderQuestion(body: HTMLElement, marker: Marker, deps: QuestionRenderDeps): void {
    if (marker.action.type !== 'question') {
        return;
    }
    const question: SingleChoiceQuestion = marker.action.payload;
    const { answers, t } = deps;
    const state = answers.get(marker.id);

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'tdv-question';
    const legend = document.createElement('legend');
    legend.className = 'tdv-question-prompt';
    legend.textContent = question.prompt;
    fieldset.appendChild(legend);

    const groupName = `tdv-q-${marker.id}`;
    const inputs: HTMLInputElement[] = [];
    for (const option of question.options) {
        const label = document.createElement('label');
        label.className = 'tdv-question-option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = groupName;
        input.value = option.id;
        if (option.id === state.selectedOptionId) {
            input.checked = true;
        }
        const text = document.createElement('span');
        text.textContent = option.text;
        label.append(input, text);
        fieldset.appendChild(label);
        inputs.push(input);
    }

    const checkButton = document.createElement('button');
    checkButton.type = 'button';
    checkButton.className = 'tdv-q-check';
    checkButton.textContent = t('Check');

    const feedback = document.createElement('div');
    feedback.className = 'tdv-q-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    body.append(fieldset, checkButton, feedback);

    // Restore the state the learner left this marker in.
    if (state.resolved) {
        feedback.className = 'tdv-q-feedback tdv-q-feedback--correct';
        feedback.textContent = question.feedbackCorrect || t('Correct');
        lockQuestion(inputs, checkButton);
    } else if (answers.isExhausted(marker.id, question.attemptsAllowed)) {
        feedback.className = 'tdv-q-feedback tdv-q-feedback--incorrect';
        feedback.textContent = `${question.feedbackIncorrect || t('Incorrect')} ${t('No attempts left')}`;
        lockQuestion(inputs, checkButton);
    }

    checkButton.addEventListener('click', () => {
        const chosen = inputs.find(input => input.checked);
        if (!chosen) {
            feedback.className = 'tdv-q-feedback';
            feedback.textContent = t('Please select an answer');
            return;
        }
        const correct = gradeSingleChoice(question, chosen.value);
        const next = answers.recordAttempt(marker.id, chosen.value, correct);
        try {
            deps.onAnswered?.(marker.id, correct);
        } catch {
            // A failing host hook (SCORM transport) must not break feedback.
        }
        if (correct) {
            feedback.className = 'tdv-q-feedback tdv-q-feedback--correct';
            feedback.textContent = question.feedbackCorrect || t('Correct');
            lockQuestion(inputs, checkButton);
            return;
        }
        feedback.className = 'tdv-q-feedback tdv-q-feedback--incorrect';
        let message = question.feedbackIncorrect || t('Incorrect');
        if (question.attemptsAllowed > 0 && next.attempts >= question.attemptsAllowed) {
            lockQuestion(inputs, checkButton);
            message += ` ${t('No attempts left')}`;
        }
        feedback.textContent = message;
    });
}
