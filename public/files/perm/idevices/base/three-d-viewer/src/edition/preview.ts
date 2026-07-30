/**
 * The live editor preview: a `<model-viewer>` for GLB/GLTF and the shared
 * Three.js runtime for STL, plus the interaction layer bound to whichever one
 * is active.
 *
 * The resolved blob URL lives here, never in the document and never on a DOM
 * dataset, so it cannot leak into persisted JSON or exported HTML.
 */

import type { InteractionController, InteractionHooks } from '../interactions/types';
import { getAssetManager, resolveModelSource, waitForAssetManager } from '../runtime/asset-resolver';
import { ensureModelViewerLoaded } from '../runtime/model-viewer-loader';
import { getEditionLibBaseUrl, getEditionModelViewerUrl } from '../runtime/paths';
import { ensureThreeJsLoaded } from '../runtime/three-loader';
import type { ViewerInstance } from '../runtime/types';
import { publishViewerRuntime } from '../runtime/viewer-runtime';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR } from '../shared/colors';
import { detectModelType, isStlSource } from '../shared/model-source';
import type { InteractionSettings, ThreeDViewerDocumentV2 } from '../shared/types';

/** How long to wait for a booted STL mesh before giving up on markers. */
const STL_READY_TIMEOUT_MS = 20000;

export interface PreviewCallbacks {
    /** The model finished loading; the caller refreshes animation options. */
    onModelLoaded: (availableAnimations: readonly string[]) => void;
    /** The model failed to load; the caller may retry. */
    onModelError: () => void;
}

export interface EditorPreview {
    /** Create the `<model-viewer>` element inside the preview container. */
    mount(): Promise<void>;
    /** Re-render for the current document. */
    update(document: ThreeDViewerDocumentV2, force?: boolean): Promise<void>;
    /** (Re)create the interaction layer; resolves to null when unavailable. */
    attachInteractions(
        document: ThreeDViewerDocumentV2,
        hooks: InteractionHooks,
    ): Promise<InteractionController | null>;
    /** The live interaction layer, if any. */
    getInteractions(): InteractionController | null;
    /** Push new interaction settings into the live layer. */
    syncInteractions(interaction: InteractionSettings): void;
    /** Orbit the preview camera. */
    nudgeCamera(dAzimuth: number, dPolar: number): void;
    /** The `<model-viewer>` element, once mounted. */
    getModelViewer(): ModelViewerElement | null;
    /** Resolve a media URL for the interaction layer. */
    resolveMediaUrl(url: string): string;
    destroy(): void;
}

const MIN_POLAR = 0.05;
const MAX_POLAR = Math.PI - 0.05;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function createEditorPreview(container: HTMLElement, callbacks: PreviewCallbacks): EditorPreview {
    const runtime = publishViewerRuntime();
    let modelViewer: ModelViewerElement | null = null;
    let interactions: InteractionController | null = null;
    let previewBlobUrl = '';
    let lastPreviewKey = '';

    const destroyInteractions = (): void => {
        if (interactions) {
            try {
                interactions.destroy();
            } catch {
                // A half-built controller must not block a re-render.
            }
            interactions = null;
        }
    };

    const resolveMediaUrl = (url: string): string => {
        if (previewBlobUrl && url === '') {
            return previewBlobUrl;
        }
        if (url.startsWith('asset://')) {
            return getAssetManager()?.resolveAssetURLSync?.(url) || url;
        }
        return url;
    };

    /** The URL the preview should load for the current source. */
    const resolvePreviewUrl = async (src: string): Promise<string> => {
        if (!src) {
            return '';
        }
        if (src.startsWith('blob:')) {
            return src;
        }
        if (!src.startsWith('asset://')) {
            return src;
        }
        const cached = getAssetManager()?.resolveAssetURLSync?.(src);
        if (cached) {
            previewBlobUrl = cached;
            return cached;
        }
        const manager = await waitForAssetManager(5000);
        if (!manager) {
            console.warn('[3D Viewer] AssetManager not available; cannot preview', src);
            return '';
        }
        const resolved = await resolveModelSource(src, manager);
        if (resolved) {
            previewBlobUrl = resolved;
        }
        return resolved;
    };

    const waitForStlInstance = (timeoutMs: number): Promise<ViewerInstance | null> => {
        const deadline = Date.now() + timeoutMs;
        return new Promise(resolve => {
            const poll = (): void => {
                const instance = runtime.getInstance(container);
                if (instance?.mesh || Date.now() >= deadline) {
                    resolve(instance);
                    return;
                }
                const raf = globalThis.requestAnimationFrame;
                if (typeof raf === 'function') {
                    raf(poll);
                } else {
                    setTimeout(poll, 16);
                }
            };
            poll();
        });
    };

    const preview: EditorPreview = {
        async mount() {
            await ensureModelViewerLoaded([getEditionModelViewerUrl()], 'edition');
            const element = document.createElement('model-viewer') as ModelViewerElement;
            element.setAttribute('shadow-intensity', '1');
            element.setAttribute('tone-mapping', 'pbr-neutral');
            element.setAttribute('reveal', 'auto');
            element.style.width = '100%';
            element.style.height = '100%';
            element.addEventListener('load', () => {
                callbacks.onModelLoaded(Array.from(element.availableAnimations ?? []));
            });
            element.addEventListener('error', () => callbacks.onModelError());
            container.prepend(element);
            modelViewer = element;
        },

        async update(documentState, force = false) {
            const background = documentState.backgroundColor || DEFAULT_BACKGROUND_COLOR;
            container.style.setProperty('--viewer-preview-bg', background);

            if (documentState.src && isStlSource(documentState.src)) {
                await renderStl(documentState, force);
                return;
            }
            if (!modelViewer) {
                return;
            }
            modelViewer.style.display = '';
            runtime.destroy(container);

            const url = await resolvePreviewUrl(documentState.src);
            if (url && (force || url !== lastPreviewKey || !modelViewer.src)) {
                lastPreviewKey = url;
                modelViewer.src = url;
                // The custom element does not always reflect the property to
                // the attribute in time; set both.
                modelViewer.setAttribute('src', url);
            }
            modelViewer.alt = documentState.alt;
            if (documentState.alt) {
                modelViewer.setAttribute('aria-label', documentState.alt);
            } else {
                modelViewer.removeAttribute('aria-label');
            }
            modelViewer.style.backgroundColor = background;
            if (documentState.cameraControls) {
                modelViewer.setAttribute('camera-controls', '');
            } else {
                modelViewer.removeAttribute('camera-controls');
            }
            if (documentState.autoRotate) {
                modelViewer.setAttribute('auto-rotate', '');
                modelViewer.setAttribute('rotation-per-second', `${documentState.autoRotateSpeed || 30}deg`);
            } else {
                modelViewer.removeAttribute('auto-rotate');
                modelViewer.removeAttribute('rotation-per-second');
            }
        },

        async attachInteractions(documentState, hooks) {
            destroyInteractions();
            const interaction = documentState.interaction;
            if (!interaction.enabled || !documentState.src) {
                return null;
            }
            const type = detectModelType(documentState.src);
            if (type === 'stl') {
                const instance = await waitForStlInstance(STL_READY_TIMEOUT_MS);
                if (!instance) {
                    return null;
                }
                interactions = runtime.createInteractionLayer(
                    { wrapper: container, type: 'stl', instance },
                    interaction,
                    'edit',
                    hooks,
                );
                instance.interaction = interactions;
                return interactions;
            }
            interactions = runtime.createInteractionLayer(
                { wrapper: container, type, modelViewer },
                interaction,
                'edit',
                hooks,
            );
            return interactions;
        },

        getInteractions: () => interactions,

        syncInteractions(interaction) {
            interactions?.setState(interaction);
        },

        nudgeCamera(dAzimuth, dPolar) {
            const instance = runtime.getInstance(container);
            const camera = instance?.camera;
            if (camera) {
                const controls = instance?.controls;
                const radius = Math.hypot(camera.position.x, camera.position.y, camera.position.z) || 1;
                const azimuth =
                    (controls?.getAzimuthalAngle?.() ?? Math.atan2(camera.position.x, camera.position.z)) + dAzimuth;
                const polar = clamp(
                    (controls?.getPolarAngle?.() ?? Math.acos(clamp(camera.position.y / radius, -1, 1))) + dPolar,
                    MIN_POLAR,
                    MAX_POLAR,
                );
                const sinPolar = Math.sin(polar);
                camera.position.set(
                    radius * sinPolar * Math.sin(azimuth),
                    radius * Math.cos(polar),
                    radius * sinPolar * Math.cos(azimuth),
                );
                camera.lookAt(0, 0, 0);
                controls?.update?.();
                return;
            }
            const orbit = modelViewer?.getCameraOrbit?.();
            if (!modelViewer || !orbit) {
                return;
            }
            const theta = (orbit.theta ?? 0) + dAzimuth;
            const phi = clamp((orbit.phi ?? Math.PI / 2) + dPolar, MIN_POLAR, MAX_POLAR);
            modelViewer.cameraOrbit = `${theta}rad ${phi}rad ${orbit.radius ?? 'auto'}m`;
            modelViewer.jumpCameraToGoal?.();
        },

        getModelViewer: () => modelViewer,
        resolveMediaUrl,

        destroy() {
            destroyInteractions();
            runtime.destroy(container);
            previewBlobUrl = '';
            lastPreviewKey = '';
        },
    };

    /** Boot (or re-boot) the STL scene through the shared runtime. */
    async function renderStl(documentState: ThreeDViewerDocumentV2, force: boolean): Promise<void> {
        const url = await resolvePreviewUrl(documentState.src);
        if (!url) {
            console.warn('[3D Viewer] STL: no URL available for', documentState.src);
            return;
        }
        // Re-render only when something the scene depends on changed: a
        // URL-only check would skip a colour or background change on the same
        // file.
        const key = JSON.stringify({
            url,
            modelColor: documentState.modelColor,
            backgroundColor: documentState.backgroundColor,
            cameraControls: documentState.cameraControls,
            autoRotate: documentState.autoRotate,
            autoRotateSpeed: documentState.autoRotateSpeed,
        });
        const existing = runtime.getInstance(container);
        if (!force && key === lastPreviewKey && existing?.renderer) {
            return;
        }
        lastPreviewKey = key;

        if (modelViewer) {
            modelViewer.style.display = 'none';
        }
        await ensureThreeJsLoaded(getEditionLibBaseUrl());
        runtime.destroy(container);
        runtime.init(container, {
            src: url,
            type: 'stl',
            modelColor: documentState.modelColor || DEFAULT_MODEL_COLOR,
            backgroundColor: documentState.backgroundColor || DEFAULT_BACKGROUND_COLOR,
            cameraControls: documentState.cameraControls,
            autoRotate: documentState.autoRotate,
            autoRotateSpeed: documentState.autoRotateSpeed || 30,
        });
    }

    return preview;
}
