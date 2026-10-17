/**
 * The renderer-agnostic interaction controller.
 *
 * It owns everything that must behave identically on both render paths and in
 * both hosts (editor preview and exported page): active-marker state, marker
 * activation, the accessible dialog, question rendering, learner answer state,
 * guided navigation and the text fallback. Renderers are reached only through
 * the `MarkerAdapter` contract.
 */

import { createModelViewerAdapter } from '../adapters/model-viewer-adapter';
import { createStlAdapter } from '../adapters/stl-adapter';
import { resolveMediaUrlSync } from '../runtime/asset-resolver';
import type { ViewerInstance } from '../runtime/types';
import { sanitizeHtml as defaultSanitizeHtml } from '../shared/html';
import type { InteractionSettings, Marker, MarkerCamera } from '../shared/types';
import { safeUrl } from '../shared/urls';
import { openDialog, type DialogHandle } from './dialog';
import { hasWebGL, revealFallback } from './fallback';
import { createGuidedNavigation, resolveStepIndex, type GuidedNavigationView } from './guided-navigation';
import { renderQuestion } from './question';
import { createAnswerStore } from './state';
import type {
    InteractionController,
    InteractionHandle,
    InteractionHooks,
    InteractionMode,
    MarkerAdapter,
} from './types';

const EMPTY_CAMERA: MarkerCamera = { orbit: '', target: '', fieldOfView: '' };

function emptyState(): InteractionSettings {
    return {
        enabled: false,
        guidedMode: false,
        wrapNavigation: false,
        showMarkerLabels: true,
        activeMarkerId: '',
        markers: [],
    };
}

function buildActionBody(
    body: HTMLElement,
    marker: Marker,
    deps: { sanitize: (html: string) => string; resolveMedia: (url: string) => string },
): void {
    if (marker.description) {
        const description = document.createElement('p');
        description.className = 'tdv-dialog-description';
        description.textContent = marker.description;
        body.appendChild(description);
    }
    const action = marker.action;
    switch (action.type) {
        case 'information': {
            const container = document.createElement('div');
            container.className = 'tdv-dialog-html';
            container.innerHTML = deps.sanitize(action.payload.html);
            body.appendChild(container);
            return;
        }
        case 'image': {
            const figure = document.createElement('figure');
            figure.className = 'tdv-dialog-figure';
            const image = document.createElement('img');
            image.src = deps.resolveMedia(action.payload.src);
            image.alt = action.payload.alt;
            figure.appendChild(image);
            if (action.payload.caption) {
                const caption = document.createElement('figcaption');
                caption.textContent = action.payload.caption;
                figure.appendChild(caption);
            }
            body.appendChild(figure);
            return;
        }
        case 'video': {
            const video = document.createElement('video');
            video.className = 'tdv-dialog-video';
            video.controls = true;
            video.src = deps.resolveMedia(action.payload.src);
            if (action.payload.poster) {
                video.poster = deps.resolveMedia(action.payload.poster);
            }
            body.appendChild(video);
            return;
        }
        case 'link':
        case 'question':
            // `link` never opens a dialog (handled before this runs) and
            // `question` is rendered by the caller, which owns answer state.
            return;
    }
}

/**
 * Build a controller for one viewer.
 *
 * `handle.type` selects the adapter; when no adapter can be built (an unknown
 * renderer, or an STL instance that never produced a mesh) the controller still
 * works — it simply reveals the accessible text fallback instead of an overlay.
 */
export function createInteractionController(
    handle: InteractionHandle,
    interaction: InteractionSettings,
    mode: InteractionMode,
    hooks: InteractionHooks = {},
): InteractionController {
    const wrapper = handle.wrapper;
    const translate = hooks.t ?? ((key: string) => key);
    const resolveMedia = hooks.resolveMediaUrl ?? (url => resolveMediaUrlSync(url));
    const sanitize = hooks.sanitizeHtml ?? defaultSanitizeHtml;
    const answers = createAnswerStore();

    let state: InteractionSettings = interaction ?? emptyState();
    let markers: readonly Marker[] = state.markers;
    let activeId = '';
    let destroyed = false;
    let dialog: DialogHandle | null = null;
    let adapter: MarkerAdapter | null = null;
    let guided: GuidedNavigationView | null = null;

    const markerLabel = (marker: Marker, index: number): string =>
        marker.label || `${translate('Marker')} ${index + 1}`;

    const closeDialog = (): void => {
        dialog?.close();
        dialog = null;
    };

    const currentIndex = (): number => markers.findIndex(marker => marker.id === activeId);

    const updateGuided = (): void => {
        guided?.update({
            enabled: Boolean(state.guidedMode),
            index: currentIndex(),
            total: markers.length,
            wrap: Boolean(state.wrapNavigation),
        });
    };

    const setActive = (markerId: string): void => {
        activeId = markerId;
        adapter?.setActive(activeId);
        updateGuided();
    };

    const activateMarker = (marker: Marker, index: number): void => {
        if (marker.action.type === 'link') {
            const url = safeUrl(marker.action.payload.url);
            if (!url) {
                return;
            }
            if (marker.action.payload.newTab) {
                globalThis.open(url, '_blank', 'noopener,noreferrer');
            } else if (globalThis.location) {
                globalThis.location.href = url;
            }
            return;
        }
        closeDialog();
        dialog = openDialog(
            {
                title: markerLabel(marker, index),
                closeLabel: translate('Close'),
                host: wrapper ?? null,
                onClose: () => {
                    dialog = null;
                },
            },
            body => {
                buildActionBody(body, marker, { sanitize, resolveMedia });
                if (marker.action.type === 'question') {
                    renderQuestion(body, marker, {
                        answers,
                        t: translate,
                        onAnswered: hooks.onQuestionAnswered,
                    });
                }
            },
        );
        hooks.onActivate?.(marker.id);
    };

    const focusMarker = (markerId: string): void => {
        const index = markers.findIndex(marker => marker.id === markerId);
        const marker = markers[index];
        if (!marker) {
            return;
        }
        setActive(markerId);
        adapter?.focusMarker(marker);
        activateMarker(marker, index);
    };

    const go = (delta: number): void => {
        const next = resolveStepIndex(currentIndex(), delta, markers.length, Boolean(state.wrapNavigation));
        const marker = next === null ? undefined : markers[next];
        if (marker) {
            focusMarker(marker.id);
        }
    };

    const render = (): void => {
        if (destroyed) {
            return;
        }
        markers = state.markers;
        if (adapter) {
            adapter.renderMarkers(markers, {
                showLabels: state.showMarkerLabels !== false,
                activeId,
            });
            // Keep the text fallback visible without WebGL so assistive-tech and
            // no-WebGL users still reach the marker content.
            revealFallback(wrapper, !hasWebGL());
        } else {
            revealFallback(wrapper, true);
        }
        updateGuided();
    };

    const controller: InteractionController = {
        setState(next) {
            state = next ?? emptyState();
            const ids = state.markers.map(marker => marker.id);
            if (activeId && !ids.includes(activeId)) {
                activeId = '';
            }
            // Answers of deleted markers are dropped so a re-created marker with
            // a fresh id starts clean.
            answers.retain(ids);
            render();
        },
        render,
        enterPlacementMode() {
            // Placement is an authoring affordance; a learner page never enters it.
            if (!adapter || mode !== 'edit') {
                return;
            }
            wrapper?.classList.add('tdv-placing');
            adapter.enterPlacementMode(placement => {
                controller.exitPlacementMode();
                hooks.onPlaced?.(placement);
            });
        },
        exitPlacementMode() {
            wrapper?.classList.remove('tdv-placing');
            adapter?.exitPlacementMode();
        },
        focusMarker,
        captureCamera: () => adapter?.captureCamera() ?? { ...EMPTY_CAMERA },
        next: () => go(1),
        previous: () => go(-1),
        getActiveId: () => activeId,
        markerLabel,
        destroy() {
            if (destroyed) {
                return;
            }
            destroyed = true;
            controller.exitPlacementMode();
            closeDialog();
            guided?.destroy();
            guided = null;
            adapter?.destroy();
            adapter = null;
            answers.clear();
        },
    };

    const adapterDeps = { markerLabel, onActivate: focusMarker };
    if ((handle.type === 'glb' || handle.type === 'gltf') && handle.modelViewer) {
        adapter = createModelViewerAdapter(handle.modelViewer, adapterDeps);
    } else if (handle.type === 'stl' && handle.instance) {
        adapter = createStlAdapter(handle.instance as ViewerInstance, wrapper, adapterDeps);
    }

    guided = createGuidedNavigation(wrapper ?? null, { t: translate, onGo: go });

    render();
    return controller;
}
