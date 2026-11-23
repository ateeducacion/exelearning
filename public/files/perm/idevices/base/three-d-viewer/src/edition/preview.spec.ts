import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishViewerRuntime } from '../runtime/viewer-runtime';
import {
    attachEditionLifecycle,
    createStubInstance,
    createWrapper,
    makeDocument,
    resetDom,
    sequentialIds,
} from '../test/helpers';
import { createThreeStub, installThreeStub, StubVector3 } from '../test/three-stub';
import { createEditorPreview } from './preview';

let restoreThree: () => void;

if (!customElements.get('model-viewer')) {
    customElements.define('model-viewer', class extends HTMLElement {});
}

function document_(overrides: Record<string, unknown> = {}): ReturnType<typeof makeDocument> {
    return makeDocument({ src: 'content/resources/a.glb', ...overrides }, sequentialIds());
}

beforeEach(() => {
    const three = createThreeStub();
    // `ensureThreeJsLoaded` short-circuits once both add-ons are published, so
    // the STL path runs without importing the vendored modules.
    three.STLLoader = class {} as unknown as ThreeNamespace['STLLoader'];
    three.OrbitControls = class {} as unknown as ThreeNamespace['OrbitControls'];
    restoreThree = installThreeStub(three);
    globalThis.eXe3DViewer = undefined;
    globalThis.__tdvForceWebGL = true;
});

afterEach(() => {
    restoreThree();
    globalThis.eXe3DViewer = undefined;
    globalThis.eXeLearning = undefined;
    globalThis.__tdvForceWebGL = undefined;
    resetDom();
    vi.restoreAllMocks();
});

const CALLBACKS = { onModelLoaded: vi.fn(), onModelError: vi.fn() };

describe('mount', () => {
    it('creates a <model-viewer> and reports load and error', async () => {
        const container = createWrapper();
        const onModelLoaded = vi.fn();
        const onModelError = vi.fn();
        const preview = createEditorPreview(container, { onModelLoaded, onModelError });
        await preview.mount();

        const element = preview.getModelViewer();
        expect(element).not.toBeNull();
        expect(container.firstElementChild).toBe(element);

        (element as unknown as { availableAnimations: string[] }).availableAnimations = ['Spin'];
        element?.dispatchEvent(new Event('load'));
        expect(onModelLoaded).toHaveBeenCalledWith(['Spin']);

        element?.dispatchEvent(new Event('error'));
        expect(onModelError).toHaveBeenCalled();
    });
});

describe('update — the GLB path', () => {
    it('applies the source and the display options to the element', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.update(document_({ alt: 'Cube', autoRotate: true, autoRotateSpeed: 45 }));

        const element = preview.getModelViewer();
        expect(element?.getAttribute('src')).toBe('content/resources/a.glb');
        expect(element?.alt).toBe('Cube');
        expect(element?.getAttribute('aria-label')).toBe('Cube');
        expect(element?.hasAttribute('camera-controls')).toBe(true);
        expect(element?.getAttribute('rotation-per-second')).toBe('45deg');
        expect(container.style.getPropertyValue('--viewer-preview-bg')).toBeTruthy();
    });

    it('clears the optional attributes when the options are off', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.update(document_({ cameraControls: false, autoRotate: false, alt: '' }));
        const element = preview.getModelViewer();
        expect(element?.hasAttribute('camera-controls')).toBe(false);
        expect(element?.hasAttribute('auto-rotate')).toBe(false);
        expect(element?.hasAttribute('aria-label')).toBe(false);
    });

    it('resolves an asset:// source through AssetManager', async () => {
        globalThis.eXeLearning = {
            app: { project: { assetManager: { resolveAssetURLSync: () => 'blob:cached' } } },
        };
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.update(document_({ src: 'asset://a.glb' }));
        expect(preview.getModelViewer()?.getAttribute('src')).toBe('blob:cached');
    });

    it('waits for AssetManager and warns when it never appears', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.update(document_({ src: 'asset://a.glb' }));
        expect(warn).toHaveBeenCalled();
        expect(preview.getModelViewer()?.hasAttribute('src')).toBe(false);
    });

    it('does nothing before the element is mounted', async () => {
        const preview = createEditorPreview(createWrapper(), CALLBACKS);
        await expect(preview.update(document_())).resolves.toBeUndefined();
        expect(preview.getModelViewer()).toBeNull();
    });
});

describe('update — the STL path', () => {
    it('boots the shared runtime and hides the model-viewer element', async () => {
        const runtime = publishViewerRuntime();
        const init = vi.spyOn(runtime, 'init');
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.update(document_({ src: 'content/resources/a.stl', modelColor: '#aabbcc' }));

        expect(init).toHaveBeenCalledWith(container, expect.objectContaining({ type: 'stl', modelColor: '#aabbcc' }));
        expect(preview.getModelViewer()?.style.display).toBe('none');
    });

    it('skips a redundant re-render but honours a forced one', async () => {
        const runtime = publishViewerRuntime();
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        const stl = document_({ src: 'content/resources/a.stl' });
        await preview.update(stl);
        // Pretend the first boot produced a live renderer.
        const instance = runtime.getInstance(container);
        if (instance) {
            instance.renderer = {} as ThreeRenderer;
        }
        const init = vi.spyOn(runtime, 'init');
        await preview.update(stl);
        expect(init).not.toHaveBeenCalled();
        await preview.update(stl, true);
        expect(init).toHaveBeenCalled();
    });

    it('re-renders when a display option changes on the same file', async () => {
        const runtime = publishViewerRuntime();
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.update(document_({ src: 'content/resources/a.stl', modelColor: '#111111' }));
        const instance = runtime.getInstance(container);
        if (instance) {
            instance.renderer = {} as ThreeRenderer;
        }
        const init = vi.spyOn(runtime, 'init');
        await preview.update(document_({ src: 'content/resources/a.stl', modelColor: '#222222' }));
        expect(init).toHaveBeenCalled();
    });

    it('warns and gives up when the STL source cannot be resolved', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.update(document_({ src: 'asset://a.stl' }));
        expect(warn).toHaveBeenCalled();
    });
});

describe('attachInteractions', () => {
    it('returns null when interactions are off or there is no model', async () => {
        const preview = createEditorPreview(createWrapper(), CALLBACKS);
        await preview.mount();
        await expect(preview.attachInteractions(document_(), {})).resolves.toBeNull();
        await expect(
            preview.attachInteractions(document_({ src: '', interaction: { enabled: true } }), {}),
        ).resolves.toBeNull();
    });

    it('creates a layer over the model-viewer element', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        const layer = await preview.attachInteractions(
            document_({ interaction: { enabled: true, markers: [{ id: 'm1', label: 'One' }] } }),
            { t: key => key },
        );
        expect(layer).not.toBeNull();
        expect(preview.getInteractions()).toBe(layer);
        expect(container.querySelector('.tdv-marker')?.getAttribute('aria-label')).toBe('One');
    });

    it('replaces a previous layer rather than stacking them', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        const doc = document_({ interaction: { enabled: true, markers: [{ id: 'm1', label: 'One' }] } });
        await preview.attachInteractions(doc, { t: key => key });
        await preview.attachInteractions(doc, { t: key => key });
        expect(container.querySelectorAll('.tdv-marker')).toHaveLength(1);
    });

    it('attaches to a booted STL instance and stores the layer on it', async () => {
        const runtime = publishViewerRuntime();
        const container = createWrapper();
        const instance = createStubInstance(container);
        runtime.registry.set(container, instance);
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();

        const layer = await preview.attachInteractions(
            document_({ src: 'content/resources/a.stl', interaction: { enabled: true, markers: [{ id: 'm1' }] } }),
            { t: key => key },
        );
        expect(layer).not.toBeNull();
        expect(instance.interaction).toBe(layer);
    });

    it('gives up on the STL layer when no instance ever appears', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        // First call sets the deadline, the next one is already past it.
        vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(1e9);
        await expect(
            preview.attachInteractions(
                document_({ src: 'content/resources/a.stl', interaction: { enabled: true, markers: [{ id: 'm1' }] } }),
                {},
            ),
        ).resolves.toBeNull();
    });

    it('forwards new settings to the live layer', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        const doc = document_({ interaction: { enabled: true, markers: [{ id: 'm1' }] } });
        await preview.attachInteractions(doc, { t: key => key });
        preview.syncInteractions({ ...doc.interaction, markers: [] });
        expect(container.querySelectorAll('.tdv-marker')).toHaveLength(0);
        // Syncing without a layer is harmless.
        preview.destroy();
        expect(() => preview.syncInteractions(doc.interaction)).not.toThrow();
    });
});

describe('resolveMediaUrl', () => {
    it('resolves an asset:// URL and leaves everything else alone', async () => {
        globalThis.eXeLearning = {
            app: { project: { assetManager: { resolveAssetURLSync: () => 'blob:media' } } },
        };
        const preview = createEditorPreview(createWrapper(), CALLBACKS);
        expect(preview.resolveMediaUrl('asset://a.png')).toBe('blob:media');
        expect(preview.resolveMediaUrl('https://example.org/a.png')).toBe('https://example.org/a.png');
    });
});

describe('nudgeCamera', () => {
    it('orbits the STL camera when an instance is live', async () => {
        const runtime = publishViewerRuntime();
        const container = createWrapper();
        const instance = createStubInstance(container);
        instance.controls = {
            target: new StubVector3(),
            getAzimuthalAngle: () => 0,
            getPolarAngle: () => Math.PI / 2,
            update: vi.fn(),
        } as unknown as ThreeOrbitControls;
        runtime.registry.set(container, instance);

        const preview = createEditorPreview(container, CALLBACKS);
        preview.nudgeCamera(Math.PI / 2, 0);
        expect(instance.camera?.position.x).toBeCloseTo(3);
        expect(instance.controls?.update).toHaveBeenCalled();
    });

    it('falls back to the camera position when the controls report no angles', async () => {
        const runtime = publishViewerRuntime();
        const container = createWrapper();
        const instance = createStubInstance(container);
        runtime.registry.set(container, instance);
        const preview = createEditorPreview(container, CALLBACKS);
        preview.nudgeCamera(Math.PI / 2, 0);
        expect(instance.camera?.position.x).toBeCloseTo(3);
    });

    it('orbits the model-viewer camera otherwise, and is inert with neither', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        expect(() => preview.nudgeCamera(0.1, 0)).not.toThrow();
        await preview.mount();
        preview.nudgeCamera(0.1, 0.1);
        expect(preview.getModelViewer()?.cameraOrbit).toBeUndefined();
    });
});

describe('destroy', () => {
    it('tears down the interaction layer and the viewer instance', async () => {
        const runtime = publishViewerRuntime();
        const destroy = vi.spyOn(runtime, 'destroy');
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.attachInteractions(document_({ interaction: { enabled: true, markers: [{ id: 'm1' }] } }), {
            t: key => key,
        });
        preview.destroy();
        expect(preview.getInteractions()).toBeNull();
        expect(container.querySelector('.tdv-marker')).toBeNull();
        expect(destroy).toHaveBeenCalledWith(container);
    });

    it('survives a controller that throws while being destroyed', async () => {
        const container = createWrapper();
        const preview = createEditorPreview(container, CALLBACKS);
        await preview.mount();
        await preview.attachInteractions(document_({ interaction: { enabled: true, markers: [{ id: 'm1' }] } }), {
            t: key => key,
        });
        const layer = preview.getInteractions();
        if (layer) {
            layer.destroy = () => {
                throw new Error('broken');
            };
        }
        expect(() => preview.destroy()).not.toThrow();
    });
});

/**
 * Every await in the preview can outlive the editor. Once the edition's
 * lifecycle is destroyed nothing may be created, loaded or booted, and the
 * AssetManager poll must settle instead of running to its deadline.
 */
describe('edition lifecycle teardown', () => {
    it('does not create a <model-viewer> for an edition closed while the library loaded', async () => {
        const container = createWrapper();
        const lifecycle = attachEditionLifecycle();
        const preview = createEditorPreview(container, CALLBACKS, lifecycle);

        const pending = preview.mount();
        lifecycle.destroy();
        await pending;

        expect(preview.getModelViewer()).toBeNull();
        expect(container.querySelector('model-viewer')).toBeNull();
    });

    it('stops forwarding model-viewer load and error events once closed', async () => {
        const onModelLoaded = vi.fn();
        const onModelError = vi.fn();
        const lifecycle = attachEditionLifecycle();
        const preview = createEditorPreview(createWrapper(), { onModelLoaded, onModelError }, lifecycle);
        await preview.mount();

        lifecycle.destroy();
        preview.getModelViewer()?.dispatchEvent(new Event('load'));
        preview.getModelViewer()?.dispatchEvent(new Event('error'));

        expect(onModelLoaded).not.toHaveBeenCalled();
        expect(onModelError).not.toHaveBeenCalled();
    });

    it('stops polling for the AssetManager once the edition closes', async () => {
        const lifecycle = attachEditionLifecycle();
        const preview = createEditorPreview(createWrapper(), CALLBACKS, lifecycle);
        await preview.mount();
        lifecycle.destroy();

        const started = Date.now();
        await preview.update(document_({ src: 'asset://a.glb' }));

        // A closed edition must not sit through the whole 5s timeout.
        expect(Date.now() - started).toBeLessThan(1000);
        expect(preview.getModelViewer()?.hasAttribute('src')).toBe(false);
    });

    it('settles a poll that the edition closes mid-wait', async () => {
        vi.useFakeTimers();
        try {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const lifecycle = attachEditionLifecycle();
            const preview = createEditorPreview(createWrapper(), CALLBACKS, lifecycle);
            await preview.mount();
            const settled = vi.fn();
            void preview.update(document_({ src: 'asset://a.glb' })).then(settled, settled);

            await vi.advanceTimersByTimeAsync(250);
            lifecycle.destroy();
            await vi.advanceTimersByTimeAsync(0);

            expect(settled).toHaveBeenCalled();
            // It bailed out as closed, not as "AssetManager never appeared".
            expect(warn).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('ignores an asset resolved after the edition closed', async () => {
        const lifecycle = attachEditionLifecycle();
        globalThis.eXeLearning = {
            app: {
                project: {
                    assetManager: {
                        resolveAssetURLSync: () => null,
                        resolveAssetURL: async () => {
                            lifecycle.destroy();
                            return 'blob:late';
                        },
                    },
                },
            },
        };
        const preview = createEditorPreview(createWrapper(), CALLBACKS, lifecycle);
        await preview.mount();
        await preview.update(document_({ src: 'asset://a.glb' }));

        expect(preview.getModelViewer()?.hasAttribute('src')).toBe(false);
        expect(preview.resolveMediaUrl('')).toBe('');
    });

    it('never boots an STL scene for an edition that closed while it loaded', async () => {
        const init = vi.spyOn(publishViewerRuntime(), 'init');
        const lifecycle = attachEditionLifecycle();
        const preview = createEditorPreview(createWrapper(), CALLBACKS, lifecycle);

        const pending = preview.update(document_({ src: 'content/resources/a.stl' }));
        lifecycle.destroy();
        await pending;

        expect(init).not.toHaveBeenCalled();
    });

    it('attaches no interaction layer once the edition closed', async () => {
        const lifecycle = attachEditionLifecycle();
        const preview = createEditorPreview(createWrapper(), CALLBACKS, lifecycle);
        await preview.mount();
        lifecycle.destroy();

        const layer = await preview.attachInteractions(
            document_({ interaction: { enabled: true, markers: [{ id: 'm1' }] } }),
            { t: text => text, onPlaced: () => {}, resolveMediaUrl: url => url },
        );

        expect(layer).toBeNull();
        expect(preview.getInteractions()).toBeNull();
    });

    it('gives up waiting for an STL instance once the edition closes', async () => {
        const lifecycle = attachEditionLifecycle();
        const preview = createEditorPreview(createWrapper(), CALLBACKS, lifecycle);
        const started = Date.now();
        const pending = preview.attachInteractions(
            document_({ src: 'content/resources/a.stl', interaction: { enabled: true, markers: [{ id: 'm1' }] } }),
            { t: text => text, onPlaced: () => {}, resolveMediaUrl: url => url },
        );
        lifecycle.destroy();

        await expect(pending).resolves.toBeNull();
        // Not the 20s STL-ready deadline.
        expect(Date.now() - started).toBeLessThan(1000);
    });
});
