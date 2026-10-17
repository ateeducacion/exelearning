import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, resetDom } from '../test/helpers';
import { createModelViewerStub } from '../test/model-viewer-stub';
import { createThreeStub, installThreeStub, StubVector3 } from '../test/three-stub';
import { createInstance } from './lifecycle';
import { bootStl, configureRendererColorManagement } from './stl-renderer';
import type { ViewerInstance, ViewerOptions } from './types';

const OPTIONS: ViewerOptions = {
    src: 'content/resources/a.stl',
    type: 'stl',
    modelColor: '#3325f4',
    backgroundColor: '#ffffff',
    cameraControls: true,
    autoRotate: false,
    autoRotateSpeed: 30,
};

let restoreThree: () => void;
let three: ThreeNamespace;

function stubGeometry(): ThreeGeometry {
    return {
        boundingBox: { getSize: (target: ThreeVector3) => target.set(4, 2, 2) },
        computeBoundingBox: vi.fn(),
        center: vi.fn(),
        scale: vi.fn(),
        hasAttribute: () => false,
        computeVertexNormals: vi.fn(),
        dispose: vi.fn(),
    };
}

function stubFetch(): void {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
    );
}

function makeInstance(wrapper: HTMLElement, overrides: Partial<ViewerOptions> = {}): ViewerInstance {
    return createInstance(wrapper, { ...OPTIONS, ...overrides });
}

beforeEach(() => {
    three = createThreeStub();
    three.STLLoader = class {
        parse(): ThreeGeometry {
            return stubGeometry();
        }
    } as unknown as ThreeNamespace['STLLoader'];
    three.OrbitControls = class {
        target = new StubVector3();
        enableDamping = false;
        dampingFactor = 0;
        update = vi.fn();
        dispose = vi.fn();
    } as unknown as ThreeNamespace['OrbitControls'];
    restoreThree = installThreeStub(three);
    // Run the animation loop exactly once per boot so tests stay deterministic.
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    stubFetch();
});

afterEach(() => {
    restoreThree();
    vi.unstubAllGlobals();
    resetDom();
    vi.restoreAllMocks();
});

describe('configureRendererColorManagement', () => {
    it('enables sRGB output on a modern renderer', () => {
        const renderer = { outputColorSpace: undefined, toneMapping: undefined } as unknown as ThreeRenderer;
        configureRendererColorManagement(renderer);
        expect(renderer.outputColorSpace).toBe('srgb');
        expect(renderer.toneMapping).toBe(0);
        expect(three.ColorManagement?.enabled).toBe(true);
    });

    it('falls back to outputEncoding on a pre-r150 renderer', () => {
        three.SRGBColorSpace = undefined;
        three.sRGBEncoding = 'srgb-encoding';
        const renderer = { outputEncoding: undefined } as unknown as ThreeRenderer;
        configureRendererColorManagement(renderer);
        expect(renderer.outputEncoding).toBe('srgb-encoding');
    });

    it('is a no-op without a renderer or without THREE', () => {
        expect(() => configureRendererColorManagement(null)).not.toThrow();
        restoreThree();
        expect(() => configureRendererColorManagement({} as ThreeRenderer)).not.toThrow();
        restoreThree = installThreeStub(three);
    });
});

describe('bootStl', () => {
    it('builds the scene, the mesh and the controls, and starts the loop', async () => {
        const wrapper = createWrapper();
        const instance = makeInstance(wrapper);
        await bootStl(instance);

        expect(wrapper.querySelector('canvas.three-js-canvas')).not.toBeNull();
        expect(instance.scene).not.toBeNull();
        expect(instance.camera).not.toBeNull();
        expect(instance.renderer).not.toBeNull();
        expect(instance.mesh).not.toBeNull();
        expect(instance.material).not.toBeNull();
        expect(instance.controls).not.toBeNull();
        expect(instance.rafId).toBe(1);
    });

    it('normalizes the mesh to a two-unit box', async () => {
        const geometry = stubGeometry();
        three.STLLoader = class {
            parse(): ThreeGeometry {
                return geometry;
            }
        } as unknown as ThreeNamespace['STLLoader'];
        const instance = makeInstance(createWrapper());
        await bootStl(instance);
        expect(geometry.center).toHaveBeenCalled();
        // The longest dimension is 4, so the scale factor is 2/4.
        expect(geometry.scale).toHaveBeenCalledWith(0.5, 0.5, 0.5);
        expect(geometry.computeVertexNormals).toHaveBeenCalled();
    });

    it('uses a purely diffuse material so the author colour survives', async () => {
        const created: Array<Record<string, unknown>> = [];
        three.MeshStandardMaterial = class {
            constructor(params: Record<string, unknown>) {
                created.push(params);
            }
        } as unknown as ThreeNamespace['MeshStandardMaterial'];
        await bootStl(makeInstance(createWrapper()));
        expect(created[0]).toMatchObject({ metalness: 0, roughness: 0.55 });
    });

    it('skips the OrbitControls when camera controls are off', async () => {
        const instance = makeInstance(createWrapper(), { cameraControls: false });
        await bootStl(instance);
        expect(instance.controls).toBeNull();
    });

    it('hides a sibling <model-viewer> and the empty-state overlay', async () => {
        const wrapper = createWrapper();
        wrapper.innerHTML = '<div class="viewer-empty" data-empty></div>';
        const modelViewer = createModelViewerStub(wrapper);
        const instance = makeInstance(wrapper);
        await bootStl(instance);
        expect(modelViewer.style.display).toBe('none');
        expect(wrapper.querySelector<HTMLElement>('[data-empty]')?.style.display).toBe('none');
        expect(instance.modelViewer).toBe(modelViewer);
    });

    it('reuses an existing canvas instead of stacking them', async () => {
        const wrapper = createWrapper();
        await bootStl(makeInstance(wrapper));
        await bootStl(makeInstance(wrapper));
        expect(wrapper.querySelectorAll('canvas.three-js-canvas')).toHaveLength(1);
    });

    it('runs the per-frame callbacks before rendering, and survives one throwing', async () => {
        const wrapper = createWrapper();
        const instance = makeInstance(wrapper);
        const good = vi.fn();
        instance.onFrame.push(() => {
            throw new Error('overlay broken');
        }, good);
        await bootStl(instance);
        expect(good).toHaveBeenCalled();
    });

    it('rotates the mesh when auto-rotation is on', async () => {
        const instance = makeInstance(createWrapper(), { autoRotate: true, autoRotateSpeed: 60 });
        await bootStl(instance);
        expect(instance.mesh?.rotation.y).toBeGreaterThan(0);
    });

    it('does nothing without THREE, without STLLoader or on a stopped instance', async () => {
        const stopped = makeInstance(createWrapper('a'));
        stopped.stopped = true;
        await bootStl(stopped);
        expect(stopped.canvas).toBeNull();

        three.STLLoader = undefined;
        const noLoader = makeInstance(createWrapper('b'));
        await bootStl(noLoader);
        expect(noLoader.canvas).toBeNull();
    });

    it('does nothing when the source cannot be resolved', async () => {
        const instance = makeInstance(createWrapper(), { src: 'asset://missing.stl' });
        await bootStl(instance);
        expect(instance.canvas).toBeNull();
    });

    it('abandons the boot when the instance is destroyed mid-fetch', async () => {
        const instance = makeInstance(createWrapper());
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                instance.stopped = true;
                return { arrayBuffer: async () => new ArrayBuffer(8) };
            }),
        );
        await bootStl(instance);
        expect(instance.mesh).toBeNull();
    });

    it('logs and degrades when the fetch or the parse fails', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('network down');
            }),
        );
        const instance = makeInstance(createWrapper());
        await bootStl(instance);
        expect(error).toHaveBeenCalled();
        expect(instance.mesh).toBeNull();
        // The scene still exists, so teardown has something to dispose.
        expect(instance.renderer).not.toBeNull();
    });
});
