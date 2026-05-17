import { describe, it, expect, beforeEach } from 'vitest';
import { DeveloperStatusReporter, STATUS } from './DeveloperStatusReporter.js';

function makeEl() {
    const attrs = {};
    return {
        hidden: false,
        textContent: '',
        getAttribute: k => attrs[k],
        setAttribute: (k, v) => {
            attrs[k] = v;
        },
    };
}

describe('DeveloperStatusReporter', () => {
    let statusEl;
    let errorEl;
    let stateEl;

    beforeEach(() => {
        statusEl = makeEl();
        errorEl = makeEl();
        errorEl.hidden = true;
        stateEl = makeEl();
    });

    it('starts in the initializing status', () => {
        const r = new DeveloperStatusReporter({ statusEl, stateEl });
        expect(r.statusValue).toBe(STATUS.INITIALIZING);
    });

    it('updates status text and data-status attribute', () => {
        const r = new DeveloperStatusReporter({ statusEl, stateEl });
        r.setStatus(STATUS.READY, 'All set');
        expect(statusEl.textContent).toBe('All set');
        expect(statusEl.getAttribute('data-status')).toBe('ready');
    });

    it('writes JSON to the state element', () => {
        const r = new DeveloperStatusReporter({ statusEl, stateEl });
        r.setState({ fixture: 'demo', viewport: 'mobile' });
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.fixture).toBe('demo');
        expect(parsed.viewport).toBe('mobile');
    });

    it('merges state shallowly', () => {
        const r = new DeveloperStatusReporter({ statusEl, stateEl });
        r.setState({ a: 1, b: 2 });
        r.setState({ b: 3, c: 4 });
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('replaces state entirely with replaceState()', () => {
        const r = new DeveloperStatusReporter({ statusEl, stateEl });
        r.setState({ a: 1, b: 2 });
        r.replaceState({ c: 3 });
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed).toEqual({ c: 3 });
    });

    it('records status in state', () => {
        const r = new DeveloperStatusReporter({ statusEl, stateEl });
        r.setStatus(STATUS.READY, 'ok');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.status).toBe('ready');
    });

    it('reports errors and shows the error element', () => {
        const r = new DeveloperStatusReporter({ statusEl, errorEl, stateEl });
        r.setError('boom');
        expect(errorEl.hidden).toBe(false);
        expect(errorEl.textContent).toBe('boom');
        expect(statusEl.getAttribute('data-status')).toBe('error');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.error).toBe('boom');
    });

    it('accepts Error instances', () => {
        const r = new DeveloperStatusReporter({ statusEl, errorEl, stateEl });
        r.setError(new Error('detailed message'));
        expect(errorEl.textContent).toBe('detailed message');
    });

    it('falls back to "Unknown error" when nothing useful is passed', () => {
        const r = new DeveloperStatusReporter({ statusEl, errorEl, stateEl });
        r.setError({});
        expect(errorEl.textContent).toBe('Unknown error');
    });

    it('clears errors via clearError()', () => {
        const r = new DeveloperStatusReporter({ statusEl, errorEl, stateEl });
        r.setError('bad');
        r.clearError();
        expect(errorEl.hidden).toBe(true);
        expect(errorEl.textContent).toBe('');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.error).toBeUndefined();
    });

    it('survives missing DOM elements', () => {
        const r = new DeveloperStatusReporter({});
        expect(() => r.setStatus('ready', 'ok')).not.toThrow();
        expect(() => r.setError('boom')).not.toThrow();
        expect(() => r.setState({ a: 1 })).not.toThrow();
    });

    it('returns a defensive copy of the state', () => {
        const r = new DeveloperStatusReporter({ statusEl, stateEl });
        r.setState({ a: 1 });
        const snapshot = r.getState();
        snapshot.a = 99;
        expect(r.getState().a).toBe(1);
    });
});
