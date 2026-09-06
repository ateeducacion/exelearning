import { describe, expect, it, vi } from 'vitest';
import { createDefaultHotspot } from '../shared/normalization';
import type { Hotspot, HotspotAction } from '../shared/types';
import { activateHotspot, defaultHotspotLabel, openLink } from './actions';

function hotspotWith(action: HotspotAction): Hotspot {
    return { ...createDefaultHotspot('hs-1'), action };
}

function makeDeps() {
    return {
        goToScene: vi.fn(),
        openModal: vi.fn(),
        openWindow: vi.fn(),
        navigate: vi.fn(),
    };
}

describe('openLink', () => {
    it('opens a new tab by default and navigates in place when newTab=false', () => {
        const deps = makeDeps();
        openLink({ url: 'https://example.com', newTab: true }, deps);
        expect(deps.openWindow).toHaveBeenCalledWith('https://example.com');
        openLink({ url: 'https://same.com', newTab: false }, deps);
        expect(deps.navigate).toHaveBeenCalledWith('https://same.com');
    });

    it('refuses empty and unsafe URLs', () => {
        const deps = makeDeps();
        openLink({ url: '', newTab: true }, deps);
        openLink({ url: 'javascript:alert(1)', newTab: true }, deps);
        expect(deps.openWindow).not.toHaveBeenCalled();
        expect(deps.navigate).not.toHaveBeenCalled();
    });

    it('uses window.open with noopener when no injector is provided', () => {
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        try {
            openLink({ url: 'https://example.com', newTab: true }, {});
            expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
        } finally {
            open.mockRestore();
        }
    });
});

describe('activateHotspot', () => {
    it('routes goToScene to navigation, skipping empty targets', () => {
        const deps = makeDeps();
        activateHotspot(hotspotWith({ type: 'goToScene', payload: { sceneId: 's2' } }), null, deps);
        expect(deps.goToScene).toHaveBeenCalledWith('s2');
        activateHotspot(hotspotWith({ type: 'goToScene', payload: { sceneId: '' } }), null, deps);
        expect(deps.goToScene).toHaveBeenCalledTimes(1);
        expect(deps.openModal).not.toHaveBeenCalled();
    });

    it('routes link to openLink', () => {
        const deps = makeDeps();
        activateHotspot(hotspotWith({ type: 'link', payload: { url: 'https://x', newTab: true } }), null, deps);
        expect(deps.openWindow).toHaveBeenCalledWith('https://x');
    });

    it('opens a modal for text, image, video and unsupported actions', () => {
        const deps = makeDeps();
        const trigger = document.createElement('button');
        for (const action of [
            { type: 'text', payload: { html: 'x' } },
            { type: 'image', payload: { src: 'a.jpg', alt: '', caption: '' } },
            { type: 'video', payload: { src: 'v.mp4', poster: '' } },
            { type: 'unsupported', originalType: 'z', originalPayload: null },
        ] as HotspotAction[]) {
            activateHotspot(hotspotWith(action), trigger, deps);
        }
        expect(deps.openModal).toHaveBeenCalledTimes(4);
        expect(deps.openModal.mock.calls[0]?.[1]).toBe(trigger);
    });
});

describe('defaultHotspotLabel', () => {
    it('labels every action type', () => {
        expect(defaultHotspotLabel(hotspotWith({ type: 'goToScene', payload: { sceneId: '' } }))).toBe('Go to scene');
        expect(defaultHotspotLabel(hotspotWith({ type: 'image', payload: { src: '', alt: '', caption: '' } }))).toBe('View image');
        expect(defaultHotspotLabel(hotspotWith({ type: 'video', payload: { src: '', poster: '' } }))).toBe('Watch video');
        expect(defaultHotspotLabel(hotspotWith({ type: 'link', payload: { url: '', newTab: true } }))).toBe('Open link');
        expect(defaultHotspotLabel(hotspotWith({ type: 'text', payload: { html: '' } }))).toBe('View information');
        expect(defaultHotspotLabel(hotspotWith({ type: 'unsupported', originalType: '', originalPayload: 0 }))).toBe(
            'View information',
        );
    });
});
