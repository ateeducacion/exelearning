import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStubInstance, createWrapper, resetDom } from '../test/helpers';
import { installThreeStub, raycastHits, StubObject3D, StubVector3 } from '../test/three-stub';
import { raycastFromPointer } from './raycast';

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

describe('raycastFromPointer', () => {
    it('returns the hit point in mesh-local space plus the face normal', () => {
        const instance = createStubInstance(createWrapper());
        // The stub mesh sits one unit up, so world (2,3,4) is local (2,2,4).
        (instance.mesh as unknown as StubObject3D).offset = new StubVector3(0, 1, 0);
        raycastHits.push({ point: new StubVector3(2, 3, 4), face: { normal: new StubVector3(0, 0, 1) } });

        expect(raycastFromPointer(instance, 100, 50)).toEqual({
            position: { x: 2, y: 2, z: 4 },
            normal: { x: 0, y: 0, z: 1 },
        });
    });

    it('falls back to an up-facing normal when the hit has no face', () => {
        const instance = createStubInstance(createWrapper());
        raycastHits.push({ point: new StubVector3(1, 1, 1), face: null });
        expect(raycastFromPointer(instance, 100, 50)?.normal).toEqual({ x: 0, y: 1, z: 0 });
    });

    it('returns null when nothing was hit', () => {
        const instance = createStubInstance(createWrapper());
        expect(raycastFromPointer(instance, 100, 50)).toBeNull();
    });

    it('returns null without THREE, a mesh, a camera or a canvas', () => {
        const instance = createStubInstance(createWrapper());
        raycastHits.push({ point: new StubVector3(), face: null });

        restoreThree();
        expect(raycastFromPointer(instance, 1, 1)).toBeNull();
        restoreThree = installThreeStub();

        expect(raycastFromPointer({ ...instance, mesh: null }, 1, 1)).toBeNull();
        expect(raycastFromPointer({ ...instance, camera: null }, 1, 1)).toBeNull();
        expect(raycastFromPointer({ ...instance, canvas: null }, 1, 1)).toBeNull();
    });

    it('returns null for a zero-sized canvas', () => {
        const instance = createStubInstance(createWrapper());
        raycastHits.push({ point: new StubVector3(), face: null });
        const canvas = instance.canvas as HTMLCanvasElement;
        canvas.getBoundingClientRect = () =>
            ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        expect(raycastFromPointer(instance, 1, 1)).toBeNull();
    });
});
