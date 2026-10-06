import { describe, expect, it } from 'vitest';
import { createDefaultScene } from '../shared/normalization';
import type { Scene } from '../shared/types';
import { createThreeMock, stubRect } from '../test/helpers';
import { createFlatImageRenderer } from './flat-image-renderer';
import { createPanoramaRenderer } from './panorama-renderer';
import { createSceneController } from './scene-controller';

function scene(overrides: Partial<Scene>): Scene {
    return { ...createDefaultScene(overrides.id ?? 's'), ...overrides };
}

function makeController() {
    const host = document.createElement('div');
    stubRect(host, { width: 640, height: 360 });
    const { three, state } = createThreeMock();
    const panorama = createPanoramaRenderer({ three, initialFov: 75, width: 640, height: 360 });
    host.appendChild(panorama.canvas);
    const flat = createFlatImageRenderer(host, 'flat');
    const controller = createSceneController({
        panorama,
        flat,
        resolveSrc: src => `resolved:${src}`,
        hostRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    });
    return { host, controller, panorama, flat, state };
}

describe('createSceneController', () => {
    it('applies an equirectangular scene: canvas visible, texture loaded', () => {
        const { controller, panorama, flat, state } = makeController();
        controller.applyScene(scene({ id: 'pano', src: 'p.jpg', initialView: { yaw: 10, pitch: 5, fov: 90 } }));
        expect(controller.currentMode).toBe('equirectangular');
        expect(controller.currentSceneId).toBe('pano');
        expect(panorama.canvas.style.display).toBe('');
        expect(flat.image.style.display).toBe('none');
        expect(state.textures[0]?.url).toBe('resolved:p.jpg');
        expect(panorama.camera.fov).toBe(90);
        expect(controller.needsFrameRender()).toBe(true);
    });

    it('applies a flat scene: image visible, controls disabled, no WebGL frames', () => {
        const { controller, panorama, flat, state } = makeController();
        controller.applyScene(scene({ id: 'photo', src: 'f.jpg', alt: 'A photo', projection: 'flat' }));
        expect(controller.currentMode).toBe('flat');
        expect(panorama.canvas.style.display).toBe('none');
        expect(state.controls[0]?.enabled).toBe(false);
        expect(flat.image.style.display).toBe('');
        expect(flat.image.getAttribute('src')).toBe('resolved:f.jpg');
        expect(flat.image.alt).toBe('A photo');
        expect(controller.needsFrameRender()).toBe(false);
    });

    it('switching between modes re-enables the panorama', () => {
        const { controller, panorama, state } = makeController();
        controller.applyScene(scene({ id: 'photo', projection: 'flat', src: 'f.jpg' }));
        controller.applyScene(scene({ id: 'pano', src: 'p.jpg' }));
        expect(controller.currentMode).toBe('equirectangular');
        expect(state.controls[0]?.enabled).toBe(true);
        expect(panorama.canvas.style.display).toBe('');
    });

    it('positions hotspots by projection mode', () => {
        const { controller, flat } = makeController();
        controller.applyScene(scene({ id: 'pano', src: 'p.jpg' }));
        // Mock projection puts everything at the viewport centre.
        expect(controller.positionFor({ yaw: 0, pitch: 0, x: 0, y: 0 })).toEqual({ x: 320, y: 180, visible: true });

        controller.applyScene(scene({ id: 'photo', projection: 'flat', src: 'f.jpg' }));
        Object.defineProperty(flat.image, 'naturalWidth', { value: 640, configurable: true });
        Object.defineProperty(flat.image, 'naturalHeight', { value: 360, configurable: true });
        expect(controller.positionFor({ yaw: 0, pitch: 0, x: 50, y: 50 })).toEqual({ x: 320, y: 180, visible: true });
    });

    it('hides hotspots when the host has no size or no panorama exists', () => {
        const { three } = createThreeMock();
        void three;
        const host = document.createElement('div');
        const flat = createFlatImageRenderer(host, 'flat');
        const zeroController = createSceneController({
            panorama: null,
            flat,
            resolveSrc: src => src,
            hostRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
        });
        expect(zeroController.positionFor({ yaw: 0, pitch: 0, x: 50, y: 50 })).toBeNull();

        const noPanorama = createSceneController({
            panorama: null,
            flat,
            resolveSrc: src => src,
            hostRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
        });
        // Equirectangular mode without a panorama renderer → hidden.
        expect(noPanorama.positionFor({ yaw: 0, pitch: 0, x: 50, y: 50 })).toBeNull();
        expect(noPanorama.needsFrameRender()).toBe(false);
    });
});
