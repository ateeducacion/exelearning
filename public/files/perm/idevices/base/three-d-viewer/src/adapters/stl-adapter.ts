/**
 * The STL adapter.
 *
 * Three.js exposes raw scene objects, so this adapter has to do by hand what
 * `<model-viewer>` does natively: raycast the pointer, project each anchor to
 * screen space every frame, and hide markers that face away or leave the
 * viewport. It owns nothing else — dialogs, questions and navigation stay in
 * the shared controller.
 */

import { addFrameCallback, removeFrameCallback } from '../runtime/lifecycle';
import type { ViewerInstance } from '../runtime/types';
import { applyActiveMarker, createMarkerButton } from '../interactions/marker-renderer';
import type { MarkerAdapter, MarkerPlacement, MarkerRenderOptions } from '../interactions/types';
import type { Marker, MarkerCamera } from '../shared/types';
import { isMarkerVisible, ndcToScreen, parseTriple } from './geometry';
import { raycastFromPointer } from './raycast';

export interface StlAdapterDeps {
    markerLabel: (marker: Marker, index: number) => string;
    onActivate: (markerId: string) => void;
}

interface OverlayEntry {
    element: HTMLElement;
    local: ThreeVector3;
    normal: ThreeVector3;
}

const EMPTY_CAMERA: MarkerCamera = { orbit: '', target: '', fieldOfView: '' };

function ensureLayer(wrapper: HTMLElement): HTMLElement {
    const existing = wrapper.querySelector<HTMLElement>('.tdv-marker-layer');
    if (existing) {
        return existing;
    }
    const layer = document.createElement('div');
    layer.className = 'tdv-marker-layer';
    wrapper.appendChild(layer);
    return layer;
}

export function createStlAdapter(instance: ViewerInstance, wrapper: HTMLElement, deps: StlAdapterDeps): MarkerAdapter {
    const layer = ensureLayer(wrapper);
    let entries: OverlayEntry[] = [];
    let placeHandler: ((event: MouseEvent) => void) | null = null;

    const updateOverlay = (): void => {
        const three = globalThis.THREE;
        const { mesh, camera, canvas } = instance;
        if (!three || !mesh || !camera || !canvas || entries.length === 0) {
            return;
        }
        mesh.updateMatrixWorld();
        camera.updateMatrixWorld();
        const width = canvas.clientWidth || canvas.width || 1;
        const height = canvas.clientHeight || canvas.height || 1;
        for (const entry of entries) {
            const world = mesh.localToWorld(entry.local.clone());
            const ndc = world.clone().project(camera);
            const worldNormal = entry.normal.clone().transformDirection(mesh.matrixWorld);
            const toCamera = new three.Vector3().subVectors(camera.position, world).normalize();
            const visible = isMarkerVisible(ndc, worldNormal, toCamera);
            const screen = ndcToScreen(ndc, width, height);
            entry.element.style.left = `${screen.x}px`;
            entry.element.style.top = `${screen.y}px`;
            entry.element.classList.toggle('tdv-marker--hidden', !visible);
            if (visible) {
                entry.element.removeAttribute('tabindex');
                entry.element.removeAttribute('aria-hidden');
            } else {
                entry.element.setAttribute('tabindex', '-1');
                entry.element.setAttribute('aria-hidden', 'true');
            }
        }
    };

    // Reprojection rides the viewer's existing animation loop — a second
    // requestAnimationFrame loop would double the per-frame cost for nothing.
    addFrameCallback(instance, updateOverlay);

    const captureCamera = (): MarkerCamera => {
        const camera = instance.camera;
        if (!camera) {
            return { ...EMPTY_CAMERA };
        }
        const position = camera.position;
        const target = instance.controls?.target ?? { x: 0, y: 0, z: 0 };
        return {
            orbit: `${position.x} ${position.y} ${position.z}`,
            target: `${target.x} ${target.y} ${target.z}`,
            fieldOfView: `${camera.fov ?? 45}deg`,
        };
    };

    return {
        renderMarkers(markers: readonly Marker[], options: MarkerRenderOptions): void {
            const three = globalThis.THREE;
            layer.innerHTML = '';
            entries = markers.map((marker, index) => {
                const element = createMarkerButton(marker, {
                    ...options,
                    index,
                    label: deps.markerLabel(marker, index),
                    variantClass: 'tdv-marker--stl',
                    onActivate: deps.onActivate,
                });
                layer.appendChild(element);
                const { position, normal } = marker.anchor;
                return {
                    element,
                    local: new three!.Vector3(position.x, position.y, position.z),
                    normal: new three!.Vector3(normal.x, normal.y, normal.z),
                };
            });
            updateOverlay();
        },

        setActive(activeId: string): void {
            applyActiveMarker(
                entries.map(entry => entry.element),
                activeId,
            );
        },

        focusMarker(marker: Marker): void {
            const camera = instance.camera;
            if (!globalThis.THREE || !camera) {
                return;
            }
            const position = parseTriple(marker.camera.orbit);
            const target = parseTriple(marker.camera.target);
            if (marker.camera.orbit) {
                camera.position.set(position.x, position.y, position.z);
            }
            if (!marker.camera.target) {
                return;
            }
            if (instance.controls) {
                instance.controls.target.set(target.x, target.y, target.z);
                instance.controls.update?.();
            } else {
                camera.lookAt(target.x, target.y, target.z);
            }
        },

        captureCamera,
        updateOverlay,

        enterPlacementMode(onPlaced: (placement: MarkerPlacement) => void): void {
            const canvas = instance.canvas;
            if (!canvas) {
                return;
            }
            placeHandler = (event: MouseEvent): void => {
                const hit = raycastFromPointer(instance, event.clientX, event.clientY);
                if (!hit) {
                    return;
                }
                onPlaced({ position: hit.position, normal: hit.normal, surface: '', camera: captureCamera() });
            };
            canvas.addEventListener('click', placeHandler);
        },

        exitPlacementMode(): void {
            if (placeHandler && instance.canvas) {
                instance.canvas.removeEventListener('click', placeHandler);
            }
            placeHandler = null;
        },

        destroy(): void {
            this.exitPlacementMode();
            removeFrameCallback(instance, updateOverlay);
            try {
                layer.remove();
            } catch {
                // The wrapper may already be detached.
            }
            entries = [];
        },
    };
}
