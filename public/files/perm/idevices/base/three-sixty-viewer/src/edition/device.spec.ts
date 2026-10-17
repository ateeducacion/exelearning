import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { createManualScheduler, createThreeMock, installThreeGlobal } from '../test/helpers';
import { createThreeSixtyEditionDevice } from './device';
import type { EditionLifecycleLike, ThreeSixtyEditionDevice } from './device';

const identity = (text: string): string => text;

afterEach(() => {
    document.body.innerHTML = '';
});

type LoadThree = (idevicePath: string, callback: () => void) => void;

function makeDevice(loadThree: LoadThree = vi.fn()) {
    const body = document.createElement('div');
    body.setAttribute('idevice-id', 'idev-device-test');
    document.body.appendChild(body);
    const manual = createManualScheduler();
    const device: ThreeSixtyEditionDevice = createThreeSixtyEditionDevice({
        translate: identity,
        ids: createSequentialIdGenerator(),
        confirm: () => true,
        scheduler: manual.scheduler,
        loadThree,
        reducedMotion: false,
    });
    return { device, body, manual };
}

/**
 * Stand-in for the workarea's EditionLifecycle: own() collects disposers and
 * destroy() runs them LIFO, as editionLifecycle.js does.
 */
function makeLifecycle(): EditionLifecycleLike & { destroy: () => void } {
    const disposers: Array<() => void> = [];
    return {
        own(disposer) {
            disposers.push(disposer);
            return () => undefined;
        },
        destroy() {
            while (disposers.length) disposers.pop()?.();
        },
    };
}

const V1_DATA = {
    ideviceId: 'idev-v1',
    src: 'asset://pano.jpg',
    alt: 'A scene',
    initialView: { yaw: 30, pitch: 10, fov: 80 },
    autorotate: { enabled: true, speed: 2 },
    zoomEnabled: false,
    fullscreenEnabled: true,
};

describe('createThreeSixtyEditionDevice', () => {
    it('implements the eXeLearning contract (i18n.name, init, save, destroy)', () => {
        const { device } = makeDevice();
        expect(typeof device.i18n.name).toBe('string');
        expect(device.i18n.name.length).toBeGreaterThan(0);
        expect(typeof device.init).toBe('function');
        expect(typeof device.save).toBe('function');
        expect(typeof device.destroy).toBe('function');
    });

    it('save before init behaves safely (returns false)', () => {
        const { device } = makeDevice();
        expect(device.save()).toBe(false);
    });

    it('initializes with no data and saves a fresh v2 document', () => {
        const { device, body } = makeDevice();
        device.init(body, null);
        expect(body.querySelector('#threeSixtySceneList')).toBeTruthy();
        const saved = device.save() as { version: number; scenes: unknown[] };
        expect(saved).not.toBe(false);
        expect(saved.version).toBe(2);
        expect(saved.scenes).toHaveLength(1);
        device.destroy();
    });

    it('opens v1 content and saves it as v2 without losing fields', () => {
        const { device, body } = makeDevice();
        device.init(body, V1_DATA, '/base/edition/');
        expect(body.querySelector<HTMLInputElement>('#threeSixtyAlt')?.value).toBe('A scene');
        expect(body.querySelector<HTMLInputElement>('#threeSixtyYaw')?.value).toBe('30');
        const saved = device.save() as {
            version: number;
            startSceneId: string;
            scenes: Array<{ id: string; src: string; alt: string; initialView: { yaw: number; pitch: number; fov: number } }>;
            behaviour: { autorotate: { enabled: boolean; speed: number }; zoomEnabled: boolean; fullscreenEnabled: boolean };
        };
        expect(saved.version).toBe(2);
        expect(saved.scenes[0]?.src).toBe('asset://pano.jpg');
        expect(saved.scenes[0]?.alt).toBe('A scene');
        expect(saved.scenes[0]?.initialView).toEqual({ yaw: 30, pitch: 10, fov: 80 });
        expect(saved.behaviour.autorotate).toEqual({ enabled: true, speed: 2 });
        expect(saved.behaviour.zoomEnabled).toBe(false);
        expect(saved.behaviour.fullscreenEnabled).toBe(true);
        expect(saved.startSceneId).toBe(saved.scenes[0]?.id);
        device.destroy();
    });

    it('initializes with v2 tour data preserving scenes and behaviour', () => {
        const { device, body } = makeDevice();
        device.init(body, {
            version: 2,
            startSceneId: 'b',
            scenes: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
            behaviour: { showLabels: false },
        });
        expect(body.querySelectorAll('.three-sixty-scene-item')).toHaveLength(2);
        const saved = device.save() as { startSceneId: string; behaviour: { showLabels: boolean } };
        expect(saved.startSceneId).toBe('b');
        expect(saved.behaviour.showLabels).toBe(false);
        device.destroy();
    });

    it('refuses to edit a newer-version document but preserves it on save', () => {
        const { device, body } = makeDevice();
        const future = {
            version: 3,
            scenes: [{ id: 's1', volumetric: true }],
            somethingNew: { nested: [1, 2, 3] },
        };
        device.init(body, future);
        // The form is replaced by an explanation.
        expect(body.querySelector('.three-sixty-viewer-unsupported')).toBeTruthy();
        expect(body.textContent).toContain('newer version of eXeLearning');
        expect(body.querySelector('#threeSixtySceneList')).toBeNull();
        // Saving passes the ORIGINAL payload through, bit for bit.
        expect(device.save()).toBe(future);
        device.destroy();
    });

    it('falls back to a fresh document on unreadable input', () => {
        const { device, body } = makeDevice();
        device.init(body, '{broken json');
        expect(body.querySelector('#threeSixtySceneList')).toBeTruthy();
        const saved = device.save() as { version: number };
        expect(saved.version).toBe(2);
        device.destroy();
    });

    it('repeated init() replaces the previous editor cleanly', () => {
        const { device, body } = makeDevice();
        device.init(body, V1_DATA);
        device.init(body, { version: 2, scenes: [{ id: 'only', title: 'Only' }] });
        expect(body.querySelectorAll('.three-sixty-scene-item')).toHaveLength(1);
        const saved = device.save() as { scenes: Array<{ id: string }> };
        expect(saved.scenes.map(scene => scene.id)).toEqual(['only']);
        // And init after an unsupported payload clears the passthrough.
        device.init(body, { version: 3 });
        expect(device.save()).toEqual({ version: 3 });
        device.init(body, null);
        const fresh = device.save() as { version: number; scenes: unknown[] };
        expect(fresh.version).toBe(2);
        device.destroy();
        expect(device.save()).toBe(false);
    });
});

/**
 * Closing the editor must release the WebGL context, the render loop and the
 * window-level drag listeners even when the author never saves: the workarea
 * destroys the edition lifecycle, not the device.
 */
describe('edition lifecycle teardown', () => {
    let uninstallThree: (() => void) | null = null;

    afterEach(() => {
        uninstallThree?.();
        uninstallThree = null;
    });

    const PANORAMA = { version: 2, scenes: [{ id: 'a', src: 'asset://pano.jpg' }] };

    it('releases the three.js preview and its render loop when the edition closes without saving', () => {
        const { three, state: threeState } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const { device, body, manual } = makeDevice();
        const lifecycle = makeLifecycle();
        device.$lifecycle = lifecycle;
        device.init(body, PANORAMA);
        expect(threeState.renderers).toHaveLength(1);
        expect(manual.pendingCount()).toBeGreaterThan(0);

        lifecycle.destroy();

        expect(threeState.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(manual.pendingCount()).toBe(0);
        expect(device.save()).toBe(false);
    });

    it('disposes each three.js resource exactly once when the device was already destroyed', () => {
        const { three, state: threeState } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const { device, body } = makeDevice();
        const lifecycle = makeLifecycle();
        device.$lifecycle = lifecycle;
        device.init(body, PANORAMA);

        device.destroy();
        lifecycle.destroy();

        expect(threeState.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
    });

    it('does not build the preview when three.js arrives after the edition closed', () => {
        const loadThree = vi.fn<LoadThree>();
        const { device, body } = makeDevice(loadThree);
        const lifecycle = makeLifecycle();
        device.$lifecycle = lifecycle;
        device.init(body, PANORAMA);
        const onLoaded = loadThree.mock.calls[0]?.[1];
        expect(typeof onLoaded).toBe('function');

        lifecycle.destroy();
        const { three, state: threeState } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        onLoaded?.();

        expect(threeState.renderers).toHaveLength(0);
    });

    it('leaves unrelated window listeners untouched on teardown', () => {
        const { device, body } = makeDevice();
        const lifecycle = makeLifecycle();
        device.$lifecycle = lifecycle;
        device.init(body, null);
        const other = vi.fn();
        window.addEventListener('pointermove', other);
        try {
            lifecycle.destroy();
            window.dispatchEvent(new PointerEvent('pointermove'));
            expect(other).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener('pointermove', other);
        }
    });
});
