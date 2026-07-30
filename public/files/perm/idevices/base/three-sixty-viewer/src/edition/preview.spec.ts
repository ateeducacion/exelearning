import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import { createManualScheduler, createThreeMock, installThreeGlobal, stubRect } from '../test/helpers';
import { createPreviewController } from './preview';
import { createEditorState } from './state';
import type { EditorState } from './state';

const identity = (text: string): string => text;

let uninstallThree: (() => void) | null = null;

afterEach(() => {
    uninstallThree?.();
    uninstallThree = null;
    document.body.innerHTML = '';
});

function makeState(sceneOverrides: Record<string, unknown> = {}): EditorState {
    const result = hydrateDocument(
        {
            version: 2,
            scenes: [
                {
                    id: 'a',
                    src: 'image.jpg',
                    hotspots: [{ id: 'h1', label: 'One' }],
                    ...sceneOverrides,
                },
            ],
        },
        createSequentialIdGenerator(),
    );
    if (result.status !== 'ok') throw new Error('fixture');
    return createEditorState(result.document, createSequentialIdGenerator());
}

type LoadThreeMock = ReturnType<typeof vi.fn<(idevicePath: string, callback: () => void) => void>>;

function makeHarness(state: EditorState, options: { placing?: boolean; loadThree?: LoadThreeMock } = {}) {
    const stage = document.createElement('div');
    stage.id = 'stage';
    stubRect(stage, { width: 400, height: 400 });
    const message = document.createElement('p');
    document.body.append(stage, message);
    const manual = createManualScheduler();
    const onPlace = vi.fn();
    const onHotspotMoved = vi.fn();
    const onHotspotSelected = vi.fn();
    const controller = createPreviewController({
        stage: () => stage,
        message: () => message,
        state,
        tr: identity,
        idevicePath: '/base/edition/',
        isPlacing: () => options.placing ?? false,
        onPlace,
        onHotspotMoved,
        onHotspotSelected,
        scheduler: manual.scheduler,
        loadThree: options.loadThree ?? vi.fn<(idevicePath: string, callback: () => void) => void>(),
        reducedMotion: false,
    });
    return { stage, message, controller, manual, onPlace, onHotspotMoved, onHotspotSelected };
}

describe('createPreviewController — messages and modes', () => {
    it('shows the select-image message without a source', () => {
        const state = makeState({ src: '' });
        const harness = makeHarness(state);
        harness.controller.refresh();
        expect(harness.message.textContent).toBe('Select an image to see a live preview.');
        expect(harness.message.style.display).toBe('');
        harness.controller.destroy();
    });

    it('renders a flat preview without needing three.js', () => {
        const state = makeState({ projection: 'flat' });
        const harness = makeHarness(state);
        harness.controller.refresh();
        expect(harness.stage.querySelector('img.three-sixty-preview-flat')).toBeTruthy();
        expect(harness.stage.querySelector('.three-sixty-viewer-overlay--editor')).toBeTruthy();
        expect(harness.message.style.display).toBe('none');
        harness.controller.destroy();
    });

    it('requests the three.js load for panorama scenes and shows progress', () => {
        const loadThree = vi.fn<(idevicePath: string, callback: () => void) => void>();
        const state = makeState();
        const harness = makeHarness(state, { loadThree });
        harness.controller.refresh();
        expect(harness.message.textContent).toBe('Loading 3D preview…');
        expect(loadThree).toHaveBeenCalledWith('/base/edition/', expect.any(Function));
        // When the loader reports back with THREE present, the preview builds.
        const { three } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        (loadThree.mock.calls[0]?.[1] as () => void)();
        expect(harness.stage.querySelector('canvas')).toBeTruthy();
        harness.controller.destroy();
    });

    it('builds the panorama preview immediately when THREE exists', () => {
        const { three, state: threeState } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const state = makeState();
        const harness = makeHarness(state);
        harness.controller.refresh();
        expect(harness.stage.querySelector('canvas')).toBeTruthy();
        expect(threeState.textures[0]?.url).toBe('image.jpg');
        harness.manual.step();
        expect(threeState.renderers[0]?.render).toHaveBeenCalled();
        // Refresh without changes keeps the same renderer (no rebuild).
        harness.controller.refresh();
        expect(threeState.renderers).toHaveLength(1);
        harness.controller.destroy();
        // Loop stops and resources are released on destroy.
        expect(threeState.renderers[0]?.dispose).toHaveBeenCalled();
        expect(harness.manual.pendingCount()).toBe(0);
    });

    it('reduced motion disables preview autorotation', () => {
        const { three, state: threeState } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const state = makeState();
        state.doc.behaviour.autorotate.enabled = true;
        const stage = document.createElement('div');
        stubRect(stage, { width: 400, height: 300 });
        document.body.appendChild(stage);
        const controller = createPreviewController({
            stage: () => stage,
            message: () => null,
            state,
            tr: identity,
            idevicePath: '',
            isPlacing: () => false,
            onPlace: vi.fn(),
            onHotspotMoved: vi.fn(),
            onHotspotSelected: vi.fn(),
            scheduler: createManualScheduler().scheduler,
            loadThree: vi.fn<(idevicePath: string, callback: () => void) => void>(),
            reducedMotion: true,
        });
        controller.refresh();
        expect(threeState.controls[0]?.autoRotate).toBe(false);
        controller.destroy();
    });
});

describe('createPreviewController — placement and drag', () => {
    it('places flat hotspots on click inside the image, ignoring letterbox bars', () => {
        const state = makeState({ projection: 'flat' });
        const harness = makeHarness(state, { placing: true });
        harness.controller.refresh();
        const image = harness.stage.querySelector('img');
        if (!image) throw new Error('missing image');
        Object.defineProperty(image, 'naturalWidth', { value: 2000, configurable: true });
        Object.defineProperty(image, 'naturalHeight', { value: 1000, configurable: true });
        // Contained rect: 400x200 at top=100. A click in the centre lands at 50/50.
        image.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));
        expect(harness.onPlace).toHaveBeenCalledWith({ x: 50, y: 50 });
        // A click on the top letterbox bar is ignored.
        harness.onPlace.mockClear();
        image.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 50 }));
        expect(harness.onPlace).not.toHaveBeenCalled();
        harness.controller.destroy();
    });

    it('places panorama hotspots from the unprojected click direction', () => {
        const { three } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const state = makeState();
        const harness = makeHarness(state, { placing: true });
        harness.controller.refresh();
        const canvas = harness.stage.querySelector('canvas');
        if (!canvas) throw new Error('missing canvas');
        stubRect(canvas as unknown as HTMLElement, { width: 400, height: 400 });
        canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));
        expect(harness.onPlace).toHaveBeenCalledTimes(1);
        const position = harness.onPlace.mock.calls[0]?.[0] as { yaw: number; pitch: number };
        expect(position.yaw).toBeCloseTo(0);
        expect(position.pitch).toBeCloseTo(0);
        harness.controller.destroy();
    });

    it('ignores preview clicks when placement mode is off', () => {
        const state = makeState({ projection: 'flat' });
        const harness = makeHarness(state, { placing: false });
        harness.controller.refresh();
        harness.stage.querySelector('img')?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
        expect(harness.onPlace).not.toHaveBeenCalled();
        harness.controller.destroy();
    });

    it('dragging a handle updates the hotspot and reports the move', () => {
        const state = makeState({ projection: 'flat' });
        const harness = makeHarness(state);
        harness.controller.refresh();
        const image = harness.stage.querySelector('img');
        if (image) {
            Object.defineProperty(image, 'naturalWidth', { value: 400, configurable: true });
            Object.defineProperty(image, 'naturalHeight', { value: 400, configurable: true });
        }
        const handle = harness.stage.querySelector<HTMLButtonElement>('.three-sixty-viewer-hotspot');
        if (!handle) throw new Error('missing handle');
        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 300, pointerId: 1 }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
        expect(state.hotspotAt(0)?.x).toBe(25);
        expect(state.hotspotAt(0)?.y).toBe(75);
        expect(harness.onHotspotMoved).toHaveBeenCalledWith(0);
        harness.controller.destroy();
    });

    it('a click on a handle without dragging selects the hotspot', () => {
        const state = makeState({ projection: 'flat' });
        const harness = makeHarness(state);
        harness.controller.refresh();
        const handle = harness.stage.querySelector<HTMLButtonElement>('.three-sixty-viewer-hotspot');
        handle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(harness.onHotspotSelected).toHaveBeenCalledWith(0);
        harness.controller.destroy();
    });

    it('getCameraYawPitch falls back to the scene initial view without a panorama', () => {
        const state = makeState({ projection: 'flat', initialView: { yaw: 12, pitch: 3, fov: 75 } });
        const harness = makeHarness(state);
        harness.controller.refresh();
        expect(harness.controller.getCameraYawPitch()).toEqual({ yaw: 12, pitch: 3 });
        harness.controller.destroy();
    });
});
