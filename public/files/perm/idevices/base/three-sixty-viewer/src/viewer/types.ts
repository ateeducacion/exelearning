/**
 * Structural types for the slice of three.js / OrbitControls the viewer uses.
 *
 * The vendored libraries are page globals (never bundled), so instead of
 * depending on @types/three we declare exactly the surface we touch. Every
 * method that older three.js builds may lack is optional and feature-checked
 * at the call site.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface ThreeVector3Like {
    x: number;
    y: number;
    z: number;
    set?: (x: number, y: number, z: number) => unknown;
    length?: () => number;
    multiplyScalar: (scalar: number) => ThreeVector3Like;
    project: (camera: ThreeCameraLike) => ThreeVector3Like;
    unproject?: (camera: ThreeCameraLike) => ThreeVector3Like;
}

export interface ThreeCameraLike {
    fov: number;
    aspect: number;
    position: ThreeVector3Like;
    updateProjectionMatrix?: () => void;
    lookAt?: (x: number, y: number, z: number) => void;
    getWorldDirection?: (target: ThreeVector3Like) => ThreeVector3Like;
}

export interface ThreeTextureLike {
    dispose?: () => void;
    colorSpace?: unknown;
    encoding?: unknown;
}

export interface ThreeMaterialLike {
    map: ThreeTextureLike | null;
    needsUpdate?: boolean;
    dispose?: () => void;
}

export interface ThreeGeometryLike {
    scale?: (x: number, y: number, z: number) => unknown;
    dispose?: () => void;
}

export interface ThreeRendererLike {
    domElement: HTMLCanvasElement;
    setPixelRatio?: (ratio: number) => void;
    setSize: (width: number, height: number) => void;
    render: (scene: ThreeSceneLike, camera: ThreeCameraLike) => void;
    dispose?: () => void;
    outputColorSpace?: unknown;
    outputEncoding?: unknown;
    toneMapping?: unknown;
    toneMappingExposure?: number;
}

export interface ThreeSceneLike {
    add: (object: unknown) => void;
}

export interface OrbitControlsLike {
    enabled: boolean;
    enablePan: boolean;
    rotateSpeed: number;
    enableDamping: boolean;
    dampingFactor: number;
    minDistance: number;
    maxDistance: number;
    enableZoom: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    update?: () => void;
    dispose?: () => void;
    getAzimuthalAngle?: () => number;
    getPolarAngle?: () => number;
}

export interface ThreeTextureLoaderLike {
    load: (
        url: string,
        onLoad?: (texture: ThreeTextureLike) => void,
        onProgress?: undefined,
        onError?: (error: unknown) => void,
    ) => ThreeTextureLike;
}

export interface ThreeNamespace {
    Scene: new () => ThreeSceneLike;
    PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => ThreeCameraLike;
    WebGLRenderer: new (options?: { antialias?: boolean; alpha?: boolean }) => ThreeRendererLike;
    SphereGeometry: new (radius: number, widthSegments: number, heightSegments: number) => ThreeGeometryLike;
    MeshBasicMaterial: new (options?: Record<string, unknown>) => ThreeMaterialLike;
    Mesh: new (geometry: ThreeGeometryLike, material: ThreeMaterialLike) => unknown;
    TextureLoader: new () => ThreeTextureLoaderLike;
    Vector3: new (x?: number, y?: number, z?: number) => ThreeVector3Like;
    OrbitControls?: new (camera: ThreeCameraLike, domElement: HTMLElement) => OrbitControlsLike;
    ColorManagement?: { enabled?: boolean };
    SRGBColorSpace?: unknown;
    sRGBEncoding?: unknown;
    NoToneMapping?: unknown;
}

/** The three.js global, when its vendored script has loaded. */
export function getThree(): ThreeNamespace | null {
    return typeof THREE !== 'undefined' && THREE ? THREE : null;
}
