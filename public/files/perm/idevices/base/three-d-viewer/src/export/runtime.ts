/**
 * `window.$threedviewer` — the export-side contract the eXeLearning engine
 * calls: `renderView` produces the static markup, `renderBehaviour` boots it.
 */

import { getAssetManager } from '../runtime/asset-resolver';
import { getExportModelViewerUrl, resolveAppUrl } from '../runtime/paths';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR, normalizeColor } from '../shared/colors';
import { hydrateDocument } from '../shared/migration';
import { detectModelType } from '../shared/model-source';
import { normalizeAnimation, normalizeInteraction, normalizeScorm } from '../shared/schema';
import type { InteractionSettings, ScormSettings, ViewerDisplayConfig } from '../shared/types';
import { normalizePath } from '../shared/urls';
import { bootWrappers, resolveBootConfig } from './bootstrap';
import { buildViewerMarkup } from './renderer';

/** Add a `<link rel="modulepreload">` once, to warm up the model-viewer fetch. */
function appendModulePreloadOnce(href: string): void {
    if (!href || typeof document === 'undefined') {
        return;
    }
    if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) {
        return;
    }
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = href;
    document.head.appendChild(link);
}

/**
 * The canonical `<id>.<ext>` reference for `data-model-asset-ref`.
 *
 * Written without the `asset://` scheme so the exporter's global URL rewriter
 * leaves it alone; it is what lets a live AssetManager recover the original
 * handle after `data-model-src` has been rewritten (or replaced by a blob URL).
 */
export function buildAssetRef(src: string): string {
    if (src.startsWith('asset://')) {
        return src.substring('asset://'.length);
    }
    if (!src.startsWith('blob:')) {
        return '';
    }
    const assetManager = getAssetManager();
    const assetId = assetManager?.reverseBlobCache?.get?.(src);
    if (!assetId) {
        return '';
    }
    const filename = assetManager?.getAssetMetadata?.(assetId)?.filename ?? '';
    const dot = filename.lastIndexOf('.');
    const extension = dot !== -1 ? filename.substring(dot + 1).toLowerCase() : '';
    return extension ? `${assetId}.${extension}` : String(assetId);
}

/** Build the display config `renderView` renders from persisted iDevice data. */
export function toDisplayConfig(data: Record<string, unknown>): ViewerDisplayConfig {
    const showNavControls = Boolean(data.showNavControls);
    const src = normalizePath(data.src);
    const speed = Number.parseFloat(String(data.autoRotateSpeed));
    return {
        src,
        type: detectModelType(src),
        alt: typeof data.alt === 'string' ? data.alt : '',
        modelColor: normalizeColor(data.modelColor, DEFAULT_MODEL_COLOR),
        backgroundColor: normalizeColor(data.backgroundColor, DEFAULT_BACKGROUND_COLOR),
        cameraControls: data.cameraControls !== false,
        // Mutually exclusive: manual nav controls win over auto-rotation.
        autoRotate: !showNavControls && data.autoRotate !== false,
        autoRotateSpeed: Number.isFinite(speed) ? speed : 30,
        showNavControls,
        animation: normalizeAnimation(data.animation),
    };
}

export interface ThreeDViewerExportRuntime {
    renderView(data: unknown, accessibility?: unknown, template?: string): string;
    renderBehaviour(data: unknown, accessibility?: unknown, ideviceId?: string): boolean;
    init(): void;
    resolveBootConfig(data: unknown, wrapper: HTMLElement): ViewerDisplayConfig;
    /** The current iDevice id, used by `asset://` resolution during a render. */
    currentIdeviceId: string;
}

export function createExportRuntime(): ThreeDViewerExportRuntime {
    const runtime: ThreeDViewerExportRuntime = {
        currentIdeviceId: '',

        renderView(data, _accessibility, template) {
            const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
            const viewerId =
                typeof record.ideviceId === 'string' && record.ideviceId
                    ? record.ideviceId
                    : `three-d-viewer-${Date.now()}`;
            const config = toDisplayConfig(record);
            // Interaction and SCORM state go through the shared schema, so the
            // exported page and the editor agree on every default.
            const interaction: InteractionSettings = normalizeInteraction(record.interaction);
            const scorm: ScormSettings = normalizeScorm(record.scorm ?? record);

            appendModulePreloadOnce(getExportModelViewerUrl());
            runtime.currentIdeviceId = viewerId;

            const content = buildViewerMarkup({
                viewerId,
                config,
                interaction,
                scorm,
                assetRef: buildAssetRef(config.src),
            });
            return typeof template === 'string' ? template.replace('{content}', content) : content;
        },

        renderBehaviour(data, _accessibility, ideviceId) {
            const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
            const id = (typeof record.ideviceId === 'string' ? record.ideviceId : '') || ideviceId || '';
            return bootWrappers(id);
        },

        // Kept for engine ABI parity with the other JSON iDevices.
        init() {},

        // `data` is ignored: the wrapper attributes are the source of truth.
        resolveBootConfig: (_data, wrapper) => resolveBootConfig(wrapper),
    };
    return runtime;
}

/**
 * The serialization helper the engine instantiates to move iDevice data in and
 * out of the edition device.
 */
export class ThreeDViewerExportObject {
    private node: { get3DViewerJSON?: () => unknown; set3DViewerJSON?: (data: unknown) => void } | null = null;
    private resources: unknown = null;

    init(node: unknown, resources?: unknown): boolean {
        this.node = (node ?? null) as ThreeDViewerExportObject['node'];
        this.resources = resources ?? null;
        return true;
    }

    toJSON(): unknown {
        return this.node?.get3DViewerJSON?.() ?? {};
    }

    fromJSON(data: unknown): void {
        this.node?.set3DViewerJSON?.(data ?? {});
    }

    getResources(): unknown {
        return this.resources;
    }
}

/** Re-exported so probes and tests reach the shared helpers from one place. */
export const exportHelpers = {
    hydrateDocument,
    normalizeInteraction,
    normalizeScorm,
    resolveAppUrl,
    getModelViewerLibUrl: getExportModelViewerUrl,
};
