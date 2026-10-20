/**
 * The wrapper → instance registry.
 *
 * Created through a factory rather than exported as a module-level singleton so
 * tests get a fresh registry per case and so the runtime facade owns exactly
 * one instance of it.
 */

import { disposeInstance } from './lifecycle';
import type { ViewerInstance, ViewerRegistry } from './types';

export function createRegistry(): ViewerRegistry {
    const instances = new Map<HTMLElement, ViewerInstance>();

    const destroy = (wrapper: HTMLElement): void => {
        const instance = instances.get(wrapper);
        if (!instance) {
            return;
        }
        // Drop the entry first so a disposer that re-enters (an interaction
        // controller closing a dialog, say) cannot recurse into this instance.
        instances.delete(wrapper);
        disposeInstance(instance);
    };

    return {
        get: wrapper => instances.get(wrapper),
        set: (wrapper, instance) => {
            instances.set(wrapper, instance);
        },
        has: wrapper => instances.has(wrapper),
        destroy,
        destroyAll: () => {
            // Reverse insertion order: the most recently booted viewer is the
            // most likely to still hold a live WebGL context.
            for (const wrapper of [...instances.keys()].reverse()) {
                destroy(wrapper);
            }
        },
        wrappers: () => [...instances.keys()],
    };
}
