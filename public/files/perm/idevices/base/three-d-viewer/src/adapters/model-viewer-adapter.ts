/**
 * The GLB/GLTF adapter.
 *
 * `<model-viewer>` has a declarative hotspot API: a slotted element with
 * `data-position` / `data-normal` is projected and occluded by the component
 * itself, so this adapter owns no projection maths at all.
 */

import { applyActiveMarker, createMarkerButton } from '../interactions/marker-renderer';
import type { MarkerAdapter, MarkerPlacement, MarkerRenderOptions } from '../interactions/types';
import type { Marker, MarkerCamera } from '../shared/types';
import { formatTriple, parseTriple } from './geometry';

export interface ModelViewerAdapterDeps {
    /** Accessible label for a marker, owned by the controller. */
    markerLabel: (marker: Marker, index: number) => string;
    onActivate: (markerId: string) => void;
}

const EMPTY_CAMERA: MarkerCamera = { orbit: '', target: '', fieldOfView: '' };

export function createModelViewerAdapter(modelViewer: ModelViewerElement, deps: ModelViewerAdapterDeps): MarkerAdapter {
    let placeHandler: ((event: MouseEvent) => void) | null = null;

    const clearMarkers = (): void => {
        for (const element of Array.from(modelViewer.querySelectorAll('.tdv-marker[slot^="hotspot-"]'))) {
            element.remove();
        }
    };

    const captureCamera = (): MarkerCamera => {
        try {
            return {
                orbit: modelViewer.getCameraOrbit?.().toString() ?? '',
                target: modelViewer.getCameraTarget?.().toString() ?? '',
                fieldOfView: modelViewer.getFieldOfView ? `${modelViewer.getFieldOfView()}deg` : '',
            };
        } catch {
            // The element may not be upgraded yet; an empty view is valid.
            return { ...EMPTY_CAMERA };
        }
    };

    return {
        renderMarkers(markers: readonly Marker[], options: MarkerRenderOptions): void {
            clearMarkers();
            markers.forEach((marker, index) => {
                const button = createMarkerButton(marker, {
                    ...options,
                    index,
                    label: deps.markerLabel(marker, index),
                    variantClass: 'tdv-marker--mv',
                    onActivate: deps.onActivate,
                });
                button.setAttribute('slot', `hotspot-${marker.id}`);
                button.dataset.position = formatTriple(marker.anchor.position);
                button.dataset.normal = formatTriple(marker.anchor.normal);
                if (marker.anchor.surface) {
                    button.dataset.surface = marker.anchor.surface;
                }
                modelViewer.appendChild(button);
            });
        },

        setActive(activeId: string): void {
            applyActiveMarker(modelViewer.querySelectorAll<HTMLElement>('.tdv-marker'), activeId);
        },

        focusMarker(marker: Marker): void {
            const camera = marker.camera;
            if (camera.orbit) {
                modelViewer.cameraOrbit = camera.orbit;
            }
            if (camera.target) {
                modelViewer.cameraTarget = camera.target;
            }
            if (camera.fieldOfView) {
                modelViewer.fieldOfView = camera.fieldOfView;
            }
        },

        captureCamera,

        // `<model-viewer>` re-projects its own hotspots every frame.
        updateOverlay(): void {},

        enterPlacementMode(onPlaced: (placement: MarkerPlacement) => void): void {
            placeHandler = (event: MouseEvent): void => {
                const hit = modelViewer.positionAndNormalFromPoint?.(event.clientX, event.clientY);
                if (!hit) {
                    return;
                }
                onPlaced({
                    position: parseTriple(hit.position?.toString()),
                    normal: parseTriple(hit.normal?.toString()),
                    surface: '',
                    camera: captureCamera(),
                });
            };
            modelViewer.addEventListener('click', placeHandler);
        },

        exitPlacementMode(): void {
            if (placeHandler) {
                modelViewer.removeEventListener('click', placeHandler);
                placeHandler = null;
            }
        },

        destroy(): void {
            this.exitPlacementMode();
            clearMarkers();
        },
    };
}
