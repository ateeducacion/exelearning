import { describe, expect, it } from 'vitest';
import { createAnswerStore } from './state';

describe('createAnswerStore', () => {
    it('reports an untouched marker as unanswered', () => {
        const store = createAnswerStore();
        expect(store.get('m1')).toEqual({ attempts: 0, resolved: false, selectedOptionId: '' });
    });

    it('counts attempts and remembers the last choice', () => {
        const store = createAnswerStore();
        store.recordAttempt('m1', 'a', false);
        const state = store.recordAttempt('m1', 'b', false);
        expect(state).toEqual({ attempts: 2, resolved: false, selectedOptionId: 'b' });
    });

    it('keeps a marker resolved once it has been answered correctly', () => {
        const store = createAnswerStore();
        store.recordAttempt('m1', 'a', true);
        const state = store.recordAttempt('m1', 'b', false);
        expect(state.resolved).toBe(true);
    });

    it('treats an allowance of 0 as unlimited', () => {
        const store = createAnswerStore();
        store.recordAttempt('m1', 'a', false);
        store.recordAttempt('m1', 'a', false);
        expect(store.isExhausted('m1', 0)).toBe(false);
    });

    it('reports exhaustion once the allowance is used up', () => {
        const store = createAnswerStore();
        expect(store.isExhausted('m1', 1)).toBe(false);
        store.recordAttempt('m1', 'a', false);
        expect(store.isExhausted('m1', 1)).toBe(true);
        expect(store.isExhausted('m1', 2)).toBe(false);
    });

    it('keeps markers independent', () => {
        const store = createAnswerStore();
        store.recordAttempt('m1', 'a', false);
        expect(store.get('m2').attempts).toBe(0);
        expect(store.isExhausted('m2', 1)).toBe(false);
    });

    it('collects the ids answered correctly', () => {
        const store = createAnswerStore();
        store.recordAttempt('m1', 'a', true);
        store.recordAttempt('m2', 'a', false);
        expect([...store.correctMarkerIds()]).toEqual(['m1']);
    });

    it('forgets markers that no longer exist', () => {
        const store = createAnswerStore();
        store.recordAttempt('m1', 'a', true);
        store.recordAttempt('m2', 'a', true);
        store.retain(['m2']);
        expect([...store.correctMarkerIds()]).toEqual(['m2']);
        expect(store.get('m1').attempts).toBe(0);
    });

    it('clears everything', () => {
        const store = createAnswerStore();
        store.recordAttempt('m1', 'a', true);
        store.clear();
        expect([...store.correctMarkerIds()]).toEqual([]);
    });
});
