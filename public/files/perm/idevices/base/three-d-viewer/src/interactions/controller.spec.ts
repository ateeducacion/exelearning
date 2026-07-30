import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionSettings } from '../shared/types';
import { createStubInstance, createWrapper, makeInteraction, resetDom, sequentialIds } from '../test/helpers';
import { createModelViewerStub } from '../test/model-viewer-stub';
import { installThreeStub } from '../test/three-stub';
import { createInteractionController } from './controller';
import { resetWebGLProbe } from './fallback';
import type { InteractionHooks } from './types';

let restoreThree: () => void;

beforeEach(() => {
    restoreThree = installThreeStub();
    globalThis.__tdvForceWebGL = true;
    resetWebGLProbe();
});

afterEach(() => {
    restoreThree();
    globalThis.__tdvForceWebGL = undefined;
    resetWebGLProbe();
    resetDom();
    vi.restoreAllMocks();
});

function interactionWith(
    markers: Array<Record<string, unknown>>,
    extra: Record<string, unknown> = {},
): InteractionSettings {
    return makeInteraction({ enabled: true, markers, ...extra }, sequentialIds());
}

function mountModelViewer(): { wrapper: HTMLElement; modelViewer: ReturnType<typeof createModelViewerStub> } {
    const wrapper = createWrapper();
    const modelViewer = createModelViewerStub(wrapper);
    return { wrapper, modelViewer };
}

function build(
    markers: Array<Record<string, unknown>>,
    hooks: InteractionHooks = {},
    extra: Record<string, unknown> = {},
): {
    wrapper: HTMLElement;
    modelViewer: ReturnType<typeof createModelViewerStub>;
    controller: ReturnType<typeof createInteractionController>;
    interaction: InteractionSettings;
} {
    const { wrapper, modelViewer } = mountModelViewer();
    const interaction = interactionWith(markers, extra);
    const controller = createInteractionController({ wrapper, type: 'glb', modelViewer }, interaction, 'view', {
        t: key => key,
        ...hooks,
    });
    return { wrapper, modelViewer, controller, interaction };
}

describe('marker activation and the dialog', () => {
    it('opens an accessible dialog with sanitized information HTML', () => {
        const { wrapper, controller } = build([
            {
                id: 'm1',
                label: 'Summit',
                action: { type: 'information', payload: { html: '<p>Hi</p><script>x()</script>' } },
            },
        ]);
        controller.focusMarker('m1');
        const dialog = wrapper.querySelector('.tdv-dialog');
        expect(dialog?.getAttribute('role')).toBe('dialog');
        expect(dialog?.getAttribute('aria-modal')).toBe('true');
        expect(dialog?.getAttribute('aria-label')).toBe('Summit');
        expect(wrapper.querySelector('.tdv-dialog-html')?.innerHTML).toBe('<p>Hi</p>');
    });

    it('shows the marker description above the action content', () => {
        const { wrapper, controller } = build([{ id: 'm1', description: 'A short note' }]);
        controller.focusMarker('m1');
        expect(wrapper.querySelector('.tdv-dialog-description')?.textContent).toBe('A short note');
    });

    it('renders an image action with its alt text and caption', () => {
        const { wrapper, controller } = build([
            { id: 'm1', action: { type: 'image', payload: { src: 'a.png', alt: 'Alt', caption: 'Cap' } } },
        ]);
        controller.focusMarker('m1');
        const image = wrapper.querySelector<HTMLImageElement>('.tdv-dialog-figure img');
        expect(image?.getAttribute('src')).toBe('a.png');
        expect(image?.alt).toBe('Alt');
        expect(wrapper.querySelector('figcaption')?.textContent).toBe('Cap');
    });

    it('renders a video action with controls and a poster', () => {
        const { wrapper, controller } = build([
            { id: 'm1', action: { type: 'video', payload: { src: 'a.mp4', poster: 'p.png' } } },
        ]);
        controller.focusMarker('m1');
        const video = wrapper.querySelector<HTMLVideoElement>('.tdv-dialog-video');
        expect(video?.controls).toBe(true);
        expect(video?.getAttribute('src')).toBe('a.mp4');
        expect(video?.poster).toBe('p.png');
    });

    it('resolves media URLs through the host hook', () => {
        const resolveMediaUrl = vi.fn((url: string) => `blob:${url}`);
        const { wrapper, controller } = build(
            [{ id: 'm1', action: { type: 'image', payload: { src: 'asset://a.png' } } }],
            { resolveMediaUrl },
        );
        controller.focusMarker('m1');
        expect(resolveMediaUrl).toHaveBeenCalledWith('asset://a.png');
        expect(wrapper.querySelector('img')?.getAttribute('src')).toBe('blob:asset://a.png');
    });

    it('opens a safe link in a new tab and never opens an executable one', () => {
        const open = vi.spyOn(globalThis, 'open').mockImplementation(() => null);
        const { wrapper, controller } = build([
            { id: 'm1', action: { type: 'link', payload: { url: 'https://example.org' } } },
            { id: 'm2', action: { type: 'link', payload: { url: 'javascript:alert(1)' } } },
        ]);
        controller.focusMarker('m1');
        expect(open).toHaveBeenCalledWith('https://example.org', '_blank', 'noopener,noreferrer');
        expect(wrapper.querySelector('.tdv-dialog')).toBeNull();

        open.mockClear();
        controller.focusMarker('m2');
        expect(open).not.toHaveBeenCalled();
    });

    it('calls the activation hook', () => {
        const onActivate = vi.fn();
        const { controller } = build([{ id: 'm1' }], { onActivate });
        controller.focusMarker('m1');
        expect(onActivate).toHaveBeenCalledWith('m1');
    });

    it('ignores a request to focus a marker that does not exist', () => {
        const { wrapper, controller } = build([{ id: 'm1' }]);
        controller.focusMarker('ghost');
        expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
        expect(controller.getActiveId()).toBe('');
    });
});

describe('dialog accessibility', () => {
    it('moves focus into the dialog and returns it on close', () => {
        const { wrapper, controller } = build([{ id: 'm1' }]);
        const trigger = wrapper.querySelector<HTMLButtonElement>('.tdv-marker');
        trigger?.focus();
        controller.focusMarker('m1');
        expect(document.activeElement?.classList.contains('tdv-dialog-close')).toBe(true);
        wrapper.querySelector<HTMLButtonElement>('.tdv-dialog-close')?.click();
        expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('closes on Escape', () => {
        const { wrapper, controller } = build([{ id: 'm1' }]);
        controller.focusMarker('m1');
        wrapper
            .querySelector('.tdv-dialog')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
    });

    it('closes when the backdrop is clicked but not when the dialog itself is', () => {
        const { wrapper, controller } = build([{ id: 'm1' }]);
        controller.focusMarker('m1');
        wrapper.querySelector('.tdv-dialog')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(wrapper.querySelector('.tdv-dialog')).not.toBeNull();
        wrapper.querySelector('.tdv-dialog-overlay')?.dispatchEvent(new MouseEvent('click'));
        expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
    });

    it('traps Tab inside the dialog', () => {
        const { wrapper, controller } = build([
            {
                id: 'm1',
                action: {
                    type: 'question',
                    payload: { prompt: 'Q', options: [{ text: 'a', correct: true }, { text: 'b' }] },
                },
            },
        ]);
        controller.focusMarker('m1');
        const dialog = wrapper.querySelector<HTMLElement>('.tdv-dialog');
        const focusable = dialog?.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        const first = focusable?.[0];
        const last = focusable?.[(focusable?.length ?? 1) - 1];
        expect(first).toBeDefined();
        expect(last).toBeDefined();

        last?.focus();
        dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(first);

        first?.focus();
        dialog?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
        );
        expect(document.activeElement).toBe(last);
    });

    it('opening another marker replaces the open dialog', () => {
        const { wrapper, controller } = build([
            { id: 'm1', label: 'One' },
            { id: 'm2', label: 'Two' },
        ]);
        controller.focusMarker('m1');
        controller.focusMarker('m2');
        expect(wrapper.querySelectorAll('.tdv-dialog')).toHaveLength(1);
        expect(wrapper.querySelector('.tdv-dialog')?.getAttribute('aria-label')).toBe('Two');
    });
});

describe('questions', () => {
    const question = (attemptsAllowed = 0): Record<string, unknown> => ({
        id: 'q1',
        label: 'Quiz',
        action: {
            type: 'question',
            payload: {
                prompt: 'Is it a volcano?',
                options: [
                    { id: 'yes', text: 'Yes', correct: true },
                    { id: 'no', text: 'No', correct: false },
                ],
                feedbackCorrect: 'Right!',
                feedbackIncorrect: 'Nope',
                attemptsAllowed,
            },
        },
    });

    function answer(wrapper: HTMLElement, optionId: string): void {
        const input = wrapper.querySelector<HTMLInputElement>(`.tdv-question input[value="${optionId}"]`);
        if (input) {
            input.checked = true;
        }
        wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.click();
    }

    it('renders an accessible single-choice question', () => {
        const { wrapper, controller } = build([question()]);
        controller.focusMarker('q1');
        expect(wrapper.querySelector('.tdv-question legend')?.textContent).toBe('Is it a volcano?');
        expect(wrapper.querySelectorAll('.tdv-question input[type="radio"]')).toHaveLength(2);
        const feedback = wrapper.querySelector('.tdv-q-feedback');
        expect(feedback?.getAttribute('role')).toBe('status');
        expect(feedback?.getAttribute('aria-live')).toBe('polite');
    });

    it('asks for an answer when nothing is selected', () => {
        const { wrapper, controller } = build([question()]);
        controller.focusMarker('q1');
        wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.click();
        expect(wrapper.querySelector('.tdv-q-feedback')?.textContent).toBe('Please select an answer');
    });

    it('shows correct feedback and locks the question', () => {
        const { wrapper, controller } = build([question()]);
        controller.focusMarker('q1');
        answer(wrapper, 'yes');
        const feedback = wrapper.querySelector('.tdv-q-feedback');
        expect(feedback?.className).toContain('tdv-q-feedback--correct');
        expect(feedback?.textContent).toBe('Right!');
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(true);
    });

    it('shows incorrect feedback and keeps unlimited attempts open', () => {
        const { wrapper, controller } = build([question()]);
        controller.focusMarker('q1');
        answer(wrapper, 'no');
        expect(wrapper.querySelector('.tdv-q-feedback')?.className).toContain('tdv-q-feedback--incorrect');
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(false);
    });

    it('locks the question once the attempt allowance runs out', () => {
        const { wrapper, controller } = build([question(1)]);
        controller.focusMarker('q1');
        answer(wrapper, 'no');
        expect(wrapper.querySelector('.tdv-q-feedback')?.textContent).toContain('No attempts left');
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(true);
    });

    it('keeps attempts exhausted after closing and reopening the marker', () => {
        const { wrapper, controller } = build([question(1)]);
        controller.focusMarker('q1');
        answer(wrapper, 'no');
        wrapper.querySelector<HTMLButtonElement>('.tdv-dialog-close')?.click();

        controller.focusMarker('q1');
        // The allowance applies to the marker for the whole session, so the
        // reopened dialog must not hand out a fresh attempt.
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(true);
        expect(wrapper.querySelector('.tdv-q-feedback')?.textContent).toContain('No attempts left');
        expect(wrapper.querySelectorAll<HTMLInputElement>('.tdv-question input')[0]?.disabled).toBe(true);
    });

    it('keeps a resolved question resolved after reopening, and restores the choice', () => {
        const { wrapper, controller } = build([question(2)]);
        controller.focusMarker('q1');
        answer(wrapper, 'yes');
        wrapper.querySelector<HTMLButtonElement>('.tdv-dialog-close')?.click();

        controller.focusMarker('q1');
        expect(wrapper.querySelector('.tdv-q-feedback')?.className).toContain('tdv-q-feedback--correct');
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(true);
        expect(wrapper.querySelector<HTMLInputElement>('.tdv-question input[value="yes"]')?.checked).toBe(true);
    });

    it('counts attempts across reopens rather than restarting them', () => {
        const { wrapper, controller } = build([question(2)]);
        controller.focusMarker('q1');
        answer(wrapper, 'no');
        wrapper.querySelector<HTMLButtonElement>('.tdv-dialog-close')?.click();

        controller.focusMarker('q1');
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(false);
        answer(wrapper, 'no');
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(true);
    });

    it('reports every graded answer to the host', () => {
        const onQuestionAnswered = vi.fn();
        const { wrapper, controller } = build([question()], { onQuestionAnswered });
        controller.focusMarker('q1');
        answer(wrapper, 'no');
        expect(onQuestionAnswered).toHaveBeenCalledWith('q1', false);
        answer(wrapper, 'yes');
        expect(onQuestionAnswered).toHaveBeenLastCalledWith('q1', true);
    });

    it('survives a host hook that throws', () => {
        const { wrapper, controller } = build([question()], {
            onQuestionAnswered: () => {
                throw new Error('transport down');
            },
        });
        controller.focusMarker('q1');
        expect(() => answer(wrapper, 'yes')).not.toThrow();
        expect(wrapper.querySelector('.tdv-q-feedback')?.className).toContain('tdv-q-feedback--correct');
    });

    it('forgets the answers of a marker the author deleted', () => {
        const { wrapper, controller } = build([question(1)]);
        controller.focusMarker('q1');
        answer(wrapper, 'no');
        wrapper.querySelector<HTMLButtonElement>('.tdv-dialog-close')?.click();

        controller.setState(interactionWith([]));
        controller.setState(interactionWith([question(1)]));
        controller.focusMarker('q1');
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-q-check')?.disabled).toBe(false);
    });
});

describe('guided navigation', () => {
    const three = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    it('steps forward and backward through the markers', () => {
        const { controller } = build(three, {}, { guidedMode: true });
        controller.next();
        expect(controller.getActiveId()).toBe('a');
        controller.next();
        expect(controller.getActiveId()).toBe('b');
        controller.previous();
        expect(controller.getActiveId()).toBe('a');
    });

    it('stops at the ends without wrapping', () => {
        const { controller } = build(three, {}, { guidedMode: true });
        controller.previous();
        expect(controller.getActiveId()).toBe('c');
        controller.next();
        expect(controller.getActiveId()).toBe('c');
    });

    it('wraps when wrapping is enabled', () => {
        const { controller } = build(three, {}, { guidedMode: true, wrapNavigation: true });
        controller.previous();
        expect(controller.getActiveId()).toBe('c');
        controller.next();
        expect(controller.getActiveId()).toBe('a');
    });

    it('updates the live status as it moves', () => {
        const { wrapper, controller } = build(three, {}, { guidedMode: true });
        controller.next();
        expect(wrapper.querySelector('.tdv-guided-status')?.textContent).toBe('Marker 1 / 3');
        controller.next();
        expect(wrapper.querySelector('.tdv-guided-status')?.textContent).toBe('Marker 2 / 3');
    });

    it('advances exactly one step per click even after repeated setState', () => {
        const { wrapper, controller } = build(three, {}, { guidedMode: true });
        controller.setState(interactionWith(three, { guidedMode: true }));
        controller.setState(interactionWith(three, { guidedMode: true }));
        wrapper.querySelector<HTMLButtonElement>('.tdv-nav-next')?.click();
        expect(controller.getActiveId()).toBe('a');
    });

    it('does nothing when there are no markers', () => {
        const { controller } = build([], {}, { guidedMode: true });
        controller.next();
        expect(controller.getActiveId()).toBe('');
    });
});

describe('state changes and the fallback', () => {
    it('re-renders markers when the state changes', () => {
        const { wrapper, controller } = build([{ id: 'a' }]);
        expect(wrapper.querySelectorAll('.tdv-marker')).toHaveLength(1);
        controller.setState(interactionWith([{ id: 'a' }, { id: 'b' }]));
        expect(wrapper.querySelectorAll('.tdv-marker')).toHaveLength(2);
    });

    it('clears the active marker when the state drops it', () => {
        const { controller } = build([{ id: 'a' }, { id: 'b' }]);
        controller.focusMarker('b');
        expect(controller.getActiveId()).toBe('b');
        controller.setState(interactionWith([{ id: 'a' }]));
        expect(controller.getActiveId()).toBe('');
    });

    it('keeps the text fallback hidden when WebGL is available', () => {
        const wrapper = createWrapper();
        wrapper.innerHTML = '<ul class="tdv-fallback" hidden></ul>';
        const modelViewer = createModelViewerStub(wrapper);
        createInteractionController({ wrapper, type: 'glb', modelViewer }, interactionWith([{ id: 'a' }]), 'view', {
            t: key => key,
        });
        expect(wrapper.querySelector<HTMLElement>('.tdv-fallback')?.hidden).toBe(true);
    });

    it('reveals the text fallback when WebGL is unavailable', () => {
        globalThis.__tdvForceWebGL = false;
        const wrapper = createWrapper();
        wrapper.innerHTML = '<ul class="tdv-fallback" hidden></ul>';
        const modelViewer = createModelViewerStub(wrapper);
        createInteractionController({ wrapper, type: 'glb', modelViewer }, interactionWith([{ id: 'a' }]), 'view', {
            t: key => key,
        });
        expect(wrapper.querySelector<HTMLElement>('.tdv-fallback')?.hidden).toBe(false);
    });

    it('reveals the text fallback when no adapter could be built', () => {
        const wrapper = createWrapper();
        wrapper.innerHTML = '<ul class="tdv-fallback" hidden></ul>';
        createInteractionController({ wrapper, type: 'unknown' }, interactionWith([{ id: 'a' }]), 'view', {
            t: key => key,
        });
        expect(wrapper.querySelector<HTMLElement>('.tdv-fallback')?.hidden).toBe(false);
    });
});

describe('placement mode', () => {
    it('enters placement mode in edit mode and reports the anchor', () => {
        const { wrapper, modelViewer } = mountModelViewer();
        const onPlaced = vi.fn();
        const controller = createInteractionController(
            { wrapper, type: 'glb', modelViewer },
            interactionWith([]),
            'edit',
            { t: key => key, onPlaced },
        );
        controller.enterPlacementMode();
        expect(wrapper.classList.contains('tdv-placing')).toBe(true);
        modelViewer.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).toHaveBeenCalledTimes(1);
        expect(wrapper.classList.contains('tdv-placing')).toBe(false);
    });

    it('never enters placement mode on a learner page', () => {
        const { wrapper, modelViewer, controller } = build([]);
        const onPlaced = vi.fn();
        controller.enterPlacementMode();
        expect(wrapper.classList.contains('tdv-placing')).toBe(false);
        modelViewer.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).not.toHaveBeenCalled();
    });
});

describe('camera capture and teardown', () => {
    it('delegates camera capture to the adapter', () => {
        const { controller } = build([{ id: 'a' }]);
        expect(controller.captureCamera()).toEqual({ orbit: '1rad 2rad 3m', target: '0m 0m 0m', fieldOfView: '40deg' });
    });

    it('returns an empty camera view when there is no adapter', () => {
        const wrapper = createWrapper();
        const controller = createInteractionController({ wrapper, type: 'unknown' }, interactionWith([]), 'view');
        expect(controller.captureCamera()).toEqual({ orbit: '', target: '', fieldOfView: '' });
    });

    it('removes markers, the dialog and the nav controls on destroy', () => {
        const { wrapper, controller } = build([{ id: 'a' }], {}, { guidedMode: true });
        controller.focusMarker('a');
        expect(wrapper.querySelector('.tdv-dialog')).not.toBeNull();
        controller.destroy();
        expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
        expect(wrapper.querySelector('.tdv-marker')).toBeNull();
        expect(wrapper.querySelector('.tdv-guided-nav')).toBeNull();
        // Destroying twice, and rendering afterwards, are both no-ops.
        expect(() => controller.destroy()).not.toThrow();
        controller.render();
        expect(wrapper.querySelector('.tdv-marker')).toBeNull();
    });

    it('keeps two controllers on one page isolated', () => {
        const first = build([{ id: 'a' }, { id: 'b' }], {}, { guidedMode: true });
        const second = build([{ id: 'c' }], {}, { guidedMode: true });
        first.controller.next();
        expect(first.controller.getActiveId()).toBe('a');
        expect(second.controller.getActiveId()).toBe('');
        first.controller.destroy();
        expect(second.wrapper.querySelectorAll('.tdv-marker')).toHaveLength(1);
    });
});

describe('the STL render path', () => {
    it('builds the STL adapter from a viewer instance', () => {
        const wrapper = createWrapper();
        const instance = createStubInstance(wrapper);
        const controller = createInteractionController(
            { wrapper, type: 'stl', instance },
            interactionWith([{ id: 'a', label: 'STL marker' }]),
            'view',
            { t: key => key },
        );
        expect(wrapper.querySelector('.tdv-marker--stl')?.getAttribute('aria-label')).toBe('STL marker');
        controller.destroy();
        expect(wrapper.querySelector('.tdv-marker-layer')).toBeNull();
    });
});

describe('marker labels', () => {
    it('falls back to a numbered label when the marker has none', () => {
        const { wrapper } = build([{ id: 'a' }, { id: 'b', label: 'Named' }]);
        const labels = [...wrapper.querySelectorAll('.tdv-marker')].map(node => node.getAttribute('aria-label'));
        expect(labels).toEqual(['Marker 1', 'Named']);
    });
});
