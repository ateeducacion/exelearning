import { describe, expect, it } from 'vitest';
import { makeMarker, sequentialIds } from '../test/helpers';
import { computeScore, gradeSingleChoice, isActivityComplete, questionMarkers, SCORE_SCALE } from './scoring';
import { normalizeQuestion } from './schema';

function questionMarker(id: string): ReturnType<typeof makeMarker> {
    return makeMarker({ id, action: { type: 'question', payload: { prompt: id } } }, 0, sequentialIds());
}

describe('gradeSingleChoice', () => {
    it('grades the chosen option by id', () => {
        const question = normalizeQuestion(
            {
                options: [
                    { id: 'a', text: 'A', correct: false },
                    { id: 'b', text: 'B', correct: true },
                ],
            },
            sequentialIds(),
        );
        expect(gradeSingleChoice(question, 'b')).toBe(true);
        expect(gradeSingleChoice(question, 'a')).toBe(false);
        expect(gradeSingleChoice(question, 'missing')).toBe(false);
    });
});

describe('questionMarkers', () => {
    it('selects only the question markers, in order', () => {
        const markers = [makeMarker({ id: 'info' }, 0, sequentialIds()), questionMarker('q1'), questionMarker('q2')];
        expect(questionMarkers(markers).map(marker => marker.id)).toEqual(['q1', 'q2']);
    });
});

describe('computeScore', () => {
    it('is the fraction of question markers answered correctly, on the 0..10 scale', () => {
        const markers = [questionMarker('q1'), questionMarker('q2'), questionMarker('q3'), questionMarker('q4')];
        expect(computeScore(markers, new Set(['q1']))).toBe(SCORE_SCALE / 4);
        expect(computeScore(markers, new Set(['q1', 'q2']))).toBe(SCORE_SCALE / 2);
        expect(computeScore(markers, new Set(['q1', 'q2', 'q3', 'q4']))).toBe(SCORE_SCALE);
    });

    it('ignores non-question markers and unknown ids', () => {
        const markers = [makeMarker({ id: 'info' }, 0, sequentialIds()), questionMarker('q1')];
        expect(computeScore(markers, new Set(['info', 'ghost']))).toBe(0);
        expect(computeScore(markers, new Set(['q1']))).toBe(SCORE_SCALE);
    });

    it('is 0 when there is nothing to score', () => {
        expect(computeScore([], new Set())).toBe(0);
        expect(computeScore([makeMarker({ id: 'info' }, 0, sequentialIds())], new Set(['info']))).toBe(0);
    });
});

describe('isActivityComplete', () => {
    it('is true only once every question marker is correct', () => {
        const markers = [questionMarker('q1'), questionMarker('q2')];
        expect(isActivityComplete(markers, new Set(['q1']))).toBe(false);
        expect(isActivityComplete(markers, new Set(['q1', 'q2']))).toBe(true);
    });

    it('is false when there are no question markers at all', () => {
        expect(isActivityComplete([], new Set())).toBe(false);
    });
});
