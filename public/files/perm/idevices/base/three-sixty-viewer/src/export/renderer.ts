/**
 * Static view HTML and viewer construction for the learner runtime, plus the
 * per-node instance registry. Before re-rendering a node its previous
 * instance is always disposed, so repeated renderBehaviour calls never leak.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { escapeAttr } from '../shared/html';
import { getStartScene } from '../shared/normalization';
import type { ThreeSixtyDocumentV2 } from '../shared/types';
import { hasWebGL } from '../viewer/lifecycle';
import { getThree } from '../viewer/types';
import { createInstance } from './instance';
import type { ThreeSixtyInstance } from './instance';

export const CSS_CLASS = 'three-sixty-viewer';
const WRAPPER_CLASS = 'three-sixty-viewer-wrapper';

/** Registry of live instances, keyed by their wrapper element. */
export interface InstanceRegistry {
    readonly instances: WeakMap<HTMLElement, ThreeSixtyInstance>;
    /** Wrappers are also tracked in a Set so destroyAll() can iterate. */
    readonly wrappers: Set<HTMLElement>;
}

export function createInstanceRegistry(): InstanceRegistry {
    return { instances: new WeakMap(), wrappers: new Set() };
}

export function registerInstance(registry: InstanceRegistry, instance: ThreeSixtyInstance): void {
    registry.instances.set(instance.wrapper, instance);
    registry.wrappers.add(instance.wrapper);
}

/** Dispose every instance whose wrapper is `node` or lives inside it. */
export function disposeInstancesWithin(registry: InstanceRegistry, node: HTMLElement): void {
    for (const wrapper of Array.from(registry.wrappers)) {
        if (wrapper === node || node.contains(wrapper)) {
            try {
                registry.instances.get(wrapper)?.destroy();
            } catch {
                // A failing destroy must not leave the registry stale.
            }
            registry.instances.delete(wrapper);
            registry.wrappers.delete(wrapper);
        }
    }
}

export function destroyAllInstances(registry: InstanceRegistry): void {
    for (const wrapper of Array.from(registry.wrappers)) {
        try {
            registry.instances.get(wrapper)?.destroy();
        } catch {
            // Keep destroying the rest.
        }
        registry.instances.delete(wrapper);
        registry.wrappers.delete(wrapper);
    }
}

/** Accessible region label for a document (start scene's alt, or generic). */
export function regionLabel(document360: ThreeSixtyDocumentV2): string {
    return getStartScene(document360)?.alt || '360° panorama';
}

/** Static HTML for renderView(): the wrapper the behaviour pass fills in. */
export function renderViewHtml(document360: ThreeSixtyDocumentV2, template: unknown): string {
    const body = `<div class="${WRAPPER_CLASS}" role="region" aria-label="${escapeAttr(regionLabel(document360))}"></div>`;
    const tpl = typeof template === 'string' && template ? template : '{content}';
    return tpl.replace('{content}', body);
}

function renderFallback(wrapper: HTMLElement, label: string): void {
    const fallback = document.createElement('div');
    fallback.className = 'three-sixty-viewer-fallback';
    fallback.textContent = label;
    wrapper.appendChild(fallback);
}

export interface BuildViewerDeps {
    readonly registry: InstanceRegistry;
    readonly webglAvailable?: () => boolean;
}

/**
 * Build (or fall back) the viewer inside `node`. Any previous instance in the
 * node is disposed first; the wrapper is created when missing and emptied
 * before use.
 */
export function buildViewer(node: HTMLElement, document360: ThreeSixtyDocumentV2, deps: BuildViewerDeps): ThreeSixtyInstance | null {
    disposeInstancesWithin(deps.registry, node);

    let wrapper = node.querySelector<HTMLElement>(`.${WRAPPER_CLASS}`);
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = WRAPPER_CLASS;
        node.appendChild(wrapper);
    }
    while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);

    const startScene = getStartScene(document360);
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', regionLabel(document360));

    if (!startScene || !startScene.src) {
        renderFallback(wrapper, '(no image)');
        return null;
    }
    const webglAvailable = deps.webglAvailable ?? hasWebGL;
    const three = getThree();
    // A flat-only start scene never needs WebGL, but tours can navigate into
    // panoramas, so the viewer still requires three.js to be present.
    if (!three || !webglAvailable()) {
        renderFallback(wrapper, startScene.alt || '');
        return null;
    }

    const instance = createInstance(wrapper, document360, { three });
    registerInstance(deps.registry, instance);
    instance.start();
    return instance;
}
