import { describe, expect, it, vi } from 'vitest';
import { createDefaultHotspot } from '../shared/normalization';
import type { Hotspot } from '../shared/types';
import { createHotspotLayer } from './hotspot-renderer';

function hotspot(overrides: Partial<Hotspot> = {}): Hotspot {
    return { ...createDefaultHotspot(`hs-${Math.random().toString(36).slice(2)}`), ...overrides };
}

function makeLayer(overrides: Partial<Parameters<typeof createHotspotLayer>[1]> = {}) {
    const host = document.createElement('div');
    const onActivate = vi.fn();
    const layer = createHotspotLayer(host, {
        showLabels: true,
        labelPosition: 'right',
        fallbackLabel: () => 'fallback',
        onActivate,
        ...overrides,
    });
    return { host, layer, onActivate };
}

describe('createHotspotLayer', () => {
    it('renders one accessible button per hotspot with icon and label', () => {
        const { layer } = makeLayer();
        layer.setHotspots([hotspot({ id: 'a', label: 'Info point' }), hotspot({ id: 'b' })]);
        expect(layer.buttons).toHaveLength(2);
        const [first, second] = Array.from(layer.overlay.querySelectorAll('button'));
        expect(first?.getAttribute('aria-label')).toBe('Info point');
        expect(first?.querySelector('.three-sixty-viewer-hotspot-label')?.textContent).toBe('Info point');
        expect(first?.querySelector('.three-sixty-viewer-hotspot-icon')?.getAttribute('aria-hidden')).toBe('true');
        // Unlabelled → fallback label, no visible label element.
        expect(second?.getAttribute('aria-label')).toBe('fallback');
        expect(second?.querySelector('.three-sixty-viewer-hotspot-label')).toBeNull();
    });

    it('omits labels when showLabels is off and applies the position class', () => {
        const { layer } = makeLayer({ showLabels: false, labelPosition: 'top' });
        layer.setHotspots([hotspot({ label: 'Named' })]);
        expect(layer.overlay.querySelector('.three-sixty-viewer-hotspot-label')).toBeNull();
        const { layer: labelled } = makeLayer({ labelPosition: 'top' });
        labelled.setHotspots([hotspot({ label: 'Named' })]);
        expect(labelled.overlay.querySelector('.three-sixty-viewer-hotspot-label-top')).toBeTruthy();
    });

    it('classes buttons by action type, treating unsupported as text', () => {
        const { layer } = makeLayer();
        layer.setHotspots([
            hotspot({ action: { type: 'goToScene', payload: { sceneId: 's' } } }),
            hotspot({ action: { type: 'unsupported', originalType: 'x', originalPayload: null } }),
        ]);
        const buttons = layer.overlay.querySelectorAll('button');
        expect(buttons[0]?.className).toContain('three-sixty-viewer-hotspot-goToScene');
        expect(buttons[1]?.className).toContain('three-sixty-viewer-hotspot-text');
    });

    it('activates on click, Enter and Space', () => {
        const { layer, onActivate } = makeLayer();
        const spot = hotspot({ id: 'act' });
        layer.setHotspots([spot]);
        const button = layer.overlay.querySelector('button');
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        button?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        button?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        button?.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }));
        expect(onActivate).toHaveBeenCalledTimes(3);
        expect(onActivate.mock.calls[0]?.[0]).toEqual(spot);
    });

    it('positions buttons per frame, hiding invisible ones', () => {
        const { layer } = makeLayer();
        layer.setHotspots([hotspot({ id: 'p1' }), hotspot({ id: 'p2' })]);
        layer.positionAll(target => (target.id === 'p1' ? { x: 10, y: 20, visible: true } : null));
        const [first, second] = Array.from(layer.overlay.querySelectorAll('button'));
        expect(first?.style.display).toBe('');
        expect(first?.style.left).toBe('10px');
        expect(first?.style.top).toBe('20px');
        expect(second?.style.display).toBe('none');
    });

    it('decorates buttons and cleans up on dispose', () => {
        const decorate = vi.fn();
        const { host, layer } = makeLayer({ decorateButton: decorate });
        layer.setHotspots([hotspot()]);
        expect(decorate).toHaveBeenCalledTimes(1);
        layer.dispose();
        expect(host.querySelector('.three-sixty-viewer-overlay')).toBeNull();
        expect(layer.buttons).toHaveLength(0);
    });
});
