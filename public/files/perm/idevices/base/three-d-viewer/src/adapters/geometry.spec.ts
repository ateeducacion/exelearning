import { describe, expect, it } from 'vitest';
import {
    FACING_THRESHOLD,
    formatTriple,
    isFacingCamera,
    isMarkerVisible,
    isOnScreen,
    ndcToScreen,
    parseTriple,
    pointerToNdc,
} from './geometry';

describe('ndcToScreen', () => {
    it('maps the centre of the frustum to the centre of the canvas', () => {
        expect(ndcToScreen({ x: 0, y: 0, z: 0 }, 200, 100)).toEqual({ x: 100, y: 50 });
    });

    it('flips the Y axis, because screen space grows downwards', () => {
        expect(ndcToScreen({ x: -1, y: 1, z: 0 }, 200, 100)).toEqual({ x: 0, y: 0 });
        expect(ndcToScreen({ x: 1, y: -1, z: 0 }, 200, 100)).toEqual({ x: 200, y: 100 });
    });
});

describe('isOnScreen', () => {
    it('accepts a point inside the frustum and the viewport', () => {
        expect(isOnScreen({ x: 0, y: 0, z: 0 })).toBe(true);
    });

    it('rejects a point outside the viewport', () => {
        expect(isOnScreen({ x: 1.2, y: 0, z: 0 })).toBe(false);
        expect(isOnScreen({ x: 0, y: -1.5, z: 0 })).toBe(false);
    });

    it('rejects a point behind the camera or past the far plane', () => {
        expect(isOnScreen({ x: 0, y: 0, z: 1.1 })).toBe(false);
        expect(isOnScreen({ x: 0, y: 0, z: -1.1 })).toBe(false);
    });
});

describe('isFacingCamera', () => {
    it('is true for a normal pointing at the camera', () => {
        expect(isFacingCamera({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 })).toBe(true);
    });

    it('is false for a normal pointing away', () => {
        expect(isFacingCamera({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 })).toBe(false);
    });

    it('keeps a silhouette marker visible thanks to the negative threshold', () => {
        const justInside = FACING_THRESHOLD / 2;
        expect(isFacingCamera({ x: 0, y: 0, z: justInside }, { x: 0, y: 0, z: 1 })).toBe(true);
    });
});

describe('isMarkerVisible', () => {
    it('requires both facing and on-screen', () => {
        const toCamera = { x: 0, y: 0, z: 1 };
        expect(isMarkerVisible({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, toCamera)).toBe(true);
        expect(isMarkerVisible({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, toCamera)).toBe(false);
        expect(isMarkerVisible({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, toCamera)).toBe(false);
    });
});

describe('parseTriple / formatTriple', () => {
    it('parses an "x y z" string', () => {
        expect(parseTriple('1 -2.5 3')).toEqual({ x: 1, y: -2.5, z: 3 });
    });

    it('defaults missing or unparsable components to zero', () => {
        expect(parseTriple('1')).toEqual({ x: 1, y: 0, z: 0 });
        expect(parseTriple('')).toEqual({ x: 0, y: 0, z: 0 });
        expect(parseTriple(undefined)).toEqual({ x: 0, y: 0, z: 0 });
        expect(parseTriple('a b c')).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('round-trips through formatTriple', () => {
        const vector = { x: 1, y: -2.5, z: 3 };
        expect(parseTriple(formatTriple(vector))).toEqual(vector);
    });
});

describe('pointerToNdc', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 } as DOMRect;

    it('maps the centre of the element to the origin', () => {
        expect(pointerToNdc(rect, 110, 70)).toEqual({ x: 0, y: 0 });
    });

    it('maps the corners to the frustum bounds', () => {
        expect(pointerToNdc(rect, 10, 20)).toEqual({ x: -1, y: 1 });
        expect(pointerToNdc(rect, 210, 120)).toEqual({ x: 1, y: -1 });
    });

    it('returns null for a zero-sized element', () => {
        expect(pointerToNdc({ left: 0, top: 0, width: 0, height: 0 } as DOMRect, 5, 5)).toBeNull();
    });
});
