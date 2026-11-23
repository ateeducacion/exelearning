import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStubInstance, createWrapper, resetDom } from '../test/helpers';
import { installThreeStub, StubObject3D } from '../test/three-stub';
import {
    addFrameCallback,
    createInstance,
    disposeInstance,
    disposeMaterial,
    disposeObject3D,
    removeFrameCallback,
    trackListener,
} from './lifecycle';
import type { ViewerOptions } from './types';

const OPTIONS: ViewerOptions = {
    src: 'asset://a.stl',
    type: 'stl',
    modelColor: '#888888',
    backgroundColor: '#f5f5f5',
    cameraControls: true,
    autoRotate: false,
    autoRotateSpeed: 30,
};

let restoreThree: () => void;

beforeEach(() => {
    restoreThree = installThreeStub();
});

afterEach(() => {
    restoreThree();
    resetDom();
    vi.restoreAllMocks();
});

describe('createInstance', () => {
    it('derives the type from the source when none is given', () => {
        const wrapper = createWrapper();
        const instance = createInstance(wrapper, { ...OPTIONS, type: '', src: 'a.glb' });
        expect(instance.type).toBe('glb');
    });

    it('starts with empty resource collections', () => {
        const instance = createInstance(createWrapper(), OPTIONS);
        expect(instance.listeners).toEqual([]);
        expect(instance.onFrame).toEqual([]);
        expect(instance.objectURLs).toEqual([]);
        expect(instance.interaction).toBeNull();
    });
});

describe('frame callbacks', () => {
    it('registers a callback once and removes it again', () => {
        const instance = createInstance(createWrapper(), OPTIONS);
        const callback = (): void => {};
        addFrameCallback(instance, callback);
        addFrameCallback(instance, callback);
        expect(instance.onFrame).toHaveLength(1);
        removeFrameCallback(instance, callback);
        expect(instance.onFrame).toHaveLength(0);
        // Removing an unregistered callback is a no-op.
        removeFrameCallback(instance, callback);
        expect(instance.onFrame).toHaveLength(0);
    });
});

describe('disposeMaterial', () => {
    it('tolerates nullish input', () => {
        expect(() => disposeMaterial(null)).not.toThrow();
        expect(() => disposeMaterial(undefined)).not.toThrow();
    });

    it('disposes the material and its texture-shaped fields', () => {
        const texture = { isTexture: true, dispose: vi.fn() };
        const material = { map: texture, notATexture: { dispose: vi.fn() }, dispose: vi.fn() };
        disposeMaterial(material);
        expect(texture.dispose).toHaveBeenCalledTimes(1);
        expect(material.dispose).toHaveBeenCalledTimes(1);
        expect(material.notATexture.dispose).not.toHaveBeenCalled();
    });

    it('handles arrays of materials', () => {
        const first = { dispose: vi.fn() };
        const second = { dispose: vi.fn() };
        disposeMaterial([first, null, second]);
        expect(first.dispose).toHaveBeenCalledTimes(1);
        expect(second.dispose).toHaveBeenCalledTimes(1);
    });
});

describe('disposeObject3D', () => {
    it('is a no-op for values without traverse', () => {
        expect(() => disposeObject3D(null)).not.toThrow();
        expect(() => disposeObject3D({})).not.toThrow();
    });

    it('disposes geometries and materials across the subtree', () => {
        const root = new StubObject3D();
        const child = new StubObject3D();
        root.children.push(child);
        const geometry = { dispose: vi.fn() };
        const material = { dispose: vi.fn() };
        child.geometry = geometry;
        child.material = material;
        disposeObject3D(root);
        expect(geometry.dispose).toHaveBeenCalledTimes(1);
        expect(material.dispose).toHaveBeenCalledTimes(1);
    });
});

describe('disposeInstance', () => {
    it('cancels the animation frame, removes listeners and drops the interaction layer', () => {
        const wrapper = createWrapper();
        const instance = createStubInstance(wrapper);
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
        const handler = vi.fn();
        const target = document.createElement('button');
        trackListener(instance, target, 'click', handler);
        instance.rafId = 7;
        const destroy = vi.fn();
        instance.interaction = { destroy } as unknown as typeof instance.interaction;

        disposeInstance(instance);

        expect(destroy).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith(7);
        expect(instance.rafId).toBeNull();
        expect(instance.listeners).toEqual([]);
        target.dispatchEvent(new Event('click'));
        expect(handler).not.toHaveBeenCalled();
        expect(instance.stopped).toBe(true);
    });

    it('disposes GPU resources and revokes the object URLs it tracked', () => {
        const instance = createStubInstance(createWrapper());
        const geometry = { dispose: vi.fn() };
        const controls = { dispose: vi.fn(), target: { x: 0, y: 0, z: 0 } };
        const renderer = { dispose: vi.fn() };
        instance.geometry = geometry as unknown as ThreeGeometry;
        instance.material = { dispose: vi.fn() };
        instance.controls = controls as unknown as ThreeOrbitControls;
        instance.renderer = renderer as unknown as ThreeRenderer;
        instance.objectURLs.push('blob:one', 'blob:two');
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        disposeInstance(instance);

        expect(geometry.dispose).toHaveBeenCalledTimes(1);
        expect(controls.dispose).toHaveBeenCalledTimes(1);
        expect(renderer.dispose).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledTimes(2);
        expect(instance.objectURLs).toEqual([]);
        expect(instance.renderer).toBeNull();
    });

    it('survives a disposer that throws', () => {
        const instance = createStubInstance(createWrapper());
        instance.interaction = {
            destroy: () => {
                throw new Error('boom');
            },
        } as unknown as typeof instance.interaction;
        instance.renderer = {
            dispose: () => {
                throw new Error('context lost');
            },
        } as unknown as ThreeRenderer;
        expect(() => disposeInstance(instance)).not.toThrow();
        expect(instance.interaction).toBeNull();
    });
});
