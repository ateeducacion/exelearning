/**
 * The learner-facing runtime published as `window.$threesixtyviewer`.
 *
 * JSON-iDevice engine API (called by public/app/common/exe_export.js):
 *   renderView(data, accesibility, template)  -> HTML string
 *   renderBehaviour(data, accesibility)       -> attach the three.js viewer
 *   init(data, accesibility)                  -> engine hook (no-op here)
 *
 * v1 single-image data is migrated transparently; documents from a NEWER
 * schema version render an accessible notice instead of guessing.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { createDefaultDocument, hydrateDocument, serializeDocument } from '../shared/schema';
import type { HydrationResult, ThreeSixtyDocumentV2 } from '../shared/types';
import { SCHEMA_VERSION } from '../shared/types';
import { buildViewer, createInstanceRegistry, destroyAllInstances, disposeInstancesWithin, renderViewHtml } from './renderer';
import type { ThreeSixtyInstance } from './instance';

export interface ThreeSixtyRuntime {
    readonly cssClass: string;
    readonly SCHEMA_VERSION: number;
    renderView: (data: unknown, accesibility: unknown, template: unknown) => string;
    renderBehaviour: (data: unknown, accesibility?: unknown) => void;
    init: (data?: unknown, accesibility?: unknown) => void;
    /** Test/utility entry: render a hydrated document into a node. */
    renderOne: (node: HTMLElement, data: unknown) => ThreeSixtyInstance | null;
    /** Extract + hydrate state from a node's JSON data attribute/script. */
    extractState: (node: HTMLElement) => ThreeSixtyDocumentV2;
    /** Hydration entry point (exposed for tests and integrations). */
    hydrateDocument: (input: unknown) => HydrationResult;
    /** Normalized wire-format snapshot of arbitrary input (legacy helper). */
    normalize: (input: unknown) => Record<string, unknown>;
    destroyAll: () => void;
}

function unsupportedVersionHtml(template: unknown): string {
    const body =
        '<div class="three-sixty-viewer-wrapper" role="region" aria-label="360° panorama">' +
        '<div class="three-sixty-viewer-fallback">' +
        'This 360° content was created with a newer version of eXeLearning and cannot be displayed here.' +
        '</div></div>';
    const tpl = typeof template === 'string' && template ? template : '{content}';
    return tpl.replace('{content}', body);
}

export interface RuntimeDeps {
    /** Injectable WebGL probe (tests run in DOM environments without GL). */
    readonly webglAvailable?: () => boolean;
}

export function createThreeSixtyRuntime(deps: RuntimeDeps = {}): ThreeSixtyRuntime {
    const registry = createInstanceRegistry();
    const webglAvailable = deps.webglAvailable;

    const hydrateToDocument = (input: unknown): ThreeSixtyDocumentV2 | null => {
        const result = hydrateDocument(input);
        if (result.status === 'ok') return result.document;
        if (result.status === 'invalid') return createDefaultDocument();
        return null; // unsupported-version
    };

    const runtime: ThreeSixtyRuntime = {
        cssClass: 'three-sixty-viewer',
        SCHEMA_VERSION,

        renderView(data, _accesibility, template) {
            const document360 = hydrateToDocument(data);
            if (!document360) return unsupportedVersionHtml(template);
            return renderViewHtml(document360, template);
        },

        renderBehaviour(data, _accesibility) {
            const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
            const id = record && typeof record.ideviceId === 'string' ? record.ideviceId : '';
            const node = id ? document.getElementById(id) : null;
            if (!node) return;
            const document360 = hydrateToDocument(data);
            if (!document360) {
                // Unsupported future version: renderView already produced the
                // notice; make sure no stale viewer stays attached.
                disposeInstancesWithin(registry, node);
                return;
            }
            buildViewer(node, document360, { registry, webglAvailable });
        },

        init(_data, _accesibility) {
            // Engine contract hook; nothing to do for this iDevice.
        },

        renderOne(node, data) {
            const document360 = hydrateToDocument(data) ?? createDefaultDocument();
            return buildViewer(node, document360, { registry, webglAvailable });
        },

        extractState(node) {
            let raw: unknown = null;
            const attr = node.getAttribute?.('data-idevice-json-data');
            if (attr) {
                raw = attr;
            } else {
                const script = node.querySelector(
                    'script.three-sixty-viewer-data[type="application/json"], script[type="application/json"].three-sixty-viewer-data',
                );
                if (script?.textContent) raw = script.textContent;
            }
            return hydrateToDocument(raw) ?? createDefaultDocument();
        },

        hydrateDocument(input) {
            return hydrateDocument(input);
        },

        normalize(input) {
            return serializeDocument(hydrateToDocument(input) ?? createDefaultDocument());
        },

        destroyAll() {
            destroyAllInstances(registry);
        },
    };
    return runtime;
}
