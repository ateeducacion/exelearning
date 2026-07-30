import { describe, expect, it } from 'vitest';
import { createThreeMock, stubRect } from '../test/helpers';
import { applyColorManagement, applyTextureColorSpace, createPanoramaRenderer } from './panorama-renderer';
import type { PanoramaOptions } from './panorama-renderer';

function makeRenderer(overrides: Partial<PanoramaOptions> = {}) {
    const { three, state } = createThreeMock();
    const renderer = createPanoramaRenderer({
        three,
        initialFov: 75,
        width: 640,
        height: 360,
        devicePixelRatio: 1,
        ...overrides,
    });
    return { renderer, three, state };
}

describe('createPanoramaRenderer', () => {
    it('wires camera, renderer size, sphere and orbit controls', () => {
        const { renderer, state } = makeRenderer({ zoomEnabled: false, autorotate: { enabled: true, speed: 2 } });
        expect(renderer.canvas).toBeInstanceOf(HTMLCanvasElement);
        expect(state.renderers[0]?.setSize).toHaveBeenCalledWith(640, 360);
        const controls = state.controls[0];
        expect(controls).toBeTruthy();
        expect(controls?.enableZoom).toBe(false);
        expect(controls?.autoRotate).toBe(true);
        expect(controls?.autoRotateSpeed).toBe(2);
        expect(state.geometries).toHaveLength(1);
        renderer.dispose();
    });

    it('renders frames and honours setViewportSize', () => {
        const { renderer, state } = makeRenderer();
        renderer.renderFrame();
        expect(state.renderers[0]?.render).toHaveBeenCalledTimes(1);
        expect(state.controls[0]?.update).toHaveBeenCalled();
        renderer.setViewportSize(800, 400);
        expect(renderer.camera.aspect).toBe(2);
        expect(state.renderers[0]?.setSize).toHaveBeenLastCalledWith(800, 400);
        // Degenerate sizes are ignored.
        renderer.setViewportSize(0, 400);
        expect(state.renderers[0]?.setSize).toHaveBeenLastCalledWith(800, 400);
        renderer.dispose();
    });

    it('applies the initial view through fov + lookAt', () => {
        const { renderer } = makeRenderer();
        renderer.applyInitialView({ yaw: 90, pitch: 0, fov: 100 });
        expect(renderer.camera.fov).toBe(100);
        expect(renderer.camera.updateProjectionMatrix).toHaveBeenCalled();
        const lookAt = renderer.camera.lookAt as unknown as { mock: { calls: unknown[][] } };
        const lastCall = lookAt.mock.calls[lookAt.mock.calls.length - 1];
        const [x, , z] = lastCall as [number, number, number];
        expect(x).toBeCloseTo(1);
        expect(z).toBeCloseTo(0);
        renderer.dispose();
    });

    it('loads textures, disposing the previous one first', () => {
        const { renderer, state } = makeRenderer();
        renderer.loadTexture('one.jpg');
        renderer.loadTexture('two.jpg');
        expect(state.textures.map(texture => texture.url)).toEqual(['one.jpg', 'two.jpg']);
        expect(state.textures[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.textures[1]?.dispose).not.toHaveBeenCalled();
        expect(state.materials[0]).toMatchObject({ map: state.textures[1] });
        renderer.dispose();
        expect(state.textures[1]?.dispose).toHaveBeenCalledTimes(1);
    });

    it('projects yaw/pitch to screen coordinates and hides points behind the camera', () => {
        const { renderer } = makeRenderer();
        const visible = renderer.projectYawPitchToScreen(0, 0, 640, 360);
        expect(visible).toEqual({ x: 320, y: 180, visible: true });
        renderer.dispose();

        const behindMock = createThreeMock({ projectBehind: true });
        const behindRenderer = createPanoramaRenderer({
            three: behindMock.three,
            initialFov: 75,
            width: 640,
            height: 360,
        });
        expect(behindRenderer.projectYawPitchToScreen(0, 0, 640, 360).visible).toBe(false);
        behindRenderer.dispose();
    });

    it('converts clicks to yaw/pitch via unproject', () => {
        const { renderer } = makeRenderer();
        stubRect(renderer.canvas, { left: 0, top: 0, width: 640, height: 360 });
        const centre = renderer.clickToYawPitch(320, 180);
        expect(centre).not.toBeNull();
        expect(centre?.yaw).toBeCloseTo(0);
        expect(centre?.pitch).toBeCloseTo(0);
        // Zero-sized canvas yields null.
        stubRect(renderer.canvas, { width: 0, height: 0 });
        expect(renderer.clickToYawPitch(0, 0)).toBeNull();
        renderer.dispose();
    });

    it('reads the live camera direction', () => {
        const { renderer } = makeRenderer();
        expect(renderer.getCameraYawPitch()).toEqual({ yaw: 0, pitch: 0 });
        renderer.dispose();
    });

    it('nudge moves the camera and keeps controls updated', () => {
        const { renderer, state } = makeRenderer();
        renderer.nudge(0.1, 0.05);
        expect(renderer.camera.lookAt).toHaveBeenCalledWith(0, 0, 0);
        expect(state.controls[0]?.update).toHaveBeenCalled();
        renderer.dispose();
    });

    it('toggles controls, autorotate and zoom', () => {
        const { renderer, state } = makeRenderer();
        renderer.setControlsEnabled(false);
        expect(state.controls[0]?.enabled).toBe(false);
        renderer.setAutorotate(true, 5);
        expect(state.controls[0]?.autoRotate).toBe(true);
        expect(state.controls[0]?.autoRotateSpeed).toBe(5);
        renderer.setZoomEnabled(false);
        expect(state.controls[0]?.enableZoom).toBe(false);
        renderer.dispose();
    });

    it('dispose releases texture, controls, geometry, material and renderer once', () => {
        const { renderer, state } = makeRenderer();
        renderer.loadTexture('a.jpg');
        renderer.dispose();
        renderer.dispose();
        expect(state.textures[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.controls[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.geometries[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.materials[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
        // After dispose renderFrame is inert.
        renderer.renderFrame();
        expect(state.renderers[0]?.render).not.toHaveBeenCalled();
    });

    it('works without OrbitControls (fallback math paths)', () => {
        const { three } = createThreeMock({ withOrbitControls: false });
        const renderer = createPanoramaRenderer({ three, initialFov: 75, width: 100, height: 100 });
        expect(renderer.controls).toBeNull();
        renderer.nudge(0.2, 0.1);
        renderer.setControlsEnabled(false);
        renderer.setAutorotate(true, 1);
        renderer.setZoomEnabled(true);
        renderer.renderFrame();
        renderer.dispose();
    });
});

describe('colour management', () => {
    it('enables ColorManagement and sRGB output on the renderer', () => {
        const { three, state } = createThreeMock();
        // Constructing the renderer through the factory applies it already;
        // call directly on a fresh renderer to assert the effects.
        const renderer = new three.WebGLRenderer({});
        applyColorManagement(three, renderer);
        expect(three.ColorManagement?.enabled).toBe(true);
        expect(renderer.outputColorSpace).toBe('srgb');
        expect(renderer.toneMapping).toBe('none');
        expect(renderer.toneMappingExposure).toBe(1);
        expect(state.renderers).toHaveLength(1);
    });

    it('sets the texture colour space when supported', () => {
        const { three } = createThreeMock();
        const texture = { colorSpace: '' };
        applyTextureColorSpace(three, texture);
        expect(texture.colorSpace).toBe('srgb');
    });
});
