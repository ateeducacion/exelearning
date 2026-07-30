/**
 * The STL render path: a Three.js scene owned by one viewer instance.
 *
 * The mesh is centred and scaled to fit a 2-unit box, so marker anchors are
 * stored in that normalized model space and stay valid across camera moves and
 * auto-rotation.
 */

import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR, normalizeColor } from '../shared/colors';
import { resolveModelSource } from './asset-resolver';
import type { ViewerInstance } from './types';

/** Target size of the longest model dimension after normalization. */
const NORMALIZED_SIZE = 2;

/**
 * Enable sRGB output and linear colour management, across Three.js r150+
 * (`outputColorSpace`) and earlier (`outputEncoding`).
 */
export function configureRendererColorManagement(renderer: ThreeRenderer | null): void {
    const three = globalThis.THREE;
    if (!three || !renderer) {
        return;
    }
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
    }
}

function ensureCanvas(wrapper: HTMLElement): HTMLCanvasElement {
    const existing = wrapper.querySelector<HTMLCanvasElement>('canvas.three-js-canvas');
    if (existing) {
        return existing;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'three-js-canvas';
    canvas.style.cssText = 'width: 100%; height: 100%; display: block;';
    wrapper.appendChild(canvas);
    return canvas;
}

function requestFrame(callback: () => void): number {
    const raf = globalThis.requestAnimationFrame;
    return typeof raf === 'function' ? raf(callback) : (setTimeout(callback, 16) as unknown as number);
}

/**
 * Build the Three.js scene for an instance and start its animation loop.
 *
 * Idempotent per instance and safe to abandon: every await re-checks
 * `instance.stopped`, so tearing a viewer down mid-fetch leaves nothing behind.
 */
export async function bootStl(instance: ViewerInstance): Promise<void> {
    const three = globalThis.THREE;
    if (!three?.STLLoader || instance.stopped) {
        return;
    }

    const { options, wrapper } = instance;
    const url = await resolveModelSource(options.src);
    if (instance.stopped || !url) {
        return;
    }

    const canvas = ensureCanvas(wrapper);
    instance.canvas = canvas;

    // A sibling <model-viewer> would still claim layout and might try to fetch
    // the STL through its GLB loader; hide it while the Three.js scene renders.
    const modelViewer = wrapper.querySelector<ModelViewerElement>('model-viewer');
    if (modelViewer) {
        modelViewer.style.display = 'none';
        instance.modelViewer = modelViewer;
    }

    const width = wrapper.clientWidth || 400;
    const height = wrapper.clientHeight || 300;

    const scene = new three.Scene();
    scene.background = new three.Color(normalizeColor(options.backgroundColor, DEFAULT_BACKGROUND_COLOR));
    const camera = new three.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new three.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio?.(Math.min(globalThis.devicePixelRatio || 1, 2));
    configureRendererColorManagement(renderer);

    instance.scene = scene as unknown as ThreeObject3D;
    instance.camera = camera;
    instance.renderer = renderer;

    scene.add(new three.AmbientLight(0xffffff, 0.6));
    const keyLight = new three.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(1, 1, 1);
    scene.add(keyLight);
    const fillLight = new three.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-1, -1, -1);
    scene.add(fillLight);

    try {
        const response = await fetch(url);
        if (instance.stopped) {
            return;
        }
        const buffer = await response.arrayBuffer();
        if (instance.stopped) {
            return;
        }

        const geometry = new three.STLLoader().parse(buffer);
        geometry.computeBoundingBox();
        geometry.center();
        const size = geometry.boundingBox?.getSize(new three.Vector3());
        const maxDimension = size ? Math.max(size.x, size.y, size.z) || 1 : 1;
        const scale = NORMALIZED_SIZE / maxDimension;
        geometry.scale(scale, scale, scale);
        if (!geometry.hasAttribute('normal')) {
            geometry.computeVertexNormals();
        }

        // Pure diffuse: with any metallic component and no environment map the
        // material reflects an empty scene (≈ black) and swallows the author's
        // colour entirely.
        const material = new three.MeshStandardMaterial({
            color: new three.Color(normalizeColor(options.modelColor, DEFAULT_MODEL_COLOR)),
            metalness: 0,
            roughness: 0.55,
        });

        const mesh = new three.Mesh(geometry, material);
        scene.add(mesh);
        camera.position.set(3, 3, 3);
        camera.lookAt(0, 0, 0);

        let controls: ThreeOrbitControls | null = null;
        if (options.cameraControls && three.OrbitControls) {
            const orbitControls = new three.OrbitControls(camera, canvas);
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.05;
            controls = orbitControls;
        }

        instance.mesh = mesh;
        instance.geometry = geometry;
        instance.material = material;
        instance.controls = controls;

        const autoRotate = options.autoRotate;
        const radiansPerSecond = ((options.autoRotateSpeed || 30) * Math.PI) / 180;
        const animate = (): void => {
            if (instance.stopped || !instance.renderer || !instance.scene || !instance.camera) {
                return;
            }
            if (autoRotate && instance.mesh) {
                instance.mesh.rotation.y += radiansPerSecond / 60;
            }
            instance.controls?.update?.();
            // Marker reprojection and any other per-frame work run here, before
            // the render, so there is only ever one animation loop per viewer.
            for (const callback of instance.onFrame) {
                try {
                    callback();
                } catch {
                    // One broken overlay must not stop the render loop.
                }
            }
            instance.renderer.render(instance.scene, instance.camera);
            instance.rafId = requestFrame(animate);
        };
        animate();

        const empty = wrapper.querySelector<HTMLElement>('[data-empty], [data-empty-state]');
        if (empty) {
            empty.style.display = 'none';
        }
    } catch (error) {
        // A failed fetch/parse leaves the empty state (or the accessible text
        // fallback) in place instead of a blank canvas.
        console.error('[3D Viewer] Failed to render STL:', error);
    }
}
