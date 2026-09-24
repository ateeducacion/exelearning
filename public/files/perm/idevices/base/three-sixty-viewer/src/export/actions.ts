/**
 * Hotspot activation dispatch for the learner runtime: scene navigation,
 * safe external links and content modals.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { Hotspot, LinkAction } from '../shared/types';
import { isSafeLinkUrl } from '../shared/urls';

export interface ActionDispatchDeps {
    readonly goToScene: (sceneId: string) => void;
    readonly openModal: (hotspot: Hotspot, trigger: HTMLElement | null) => void;
    readonly openWindow?: (url: string) => void;
    readonly navigate?: (url: string) => void;
}

/**
 * Open an external link from a hotspot. Defaults to a new tab and uses
 * noopener/noreferrer so the target page cannot reach back into the viewer.
 * Unsafe URLs (scripting schemes) are refused outright.
 */
export function openLink(payload: LinkAction['payload'], deps: Pick<ActionDispatchDeps, 'openWindow' | 'navigate'>): void {
    if (!payload.url || !isSafeLinkUrl(payload.url)) return;
    if (payload.newTab !== false) {
        if (deps.openWindow) {
            deps.openWindow(payload.url);
        } else if (typeof window !== 'undefined' && typeof window.open === 'function') {
            window.open(payload.url, '_blank', 'noopener,noreferrer');
        }
        return;
    }
    if (deps.navigate) {
        deps.navigate(payload.url);
        return;
    }
    if (typeof window !== 'undefined') {
        try {
            window.location.href = payload.url;
        } catch {
            // Navigation can be blocked (sandboxed iframe); nothing to do.
        }
    }
}

/** Route a hotspot activation to the right behaviour for its action type. */
export function activateHotspot(hotspot: Hotspot, trigger: HTMLElement | null, deps: ActionDispatchDeps): void {
    const action = hotspot.action;
    switch (action.type) {
        case 'goToScene':
            if (action.payload.sceneId) deps.goToScene(action.payload.sceneId);
            return;
        case 'link':
            openLink(action.payload, deps);
            return;
        case 'text':
        case 'image':
        case 'video':
        case 'unsupported':
            deps.openModal(hotspot, trigger);
            return;
    }
}

/** English fallback labels for unlabelled hotspots in exported content. */
export function defaultHotspotLabel(hotspot: Hotspot): string {
    switch (hotspot.action.type) {
        case 'goToScene':
            return 'Go to scene';
        case 'image':
            return 'View image';
        case 'video':
            return 'Watch video';
        case 'link':
            return 'Open link';
        case 'text':
        case 'unsupported':
            return 'View information';
    }
}
