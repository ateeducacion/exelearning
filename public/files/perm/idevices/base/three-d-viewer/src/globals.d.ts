/**
 * Ambient declarations for the browser globals eXeLearning supplies through
 * classic scripts, plus the third-party surfaces this iDevice touches.
 *
 * The 3D Viewer bundles never import these — they are already on the page
 * (workarea, preview or export) when the bundle runs — so every access is
 * feature-detected and typed as possibly undefined.
 *
 * Only the members this iDevice actually uses are declared. These are NOT
 * complete typings for Three.js, `<model-viewer>` or the eXe runtime.
 */

// ---------------------------------------------------------------------------
// eXeLearning globals
// ---------------------------------------------------------------------------

/** GUI-string translator (workarea i18n). */
declare var _: ((text: string) => string) | undefined;

/** Content-string translator (exported-content i18n). */
declare var c_: ((text: string) => string) | undefined;

declare var eXe:
    | {
          app?: {
              alert?: (message: string) => void;
          };
      }
    | undefined;

/** The slice of AssetManager this iDevice uses to resolve `asset://` handles. */
interface ExeAssetManager {
    resolveAssetURLSync?: (assetUrl: string) => string | null | undefined;
    resolveAssetURL?: (assetUrl: string) => Promise<string | null | undefined>;
    /** blob URL -> asset id, used to recover a canonical `asset://` reference. */
    reverseBlobCache?: { get?: (blobUrl: string) => string | null | undefined };
    getAssetMetadata?: (assetId: string) => { filename?: string } | null | undefined;
}

interface ExeProject {
    odeSession?: string;
    assetManager?: ExeAssetManager;
    _yjsBridge?: { assetManager?: ExeAssetManager };
}

interface ExeSymfonyConfig {
    baseURL?: string;
    basePath?: string;
}

interface ExeLearningGlobal {
    app?: { project?: ExeProject };
    symfony?: ExeSymfonyConfig;
    /** Serialized or plain runtime config; `isStaticMode` drives path building. */
    config?: string | { isStaticMode?: boolean; isOfflineInstallation?: boolean; baseURL?: string; basePath?: string };
}

declare var eXeLearning: ExeLearningGlobal | undefined;

/** The shared gamification SCORM helper available in exported packages. */
interface ExeScormRuntime {
    registerActivity?: (game: Record<string, unknown>) => void;
    sendScoreNew?: (auto: boolean, game: Record<string, unknown>) => void;
}

declare var $exeDevices:
    | {
          iDevice?: { gamification?: { scorm?: ExeScormRuntime } };
      }
    | undefined;

/** The shared gamification SCORM helper available in the workarea editor. */
interface ExeScormEdition {
    getTab?: (repeatActivity: boolean, showScore: boolean) => string;
    init?: () => void;
    setValues?: (isScorm: number, textButtonScorm: string, repeatActivity: boolean, weighted: number) => void;
    getValues?: () => { isScorm?: number; weighted?: number; textButtonScorm?: string } | null;
}

declare var $exeDevicesEdition:
    | {
          iDevice?: { gamification?: { scorm?: ExeScormEdition } };
      }
    | undefined;

// ---------------------------------------------------------------------------
// Third-party surfaces (minimal slices)
// ---------------------------------------------------------------------------

/** The `<model-viewer>` members this iDevice reads or writes. */
interface ModelViewerElement extends HTMLElement {
    src?: string;
    alt?: string;
    loaded?: boolean;
    animationName?: string;
    animationSpeed?: number;
    availableAnimations?: readonly string[];
    cameraOrbit?: string;
    cameraTarget?: string;
    fieldOfView?: string;
    play?: (options?: { repetitions?: number }) => void;
    pause?: () => void;
    jumpCameraToGoal?: () => void;
    getCameraOrbit?: () => { theta?: number; phi?: number; radius?: number; toString(): string };
    getCameraTarget?: () => { toString(): string };
    getFieldOfView?: () => number;
    positionAndNormalFromPoint?: (
        x: number,
        y: number,
    ) => { position?: { toString(): string }; normal?: { toString(): string } } | null;
}

/** A Three.js `Vector3`-shaped value (only the members the adapters use). */
interface ThreeVector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): ThreeVector3;
    clone(): ThreeVector3;
    length(): number;
    normalize(): ThreeVector3;
    dot(other: ThreeVector3): number;
    subVectors(a: ThreeVector3, b: ThreeVector3): ThreeVector3;
    project(camera: ThreeCamera): ThreeVector3;
    transformDirection(matrix: unknown): ThreeVector3;
}

interface ThreeCamera {
    position: ThreeVector3;
    fov?: number;
    aspect?: number;
    lookAt(x: number, y: number, z: number): void;
    updateMatrixWorld(): void;
    updateProjectionMatrix?: () => void;
}

interface ThreeObject3D {
    matrixWorld: unknown;
    rotation: { y: number };
    updateMatrixWorld(): void;
    localToWorld(target: ThreeVector3): ThreeVector3;
    worldToLocal(target: ThreeVector3): ThreeVector3;
    traverse(callback: (node: ThreeDisposableNode) => void): void;
}

interface ThreeDisposableNode {
    geometry?: { dispose?: () => void } | null;
    material?: unknown;
}

interface ThreeOrbitControls {
    target: ThreeVector3;
    enableDamping?: boolean;
    dampingFactor?: number;
    getAzimuthalAngle?: () => number;
    getPolarAngle?: () => number;
    update?: () => void;
    dispose?: () => void;
}

interface ThreeRenderer {
    outputColorSpace?: unknown;
    outputEncoding?: unknown;
    toneMapping?: unknown;
    setSize(width: number, height: number): void;
    setPixelRatio?: (ratio: number) => void;
    render(scene: unknown, camera: unknown): void;
    dispose?: () => void;
}

interface ThreeRaycaster {
    setFromCamera(ndc: unknown, camera: ThreeCamera): void;
    intersectObject(
        object: ThreeObject3D,
        recursive?: boolean,
    ): Array<{ point: ThreeVector3; face?: { normal: ThreeVector3 } | null }>;
}

/**
 * The Three.js namespace, as published on `window.THREE` by
 * `ensureThreeJsLoaded()` (core module + STLLoader + OrbitControls).
 */
interface ThreeNamespace {
    Scene: new () => { background?: unknown; add(object: unknown): void; traverse?: unknown };
    Color: new (value: string | number) => unknown;
    PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => ThreeCamera;
    WebGLRenderer: new (params: { canvas: HTMLCanvasElement; antialias?: boolean }) => ThreeRenderer;
    AmbientLight: new (color: number, intensity: number) => unknown;
    DirectionalLight: new (color: number, intensity: number) => { position: ThreeVector3 };
    MeshStandardMaterial: new (params: Record<string, unknown>) => unknown;
    Mesh: new (geometry: unknown, material: unknown) => ThreeObject3D;
    Vector2: new (x: number, y: number) => unknown;
    Vector3: new (x?: number, y?: number, z?: number) => ThreeVector3;
    Raycaster: new () => ThreeRaycaster;
    STLLoader?: new () => { parse(buffer: ArrayBuffer): ThreeGeometry };
    OrbitControls?: new (camera: ThreeCamera, domElement: HTMLElement) => ThreeOrbitControls;
    ColorManagement?: { enabled?: boolean };
    SRGBColorSpace?: unknown;
    sRGBEncoding?: unknown;
    NoToneMapping?: unknown;
}

interface ThreeGeometry {
    boundingBox?: { getSize(target: ThreeVector3): ThreeVector3 } | null;
    computeBoundingBox(): void;
    center(): void;
    scale(x: number, y: number, z: number): void;
    hasAttribute(name: string): boolean;
    computeVertexNormals(): void;
    dispose?: () => void;
}

// ---------------------------------------------------------------------------
// Globals the bundles read and write
//
// Declared with `var` (not only on `Window`) because the bundles reach them
// through `globalThis`, which is what makes the same code work in the workarea,
// in an export and in the happy-dom test environment.
// ---------------------------------------------------------------------------

/** Cross-bundle coordination for lazily injected libraries. */
declare var $exeLibs: Record<string, unknown> | undefined;

/** Three.js namespace, attached by `ensureThreeJsLoaded()`. */
declare var THREE: ThreeNamespace | undefined;

/** The shared viewer runtime, published by whichever bundle loads first. */
declare var eXe3DViewer: unknown;

/** Deterministic WebGL override for tests (see `hasWebGL`). */
declare var __tdvForceWebGL: boolean | undefined;

// ---------------------------------------------------------------------------
// Window surface published by the two generated bundles
// ---------------------------------------------------------------------------

interface Window {
    /** Published by the edition bundle; the workarea engine reads this. */
    $exeDevice?: unknown;
    /** Published by the export bundle; the export engine reads this. */
    $threedviewer?: unknown;
    /** Serialization helper the export engine instantiates. */
    ThreeDViewerExportObject?: unknown;
    /** The shared viewer runtime (registry, STL boot, interaction factory). */
    eXe3DViewer?: unknown;
    /** Cross-bundle coordination for lazily injected libraries. */
    $exeLibs?: Record<string, unknown>;
    /** Three.js namespace, attached by `ensureThreeJsLoaded()`. */
    THREE?: ThreeNamespace;
    /** Deterministic WebGL override for tests (see `hasWebGL`). */
    __tdvForceWebGL?: boolean;
    _?: (text: string) => string;
    c_?: (text: string) => string;
}
