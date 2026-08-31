import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, makeInteraction, resetDom, sequentialIds } from '../test/helpers';
import { createModelViewerStub } from '../test/model-viewer-stub';
import { installThreeStub } from '../test/three-stub';
import { createViewerRuntime, getViewerRuntime, publishViewerRuntime, readWrapperOptions } from './viewer-runtime';

let restoreThree: () => void;

beforeEach(() => {
    restoreThree = installThreeStub();
    globalThis.eXe3DViewer = undefined;
    globalThis.__tdvForceWebGL = true;
});

afterEach(() => {
    restoreThree();
    globalThis.eXe3DViewer = undefined;
    globalThis.__tdvForceWebGL = undefined;
    resetDom();
    vi.restoreAllMocks();
});

describe('readWrapperOptions', () => {
    it('reads and normalizes the flat attributes', () => {
        const wrapper = createWrapper();
        Object.assign(wrapper.dataset, {
            modelSrc: 'content/resources/a.stl',
            modelColor: '#ABC',
            backgroundColor: '#DEF',
            cameraControls: 'false',
            autoRotate: 'true',
            autoRotateSpeed: '45',
        });
        expect(readWrapperOptions(wrapper)).toEqual({
            src: 'content/resources/a.stl',
            type: 'stl',
            modelColor: '#aabbcc',
            backgroundColor: '#ddeeff',
            cameraControls: false,
            autoRotate: true,
            autoRotateSpeed: 45,
        });
    });

    it('applies the defaults and strips an ephemeral source', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'blob:http://x/1';
        expect(readWrapperOptions(wrapper)).toMatchObject({
            src: '',
            cameraControls: true,
            autoRotate: true,
            autoRotateSpeed: 30,
        });
    });

    it('lets nav controls win over auto-rotation', () => {
        const wrapper = createWrapper();
        wrapper.dataset.showNavControls = 'true';
        wrapper.dataset.autoRotate = 'true';
        expect(readWrapperOptions(wrapper).autoRotate).toBe(false);
    });
});

describe('createViewerRuntime', () => {
    it('registers an instance and returns the same one on a repeated init', () => {
        const runtime = createViewerRuntime();
        const wrapper = createWrapper();
        const first = runtime.init(wrapper, readWrapperOptions(wrapper));
        expect(first).not.toBeNull();
        expect(runtime.init(wrapper)).toBe(first);
        expect(runtime.getInstance(wrapper)).toBe(first);
    });

    it('reads the wrapper attributes when no options are given', () => {
        const runtime = createViewerRuntime();
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'a.glb';
        expect(runtime.init(wrapper)?.type).toBe('glb');
    });

    it('returns null without a wrapper', () => {
        expect(createViewerRuntime().init(null as unknown as HTMLElement)).toBeNull();
    });

    it('registers the instance BEFORE the async STL boot, so destroy always finds it', () => {
        const runtime = createViewerRuntime();
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'content/resources/a.stl';
        const instance = runtime.init(wrapper);
        expect(runtime.getInstance(wrapper)).toBe(instance);
        runtime.destroy(wrapper);
        expect(runtime.getInstance(wrapper)).toBeNull();
    });

    it('reports an STL boot failure without rejecting', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const three = globalThis.THREE as ThreeNamespace;
        three.STLLoader = class {
            parse(): never {
                throw new Error('bad geometry');
            }
        } as unknown as ThreeNamespace['STLLoader'];
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('network down');
            }),
        );
        const runtime = createViewerRuntime();
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'content/resources/a.stl';
        runtime.init(wrapper);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(error).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('tears every instance down', () => {
        const runtime = createViewerRuntime();
        const first = runtime.init(createWrapper('one'), readWrapperOptions(createWrapper('one-opts')));
        const second = runtime.init(createWrapper('two'), readWrapperOptions(createWrapper('two-opts')));
        runtime.destroyAll();
        expect(first?.stopped).toBe(true);
        expect(second?.stopped).toBe(true);
        expect(runtime.registry.wrappers()).toEqual([]);
    });

    it('binds a single pagehide teardown that respects bfcache', () => {
        const addEventListener = vi.spyOn(globalThis, 'addEventListener');
        const runtime = createViewerRuntime();
        const first = runtime.init(createWrapper('one'), readWrapperOptions(createWrapper('one-opts')));
        runtime.init(createWrapper('two'), readWrapperOptions(createWrapper('two-opts')));
        const pageHideBindings = addEventListener.mock.calls.filter(call => call[0] === 'pagehide');
        expect(pageHideBindings).toHaveLength(1);
        const handler = pageHideBindings[0][1] as (event: { persisted?: boolean }) => void;

        handler({ persisted: true });
        expect(first?.stopped).toBeFalsy();
        expect(runtime.registry.wrappers()).toHaveLength(2);

        handler({ persisted: false });
        expect(first?.stopped).toBe(true);
        expect(runtime.registry.wrappers()).toEqual([]);
    });

    it('creates an interaction layer through the shared controller', () => {
        const runtime = createViewerRuntime();
        const wrapper = createWrapper();
        const modelViewer = createModelViewerStub(wrapper);
        const controller = runtime.createInteractionLayer(
            { wrapper, type: 'glb', modelViewer },
            makeInteraction({ enabled: true, markers: [{ id: 'm1', label: 'One' }] }, sequentialIds()),
            'view',
            { t: key => key },
        );
        expect(wrapper.querySelector('.tdv-marker')?.getAttribute('aria-label')).toBe('One');
        controller.destroy();
    });

    it('re-exports the pure helpers both surfaces share', () => {
        const runtime = createViewerRuntime();
        expect(runtime.detectModelType('a.stl')).toBe('stl');
        expect(runtime.normalizeColor('#ABC')).toBe('#aabbcc');
        expect(runtime.normalizeModelSource('blob:x')).toBe('');
        expect(typeof runtime.resolveModelSource).toBe('function');
        expect(typeof runtime.configureRendererColorManagement).toBe('function');
        expect(typeof runtime.disposeObject3D).toBe('function');
        expect(typeof runtime.disposeMaterial).toBe('function');
        expect(typeof runtime.readWrapperOptions).toBe('function');
    });

    it('keeps two runtimes independent', () => {
        const first = createViewerRuntime();
        const second = createViewerRuntime();
        const wrapper = createWrapper();
        first.init(wrapper, readWrapperOptions(wrapper));
        expect(second.getInstance(wrapper)).toBeNull();
    });
});

describe('publishViewerRuntime / getViewerRuntime', () => {
    it('publishes once and reuses whatever is already there', () => {
        expect(getViewerRuntime()).toBeNull();
        const first = publishViewerRuntime();
        expect(globalThis.eXe3DViewer).toBe(first);
        expect(publishViewerRuntime()).toBe(first);
        expect(getViewerRuntime()).toBe(first);
    });
});
