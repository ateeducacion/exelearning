import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionHooks } from '../interactions/types';
import { normalizeScorm } from '../shared/schema';
import { createWrapper, makeInteraction, resetDom, sequentialIds } from '../test/helpers';
import { getScormRuntime, isScormExport, setupScormScoring } from './scorm';

interface ScormSpy extends ExeScormRuntime {
    registerActivity: (game: Record<string, unknown>) => void;
    sendScoreNew: (auto: boolean, game: Record<string, unknown>) => void;
}

/** Read a spy back as a Vitest mock for assertions. */
function asMock(fn: unknown): ReturnType<typeof vi.fn> {
    return fn as ReturnType<typeof vi.fn>;
}

function installScorm(overrides: Partial<ScormSpy> = {}): ScormSpy {
    const runtime: ScormSpy = {
        registerActivity: vi.fn(),
        sendScoreNew: vi.fn(),
        ...overrides,
    };
    globalThis.$exeDevices = { iDevice: { gamification: { scorm: runtime } } };
    return runtime;
}

const questions = (count: number): Array<Record<string, unknown>> =>
    Array.from({ length: count }, (_, index) => ({
        id: `q${index + 1}`,
        action: { type: 'question', payload: { prompt: `Q${index + 1}` } },
    }));

beforeEach(() => {
    document.body.classList.add('exe-scorm');
});

afterEach(() => {
    document.body.classList.remove('exe-scorm');
    globalThis.$exeDevices = undefined;
    resetDom();
    vi.restoreAllMocks();
});

describe('getScormRuntime / isScormExport', () => {
    it('finds the gamification helper when it is on the page', () => {
        const runtime = installScorm();
        expect(getScormRuntime()).toBe(runtime);
    });

    it('returns null when the framework is absent', () => {
        globalThis.$exeDevices = undefined;
        expect(getScormRuntime()).toBeNull();
    });

    it('detects a SCORM export from the body class', () => {
        expect(isScormExport()).toBe(true);
        document.body.classList.remove('exe-scorm');
        expect(isScormExport()).toBe(false);
    });
});

describe('setupScormScoring', () => {
    it('registers the activity and reports the fraction correct', () => {
        const runtime = installScorm();
        const wrapper = createWrapper('idev-1');
        const interaction = makeInteraction({ enabled: true, markers: questions(4) }, sequentialIds());
        const hooks: InteractionHooks = {};

        const wiring = setupScormScoring(wrapper, interaction, normalizeScorm({ mode: 1, weighted: 80 }), hooks);

        expect(wiring).not.toBeNull();
        expect(asMock(runtime.registerActivity)).toHaveBeenCalledTimes(1);
        expect(asMock(runtime.registerActivity).mock.calls[0]?.[0]).toMatchObject({
            main: 'idev-1',
            idevice: 'three-d-viewer',
            isScorm: 1,
            weighted: 80,
            gameStarted: true,
        });

        hooks.onQuestionAnswered?.('q1', true);
        expect(wiring?.game.scorerp).toBe(2.5);
        expect(wiring?.game.gameOver).toBe(false);
        expect(asMock(runtime.sendScoreNew)).toHaveBeenCalledWith(true, wiring?.game);
    });

    it('counts a marker once even when answered correctly twice', () => {
        installScorm();
        const wrapper = createWrapper();
        const interaction = makeInteraction({ enabled: true, markers: questions(2) }, sequentialIds());
        const hooks: InteractionHooks = {};
        const wiring = setupScormScoring(wrapper, interaction, normalizeScorm({ mode: 1 }), hooks);

        hooks.onQuestionAnswered?.('q1', true);
        hooks.onQuestionAnswered?.('q1', true);
        expect(wiring?.game.scorerp).toBe(5);
    });

    it('marks the activity over once every question is correct', () => {
        installScorm();
        const wrapper = createWrapper();
        const interaction = makeInteraction({ enabled: true, markers: questions(2) }, sequentialIds());
        const hooks: InteractionHooks = {};
        const wiring = setupScormScoring(wrapper, interaction, normalizeScorm({ mode: 2 }), hooks);

        hooks.onQuestionAnswered?.('q1', true);
        hooks.onQuestionAnswered?.('q2', true);
        expect(wiring?.game.scorerp).toBe(10);
        expect(wiring?.game.gameOver).toBe(true);
    });

    it('does not wire scoring when it is switched off', () => {
        const runtime = installScorm();
        const hooks: InteractionHooks = {};
        const interaction = makeInteraction({ enabled: true, markers: questions(1) }, sequentialIds());
        expect(setupScormScoring(createWrapper(), interaction, normalizeScorm({ mode: 0 }), hooks)).toBeNull();
        expect(asMock(runtime.registerActivity)).not.toHaveBeenCalled();
        expect(hooks.onQuestionAnswered).toBeUndefined();
    });

    it('does not wire scoring outside a SCORM export', () => {
        installScorm();
        document.body.classList.remove('exe-scorm');
        const interaction = makeInteraction({ enabled: true, markers: questions(1) }, sequentialIds());
        expect(setupScormScoring(createWrapper(), interaction, normalizeScorm({ mode: 1 }), {})).toBeNull();
    });

    it('does not wire scoring without the framework or without questions', () => {
        globalThis.$exeDevices = undefined;
        const withQuestion = makeInteraction({ enabled: true, markers: questions(1) }, sequentialIds());
        expect(setupScormScoring(createWrapper(), withQuestion, normalizeScorm({ mode: 1 }), {})).toBeNull();

        installScorm();
        const withoutQuestion = makeInteraction({ enabled: true, markers: [{ id: 'info' }] }, sequentialIds());
        expect(setupScormScoring(createWrapper(), withoutQuestion, normalizeScorm({ mode: 1 }), {})).toBeNull();
    });

    it('degrades silently when the framework throws', () => {
        const runtime = installScorm({
            registerActivity: vi.fn(() => {
                throw new Error('not ready');
            }),
            sendScoreNew: vi.fn(() => {
                throw new Error('no connection');
            }),
        });
        const interaction = makeInteraction({ enabled: true, markers: questions(1) }, sequentialIds());
        const hooks: InteractionHooks = {};
        const wiring = setupScormScoring(createWrapper(), interaction, normalizeScorm({ mode: 1 }), hooks);
        expect(wiring).not.toBeNull();
        expect(() => hooks.onQuestionAnswered?.('q1', true)).not.toThrow();
        expect(asMock(runtime.sendScoreNew)).toHaveBeenCalled();
    });
});
