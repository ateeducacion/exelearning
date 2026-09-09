import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishViewerRuntime } from '../runtime/viewer-runtime';
import type { ViewerDisplayConfig } from '../shared/types';
import { createStubInstance, createWrapper, flush, resetDom } from '../test/helpers';
import { createModelViewerStub, type ModelViewerStub } from '../test/model-viewer-stub';
import { createThreeStub, installThreeStub, StubVector3 } from '../test/three-stub';
import { isLocalFileProtocol, orbitPosition, ThreeDViewerController } from './viewer-controller';

let restoreThree: () => void;

function config(overrides: Partial<ViewerDisplayConfig> = {}): ViewerDisplayConfig {
    return {
        src: 'content/resources/a.glb',
        type: 'glb',
        alt: '',
        modelColor: '#888888',
        backgroundColor: '#f5f5f5',
        cameraControls: true,
        autoRotate: false,
        autoRotateSpeed: 30,
        showNavControls: false,
        animation: { enabled: false, name: '', speed: 1 },
        ...overrides,
    };
}

function mount(markup = ''): { wrapper: HTMLElement; modelViewer: ModelViewerStub } {
    const wrapper = createWrapper('idev-1');
    wrapper.innerHTML = `${markup}<span data-live></span><div class="viewer-empty" data-empty></div>`;
    const modelViewer = createModelViewerStub(wrapper);
    return { wrapper, modelViewer };
}

beforeEach(() => {
    const three = createThreeStub();
    // `ensureThreeJsLoaded` short-circuits once both add-ons are published, so
    // the STL path can be exercised without importing the vendored modules.
    three.STLLoader = class {} as unknown as ThreeNamespace['STLLoader'];
    three.OrbitControls = class {} as unknown as ThreeNamespace['OrbitControls'];
    restoreThree = installThreeStub(three);
    globalThis.eXe3DViewer = undefined;
});

afterEach(() => {
    restoreThree();
    globalThis.eXe3DViewer = undefined;
    globalThis.eXeLearning = undefined;
    resetDom();
    vi.restoreAllMocks();
});

describe('orbitPosition', () => {
    it('keeps the orbit radius while turning the camera', () => {
        const next = orbitPosition({ x: 0, y: 0, z: 3 }, Math.PI / 2, 0);
        expect(Math.hypot(next.x, next.y, next.z)).toBeCloseTo(3);
        expect(next.x).toBeCloseTo(3);
        expect(next.z).toBeCloseTo(0);
    });

    it('clamps the polar angle away from the poles', () => {
        const up = orbitPosition({ x: 0, y: 0, z: 3 }, 0, 10);
        const down = orbitPosition({ x: 0, y: 0, z: 3 }, 0, -10);
        expect(up.y).toBeLessThan(3);
        expect(down.y).toBeGreaterThan(-3);
    });

    it('uses the angles the controls report when they are available', () => {
        const next = orbitPosition({ x: 0, y: 0, z: 3 }, 0, 0, { azimuth: Math.PI / 2, polar: Math.PI / 2 });
        expect(next.x).toBeCloseTo(3);
    });

    it('treats a degenerate position as unit radius', () => {
        const next = orbitPosition({ x: 0, y: 0, z: 0 }, 0, 0);
        expect(Math.hypot(next.x, next.y, next.z)).toBeCloseTo(1);
    });
});

describe('isLocalFileProtocol', () => {
    it('is false for an http page', () => {
        expect(isLocalFileProtocol()).toBe(false);
    });
});

describe('ThreeDViewerController — GLB path', () => {
    it('applies the configuration to the element', async () => {
        const { wrapper, modelViewer } = mount();
        await new ThreeDViewerController(
            wrapper,
            config({ alt: 'Cube', autoRotate: true, autoRotateSpeed: 45 }),
        ).start();

        expect(modelViewer.getAttribute('src')).toBe('content/resources/a.glb');
        expect(modelViewer.alt).toBe('Cube');
        expect(modelViewer.getAttribute('aria-label')).toBe('Cube');
        expect(modelViewer.hasAttribute('camera-controls')).toBe(true);
        expect(modelViewer.getAttribute('rotation-per-second')).toBe('45deg');
        expect(modelViewer.style.backgroundColor).toBeTruthy();
    });

    it('removes the optional attributes when the options are off', async () => {
        const { wrapper, modelViewer } = mount();
        await new ThreeDViewerController(wrapper, config({ cameraControls: false })).start();
        expect(modelViewer.hasAttribute('camera-controls')).toBe(false);
        expect(modelViewer.hasAttribute('auto-rotate')).toBe(false);
        expect(modelViewer.hasAttribute('aria-label')).toBe(false);
    });

    it('hides the empty-state overlay once a model is configured', async () => {
        const { wrapper } = mount();
        await new ThreeDViewerController(wrapper, config()).start();
        expect(wrapper.querySelector<HTMLElement>('[data-empty]')?.style.display).toBe('none');
    });

    it('shows the empty-state overlay when nothing is configured', async () => {
        const { wrapper } = mount();
        await new ThreeDViewerController(wrapper, config({ src: '' })).start();
        expect(wrapper.querySelector<HTMLElement>('[data-empty]')?.style.display).toBe('grid');
    });

    it('falls back to the async resolver for an uncached asset:// source', async () => {
        globalThis.eXeLearning = {
            app: {
                project: {
                    assetManager: {
                        resolveAssetURLSync: () => null,
                        resolveAssetURL: async () => 'blob:resolved',
                    },
                },
            },
        };
        const { wrapper, modelViewer } = mount();
        await new ThreeDViewerController(wrapper, config({ src: 'asset://a.glb' })).start();
        expect(modelViewer.getAttribute('src')).toBe('blob:resolved');
    });

    it('plays the configured animation once the model loads', async () => {
        const { wrapper, modelViewer } = mount();
        modelViewer.availableAnimations = ['Spin', 'Bounce'];
        const controller = new ThreeDViewerController(
            wrapper,
            config({ animation: { enabled: true, name: 'Bounce', speed: 2 } }),
        );
        await controller.start();
        modelViewer.dispatchEvent(new Event('load'));
        expect(modelViewer.animationName).toBe('Bounce');
        expect(modelViewer.animationSpeed).toBe(2);
        expect(modelViewer.__played).toBe(true);
        expect(wrapper.querySelector('[data-live]')?.textContent).toContain('Bounce');
    });

    it('falls back to the first animation when the stored one is gone', async () => {
        const { wrapper, modelViewer } = mount();
        modelViewer.availableAnimations = ['Spin'];
        await new ThreeDViewerController(
            wrapper,
            config({ animation: { enabled: true, name: 'Missing', speed: 1 } }),
        ).start();
        modelViewer.dispatchEvent(new Event('load'));
        expect(modelViewer.animationName).toBe('Spin');
    });

    it('pauses and announces when animation is off or unavailable', async () => {
        const { wrapper, modelViewer } = mount();
        await new ThreeDViewerController(wrapper, config()).start();
        expect(modelViewer.__paused).toBe(true);
        expect(wrapper.querySelector('[data-live]')?.textContent).toBe('Animation paused');

        modelViewer.__paused = false;
        const { wrapper: other, modelViewer: otherViewer } = mount();
        await new ThreeDViewerController(other, config({ animation: { enabled: true, name: '', speed: 1 } })).start();
        otherViewer.dispatchEvent(new Event('load'));
        expect(otherViewer.__played).toBe(false);
    });
});

describe('ThreeDViewerController — STL path', () => {
    it('boots the shared runtime with the resolved URL', async () => {
        const runtime = publishViewerRuntime();
        const init = vi.spyOn(runtime, 'init');
        const { wrapper } = mount();
        await new ThreeDViewerController(wrapper, config({ src: 'content/resources/a.stl', type: 'stl' })).start();
        expect(init).toHaveBeenCalledWith(
            wrapper,
            expect.objectContaining({ src: 'content/resources/a.stl', type: 'stl' }),
        );
        expect(wrapper.querySelector<HTMLElement>('[data-empty]')?.style.display).toBe('none');
    });

    it('gives up cleanly when no STL URL can be resolved', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        globalThis.eXeLearning = {
            app: { project: { assetManager: { resolveAssetURLSync: () => null, resolveAssetURL: async () => null } } },
        };
        const runtime = publishViewerRuntime();
        const init = vi.spyOn(runtime, 'init');
        const { wrapper } = mount();
        await new ThreeDViewerController(wrapper, config({ src: 'asset://a.stl', type: 'stl' }), {
            assetTimeoutMs: 0,
        }).start();
        expect(warn).toHaveBeenCalled();
        expect(init).not.toHaveBeenCalled();
    });

    it('reports a boot failure without throwing', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const runtime = publishViewerRuntime();
        vi.spyOn(runtime, 'init').mockImplementation(() => {
            throw new Error('WebGL unavailable');
        });
        const { wrapper } = mount();
        await expect(
            new ThreeDViewerController(wrapper, config({ src: 'content/resources/a.stl', type: 'stl' })).start(),
        ).resolves.toBeUndefined();
        expect(error).toHaveBeenCalled();
    });
});

describe('ThreeDViewerController — controls', () => {
    const NAV_MARKUP =
        '<button data-fullscreen></button>' +
        '<div class="three-d-viewer-nav">' +
        '<button data-nav="left"></button><button data-nav="right"></button>' +
        '<button data-nav="up"></button><button data-nav="down"></button></div>';

    it('labels the fullscreen button and toggles fullscreen', async () => {
        const { wrapper } = mount(NAV_MARKUP);
        const request = vi.fn(async () => {});
        wrapper.requestFullscreen = request;
        await new ThreeDViewerController(wrapper, config({ showNavControls: true })).start();

        wrapper.querySelector<HTMLButtonElement>('[data-fullscreen]')?.click();
        expect(request).toHaveBeenCalled();

        document.dispatchEvent(new Event('fullscreenchange'));
        expect(wrapper.querySelector('[data-fullscreen]')?.getAttribute('aria-label')).toBe('Fullscreen');
    });

    it('exits fullscreen when the wrapper already owns it', async () => {
        const { wrapper } = mount(NAV_MARKUP);
        const exit = vi.fn(async () => {});
        Object.defineProperty(document, 'fullscreenElement', { value: wrapper, configurable: true });
        document.exitFullscreen = exit;
        await new ThreeDViewerController(wrapper, config({ showNavControls: true })).start();
        wrapper.querySelector<HTMLButtonElement>('[data-fullscreen]')?.click();
        expect(exit).toHaveBeenCalled();
        Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    });

    it('orbits the model-viewer camera from the arrow pad', async () => {
        const { wrapper, modelViewer } = mount(NAV_MARKUP);
        await new ThreeDViewerController(wrapper, config({ showNavControls: true })).start();
        wrapper.querySelector<HTMLButtonElement>('[data-nav="right"]')?.click();
        expect(modelViewer.cameraOrbit).toMatch(/rad/);
        expect(modelViewer.__jumped).toBe(true);
    });

    it('orbits the STL camera through the live instance', async () => {
        const runtime = publishViewerRuntime();
        const { wrapper } = mount(NAV_MARKUP);
        const instance = createStubInstance(wrapper);
        instance.controls = {
            target: new StubVector3(),
            getAzimuthalAngle: () => 0,
            getPolarAngle: () => Math.PI / 2,
            update: vi.fn(),
        } as unknown as ThreeOrbitControls;
        runtime.registry.set(wrapper, instance);

        const controller = new ThreeDViewerController(wrapper, config({ showNavControls: true, type: 'glb' }));
        await controller.start();
        controller.nudgeCamera(Math.PI / 2, 0);
        expect(instance.camera?.position.x).toBeCloseTo(3);
        expect(instance.controls?.update).toHaveBeenCalled();
    });

    it('does nothing when neither renderer can be reached', async () => {
        const wrapper = createWrapper();
        wrapper.innerHTML = '<button data-nav="left"></button>';
        const controller = new ThreeDViewerController(wrapper, config({ showNavControls: true }));
        await controller.start();
        expect(() => controller.nudgeCamera(0.1, 0)).not.toThrow();
    });
});

describe('ThreeDViewerController — lifecycle', () => {
    it('reacts to a late src change through its observer', async () => {
        const { wrapper, modelViewer } = mount();
        await new ThreeDViewerController(wrapper, config({ src: '' })).start();
        expect(wrapper.querySelector<HTMLElement>('[data-empty]')?.style.display).toBe('grid');
        modelViewer.setAttribute('src', 'blob:late');
        await flush();
        expect(wrapper.querySelector<HTMLElement>('[data-empty]')?.style.display).toBe('none');
    });

    it('disconnects its observers and tears the viewer down', async () => {
        const runtime = publishViewerRuntime();
        const destroy = vi.spyOn(runtime, 'destroy');
        const { wrapper } = mount();
        const controller = new ThreeDViewerController(wrapper, config());
        await controller.start();
        controller.destroy();
        expect(destroy).toHaveBeenCalledWith(wrapper);
    });

    it('shows the local-file warning instead of booting under file://', async () => {
        vi.stubGlobal('location', { protocol: 'file:', href: 'file:///a/index.html', origin: 'null' });
        const { wrapper, modelViewer } = mount();
        await new ThreeDViewerController(wrapper, config()).start();
        expect(wrapper.querySelector('.three-d-viewer-local-warning')).not.toBeNull();
        expect(modelViewer.style.display).toBe('none');
        expect(wrapper.querySelector<HTMLElement>('[data-empty]')?.style.display).toBe('none');
        vi.unstubAllGlobals();
    });

    it('tolerates a wrapper with no <model-viewer> at all', async () => {
        const wrapper = createWrapper();
        await expect(new ThreeDViewerController(wrapper, config()).start()).resolves.toBeUndefined();
    });
});
