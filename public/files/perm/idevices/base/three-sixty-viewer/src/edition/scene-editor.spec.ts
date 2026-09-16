import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import { formHtml } from './form';
import { refreshActiveSceneInputs, refreshImageLabel, wireActiveSceneFields, wireBehaviourFields } from './scene-editor';
import { createEditorState } from './state';
import type { EditorState } from './state';

const identity = (text: string): string => text;

afterEach(() => {
    document.body.innerHTML = '';
});

function makeForm(input: unknown = null): { body: HTMLElement; state: EditorState; callbacks: ReturnType<typeof makeCallbacks> } {
    const result = hydrateDocument(input, createSequentialIdGenerator());
    if (result.status !== 'ok') throw new Error('fixture');
    const state = createEditorState(result.document, createSequentialIdGenerator());
    const body = document.createElement('div');
    document.body.appendChild(body);
    body.innerHTML = formHtml(state, identity);
    const callbacks = makeCallbacks();
    wireActiveSceneFields(body, state, callbacks);
    return { body, state, callbacks };
}

function makeCallbacks() {
    return {
        onChanged: vi.fn(),
        onTitleChanged: vi.fn(),
        onProjectionChanged: vi.fn(),
        onPickImage: vi.fn(),
        onImageFile: vi.fn(),
    };
}

function fire(body: HTMLElement, selector: string, value: string, type: 'input' | 'change' = 'input'): void {
    const element = body.querySelector<HTMLInputElement>(selector);
    if (!element) throw new Error(`missing ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event(type, { bubbles: true }));
}

describe('wireActiveSceneFields', () => {
    it('updates title, alt and description from their inputs', () => {
        const { body, state, callbacks } = makeForm();
        fire(body, '#threeSixtySceneTitle', 'New title');
        fire(body, '#threeSixtyAlt', 'New alt');
        const description = body.querySelector<HTMLTextAreaElement>('#threeSixtySceneDescription');
        if (!description) throw new Error('missing description');
        description.value = 'Described';
        description.dispatchEvent(new Event('input', { bubbles: true }));
        const scene = state.activeScene();
        expect(scene.title).toBe('New title');
        expect(scene.alt).toBe('New alt');
        expect(scene.description).toBe('Described');
        expect(callbacks.onTitleChanged).toHaveBeenCalledTimes(1);
    });

    it('clamps the initial-view fields into their ranges', () => {
        const { body, state, callbacks } = makeForm();
        fire(body, '#threeSixtyYaw', '999');
        fire(body, '#threeSixtyPitch', '-999');
        fire(body, '#threeSixtyFov', '10');
        expect(state.activeScene().initialView).toEqual({ yaw: 180, pitch: -90, fov: 30 });
        expect(callbacks.onChanged).toHaveBeenCalledTimes(3);
    });

    it('routes projection toggling, image picking, clearing and file fallback', () => {
        const { body, state, callbacks } = makeForm({ version: 2, scenes: [{ id: 'a', src: 'old.jpg' }] });
        const toggle = body.querySelector<HTMLInputElement>('#threeSixtyIsPanorama');
        if (!toggle) throw new Error('missing toggle');
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.activeScene().projection).toBe('flat');
        expect(callbacks.onProjectionChanged).toHaveBeenCalledTimes(1);

        body.querySelector<HTMLButtonElement>('#threeSixtyImageButton')?.click();
        expect(callbacks.onPickImage).toHaveBeenCalledTimes(1);

        body.querySelector<HTMLButtonElement>('#threeSixtyImageClear')?.click();
        expect(state.activeScene().src).toBe('');
        expect(callbacks.onChanged).toHaveBeenCalled();
    });
});

describe('wireBehaviourFields', () => {
    it('updates every behaviour toggle and the clamped autorotate speed', () => {
        const { body, state } = makeForm();
        const onChanged = vi.fn();
        wireBehaviourFields(body, state, onChanged);
        for (const [selector, read] of [
            ['#threeSixtyAutorotate', () => state.doc.behaviour.autorotate.enabled],
            ['#threeSixtyZoom', () => state.doc.behaviour.zoomEnabled],
            ['#threeSixtyFullscreen', () => state.doc.behaviour.fullscreenEnabled],
            ['#threeSixtyShowLabels', () => state.doc.behaviour.showLabels],
            ['#threeSixtyNavControls', () => state.doc.behaviour.showNavControls],
        ] as Array<[string, () => boolean]>) {
            const checkbox = body.querySelector<HTMLInputElement>(selector);
            if (!checkbox) throw new Error(`missing ${selector}`);
            checkbox.checked = selector === '#threeSixtyAutorotate';
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            expect(read()).toBe(selector === '#threeSixtyAutorotate');
        }
        fire(body, '#threeSixtyAutorotateSpeed', '99');
        expect(state.doc.behaviour.autorotate.speed).toBe(10);
        fire(body, '#threeSixtyAutorotateSpeed', '2.5');
        expect(state.doc.behaviour.autorotate.speed).toBe(2.5);
        expect(onChanged).toHaveBeenCalled();
    });
});

describe('refreshActiveSceneInputs / refreshImageLabel', () => {
    it('repoints the inputs at the newly active scene', () => {
        const { body, state } = makeForm({
            version: 2,
            scenes: [
                { id: 'a', title: 'First', alt: 'A', initialView: { yaw: 1, pitch: 2, fov: 80 } },
                { id: 'b', title: 'Second', alt: 'B', src: 'b.jpg', initialView: { yaw: 5, pitch: 6, fov: 90 } },
            ],
        });
        state.setActiveScene(1);
        refreshActiveSceneInputs(body, state, identity);
        expect(body.querySelector<HTMLInputElement>('#threeSixtySceneTitle')?.value).toBe('Second');
        expect(body.querySelector<HTMLInputElement>('#threeSixtyAlt')?.value).toBe('B');
        expect(body.querySelector<HTMLInputElement>('#threeSixtyYaw')?.value).toBe('5');
        expect(body.querySelector('#threeSixtyActiveSceneLegend')?.textContent).toBe('Second');
        expect(body.querySelector('#threeSixtyImageName')?.textContent).toBe('b.jpg');
        expect(body.querySelector('#threeSixtyImageClear')?.hasAttribute('hidden')).toBe(false);
    });

    it('shows the no-image label and hides the clear button without a source', () => {
        const { body, state } = makeForm();
        refreshImageLabel(body, state, identity);
        expect(body.querySelector('#threeSixtyImageName')?.textContent).toBe('No image selected');
        expect(body.querySelector('#threeSixtyImageClear')?.hasAttribute('hidden')).toBe(true);
    });
});
