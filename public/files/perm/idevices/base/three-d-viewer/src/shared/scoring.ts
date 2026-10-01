/**
 * Pure grading and score arithmetic. No browser globals, no SCORM transport —
 * the transport lives in `edition/scorm.ts` and `export/scorm.ts` and calls in
 * here for every number it reports.
 */

import type { Marker, SingleChoiceQuestion } from './types';

/** The eXe gamification framework reports scores on a 0..10 scale. */
export const SCORE_SCALE = 10;

/** Grade a single-choice answer by option id. */
export function gradeSingleChoice(question: SingleChoiceQuestion, selectedOptionId: string): boolean {
    const chosen = question.options.find(option => option.id === selectedOptionId);
    return Boolean(chosen?.correct);
}

/** Every marker whose action is a question, in authoring order. */
export function questionMarkers(markers: readonly Marker[]): Marker[] {
    return markers.filter(marker => marker.action.type === 'question');
}

/**
 * The activity score: correctly answered question markers over the total
 * number of question markers, on the 0..10 convention.
 *
 * `correctMarkerIds` is a set so a marker answered correctly twice still counts
 * once; markers that are not questions (or no longer exist) are ignored.
 */
export function computeScore(markers: readonly Marker[], correctMarkerIds: ReadonlySet<string>): number {
    const questions = questionMarkers(markers);
    if (questions.length === 0) {
        return 0;
    }
    const correct = questions.filter(marker => correctMarkerIds.has(marker.id)).length;
    return (correct * SCORE_SCALE) / questions.length;
}

/** Whether every question marker has been answered correctly. */
export function isActivityComplete(markers: readonly Marker[], correctMarkerIds: ReadonlySet<string>): boolean {
    const questions = questionMarkers(markers);
    return questions.length > 0 && questions.every(marker => correctMarkerIds.has(marker.id));
}
