/**
 * `window.$exeDevice` — the JSON-iDevice editor contract.
 *
 * The device is a thin coordinator: it owns the document, and delegates markup
 * to `editor.ts`, form plumbing to `form.ts`, the preview to `preview.ts`,
 * marker authoring to `marker-list.ts` / `marker-editor.ts` and SCORM to
 * `scorm.ts`. Every collaborator is injectable so tests can drive the device
 * without a WebGL context.
 */

import type { InteractionHooks, MarkerPlacement } from '../interactions/types';
import { recoverAssetRefFromBlob } from '../runtime/asset-resolver';
import { hydrateDocument, serializeDocument } from '../shared/migration';
import { isSupportedModelFile } from '../shared/model-source';
import { defaultIdFactory, normalizeMarker } from '../shared/schema';
import type { HydrationResult, IdFactory, Marker, ThreeDViewerDocumentV2 } from '../shared/types';
import { collectElements, renderEditorMarkup, renderUnsupportedVersionMarkup } from './editor';
import type { EditorElements, Translate } from './editor';
import {
    applyDocumentToForm,
    readDisplaySettings,
    updateAnimationOptions,
    updateAutoRotateSpeedState,
    updateEmptyState,
    updateModelColorFieldState,
    updateNavControlsVisibility,
} from './form';
import { openMarkerEditor, type MarkerEditorHandle } from './marker-editor';
import { moveMarker, removeMarker, renderMarkerList } from './marker-list';
import { createEditorPreview, type EditorPreview } from './preview';
import { createScormSection, shouldShowScormSection, type ScormSection } from './scorm';

/** Camera nudge step, matching the 360 viewer's feel. */
const YAW_STEP = (15 * Math.PI) / 180;
const PITCH_STEP = (10 * Math.PI) / 180;

/** How many times to retry a failed preview load before giving up. */
const MAX_PREVIEW_RETRIES = 3;

export interface DeviceDependencies {
    /** GUI translator; defaults to the global `_()`. */
    translate: Translate;
    /** Marker/option id factory; injected so tests are deterministic. */
    createId: IdFactory;
    /** Builds the live preview; injected so tests can stub WebGL away. */
    createPreview: typeof createEditorPreview;
    /** Shows a blocking message to the author. */
    alert: (message: string) => void;
}

function defaultTranslate(text: string): string {
    return typeof globalThis._ === 'function' ? globalThis._(text) : text;
}

function defaultAlert(message: string): void {
    const app = globalThis.eXe?.app;
    if (typeof app?.alert === 'function') {
        app.alert(message);
        return;
    }
    console.warn('[3D Viewer]', message);
}

export const defaultDependencies: DeviceDependencies = {
    translate: defaultTranslate,
    createId: defaultIdFactory,
    createPreview: createEditorPreview,
    alert: defaultAlert,
};

export interface ThreeDViewerDevice {
    readonly name: string;
    readonly i18n: { name: string };
    init(element: HTMLElement, previousData?: unknown, path?: string): Promise<void>;
    save(): ThreeDViewerDocumentV2 | unknown | false;
    /** Load persisted data into the device (the export-object contract). */
    set3DViewerJSON(data: unknown): void;
    /** Serialize the device state (the export-object contract). */
    get3DViewerJSON(): ThreeDViewerDocumentV2 | unknown;
    /** Called by the interaction layer when the author clicks the model. */
    handleMarkerPlaced(placement: MarkerPlacement): void;
    /** The current document, for tests and probes. */
    getDocument(): ThreeDViewerDocumentV2;
    /** The current hydration result, for tests and probes. */
    getHydration(): HydrationResult;
}

export function createThreeDViewerDevice(overrides: Partial<DeviceDependencies> = {}): ThreeDViewerDevice {
    const deps: DeviceDependencies = { ...defaultDependencies, ...overrides };
    const t = deps.translate;

    const emptyDocument = (): ThreeDViewerDocumentV2 => {
        const fresh = hydrateDocument(null, deps.createId);
        // `hydrateDocument(null)` is the defaults path and can only be 'ok';
        // the guard is here so the type stays honest rather than asserted.
        if (fresh.status !== 'ok') {
            throw new Error('[3D Viewer] Default document failed to hydrate');
        }
        return fresh.document;
    };

    let hydration: HydrationResult = { status: 'ok', document: emptyDocument() };
    let documentState: ThreeDViewerDocumentV2 = hydration.status === 'ok' ? hydration.document : emptyDocument();
    let elements: EditorElements | null = null;
    let preview: EditorPreview | null = null;
    let scormSection: ScormSection | null = null;
    let markerEditor: MarkerEditorHandle | null = null;
    let previewRetries = 0;

    const announce = (message: string): void => {
        if (elements) {
            elements.ariaLive.textContent = message;
        }
    };

    const interactionHooks = (): InteractionHooks => ({
        t,
        onPlaced: placement => device.handleMarkerPlaced(placement),
        resolveMediaUrl: url => preview?.resolveMediaUrl(url) ?? url,
    });

    const syncPreviewInteractions = (): void => {
        preview?.syncInteractions(documentState.interaction);
    };

    const refreshScormVisibility = (): void => {
        if (!elements || !scormSection) {
            return;
        }
        const show = shouldShowScormSection(documentState.interaction.enabled, documentState.interaction.markers);
        elements.scormSection.hidden = !show;
        if (show && !scormSection.isRendered()) {
            scormSection.render(documentState.scorm, t('Save score'));
        }
    };

    const refreshMarkerList = (): void => {
        if (!elements) {
            return;
        }
        renderMarkerList(elements.markerList, documentState.interaction.markers, t, {
            onMove: (markerId, delta) => {
                documentState.interaction.markers = moveMarker(documentState.interaction.markers, markerId, delta);
                refreshMarkerList();
                syncPreviewInteractions();
            },
            onEdit: markerId => openEditorFor(markerId),
            onDelete: markerId => deleteMarker(markerId),
        });
        refreshScormVisibility();
    };

    const deleteMarker = (markerId: string): void => {
        documentState.interaction.markers = removeMarker(documentState.interaction.markers, markerId);
        if (markerEditor?.markerId === markerId) {
            markerEditor.close();
            markerEditor = null;
        }
        refreshMarkerList();
        syncPreviewInteractions();
    };

    const openEditorFor = (markerId: string): void => {
        if (!elements) {
            return;
        }
        const marker = documentState.interaction.markers.find(candidate => candidate.id === markerId);
        if (!marker) {
            return;
        }
        markerEditor?.close();
        markerEditor = openMarkerEditor(elements.markerEditorHost, marker, t, deps.createId, {
            onSave: saved => {
                const index = documentState.interaction.markers.findIndex(candidate => candidate.id === markerId);
                if (index >= 0) {
                    documentState.interaction.markers[index] = { ...saved, order: index };
                }
                markerEditor = null;
                refreshMarkerList();
                syncPreviewInteractions();
            },
            onCancel: () => {
                markerEditor = null;
            },
            onDelete: id => {
                markerEditor = null;
                deleteMarker(id);
            },
            captureCamera: () => preview?.getInteractions()?.captureCamera() ?? null,
        });
    };

    const refreshInteractionVisibility = (): void => {
        if (!elements) {
            return;
        }
        elements.interactionsBody.hidden = !documentState.interaction.enabled;
        elements.addMarker.disabled = !documentState.src;
        refreshScormVisibility();
    };

    const applyDisplayFormState = (): void => {
        if (!elements) {
            return;
        }
        const settings = readDisplaySettings(elements, documentState.src);
        documentState = { ...documentState, ...settings };
        updateAutoRotateSpeedState(elements);
    };

    const refreshPreview = (force = false): void => {
        if (!elements || !preview) {
            return;
        }
        updateEmptyState(elements, documentState.src);
        void preview.update(documentState, force).then(() => {
            void preview?.attachInteractions(documentState, interactionHooks());
        });
    };

    const registerBehaviours = (): void => {
        if (!elements) {
            return;
        }
        const el = elements;
        const onDisplayChange = (): void => {
            applyDisplayFormState();
            refreshPreview();
        };

        for (const control of [
            el.alt,
            el.modelColor,
            el.backgroundColor,
            el.cameraControls,
            el.autoRotateSpeed,
            el.animationToggle,
            el.animationName,
            el.animationSpeed,
        ]) {
            control.addEventListener('change', onDisplayChange);
            if (control instanceof HTMLInputElement && control.type === 'text') {
                control.addEventListener('input', onDisplayChange);
            }
        }

        // auto-rotate and nav controls are mutually exclusive: flip the sibling
        // BEFORE reading the form, or the read would observe stale values.
        const onExclusiveToggle = (winner: 'autoRotate' | 'showNavControls'): void => {
            if (winner === 'autoRotate' && el.autoRotate.checked) {
                el.showNavControls.checked = false;
            } else if (winner === 'showNavControls' && el.showNavControls.checked) {
                el.autoRotate.checked = false;
            }
            applyDisplayFormState();
            updateNavControlsVisibility(el, documentState.showNavControls);
            refreshPreview();
        };
        el.autoRotate.addEventListener('change', () => onExclusiveToggle('autoRotate'));
        el.showNavControls.addEventListener('change', () => onExclusiveToggle('showNavControls'));

        el.src.addEventListener('change', () => {
            void handleModelSelection();
        });

        el.interactionsEnable.addEventListener('change', () => {
            documentState.interaction.enabled = el.interactionsEnable.checked;
            refreshInteractionVisibility();
            void preview?.attachInteractions(documentState, interactionHooks());
        });
        const syncFlag = (
            control: HTMLInputElement,
            key: 'guidedMode' | 'wrapNavigation' | 'showMarkerLabels',
        ): void => {
            control.addEventListener('change', () => {
                documentState.interaction[key] = control.checked;
                syncPreviewInteractions();
            });
        };
        syncFlag(el.guidedMode, 'guidedMode');
        syncFlag(el.wrapNavigation, 'wrapNavigation');
        syncFlag(el.showMarkerLabels, 'showMarkerLabels');

        el.addMarker.addEventListener('click', () => {
            void startMarkerPlacement();
        });

        // Preview chrome: fullscreen and the 4-direction nav pad.
        const fullscreen = el.preview.querySelector<HTMLElement>('[data-fullscreen]');
        if (fullscreen) {
            const target = el.preview.parentElement ?? el.preview;
            const isFullscreen = (): boolean => document.fullscreenElement === target;
            fullscreen.addEventListener('click', () => {
                if (isFullscreen()) {
                    void document.exitFullscreen?.();
                } else {
                    void target.requestFullscreen?.();
                }
            });
            document.addEventListener('fullscreenchange', () => {
                const label = t(isFullscreen() ? 'Exit fullscreen' : 'Fullscreen');
                fullscreen.setAttribute('aria-label', label);
                fullscreen.setAttribute('title', label);
            });
        }
        for (const button of Array.from(el.preview.querySelectorAll<HTMLElement>('[data-nav]'))) {
            const direction = button.getAttribute('data-nav');
            const dAzimuth = direction === 'right' ? -YAW_STEP : direction === 'left' ? YAW_STEP : 0;
            const dPolar = direction === 'up' ? PITCH_STEP : direction === 'down' ? -PITCH_STEP : 0;
            button.addEventListener('click', () => preview?.nudgeCamera(dAzimuth, dPolar));
        }
    };

    const handleModelSelection = async (): Promise<void> => {
        if (!elements) {
            return;
        }
        const picked = elements.src.value;
        if (!picked) {
            return;
        }
        // A misconfigured picker could hand back a blob URL; those are ephemeral
        // and would 404 after a reload, so refuse to store one.
        if (picked.startsWith('blob:')) {
            console.warn('[3D Viewer] Refusing to store a blob: URL as the model source');
            elements.src.value = documentState.src;
            return;
        }
        documentState.src = picked;
        applyDisplayFormState();
        updateModelColorFieldState(elements, documentState.src, t);
        refreshInteractionVisibility();
        refreshPreview(true);
    };

    const startMarkerPlacement = async (): Promise<void> => {
        if (!elements || !documentState.src) {
            return;
        }
        if (!documentState.interaction.enabled) {
            documentState.interaction.enabled = true;
            elements.interactionsEnable.checked = true;
            refreshInteractionVisibility();
        }
        const layer = await preview?.attachInteractions(documentState, interactionHooks());
        if (!layer) {
            return;
        }
        layer.enterPlacementMode();
        elements.placementHint.hidden = false;
        announce(t('Click on the model to place the marker.'));
    };

    const device: ThreeDViewerDevice = {
        name: t('3D Viewer'),
        i18n: { name: t('3D Viewer') },

        async init(element, previousData) {
            // Re-opening the same iDevice replaces the form markup; without this
            // teardown the previous WebGL context and animation loop would leak.
            preview?.destroy();
            preview = null;
            markerEditor = null;
            previewRetries = 0;

            device.set3DViewerJSON(previousData ?? {});

            if (hydration.status !== 'ok') {
                const version = hydration.status === 'unsupported-version' ? hydration.version : 0;
                element.innerHTML = renderUnsupportedVersionMarkup(t, version);
                elements = null;
                return;
            }

            element.innerHTML = renderEditorMarkup(t);
            elements = collectElements(element);
            scormSection = createScormSection(elements.scormHost);

            applyDocumentToForm(elements, documentState);
            updateAutoRotateSpeedState(elements);
            updateNavControlsVisibility(elements, documentState.showNavControls);
            updateModelColorFieldState(elements, documentState.src, t);
            updateEmptyState(elements, documentState.src);
            elements.animationRow.hidden = true;
            elements.animationToggle.disabled = true;
            elements.animationName.disabled = true;
            elements.animationSpeed.disabled = true;
            refreshInteractionVisibility();
            refreshMarkerList();

            preview = deps.createPreview(elements.preview, {
                translate: t,
                announce,
                onModelLoaded: available => {
                    if (!elements) {
                        return;
                    }
                    previewRetries = 0;
                    documentState.animation = updateAnimationOptions(elements, available, documentState.animation);
                    // The picker now reflects what this model actually offers,
                    // so playback can follow it.
                    preview?.applyAnimation(documentState.animation);
                    updateEmptyState(elements, documentState.src);
                    void preview?.attachInteractions(documentState, interactionHooks());
                },
                onModelError: () => {
                    if (!documentState.src || previewRetries >= MAX_PREVIEW_RETRIES) {
                        return;
                    }
                    previewRetries += 1;
                    setTimeout(() => refreshPreview(true), 150 * previewRetries);
                },
            });
            await preview.mount();
            registerBehaviours();
            refreshPreview(true);
        },

        save() {
            if (hydration.status !== 'ok') {
                // A document this build cannot read is returned untouched, so a
                // newer build can still open it.
                deps.alert(
                    t('This 3D Viewer was created with a newer version of eXeLearning and cannot be edited here.'),
                );
                return hydration.original;
            }
            if (elements) {
                applyDisplayFormState();
                documentState.scorm = scormSection?.read(documentState.scorm) ?? documentState.scorm;
            }
            if (!documentState.src) {
                deps.alert(t('Please select a 3D model file'));
                return false;
            }
            if (!isSupportedModelFile(documentState.src)) {
                deps.alert(t('Please select a valid 3D model file (GLB, GLTF, or STL)'));
                return false;
            }
            return device.get3DViewerJSON();
        },

        set3DViewerJSON(data) {
            hydration = hydrateDocument(data, deps.createId);
            if (hydration.status !== 'ok') {
                return;
            }
            documentState = hydration.document;
            // The workarea resolves `asset://` → `blob:` when it reads the
            // iDevice JSON, so a re-opened document can arrive with an ephemeral
            // source. Recover the durable handle, or drop it.
            const rawSrc = (data as { src?: unknown } | null)?.src;
            if (typeof rawSrc === 'string' && rawSrc.startsWith('blob:')) {
                const assetRef = recoverAssetRefFromBlob(rawSrc);
                if (assetRef) {
                    documentState.src = `asset://${assetRef}`;
                } else {
                    console.warn('[3D Viewer] Discarding a stale blob: URL from stored data');
                }
            }
        },

        get3DViewerJSON() {
            if (hydration.status !== 'ok') {
                return hydration.original;
            }
            return serializeDocument(documentState, deps.createId);
        },

        handleMarkerPlaced(placement) {
            if (elements) {
                elements.placementHint.hidden = true;
            }
            const index = documentState.interaction.markers.length;
            const marker: Marker = normalizeMarker(
                {
                    label: '',
                    icon: 'circle',
                    order: index,
                    anchor: {
                        position: placement.position,
                        normal: placement.normal,
                        surface: placement.surface,
                    },
                    camera: placement.camera,
                    action: { type: 'information', payload: { html: '' } },
                },
                index,
                deps.createId,
            );
            documentState.interaction.markers.push(marker);
            refreshMarkerList();
            syncPreviewInteractions();
            openEditorFor(marker.id);
        },

        getDocument: () => documentState,
        getHydration: () => hydration,
    };

    return device;
}
