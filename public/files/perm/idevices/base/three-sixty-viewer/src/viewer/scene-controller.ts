/**
 * Scene switching for a running viewer: tours can mix equirectangular (WebGL
 * sphere) and flat (`<img>`) scenes, so applying a scene swaps the visible
 * layer, camera view and texture/image, and decides how hotspots are
 * positioned for the current mode.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { Rect } from '../shared/geometry';
import type { Projection, Scene } from '../shared/types';
import type { FlatImageRenderer } from './flat-image-renderer';
import type { HotspotPosition } from './hotspot-renderer';
import type { PanoramaRenderer } from './panorama-renderer';

export interface SceneControllerDeps {
    readonly panorama: PanoramaRenderer | null;
    readonly flat: FlatImageRenderer;
    readonly resolveSrc: (src: string) => string;
    /** Current bounding box of the positioning host (the wrapper). */
    readonly hostRect: () => Rect;
}

export interface SceneController {
    readonly currentMode: Projection;
    readonly currentSceneId: string;
    /** Swap layers and load the scene's media. */
    applyScene: (scene: Scene) => void;
    /** Per-frame hotspot position for the current mode; null hides it. */
    positionFor: (hotspot: { yaw: number; pitch: number; x: number; y: number }) => HotspotPosition | null;
    /** Whether the WebGL canvas needs per-frame rendering right now. */
    needsFrameRender: () => boolean;
}

export function createSceneController(deps: SceneControllerDeps): SceneController {
    let mode: Projection = 'equirectangular';
    let sceneId = '';

    return {
        get currentMode() {
            return mode;
        },
        get currentSceneId() {
            return sceneId;
        },

        applyScene(scene) {
            mode = scene.projection;
            sceneId = scene.id;
            const canvas = deps.panorama?.canvas ?? null;
            if (scene.projection === 'flat') {
                if (canvas) canvas.style.display = 'none';
                deps.panorama?.setControlsEnabled(false);
                deps.flat.setImage(deps.resolveSrc(scene.src), scene.alt);
                deps.flat.setVisible(true);
            } else {
                deps.flat.setVisible(false);
                if (canvas) canvas.style.display = '';
                deps.panorama?.setControlsEnabled(true);
                deps.panorama?.applyInitialView(scene.initialView);
                deps.panorama?.loadTexture(deps.resolveSrc(scene.src));
            }
        },

        positionFor(hotspot) {
            const box = deps.hostRect();
            if (box.width < 1 || box.height < 1) return null;
            if (mode === 'flat') {
                const position = deps.flat.percentToPosition(box, hotspot.x, hotspot.y);
                return { x: position.x, y: position.y, visible: true };
            }
            if (!deps.panorama) return null;
            return deps.panorama.projectYawPitchToScreen(hotspot.yaw, hotspot.pitch, box.width, box.height);
        },

        needsFrameRender() {
            return mode !== 'flat' && deps.panorama !== null;
        },
    };
}
