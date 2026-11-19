/**
 * Booting the wrappers on an exported (or previewed) page: legacy upgrade,
 * boot-config resolution, viewer construction and interaction attachment.
 */

import { revealFallback } from '../interactions/fallback';
import type { InteractionHooks } from '../interactions/types';
import { getAssetManager } from '../runtime/asset-resolver';
import { getExportLibBaseUrl, getExportModelViewerUrl, getIdeviceResourcesBase } from '../runtime/paths';
import { ensureModelViewerLoaded } from '../runtime/model-viewer-loader';
import { ensureThreeJsLoaded } from '../runtime/three-loader';
import type { ViewerInstance } from '../runtime/types';
import { publishViewerRuntime } from '../runtime/viewer-runtime';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR, normalizeColor } from '../shared/colors';
import { normalizeAnimation, normalizeInteraction, normalizeScorm } from '../shared/schema';
import { detectModelType, isStlSource } from '../shared/model-source';
import type { InteractionSettings, ScormSettings, ViewerDisplayConfig } from '../shared/types';
import { resolveRuntimeSrc } from './source-resolver';
import { setupScormScoring } from './scorm';
import { ThreeDViewerController } from './viewer-controller';

/** How long to wait for a booted STL mesh before showing the text fallback. */
const STL_INTERACTION_TIMEOUT_MS = 20000;

/**
 * Upgrade persisted HTML that still carries the base64 `data-config` payload
 * (written before the flat `data-*` attributes existed) into the current shape.
 * Idempotent, silent, and a no-op for wrappers already in the new format.
 */
export function migrateLegacyConfig(wrapper: HTMLElement): void {
    const encoded = wrapper.getAttribute('data-config');
    if (!encoded) {
        return;
    }
    let config: Record<string, unknown> = {};
    try {
        config = JSON.parse(decodeURIComponent(escape(atob(encoded)))) as Record<string, unknown>;
    } catch {
        try {
            config = JSON.parse(encoded) as Record<string, unknown>;
        } catch {
            config = {};
        }
    }
    const data = wrapper.dataset;
    const setIfMissing = (key: string, value: unknown): void => {
        if (data[key] == null && value != null && value !== '') {
            data[key] = String(value);
        }
    };
    setIfMissing('modelSrc', config.src);
    setIfMissing('alt', config.alt);
    setIfMissing('backgroundColor', config.backgroundColor);
    if (config.cameraControls != null) {
        setIfMissing('cameraControls', Boolean(config.cameraControls));
    }
    if (config.autoRotate != null) {
        setIfMissing('autoRotate', Boolean(config.autoRotate));
    }
    setIfMissing('autoRotateSpeed', config.autoRotateSpeed);
    if (config.showNavControls != null) {
        setIfMissing('showNavControls', Boolean(config.showNavControls));
    }
    const animation = config.animation as Record<string, unknown> | undefined;
    if (animation) {
        if (animation.enabled != null) {
            setIfMissing('animationEnabled', Boolean(animation.enabled));
        }
        setIfMissing('animationName', animation.name);
        setIfMissing('animationSpeed', animation.speed);
    }
    if (!data.modelType && data.modelSrc) {
        const type = detectModelType(data.modelSrc);
        if (type !== 'unknown') {
            data.modelType = type;
        }
    }
    if (!data.modelColor) {
        data.modelColor = DEFAULT_MODEL_COLOR;
    }
    wrapper.removeAttribute('data-config');
}

/**
 * Read the boot config from a wrapper's flat `data-*` attributes.
 *
 * The attributes are the single source of truth: the exporter rewrites
 * `asset://uuid.ext` → `content/resources/...` inside `data-model-src`, so the
 * editor and a static export take the same code path.
 */
export function resolveBootConfig(wrapper: HTMLElement): ViewerDisplayConfig {
    const data = wrapper.dataset;
    const showNavControls = data.showNavControls === 'true';
    const rawSrc = (data.modelSrc ?? '').trim();
    const assetRef = (data.modelAssetRef ?? '').trim();
    // Prefer the canonical `asset://` handle when AssetManager is live:
    // `data-model-src` may have been rewritten to a path that only exists inside
    // an export ZIP, or replaced with a blob URL by the workarea resolver.
    let src = assetRef && getAssetManager() ? `asset://${assetRef}` : rawSrc;
    // `data:` would never round-trip; `blob:` is left intact because the browser
    // can still fetch a live one, which beats showing the empty state.
    if (src.startsWith('data:')) {
        src = '';
    }
    return {
        src,
        type: data.modelType ? (data.modelType as ViewerDisplayConfig['type']) : detectModelType(src),
        alt: data.alt ?? '',
        modelColor: normalizeColor(data.modelColor, DEFAULT_MODEL_COLOR),
        backgroundColor: normalizeColor(data.backgroundColor, DEFAULT_BACKGROUND_COLOR),
        cameraControls: data.cameraControls !== 'false',
        autoRotate: !showNavControls && data.autoRotate !== 'false',
        autoRotateSpeed: Number.parseFloat(data.autoRotateSpeed ?? '') || 30,
        showNavControls,
        animation: normalizeAnimation({
            enabled: data.animationEnabled === 'true',
            name: data.animationName ?? '',
            speed: Number.parseFloat(data.animationSpeed ?? '') || 1,
        }),
    };
}

/** Read and parse the JSON interaction block a wrapper carries, if any. */
export function parseInteractionData(wrapper: HTMLElement): Record<string, unknown> | null {
    const script = wrapper.querySelector('script.tdv-interaction-data');
    if (!script) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(script.textContent || '{}');
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function buildInteractionHooks(wrapper: HTMLElement, raw: Record<string, unknown>): InteractionHooks {
    const i18n = (raw.i18n && typeof raw.i18n === 'object' ? raw.i18n : {}) as Record<string, string>;
    return {
        t: key => i18n[key] ?? key,
        resolveMediaUrl: url => {
            try {
                return resolveRuntimeSrc(url) || url;
            } catch {
                return url;
            }
        },
    };
}

/** Poll the runtime until the STL mesh exists, or the deadline passes. */
function waitForStlMesh(wrapper: HTMLElement, timeoutMs: number): Promise<ViewerInstance | null> {
    const runtime = publishViewerRuntime();
    const deadline = Date.now() + timeoutMs;
    return new Promise(resolve => {
        const poll = (): void => {
            const instance = runtime.getInstance(wrapper);
            if (instance?.mesh || Date.now() >= deadline) {
                resolve(instance);
                return;
            }
            const raf = globalThis.requestAnimationFrame;
            if (typeof raf === 'function') {
                raf(poll);
            } else {
                setTimeout(poll, 16);
            }
        };
        poll();
    });
}

/**
 * Attach the shared interaction layer to a booted wrapper. Idempotent: the
 * wrapper is flagged so a second `renderBehaviour` pass does nothing.
 */
export async function attachInteractionLayer(
    wrapper: HTMLElement,
    timeoutMs: number = STL_INTERACTION_TIMEOUT_MS,
): Promise<void> {
    if (wrapper.dataset.tdvInteractionBooted === '1') {
        return;
    }
    const raw = parseInteractionData(wrapper);
    if (!raw?.enabled) {
        return;
    }
    wrapper.dataset.tdvInteractionBooted = '1';

    const interaction: InteractionSettings = normalizeInteraction(raw);
    const scorm: ScormSettings = normalizeScorm(raw.scorm);
    const hooks = buildInteractionHooks(wrapper, raw);
    setupScormScoring(wrapper, interaction, scorm, hooks);

    const runtime = publishViewerRuntime();
    const type = wrapper.dataset.modelType || detectModelType(wrapper.dataset.modelSrc ?? '');

    if (type === 'stl') {
        const instance = await waitForStlMesh(wrapper, timeoutMs);
        if (!instance?.mesh) {
            // No mesh means no WebGL or a failed load: expose the text list.
            revealFallback(wrapper, true);
            return;
        }
        instance.interaction = runtime.createInteractionLayer(
            { wrapper, type: 'stl', instance },
            interaction,
            'view',
            hooks,
        );
        return;
    }

    const modelViewer = wrapper.querySelector<ModelViewerElement>('model-viewer');
    runtime.createInteractionLayer({ wrapper, type, modelViewer }, interaction, 'view', hooks);
}

/** Every 3D Viewer wrapper reachable from an iDevice scope. */
export function findWrappers(ideviceId: string): HTMLElement[] {
    const selector = '.three-d-viewer-wrapper[data-three-d]';
    let scope: ParentNode = document;
    if (ideviceId) {
        scope =
            document.querySelector(`.idevice_node.three-d-viewer[id="${ideviceId}"]`) ??
            document.querySelector(`[idevice-id="${ideviceId}"]`) ??
            document.getElementById(ideviceId) ??
            document;
    }
    const scoped = Array.from(scope.querySelectorAll<HTMLElement>(selector));
    if (scoped.length > 0 || scope === document) {
        return scoped;
    }
    return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

/**
 * Strip a stale `src` from any `<model-viewer>` inside an STL wrapper, BEFORE
 * the custom element is defined. The moment model-viewer upgrades it would
 * fetch that URL and route the ASCII STL bytes through its GLB/GLTF/USDZ
 * loaders, throwing on the `COLOR=` header.
 */
export function stripStlModelViewerSrc(wrapper: HTMLElement): void {
    const modelViewer = wrapper.querySelector<ModelViewerElement>('model-viewer');
    if (!modelViewer) {
        return;
    }
    const data = wrapper.dataset;
    const isStl =
        data.modelType === 'stl' ||
        isStlSource(data.modelSrc ?? '') ||
        isStlSource(modelViewer.getAttribute('src') ?? '');
    if (isStl) {
        modelViewer.removeAttribute('src');
    }
}

/** Boot every wrapper of an iDevice: viewers first, interaction layers after. */
export function bootWrappers(ideviceId: string): boolean {
    const wrappers = findWrappers(ideviceId);
    if (wrappers.length === 0) {
        return true;
    }

    wrappers.forEach(migrateLegacyConfig);
    wrappers.forEach(stripStlModelViewerSrc);

    const modelViewerCandidates = [getExportModelViewerUrl()];
    const resourcesBase = getIdeviceResourcesBase(ideviceId);
    if (resourcesBase) {
        modelViewerCandidates.push(`${resourcesBase}model-viewer.min.js`);
    }

    void ensureModelViewerLoaded(modelViewerCandidates, 'export').then(() => {
        for (const wrapper of wrappers) {
            if (wrapper.dataset.threedBooted === '1') {
                continue;
            }
            wrapper.dataset.threedBooted = '1';
            void new ThreeDViewerController(wrapper, resolveBootConfig(wrapper)).start();
        }
    });

    const interactive = wrappers.filter(wrapper => parseInteractionData(wrapper)?.enabled);
    if (interactive.length > 0) {
        // The STL path needs Three.js before markers can project; the GLB path
        // does not, and `ensureThreeJsLoaded` is a no-op once it is loaded.
        const needsThree = interactive.some(wrapper => wrapper.dataset.modelType === 'stl');
        const ready = needsThree ? ensureThreeJsLoaded(getExportLibBaseUrl()) : Promise.resolve();
        void ready
            .then(() => Promise.all(interactive.map(attachInteractionLayer)))
            .catch(() => {
                for (const wrapper of interactive) {
                    revealFallback(wrapper, true);
                }
            });
    }
    return true;
}
