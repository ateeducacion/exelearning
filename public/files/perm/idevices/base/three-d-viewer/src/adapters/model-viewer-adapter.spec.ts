import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModelViewerStub } from '../test/model-viewer-stub';
import { createWrapper, makeMarker, resetDom, sequentialIds } from '../test/helpers';
import type { Marker } from '../shared/types';
import { createModelViewerAdapter } from './model-viewer-adapter';

afterEach(resetDom);

function markers(): Marker[] {
    const ids = sequentialIds();
    return [
        makeMarker(
            {
                id: 'm1',
                label: 'Summit',
                icon: 'info',
                anchor: { position: { x: 1, y: 2, z: 3 }, normal: { x: 0, y: 1, z: 0 }, surface: 'front' },
            },
            0,
            ids,
        ),
        makeMarker({ id: 'm2', label: '' }, 1, ids),
    ];
}

function makeAdapter(): {
    adapter: ReturnType<typeof createModelViewerAdapter>;
    modelViewer: ReturnType<typeof createModelViewerStub>;
    activated: string[];
} {
    const wrapper = createWrapper();
    const modelViewer = createModelViewerStub(wrapper);
    const activated: string[] = [];
    const adapter = createModelViewerAdapter(modelViewer, {
        markerLabel: (marker, index) => marker.label || `Marker ${index + 1}`,
        onActivate: id => activated.push(id),
    });
    return { adapter, modelViewer, activated };
}

describe('createModelViewerAdapter — rendering', () => {
    it('renders markers as slotted hotspot buttons carrying the anchor', () => {
        const { adapter, modelViewer } = makeAdapter();
        adapter.renderMarkers(markers(), { showLabels: true, activeId: '' });

        const buttons = modelViewer.querySelectorAll<HTMLButtonElement>('.tdv-marker');
        expect(buttons).toHaveLength(2);
        const first = buttons[0] as HTMLButtonElement;
        expect(first.getAttribute('slot')).toBe('hotspot-m1');
        expect(first.dataset.position).toBe('1 2 3');
        expect(first.dataset.normal).toBe('0 1 0');
        expect(first.dataset.surface).toBe('front');
        expect(first.getAttribute('aria-label')).toBe('Summit');
        expect(first.querySelector('.tdv-icon-info')).not.toBeNull();
        expect(first.querySelector('.tdv-marker-label')?.textContent).toBe('Summit');
    });

    it('omits the visible label when labels are off or the marker has none', () => {
        const { adapter, modelViewer } = makeAdapter();
        adapter.renderMarkers(markers(), { showLabels: false, activeId: '' });
        expect(modelViewer.querySelectorAll('.tdv-marker-label')).toHaveLength(0);

        adapter.renderMarkers(markers(), { showLabels: true, activeId: '' });
        // The second marker has an empty label, so only one is rendered.
        expect(modelViewer.querySelectorAll('.tdv-marker-label')).toHaveLength(1);
    });

    it('replaces the previous markers instead of stacking them', () => {
        const { adapter, modelViewer } = makeAdapter();
        adapter.renderMarkers(markers(), { showLabels: true, activeId: '' });
        adapter.renderMarkers(markers(), { showLabels: true, activeId: '' });
        expect(modelViewer.querySelectorAll('.tdv-marker')).toHaveLength(2);
    });

    it('marks the active marker and moves the flag on setActive', () => {
        const { adapter, modelViewer } = makeAdapter();
        adapter.renderMarkers(markers(), { showLabels: true, activeId: 'm2' });
        expect(modelViewer.querySelector('[data-marker-id="m2"]')?.getAttribute('aria-current')).toBe('true');

        adapter.setActive('m1');
        expect(modelViewer.querySelector('[data-marker-id="m1"]')?.getAttribute('aria-current')).toBe('true');
        expect(modelViewer.querySelector('[data-marker-id="m2"]')?.hasAttribute('aria-current')).toBe(false);
    });

    it('activates a marker when its button is clicked', () => {
        const { adapter, modelViewer, activated } = makeAdapter();
        adapter.renderMarkers(markers(), { showLabels: true, activeId: '' });
        modelViewer.querySelector<HTMLButtonElement>('[data-marker-id="m2"]')?.click();
        expect(activated).toEqual(['m2']);
    });
});

describe('createModelViewerAdapter — camera', () => {
    it('captures the camera view from the element', () => {
        const { adapter } = makeAdapter();
        expect(adapter.captureCamera()).toEqual({ orbit: '1rad 2rad 3m', target: '0m 0m 0m', fieldOfView: '40deg' });
    });

    it('returns an empty view when the element is not upgraded yet', () => {
        const wrapper = createWrapper();
        const modelViewer = createModelViewerStub(wrapper);
        modelViewer.getCameraOrbit = () => {
            throw new Error('not ready');
        };
        const adapter = createModelViewerAdapter(modelViewer, { markerLabel: () => 'x', onActivate: () => {} });
        expect(adapter.captureCamera()).toEqual({ orbit: '', target: '', fieldOfView: '' });
    });

    it('applies a stored camera view when focusing a marker', () => {
        const { adapter, modelViewer } = makeAdapter();
        const [marker] = markers();
        adapter.focusMarker({
            ...(marker as Marker),
            camera: { orbit: '1rad 1rad 5m', target: '1m 2m 3m', fieldOfView: '30deg' },
        });
        expect(modelViewer.cameraOrbit).toBe('1rad 1rad 5m');
        expect(modelViewer.cameraTarget).toBe('1m 2m 3m');
        expect(modelViewer.fieldOfView).toBe('30deg');
    });

    it('leaves the camera alone when the marker stored no view', () => {
        const { adapter, modelViewer } = makeAdapter();
        adapter.focusMarker(markers()[0] as Marker);
        expect(modelViewer.cameraOrbit).toBeUndefined();
    });

    it('updateOverlay is a no-op — model-viewer re-projects its own hotspots', () => {
        const { adapter } = makeAdapter();
        expect(() => adapter.updateOverlay()).not.toThrow();
    });
});

describe('createModelViewerAdapter — placement', () => {
    it('reports a placement built from positionAndNormalFromPoint', () => {
        const { adapter, modelViewer } = makeAdapter();
        const onPlaced = vi.fn();
        adapter.enterPlacementMode(onPlaced);
        modelViewer.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 20 }));
        expect(onPlaced).toHaveBeenCalledWith({
            position: { x: 1, y: 2, z: 3 },
            normal: { x: 0, y: 1, z: 0 },
            surface: '',
            camera: { orbit: '1rad 2rad 3m', target: '0m 0m 0m', fieldOfView: '40deg' },
        });
    });

    it('ignores a click that misses the model', () => {
        const { adapter, modelViewer } = makeAdapter();
        modelViewer.__hit = null;
        const onPlaced = vi.fn();
        adapter.enterPlacementMode(onPlaced);
        modelViewer.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).not.toHaveBeenCalled();
    });

    it('stops listening after exiting placement mode', () => {
        const { adapter, modelViewer } = makeAdapter();
        const onPlaced = vi.fn();
        adapter.enterPlacementMode(onPlaced);
        adapter.exitPlacementMode();
        modelViewer.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).not.toHaveBeenCalled();
        // Exiting twice is harmless.
        expect(() => adapter.exitPlacementMode()).not.toThrow();
    });
});

describe('createModelViewerAdapter — destroy', () => {
    it('removes the markers and the placement listener', () => {
        const { adapter, modelViewer } = makeAdapter();
        const onPlaced = vi.fn();
        adapter.renderMarkers(markers(), { showLabels: true, activeId: '' });
        adapter.enterPlacementMode(onPlaced);
        adapter.destroy();
        expect(modelViewer.querySelectorAll('.tdv-marker')).toHaveLength(0);
        modelViewer.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).not.toHaveBeenCalled();
    });
});
