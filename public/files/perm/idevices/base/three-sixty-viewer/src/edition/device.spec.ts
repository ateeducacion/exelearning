import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { createManualScheduler } from '../test/helpers';
import { createThreeSixtyEditionDevice } from './device';
import type { ThreeSixtyEditionDevice } from './device';

const identity = (text: string): string => text;

afterEach(() => {
    document.body.innerHTML = '';
});

function makeDevice(): { device: ThreeSixtyEditionDevice; body: HTMLElement } {
    const body = document.createElement('div');
    body.setAttribute('idevice-id', 'idev-device-test');
    document.body.appendChild(body);
    const device = createThreeSixtyEditionDevice({
        translate: identity,
        ids: createSequentialIdGenerator(),
        confirm: () => true,
        scheduler: createManualScheduler().scheduler,
        loadThree: vi.fn(),
        reducedMotion: false,
    });
    return { device, body };
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
