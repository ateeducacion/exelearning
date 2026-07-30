/**
 * A minimal, deterministic Three.js stub.
 *
 * Unit tests must exercise the STL adapter's projection, occlusion and raycast
 * logic without a WebGL context, so this stub implements only the members the
 * adapters touch. `project()` is the identity, which makes local coordinates
 * double as normalized device coordinates and keeps the assertions readable.
 */

export class StubVector3 {
    constructor(
        public x = 0,
        public y = 0,
        public z = 0,
    ) {}

    set(x: number, y: number, z: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    clone(): StubVector3 {
        return new StubVector3(this.x, this.y, this.z);
    }

    length(): number {
        return Math.hypot(this.x, this.y, this.z);
    }

    normalize(): this {
        const length = this.length() || 1;
        this.x /= length;
        this.y /= length;
        this.z /= length;
        return this;
    }

    dot(other: StubVector3): number {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    subVectors(a: StubVector3, b: StubVector3): this {
        return this.set(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    /** Identity projection: local coordinates are the NDC in these tests. */
    project(): this {
        return this;
    }

    /** Identity transform: the stub mesh is never rotated or scaled. */
    transformDirection(): this {
        return this;
    }
}

export class StubObject3D {
    matrixWorld = {};
    rotation = { y: 0 };
    children: StubObject3D[] = [];
    geometry: { dispose: () => void; disposed?: boolean } | null = null;
    material: unknown = null;
    /** Uniform world offset applied by `localToWorld` / `worldToLocal`. */
    offset = new StubVector3(0, 0, 0);

    updateMatrixWorld(): void {}

    localToWorld(target: StubVector3): StubVector3 {
        return target.set(target.x + this.offset.x, target.y + this.offset.y, target.z + this.offset.z);
    }

    worldToLocal(target: StubVector3): StubVector3 {
        return target.set(target.x - this.offset.x, target.y - this.offset.y, target.z - this.offset.z);
    }

    traverse(callback: (node: StubObject3D) => void): void {
        callback(this);
        for (const child of this.children) {
            child.traverse(callback);
        }
    }

    add(child: unknown): void {
        this.children.push(child as StubObject3D);
    }
}

export class StubCamera {
    position = new StubVector3(0, 0, 3);
    fov = 45;
    lookedAt: [number, number, number] | null = null;

    lookAt(x: number, y: number, z: number): void {
        this.lookedAt = [x, y, z];
    }

    updateMatrixWorld(): void {}
}

export interface StubRaycastHit {
    point: StubVector3;
    face: { normal: StubVector3 } | null;
}

/** Hits the next raycast returns; tests push and pop entries. */
export const raycastHits: StubRaycastHit[] = [];

export class StubRaycaster {
    lastNdc: unknown = null;
    lastCamera: unknown = null;

    setFromCamera(ndc: unknown, camera: unknown): void {
        this.lastNdc = ndc;
        this.lastCamera = camera;
    }

    intersectObject(): StubRaycastHit[] {
        return raycastHits;
    }
}

export class StubScene extends StubObject3D {
    background: unknown = null;
}

/** Build a `window.THREE`-shaped stub namespace. */
export function createThreeStub(): ThreeNamespace {
    class StubRenderer {
        outputColorSpace: unknown = undefined;
        toneMapping: unknown = undefined;
        disposed = false;
        size: [number, number] = [0, 0];
        setSize(width: number, height: number): void {
            this.size = [width, height];
        }
        setPixelRatio(): void {}
        render(): void {}
        dispose(): void {
            this.disposed = true;
        }
    }

    class StubMaterial {
        disposed = false;
        constructor(public params: Record<string, unknown>) {}
        dispose(): void {
            this.disposed = true;
        }
    }

    return {
        Scene: StubScene as unknown as ThreeNamespace['Scene'],
        Color: class {
            constructor(public value: string | number) {}
        } as unknown as ThreeNamespace['Color'],
        PerspectiveCamera: StubCamera as unknown as ThreeNamespace['PerspectiveCamera'],
        WebGLRenderer: StubRenderer as unknown as ThreeNamespace['WebGLRenderer'],
        AmbientLight: class {} as unknown as ThreeNamespace['AmbientLight'],
        DirectionalLight: class {
            position = new StubVector3();
        } as unknown as ThreeNamespace['DirectionalLight'],
        MeshStandardMaterial: StubMaterial as unknown as ThreeNamespace['MeshStandardMaterial'],
        Mesh: StubObject3D as unknown as ThreeNamespace['Mesh'],
        Vector2: StubVector3 as unknown as ThreeNamespace['Vector2'],
        Vector3: StubVector3 as unknown as ThreeNamespace['Vector3'],
        Raycaster: StubRaycaster as unknown as ThreeNamespace['Raycaster'],
        ColorManagement: { enabled: false },
        SRGBColorSpace: 'srgb',
        NoToneMapping: 0,
    };
}

/** Install the stub on `globalThis.THREE` and return a restore function. */
export function installThreeStub(three: ThreeNamespace = createThreeStub()): () => void {
    const previous = globalThis.THREE;
    globalThis.THREE = three;
    return () => {
        globalThis.THREE = previous;
    };
}
