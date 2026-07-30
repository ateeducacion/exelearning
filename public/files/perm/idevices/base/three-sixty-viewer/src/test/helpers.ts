/**
 * Test-only harness: a structural three.js mock (the vendored libraries are
 * page globals, so unit tests inject this instead), plus install/uninstall
 * helpers for the globals the bundles read.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type {
    OrbitControlsLike,
    ThreeCameraLike,
    ThreeNamespace,
    ThreeTextureLike,
    ThreeVector3Like,
} from '../viewer/types';

export interface ThreeMockState {
    /** Every texture handed out by TextureLoader.load. */
    readonly textures: Array<ThreeTextureLike & { url: string; dispose: ReturnType<typeof vi.fn> }>;
    /** Every OrbitControls instance constructed. */
    readonly controls: MockOrbitControls[];
    /** Every WebGLRenderer instance constructed. */
    readonly renderers: MockRenderer[];
    readonly geometries: Array<{ dispose: ReturnType<typeof vi.fn> }>;
    readonly materials: Array<{ dispose: ReturnType<typeof vi.fn> }>;
}

export interface MockOrbitControls extends OrbitControlsLike {
    update: Mock<() => void>;
    dispose: Mock<() => void>;
}

export interface MockRenderer {
    domElement: HTMLCanvasElement;
    setPixelRatio: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    outputColorSpace?: unknown;
    toneMapping?: unknown;
    toneMappingExposure?: number;
}

export interface ThreeMockOptions {
    /** What Vector3.project reports: in front (visible) or behind. */
    projectBehind?: boolean;
    /** Omit OrbitControls to exercise the controls-less path. */
    withOrbitControls?: boolean;
}

class MockVector3 implements ThreeVector3Like {
    constructor(
        public x = 0,
        public y = 0,
        public z = 0,
        private readonly behind = false,
    ) {}

    set(x: number, y: number, z: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    length(): number {
        return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
    }

    multiplyScalar(scalar: number): this {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    project(_camera: ThreeCameraLike): this {
        // Centre of the viewport, in front of or behind the camera.
        this.x = 0;
        this.y = 0;
        this.z = this.behind ? 1 : 0.5;
        return this;
    }

    unproject(camera: ThreeCameraLike): this {
        // Treat NDC x/y as yaw-ish direction: keep x/y, push z forward.
        this.z = camera.position.z + 1;
        return this;
    }
}

/** Build a structural THREE mock with inspectable state. */
export function createThreeMock(options: ThreeMockOptions = {}): { three: ThreeNamespace; state: ThreeMockState } {
    const state: ThreeMockState = { textures: [], controls: [], renderers: [], geometries: [], materials: [] };
    const behind = options.projectBehind === true;

    class MockCamera implements ThreeCameraLike {
        position: ThreeVector3Like = new MockVector3(0, 0, 0.01);
        updateProjectionMatrix = vi.fn();
        lookAt = vi.fn();
        getWorldDirection = vi.fn((target: ThreeVector3Like) => {
            target.x = 0;
            target.y = 0;
            target.z = 1;
            return target;
        });
        constructor(
            public fov: number,
            public aspect: number,
        ) {}
    }

    class MockOrbit implements MockOrbitControls {
        enabled = true;
        enablePan = true;
        rotateSpeed = 1;
        enableDamping = false;
        dampingFactor = 0;
        minDistance = 0;
        maxDistance = Number.POSITIVE_INFINITY;
        enableZoom = true;
        autoRotate = false;
        autoRotateSpeed = 0;
        update = vi.fn<() => void>();
        dispose = vi.fn<() => void>();
        getAzimuthalAngle = (): number => 0;
        getPolarAngle = (): number => Math.PI / 2;
        constructor(
            public camera: ThreeCameraLike,
            public dom: HTMLElement,
        ) {
            state.controls.push(this);
        }
    }

    const three: ThreeNamespace = {
        Scene: class {
            children: unknown[] = [];
            add(object: unknown): void {
                this.children.push(object);
            }
        },
        PerspectiveCamera: MockCamera as unknown as ThreeNamespace['PerspectiveCamera'],
        WebGLRenderer: class {
            domElement = document.createElement('canvas');
            setPixelRatio = vi.fn();
            setSize = vi.fn();
            render = vi.fn();
            dispose = vi.fn();
            outputColorSpace: unknown = '';
            toneMapping: unknown = '';
            toneMappingExposure = 0;
            constructor() {
                state.renderers.push(this as unknown as MockRenderer);
            }
        } as unknown as ThreeNamespace['WebGLRenderer'],
        SphereGeometry: class {
            scale = vi.fn();
            dispose = vi.fn();
            constructor() {
                state.geometries.push(this as unknown as { dispose: ReturnType<typeof vi.fn> });
            }
        } as unknown as ThreeNamespace['SphereGeometry'],
        MeshBasicMaterial: class {
            map: ThreeTextureLike | null = null;
            needsUpdate = false;
            dispose = vi.fn();
            constructor() {
                state.materials.push(this as unknown as { dispose: ReturnType<typeof vi.fn> });
            }
        } as unknown as ThreeNamespace['MeshBasicMaterial'],
        Mesh: class {
            constructor(
                public geometry: unknown,
                public material: unknown,
            ) {}
        } as unknown as ThreeNamespace['Mesh'],
        TextureLoader: class {
            load(url: string): ThreeTextureLike {
                const texture = { url, dispose: vi.fn(), colorSpace: '' };
                state.textures.push(texture);
                return texture;
            }
        },
        Vector3: class extends MockVector3 {
            constructor(x?: number, y?: number, z?: number) {
                super(x, y, z, behind);
            }
        } as unknown as ThreeNamespace['Vector3'],
        SRGBColorSpace: 'srgb',
        NoToneMapping: 'none',
        ColorManagement: { enabled: false },
    };
    if (options.withOrbitControls !== false) {
        three.OrbitControls = MockOrbit as unknown as NonNullable<ThreeNamespace['OrbitControls']>;
    }
    return { three, state };
}

/** Install the mock as the page global THREE; returns an uninstaller. */
export function installThreeGlobal(three: ThreeNamespace): () => void {
    const target = globalThis as { THREE?: ThreeNamespace };
    const previous = target.THREE;
    target.THREE = three;
    return () => {
        if (previous === undefined) delete target.THREE;
        else target.THREE = previous;
    };
}

/** A manual frame scheduler tests can step frame by frame. */
export function createManualScheduler(): {
    scheduler: { request: (cb: () => void) => number; cancel: (handle: number) => void };
    step: () => void;
    pendingCount: () => number;
} {
    let nextHandle = 1;
    const pending = new Map<number, () => void>();
    return {
        scheduler: {
            request(callback) {
                const handle = nextHandle++;
                pending.set(handle, callback);
                return handle;
            },
            cancel(handle) {
                pending.delete(handle);
            },
        },
        step() {
            const callbacks = Array.from(pending.values());
            pending.clear();
            for (const callback of callbacks) callback();
        },
        pendingCount() {
            return pending.size;
        },
    };
}

/** Give an element a deterministic bounding box (happy-dom reports zeros). */
export function stubRect(element: HTMLElement, rect: { left?: number; top?: number; width: number; height: number }): void {
    element.getBoundingClientRect = () =>
        ({
            left: rect.left ?? 0,
            top: rect.top ?? 0,
            width: rect.width,
            height: rect.height,
            right: (rect.left ?? 0) + rect.width,
            bottom: (rect.top ?? 0) + rect.height,
            x: rect.left ?? 0,
            y: rect.top ?? 0,
            toJSON: () => ({}),
        }) as DOMRect;
}
