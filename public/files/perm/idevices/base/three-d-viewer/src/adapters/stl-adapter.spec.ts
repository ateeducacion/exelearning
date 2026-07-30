import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerInstance } from '../runtime/types';
import { createStubInstance, createWrapper, makeMarker, resetDom, sequentialIds } from '../test/helpers';
import { installThreeStub, raycastHits, StubVector3 } from '../test/three-stub';
import type { Marker } from '../shared/types';
import { createStlAdapter } from './stl-adapter';

let restoreThree: () => void;

beforeEach(() => {
    restoreThree = installThreeStub();
    raycastHits.length = 0;
});

afterEach(() => {
    restoreThree();
    raycastHits.length = 0;
    resetDom();
});

function markerAt(x: number, y: number, z: number, normal = { x: 0, y: 0, z: 1 }, id = 'm1'): Marker {
    return makeMarker({ id, label: `Marker ${id}`, anchor: { position: { x, y, z }, normal } }, 0, sequentialIds());
}

function setup(): {
    wrapper: HTMLElement;
    instance: ViewerInstance;
    adapter: ReturnType<typeof createStlAdapter>;
    activated: string[];
} {
    const wrapper = createWrapper();
    const instance = createStubInstance(wrapper);
    const activated: string[] = [];
    const adapter = createStlAdapter(instance, wrapper, {
        markerLabel: marker => marker.label,
        onActivate: id => activated.push(id),
    });
    return { wrapper, instance, adapter, activated };
}

describe('createStlAdapter — overlay', () => {
    it('creates a marker layer and renders accessible buttons into it', () => {
        const { wrapper, adapter } = setup();
        adapter.renderMarkers([markerAt(0, 0, 0)], { showLabels: true, activeId: '' });
        const layer = wrapper.querySelector('.tdv-marker-layer');
        expect(layer).not.toBeNull();
        const button = layer?.querySelector<HTMLButtonElement>('.tdv-marker--stl');
        expect(button?.getAttribute('aria-label')).toBe('Marker m1');
    });

    it('projects a marker onto the canvas in pixels', () => {
        const { wrapper, adapter } = setup();
        adapter.renderMarkers([markerAt(0, 0, 0)], { showLabels: true, activeId: '' });
        const button = wrapper.querySelector<HTMLElement>('.tdv-marker--stl');
        // Canvas is 200x100 in the stub, so NDC (0,0) is the centre.
        expect(button?.style.left).toBe('100px');
        expect(button?.style.top).toBe('50px');
        expect(button?.classList.contains('tdv-marker--hidden')).toBe(false);
    });

    it('hides a marker whose surface faces away from the camera', () => {
        const { wrapper, adapter } = setup();
        adapter.renderMarkers([markerAt(0, 0, 0, { x: 0, y: 0, z: -1 })], { showLabels: true, activeId: '' });
        const button = wrapper.querySelector<HTMLElement>('.tdv-marker--stl');
        expect(button?.classList.contains('tdv-marker--hidden')).toBe(true);
        expect(button?.getAttribute('aria-hidden')).toBe('true');
        expect(button?.getAttribute('tabindex')).toBe('-1');
    });

    it('hides a marker projected outside the viewport', () => {
        const { wrapper, adapter } = setup();
        adapter.renderMarkers([markerAt(5, 0, 0)], { showLabels: true, activeId: '' });
        expect(wrapper.querySelector('.tdv-marker--stl')?.classList.contains('tdv-marker--hidden')).toBe(true);
    });

    it('re-runs the projection when the camera moves', () => {
        const { instance, wrapper, adapter } = setup();
        adapter.renderMarkers([markerAt(0, 0, 0)], { showLabels: true, activeId: '' });
        const button = wrapper.querySelector<HTMLElement>('.tdv-marker--stl');
        // Move the mesh so the marker projects to a different point.
        (instance.mesh as unknown as { offset: StubVector3 }).offset = new StubVector3(0.5, 0, 0);
        adapter.updateOverlay();
        expect(button?.style.left).toBe('150px');
    });

    it('drives its projection off the viewer animation loop, not a second one', () => {
        const { instance } = setup();
        expect(instance.onFrame).toHaveLength(1);
    });

    it('is inert without markers or without a mesh', () => {
        const { instance, adapter } = setup();
        expect(() => adapter.updateOverlay()).not.toThrow();
        adapter.renderMarkers([markerAt(0, 0, 0)], { showLabels: true, activeId: '' });
        instance.mesh = null;
        expect(() => adapter.updateOverlay()).not.toThrow();
    });
});

describe('createStlAdapter — active marker and activation', () => {
    it('flags the active marker and moves the flag', () => {
        const { wrapper, adapter } = setup();
        adapter.renderMarkers([markerAt(0, 0, 0, { x: 0, y: 0, z: 1 }, 'm1')], { showLabels: true, activeId: 'm1' });
        expect(wrapper.querySelector('[data-marker-id="m1"]')?.getAttribute('aria-current')).toBe('true');
        adapter.setActive('');
        expect(wrapper.querySelector('[data-marker-id="m1"]')?.hasAttribute('aria-current')).toBe(false);
    });

    it('activates a marker on click', () => {
        const { wrapper, adapter, activated } = setup();
        adapter.renderMarkers([markerAt(0, 0, 0)], { showLabels: true, activeId: '' });
        wrapper.querySelector<HTMLButtonElement>('.tdv-marker--stl')?.click();
        expect(activated).toEqual(['m1']);
    });
});

describe('createStlAdapter — camera', () => {
    it('captures the camera position, the controls target and the field of view', () => {
        const { instance, adapter } = setup();
        instance.controls = { target: new StubVector3(1, 2, 3) } as unknown as ThreeOrbitControls;
        expect(adapter.captureCamera()).toEqual({ orbit: '0 0 3', target: '1 2 3', fieldOfView: '45deg' });
    });

    it('falls back to the origin target and an empty view without a camera', () => {
        const { instance, adapter } = setup();
        expect(adapter.captureCamera().target).toBe('0 0 0');
        instance.camera = null;
        expect(adapter.captureCamera()).toEqual({ orbit: '', target: '', fieldOfView: '' });
    });

    it('restores a stored camera view, driving the controls when present', () => {
        const { instance, adapter } = setup();
        const controls = { target: new StubVector3(), update: vi.fn() };
        instance.controls = controls as unknown as ThreeOrbitControls;
        adapter.focusMarker({
            ...markerAt(0, 0, 0),
            camera: { orbit: '4 5 6', target: '7 8 9', fieldOfView: '' },
        });
        expect(instance.camera?.position).toMatchObject({ x: 4, y: 5, z: 6 });
        expect(controls.target).toMatchObject({ x: 7, y: 8, z: 9 });
        expect(controls.update).toHaveBeenCalled();
    });

    it('looks at the target directly when there are no controls', () => {
        const { instance, adapter } = setup();
        adapter.focusMarker({ ...markerAt(0, 0, 0), camera: { orbit: '', target: '7 8 9', fieldOfView: '' } });
        expect((instance.camera as unknown as { lookedAt: number[] }).lookedAt).toEqual([7, 8, 9]);
    });

    it('does nothing when the marker stored no camera view', () => {
        const { instance, adapter } = setup();
        adapter.focusMarker(markerAt(0, 0, 0));
        expect(instance.camera?.position).toMatchObject({ x: 0, y: 0, z: 3 });
    });
});

describe('createStlAdapter — placement', () => {
    it('reports a placement from a canvas click', () => {
        const { instance, adapter } = setup();
        raycastHits.push({ point: new StubVector3(1, 1, 1), face: { normal: new StubVector3(0, 1, 0) } });
        const onPlaced = vi.fn();
        adapter.enterPlacementMode(onPlaced);
        instance.canvas?.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 50 }));
        expect(onPlaced).toHaveBeenCalledWith({
            position: { x: 1, y: 1, z: 1 },
            normal: { x: 0, y: 1, z: 0 },
            surface: '',
            camera: { orbit: '0 0 3', target: '0 0 0', fieldOfView: '45deg' },
        });
    });

    it('ignores a click that misses the mesh, and stops after exiting', () => {
        const { instance, adapter } = setup();
        const onPlaced = vi.fn();
        adapter.enterPlacementMode(onPlaced);
        instance.canvas?.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).not.toHaveBeenCalled();

        raycastHits.push({ point: new StubVector3(), face: null });
        adapter.exitPlacementMode();
        instance.canvas?.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).not.toHaveBeenCalled();
    });

    it('does nothing without a canvas', () => {
        const { instance, adapter } = setup();
        instance.canvas = null;
        expect(() => adapter.enterPlacementMode(vi.fn())).not.toThrow();
    });
});

describe('createStlAdapter — destroy', () => {
    it('removes the overlay, the frame callback and the placement listener', () => {
        const { wrapper, instance, adapter } = setup();
        adapter.renderMarkers([markerAt(0, 0, 0)], { showLabels: true, activeId: '' });
        const onPlaced = vi.fn();
        adapter.enterPlacementMode(onPlaced);

        adapter.destroy();

        expect(wrapper.querySelector('.tdv-marker-layer')).toBeNull();
        expect(instance.onFrame).toHaveLength(0);
        raycastHits.push({ point: new StubVector3(), face: null });
        instance.canvas?.dispatchEvent(new MouseEvent('click'));
        expect(onPlaced).not.toHaveBeenCalled();
    });
});
