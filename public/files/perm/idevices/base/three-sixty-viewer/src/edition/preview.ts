/**
 * The editor's live preview: a panorama (three.js, lazily loaded) or a flat
 * image, plus draggable hotspot handles, placement clicks and camera-pose
 * queries. Owns every preview resource; `destroy()` (or a mode/image change)
 * releases all of them, so repeated init/edit cycles never leak.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { Rect, YawPitch } from '../shared/geometry';
import type { Hotspot } from '../shared/types';
import { captureDragEvents } from '../viewer/controls';
import { createFlatImageRenderer } from '../viewer/flat-image-renderer';
import type { FlatImageRenderer } from '../viewer/flat-image-renderer';
import { createHotspotLayer } from '../viewer/hotspot-renderer';
import type { HotspotLayer } from '../viewer/hotspot-renderer';
import { createDisposerBag, createRenderLoop, defaultFrameScheduler, prefersReducedMotion } from '../viewer/lifecycle';
import type { DisposerBag, FrameScheduler } from '../viewer/lifecycle';
import { createPanoramaRenderer } from '../viewer/panorama-renderer';
import type { PanoramaRenderer } from '../viewer/panorama-renderer';
import { getThree } from '../viewer/types';
import type { Translate } from './i18n';
import type { EditorState } from './state';
import { ensureThreeLoaded } from './three-loader';

export type PlacementPosition = { yaw: number; pitch: number } | { x: number; y: number };

export interface PreviewDeps {
    readonly stage: () => HTMLElement | null;
    readonly message: () => HTMLElement | null;
    readonly state: EditorState;
    readonly tr: Translate;
    readonly idevicePath: string;
    /** Whether a click on the preview should place a hotspot right now. */
    readonly isPlacing: () => boolean;
    readonly onPlace: (position: PlacementPosition) => void;
    /** A handle drag finished: index's coordinates changed. */
    readonly onHotspotMoved: (index: number) => void;
    /** A handle was clicked (no drag): select + reveal its row. */
    readonly onHotspotSelected: (index: number) => void;
    readonly scheduler?: FrameScheduler;
    readonly loadThree?: (idevicePath: string, callback: () => void) => void;
    readonly reducedMotion?: boolean;
}

export interface PreviewController {
    /** Re-render after any state change (cheap when nothing structural moved). */
    refresh: () => void;
    /** Rebuild the hotspot handles (list add/remove/action change). */
    refreshHotspots: () => void;
    /** Live camera pose, falling back to the scene's initial view. */
    getCameraYawPitch: () => YawPitch;
    destroy: () => void;
}

type Mode = 'none' | 'flat' | 'equirectangular';

export function createPreviewController(deps: PreviewDeps): PreviewController {
    const scheduler = deps.scheduler ?? defaultFrameScheduler();
    const loadThree = deps.loadThree ?? ensureThreeLoaded;

    let mode: Mode = 'none';
    let currentSrc = '';
    let panorama: PanoramaRenderer | null = null;
    let flat: FlatImageRenderer | null = null;
    let hotspots: HotspotLayer | null = null;
    let bag: DisposerBag | null = null;
    let destroyed = false;

    const stageRect = (): Rect | null => {
        const stage = deps.stage();
        if (!stage) return null;
        const rect = stage.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };

    const showMessage = (text: string | null): void => {
        const message = deps.message();
        if (!message) return;
        if (text === null) {
            message.style.display = 'none';
        } else {
            message.textContent = text;
            message.style.display = '';
        }
    };

    const teardown = (): void => {
        bag?.dispose();
        bag = null;
        panorama = null;
        flat = null;
        hotspots = null;
        mode = 'none';
        currentSrc = '';
    };

    const positionHotspot = (hotspot: Hotspot): { x: number; y: number; visible: boolean } | null => {
        const rect = stageRect();
        if (!rect || rect.width < 1 || rect.height < 1) return null;
        const box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        if (mode === 'flat' && flat) {
            const position = flat.percentToPosition(box, hotspot.x, hotspot.y);
            return { x: position.x, y: position.y, visible: true };
        }
        if (mode === 'equirectangular' && panorama) {
            return panorama.projectYawPitchToScreen(hotspot.yaw, hotspot.pitch, rect.width, rect.height);
        }
        return null;
    };

    const decorateHandle = (button: HTMLButtonElement, _hotspot: Hotspot, index: number): void => {
        button.classList.add('three-sixty-viewer-hotspot--editor');
        button.setAttribute('title', deps.tr('Drag to move'));
        let dragging = false;
        let moved = false;

        const onPointerMove = (event: PointerEvent): void => {
            if (!dragging) return;
            moved = true;
            const hotspot = deps.state.hotspotAt(index);
            const rect = stageRect();
            if (!hotspot || !rect) return;
            if (mode === 'flat' && flat) {
                const coords = flat.clientToPercent(rect, event.clientX, event.clientY);
                if (coords) {
                    hotspot.x = coords.x;
                    hotspot.y = coords.y;
                }
            } else if (mode === 'equirectangular' && panorama) {
                const pose = panorama.clickToYawPitch(event.clientX, event.clientY);
                if (pose) {
                    hotspot.yaw = pose.yaw;
                    hotspot.pitch = pose.pitch;
                }
            }
        };
        const onPointerUp = (event: PointerEvent): void => {
            if (!dragging) return;
            dragging = false;
            try {
                button.releasePointerCapture?.(event.pointerId);
            } catch {
                // Pointer capture may already be gone.
            }
            panorama?.setControlsEnabled(true);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            if (moved) deps.onHotspotMoved(index);
        };
        button.addEventListener('pointerdown', event => {
            event.preventDefault();
            event.stopPropagation();
            dragging = true;
            moved = false;
            try {
                button.setPointerCapture?.(event.pointerId);
            } catch {
                // Optional in test DOMs.
            }
            panorama?.setControlsEnabled(false);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });
        button.addEventListener('click', event => {
            event.preventDefault();
            if (!moved) deps.onHotspotSelected(index);
        });
        bag?.add(() => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        });
    };

    const buildHotspotLayer = (stage: HTMLElement): void => {
        hotspots = createHotspotLayer(stage, {
            buttonModifier: 'three-sixty-viewer-hotspot--editor',
            showLabels: false,
            labelPosition: deps.state.doc.behaviour.labelPosition,
            fallbackLabel: hotspot => {
                const index = deps.state.activeScene().hotspots.findIndex(candidate => candidate.id === hotspot.id);
                return `${deps.tr('Hotspot')} ${index + 1}`;
            },
            decorateButton: decorateHandle,
        });
        const layer = hotspots;
        bag?.add(() => layer.dispose());
        hotspots.setHotspots(deps.state.activeScene().hotspots as readonly Hotspot[]);
    };

    const placementClick = (event: MouseEvent): void => {
        if (!deps.isPlacing()) return;
        if (mode === 'flat' && flat) {
            const rect = stageRect();
            if (!rect) return;
            const coords = flat.clientToPercent(rect, event.clientX, event.clientY);
            // Clicks on the letterbox bars are ignored on purpose.
            if (coords) deps.onPlace(coords);
        } else if (mode === 'equirectangular' && panorama) {
            const pose = panorama.clickToYawPitch(event.clientX, event.clientY);
            if (pose) deps.onPlace(pose);
        }
    };

    const buildFlatPreview = (stage: HTMLElement, src: string): void => {
        teardown();
        bag = createDisposerBag();
        mode = 'flat';
        currentSrc = src;
        while (stage.firstChild) stage.removeChild(stage.firstChild);
        flat = createFlatImageRenderer(stage, 'three-sixty-preview-flat');
        const flatRenderer = flat;
        bag.add(() => flatRenderer.dispose());
        flat.setImage(src, deps.state.activeScene().alt);
        flat.setVisible(true);
        buildHotspotLayer(stage);
        flat.image.addEventListener('click', placementClick);
        hotspots?.overlay.addEventListener('click', placementClick);
        const loop = createRenderLoop(() => hotspots?.positionAll(positionHotspot), scheduler);
        bag.add(() => loop.stop());
        loop.start();
    };

    const buildPanoramaPreview = (stage: HTMLElement, src: string): void => {
        const three = getThree();
        if (!three) return;
        teardown();
        bag = createDisposerBag();
        mode = 'equirectangular';
        currentSrc = src;
        while (stage.firstChild) stage.removeChild(stage.firstChild);
        const rect = stage.getBoundingClientRect();
        const scene = deps.state.activeScene();
        panorama = createPanoramaRenderer({
            three,
            initialFov: scene.initialView.fov,
            width: Math.max(200, rect.width | 0),
            height: Math.max(150, rect.height | 0),
            zoomEnabled: deps.state.doc.behaviour.zoomEnabled,
            autorotate: { enabled: false, speed: deps.state.doc.behaviour.autorotate.speed },
        });
        const panoramaRenderer = panorama;
        bag.add(() => panoramaRenderer.dispose());
        stage.appendChild(panorama.canvas);
        captureDragEvents(panorama.canvas);
        panorama.canvas.addEventListener('click', placementClick);
        panorama.loadTexture(src);
        buildHotspotLayer(stage);
        const loop = createRenderLoop(() => {
            panoramaRenderer.renderFrame();
            hotspots?.positionAll(positionHotspot);
        }, scheduler);
        bag.add(() => loop.stop());
        loop.start();
        applyBehaviour();
    };

    const applyBehaviour = (): void => {
        if (!panorama) return;
        const scene = deps.state.activeScene();
        panorama.applyInitialView(scene.initialView);
        const behaviour = deps.state.doc.behaviour;
        const reducedMotion = deps.reducedMotion ?? prefersReducedMotion();
        panorama.setAutorotate(behaviour.autorotate.enabled && !reducedMotion, behaviour.autorotate.speed);
        panorama.setZoomEnabled(behaviour.zoomEnabled);
    };

    const controller: PreviewController = {
        refresh() {
            if (destroyed) return;
            const stage = deps.stage();
            if (!stage) return;
            const scene = deps.state.activeScene();
            if (!scene.src) {
                teardown();
                showMessage(deps.tr('Select an image to see a live preview.'));
                return;
            }
            if (scene.projection === 'flat') {
                if (mode !== 'flat' || currentSrc !== scene.src) {
                    buildFlatPreview(stage, scene.src);
                } else {
                    hotspots?.setHotspots(scene.hotspots as readonly Hotspot[]);
                }
                showMessage(null);
                return;
            }
            if (!getThree()) {
                showMessage(deps.tr('Loading 3D preview…'));
                loadThree(deps.idevicePath, () => {
                    if (!destroyed && getThree()) controller.refresh();
                });
                return;
            }
            if (mode !== 'equirectangular' || currentSrc !== scene.src) {
                buildPanoramaPreview(stage, scene.src);
            } else {
                hotspots?.setHotspots(scene.hotspots as readonly Hotspot[]);
                applyBehaviour();
            }
            showMessage(null);
        },

        refreshHotspots() {
            hotspots?.setHotspots(deps.state.activeScene().hotspots as readonly Hotspot[]);
        },

        getCameraYawPitch() {
            const scene = deps.state.activeScene();
            return panorama?.getCameraYawPitch() ?? { yaw: scene.initialView.yaw, pitch: scene.initialView.pitch };
        },

        destroy() {
            destroyed = true;
            teardown();
        },
    };
    return controller;
}
