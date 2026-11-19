/**
 * Equirectangular (360°) scene rendering: an inverted textured sphere with a
 * perspective camera at its centre, orbit controls, colour management and the
 * yaw/pitch conversions used for hotspot projection and click placement.
 *
 * One factory serves both the export runtime and the edition preview; the
 * caller owns DOM placement and the render loop, this module owns every
 * three.js resource it creates and releases all of them in `dispose()`.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { YawPitch } from '../shared/geometry';
import { clamp, clientToNdc, directionToYawPitch, ndcToScreen, yawPitchToDirection } from '../shared/geometry';
import type { InitialView } from '../shared/types';
import type {
    OrbitControlsLike,
    ThreeCameraLike,
    ThreeGeometryLike,
    ThreeMaterialLike,
    ThreeNamespace,
    ThreeRendererLike,
    ThreeSceneLike,
    ThreeTextureLike,
} from './types';

export interface PanoramaOptions {
    readonly three: ThreeNamespace;
    readonly initialFov: number;
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio?: number;
    readonly zoomEnabled?: boolean;
    readonly autorotate?: { readonly enabled: boolean; readonly speed: number };
}

export interface ScreenProjection {
    readonly x: number;
    readonly y: number;
    readonly visible: boolean;
}

export interface PanoramaRenderer {
    readonly canvas: HTMLCanvasElement;
    readonly camera: ThreeCameraLike;
    readonly controls: OrbitControlsLike | null;
    renderFrame: () => void;
    setViewportSize: (width: number, height: number) => void;
    applyInitialView: (view: InitialView) => void;
    loadTexture: (url: string) => void;
    nudge: (dYaw: number, dPitch: number) => void;
    getCameraYawPitch: () => YawPitch | null;
    clickToYawPitch: (clientX: number, clientY: number) => YawPitch | null;
    projectYawPitchToScreen: (yaw: number, pitch: number, width: number, height: number) => ScreenProjection;
    setControlsEnabled: (enabled: boolean) => void;
    setAutorotate: (enabled: boolean, speed: number) => void;
    setZoomEnabled: (enabled: boolean) => void;
    dispose: () => void;
}

/** Make WebGL output match the source panorama's apparent brightness/colour. */
export function applyColorManagement(three: ThreeNamespace, renderer: ThreeRendererLike): void {
    if (three.ColorManagement && 'enabled' in three.ColorManagement) {
        three.ColorManagement.enabled = true;
    }
    if ('outputColorSpace' in renderer && three.SRGBColorSpace !== undefined) {
        renderer.outputColorSpace = three.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && three.sRGBEncoding !== undefined) {
        renderer.outputEncoding = three.sRGBEncoding;
    }
    if ('toneMapping' in renderer && three.NoToneMapping !== undefined) {
        renderer.toneMapping = three.NoToneMapping;
        renderer.toneMappingExposure = 1.0;
    }
}

export function applyTextureColorSpace(three: ThreeNamespace, texture: ThreeTextureLike): void {
    if ('colorSpace' in texture && three.SRGBColorSpace !== undefined) {
        texture.colorSpace = three.SRGBColorSpace;
    } else if ('encoding' in texture && three.sRGBEncoding !== undefined) {
        texture.encoding = three.sRGBEncoding;
    }
}

export function createPanoramaRenderer(options: PanoramaOptions): PanoramaRenderer {
    const three = options.three;
    const width = Math.max(1, options.width);
    const height = Math.max(1, options.height);

    const scene: ThreeSceneLike = new three.Scene();
    const camera = new three.PerspectiveCamera(options.initialFov, width / height, 0.1, 1000);
    camera.position.set?.(0, 0, 0.01);

    const renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
    if (typeof renderer.setPixelRatio === 'function') {
        const dpr = options.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ?? 1;
        renderer.setPixelRatio(Math.min(dpr, 2));
    }
    renderer.setSize(width, height);
    applyColorManagement(three, renderer);

    const geometry: ThreeGeometryLike = new three.SphereGeometry(500, 60, 40);
    geometry.scale?.(-1, 1, 1);
    const material: ThreeMaterialLike = new three.MeshBasicMaterial({});
    scene.add(new three.Mesh(geometry, material));

    let texture: ThreeTextureLike | null = null;
    let disposed = false;

    let controls: OrbitControlsLike | null = null;
    if (three.OrbitControls) {
        controls = new three.OrbitControls(camera, renderer.domElement);
        controls.enablePan = false;
        controls.rotateSpeed = -0.25;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 0.01;
        controls.maxDistance = 0.01;
        controls.enableZoom = options.zoomEnabled !== false;
        controls.autoRotate = options.autorotate?.enabled === true;
        controls.autoRotateSpeed = options.autorotate?.speed ?? 1;
    }

    const disposeTexture = (): void => {
        try {
            texture?.dispose?.();
        } catch {
            // Ignore driver-level disposal failures.
        }
        texture = null;
        material.map = null;
    };

    return {
        canvas: renderer.domElement,
        camera,
        controls,

        renderFrame() {
            if (disposed) return;
            controls?.update?.();
            renderer.render(scene, camera);
        },

        setViewportSize(nextWidth, nextHeight) {
            if (nextWidth < 1 || nextHeight < 1) return;
            camera.aspect = nextWidth / nextHeight;
            camera.updateProjectionMatrix?.();
            renderer.setSize(nextWidth, nextHeight);
        },

        applyInitialView(view) {
            camera.fov = view.fov;
            camera.updateProjectionMatrix?.();
            const direction = yawPitchToDirection(view.yaw, view.pitch);
            camera.lookAt?.(direction.x, direction.y, direction.z);
        },

        loadTexture(url) {
            disposeTexture();
            try {
                const loader = new three.TextureLoader();
                const loaded = loader.load(url, undefined, undefined, () => {
                    // Load errors leave the sphere untextured; the alt text and
                    // scene description remain the accessible fallback.
                });
                if (loaded) {
                    applyTextureColorSpace(three, loaded);
                    material.map = loaded;
                    if ('needsUpdate' in material) material.needsUpdate = true;
                    texture = loaded;
                }
            } catch {
                // TextureLoader construction failures behave like load errors.
            }
        },

        nudge(dYaw, dPitch) {
            const position = camera.position;
            const radius = position.length?.() || 0.01;
            let azimuth =
                typeof controls?.getAzimuthalAngle === 'function'
                    ? controls.getAzimuthalAngle()
                    : Math.atan2(position.x || 0, position.z || 0);
            let polar =
                typeof controls?.getPolarAngle === 'function'
                    ? controls.getPolarAngle()
                    : Math.acos(clamp((position.y || 0) / radius, -1, 1));
            azimuth += dYaw;
            // Positive dPitch pans up (smaller polar angle); clamp away from
            // the poles to avoid gimbal lock.
            polar = clamp(polar - dPitch, 0.05, Math.PI - 0.05);
            const sinPolar = Math.sin(polar);
            position.set?.(radius * sinPolar * Math.sin(azimuth), radius * Math.cos(polar), radius * sinPolar * Math.cos(azimuth));
            camera.lookAt?.(0, 0, 0);
            controls?.update?.();
        },

        getCameraYawPitch() {
            if (typeof camera.getWorldDirection !== 'function') return null;
            try {
                const direction = new three.Vector3(0, 0, 0);
                camera.getWorldDirection(direction);
                return directionToYawPitch(direction);
            } catch {
                return null;
            }
        },

        clickToYawPitch(clientX, clientY) {
            const rect = renderer.domElement.getBoundingClientRect();
            const ndc = clientToNdc(rect, clientX, clientY);
            if (!ndc) return null;
            try {
                const vector = new three.Vector3(ndc.x, ndc.y, 0.5);
                if (typeof vector.unproject !== 'function') return null;
                vector.unproject(camera);
                return directionToYawPitch({
                    x: vector.x - camera.position.x,
                    y: vector.y - camera.position.y,
                    z: vector.z - camera.position.z,
                });
            } catch {
                return null;
            }
        },

        projectYawPitchToScreen(yaw, pitch, viewWidth, viewHeight) {
            const direction = yawPitchToDirection(yaw, pitch);
            try {
                const vector = new three.Vector3(direction.x, direction.y, direction.z);
                // Slightly inside the sphere shell so projection works.
                vector.multiplyScalar(10);
                vector.project(camera);
                if (vector.z >= 1) return { x: 0, y: 0, visible: false };
                const screen = ndcToScreen(vector.x, vector.y, viewWidth, viewHeight);
                return { x: screen.x, y: screen.y, visible: true };
            } catch {
                return { x: 0, y: 0, visible: false };
            }
        },

        setControlsEnabled(enabled) {
            if (controls) controls.enabled = enabled;
        },

        setAutorotate(enabled, speed) {
            if (!controls) return;
            controls.autoRotate = enabled;
            controls.autoRotateSpeed = speed;
        },

        setZoomEnabled(enabled) {
            if (controls) controls.enableZoom = enabled;
        },

        dispose() {
            if (disposed) return;
            disposed = true;
            disposeTexture();
            for (const release of [
                () => controls?.dispose?.(),
                () => geometry.dispose?.(),
                () => material.dispose?.(),
                () => renderer.dispose?.(),
            ]) {
                try {
                    release();
                } catch {
                    // Keep releasing the remaining resources.
                }
            }
            renderer.domElement.parentNode?.removeChild(renderer.domElement);
        },
    };
}
