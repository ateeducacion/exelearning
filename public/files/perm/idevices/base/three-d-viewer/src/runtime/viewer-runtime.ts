/**
 * `window.eXe3DViewer` — the shared viewer runtime.
 *
 * Both generated bundles carry a compiled copy of this module and publish it
 * idempotently, so the first bundle on a page owns the single registry and any
 * later bundle reuses it. That keeps one instance map per document even when
 * the editor preview and an exported viewer coexist.
 */

import { createInteractionController } from '../interactions/controller';
import type {
    InteractionController,
    InteractionHandle,
    InteractionHooks,
    InteractionMode,
} from '../interactions/types';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR, normalizeColor } from '../shared/colors';
import { detectModelType, normalizeModelSource } from '../shared/model-source';
import type { InteractionSettings } from '../shared/types';
import { resolveModelSource } from './asset-resolver';
import { createRegistry } from './instance-registry';
import { createInstance, disposeMaterial, disposeObject3D } from './lifecycle';
import { bootStl, configureRendererColorManagement } from './stl-renderer';
import type { ViewerInstance, ViewerOptions, ViewerRegistry } from './types';

/** Read boot options from a wrapper's flat `data-*` attributes. */
export function readWrapperOptions(wrapper: HTMLElement): ViewerOptions {
    const data = wrapper.dataset;
    const showNavControls = data.showNavControls === 'true';
    const src = normalizeModelSource(data.modelSrc ?? '');
    return {
        src,
        type: (data.modelType as ViewerOptions['type']) || detectModelType(src),
        modelColor: normalizeColor(data.modelColor, DEFAULT_MODEL_COLOR),
        backgroundColor: normalizeColor(data.backgroundColor, DEFAULT_BACKGROUND_COLOR),
        cameraControls: data.cameraControls !== 'false',
        autoRotate: !showNavControls && data.autoRotate !== 'false',
        autoRotateSpeed: Number.parseFloat(data.autoRotateSpeed ?? '') || 30,
    };
}

export interface ViewerRuntime {
    init(wrapper: HTMLElement, options?: ViewerOptions): ViewerInstance | null;
    destroy(wrapper: HTMLElement): void;
    destroyAll(): void;
    getInstance(wrapper: HTMLElement): ViewerInstance | null;
    createInteractionLayer(
        handle: InteractionHandle,
        interaction: InteractionSettings,
        mode: InteractionMode,
        hooks?: InteractionHooks,
    ): InteractionController;
    /** Pure helpers, reused by both surfaces and by the tests. */
    detectModelType: typeof detectModelType;
    normalizeColor: typeof normalizeColor;
    normalizeModelSource: typeof normalizeModelSource;
    resolveModelSource: typeof resolveModelSource;
    configureRendererColorManagement: typeof configureRendererColorManagement;
    disposeObject3D: typeof disposeObject3D;
    disposeMaterial: typeof disposeMaterial;
    readWrapperOptions: typeof readWrapperOptions;
    /** The live registry, exposed for tests and cross-instance assertions. */
    registry: ViewerRegistry;
}

/** Build a runtime with its own registry. */
export function createViewerRuntime(): ViewerRuntime {
    const registry = createRegistry();
    let pageHideBound = false;

    /**
     * `pagehide` replaces the former `beforeunload` binding: an unload-family
     * listener makes the page ineligible for the back/forward cache, and the
     * viewer ships inside SCORM packages whose runtime relies on bfcache
     * staying available.
     *
     * `event.persisted === true` means the page is being frozen into the
     * back/forward cache and may be restored intact, so the WebGL contexts
     * and object URLs must survive; only a real teardown disposes them.
     */
    const bindPageHideOnce = (): void => {
        if (pageHideBound || typeof globalThis.addEventListener !== 'function') {
            return;
        }
        pageHideBound = true;
        globalThis.addEventListener('pagehide', (event: PageTransitionEvent) => {
            if (event.persisted) {
                return;
            }
            registry.destroyAll();
        });
    };

    return {
        init(wrapper, options) {
            if (!wrapper) {
                return null;
            }
            const existing = registry.get(wrapper);
            if (existing) {
                return existing;
            }
            const instance = createInstance(wrapper, options ?? readWrapperOptions(wrapper));
            // Register before any async boot work so `destroy()` always finds
            // the instance, even mid-fetch.
            registry.set(wrapper, instance);
            bindPageHideOnce();
            if (instance.type === 'stl' && instance.options.src) {
                void bootStl(instance).catch((error: unknown) => {
                    console.error('[3D Viewer] STL boot failed:', error);
                });
            }
            return instance;
        },
        destroy: wrapper => registry.destroy(wrapper),
        destroyAll: () => registry.destroyAll(),
        getInstance: wrapper => registry.get(wrapper) ?? null,
        createInteractionLayer: (handle, interaction, mode, hooks) =>
            createInteractionController(handle, interaction, mode, hooks),
        detectModelType,
        normalizeColor,
        normalizeModelSource,
        resolveModelSource,
        configureRendererColorManagement,
        disposeObject3D,
        disposeMaterial,
        readWrapperOptions,
        registry,
    };
}

/**
 * Publish the runtime on `window.eXe3DViewer`, reusing an already-published one.
 * Returns whichever runtime is now live so callers never hold a shadow copy.
 */
export function publishViewerRuntime(): ViewerRuntime {
    const existing = globalThis.eXe3DViewer as ViewerRuntime | undefined;
    if (existing) {
        return existing;
    }
    const runtime = createViewerRuntime();
    globalThis.eXe3DViewer = runtime;
    return runtime;
}

/** The live runtime, or `null` when no bundle has published one yet. */
export function getViewerRuntime(): ViewerRuntime | null {
    return (globalThis.eXe3DViewer as ViewerRuntime | undefined) ?? null;
}
