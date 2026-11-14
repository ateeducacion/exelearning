import { describe, expect, it } from 'vitest';
import {
    clamp,
    clientToFlatPercent,
    clientToNdc,
    containedImageRect,
    directionToYawPitch,
    flatPercentToPosition,
    ndcToScreen,
    toFiniteNumber,
    yawPitchToDirection,
} from './geometry';

describe('clamp / toFiniteNumber', () => {
    it('clamps below, inside and above the range', () => {
        expect(clamp(-181, -180, 180)).toBe(-180);
        expect(clamp(0, -180, 180)).toBe(0);
        expect(clamp(181, -180, 180)).toBe(180);
        expect(clamp(-180, -180, 180)).toBe(-180);
        expect(clamp(180, -180, 180)).toBe(180);
    });

    it('parses numbers and strings, falling back on garbage', () => {
        expect(toFiniteNumber(3, 0)).toBe(3);
        expect(toFiniteNumber('4.5', 0)).toBe(4.5);
        expect(toFiniteNumber('nope', 7)).toBe(7);
        expect(toFiniteNumber(Number.NaN, 7)).toBe(7);
        expect(toFiniteNumber(Number.POSITIVE_INFINITY, 7)).toBe(7);
        expect(toFiniteNumber(undefined, 7)).toBe(7);
        expect(toFiniteNumber(null, 7)).toBe(7);
        expect(toFiniteNumber({}, 7)).toBe(7);
    });
});

describe('containedImageRect', () => {
    it('letterboxes a wide image horizontally centred (bars top/bottom)', () => {
        // 2000x1000 image in a 400x400 box → 400x200 centred vertically.
        expect(containedImageRect(2000, 1000, 400, 400)).toEqual({ left: 0, top: 100, width: 400, height: 200 });
    });

    it('letterboxes a tall image vertically centred (bars left/right)', () => {
        // 1000x2000 image in a 400x400 box → 200x400 centred horizontally.
        expect(containedImageRect(1000, 2000, 400, 400)).toEqual({ left: 100, top: 0, width: 200, height: 400 });
    });

    it('fills the box exactly when aspect ratios match', () => {
        expect(containedImageRect(800, 400, 400, 200)).toEqual({ left: 0, top: 0, width: 400, height: 200 });
    });

    it('falls back to the full box when natural dimensions are unavailable', () => {
        expect(containedImageRect(0, 0, 400, 300)).toEqual({ left: 0, top: 0, width: 400, height: 300 });
        expect(containedImageRect(100, 0, 400, 300)).toEqual({ left: 0, top: 0, width: 400, height: 300 });
        expect(containedImageRect(0, 100, 400, 300)).toEqual({ left: 0, top: 0, width: 400, height: 300 });
    });

    it('reports zeroed box dimensions instead of NaN when the box is empty', () => {
        expect(containedImageRect(100, 100, 0, 0)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    });
});

describe('yaw/pitch ↔ direction', () => {
    it('maps the cardinal directions', () => {
        const forward = yawPitchToDirection(0, 0);
        expect(forward.x).toBeCloseTo(0);
        expect(forward.y).toBeCloseTo(0);
        expect(forward.z).toBeCloseTo(1);

        const right = yawPitchToDirection(90, 0);
        expect(right.x).toBeCloseTo(1);
        expect(right.z).toBeCloseTo(0);

        const up = yawPitchToDirection(0, 90);
        expect(up.y).toBeCloseTo(1);
    });

    it('round-trips through directionToYawPitch', () => {
        for (const [yaw, pitch] of [
            [0, 0],
            [45, 10],
            [-120, -45],
            [179, 89],
            [-179, -89],
        ] as const) {
            const back = directionToYawPitch(yawPitchToDirection(yaw, pitch));
            expect(back.yaw).toBeCloseTo(yaw, 5);
            expect(back.pitch).toBeCloseTo(pitch, 5);
        }
    });

    it('normalizes non-unit vectors and clamps degenerate input', () => {
        expect(directionToYawPitch({ x: 0, y: 10, z: 0 }).pitch).toBeCloseTo(90);
        // Zero vector: length falls back to 1, all components 0 → yaw 0, pitch 0.
        expect(directionToYawPitch({ x: 0, y: 0, z: 0 })).toEqual({ yaw: 0, pitch: 0 });
    });
});

describe('clientToNdc / ndcToScreen', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 };

    it('maps the corners and centre of the rect', () => {
        expect(clientToNdc(rect, 100, 50)).toEqual({ x: -1, y: 1 });
        expect(clientToNdc(rect, 300, 150)).toEqual({ x: 1, y: -1 });
        expect(clientToNdc(rect, 200, 100)).toEqual({ x: 0, y: 0 });
    });

    it('returns null for an empty rect', () => {
        expect(clientToNdc({ left: 0, top: 0, width: 0, height: 100 }, 0, 0)).toBeNull();
        expect(clientToNdc({ left: 0, top: 0, width: 100, height: 0 }, 0, 0)).toBeNull();
    });

    it('ndcToScreen is the inverse of clientToNdc (relative to the box)', () => {
        expect(ndcToScreen(0, 0, 200, 100)).toEqual({ x: 100, y: 50 });
        expect(ndcToScreen(-1, 1, 200, 100)).toEqual({ x: 0, y: 0 });
        expect(ndcToScreen(1, -1, 200, 100)).toEqual({ x: 200, y: 100 });
    });
});

describe('clientToFlatPercent', () => {
    const box = { left: 0, top: 0, width: 400, height: 400 };
    // A wide image contained in the square box: 400x200 at top=100.
    const image = containedImageRect(2000, 1000, 400, 400);

    it('maps clicks inside the contained image to percentages', () => {
        expect(clientToFlatPercent(box, image, 0, 100)).toEqual({ x: 0, y: 0 });
        expect(clientToFlatPercent(box, image, 400, 300)).toEqual({ x: 100, y: 100 });
        expect(clientToFlatPercent(box, image, 200, 200)).toEqual({ x: 50, y: 50 });
    });

    it('ignores clicks on the letterbox bars (outside the image)', () => {
        expect(clientToFlatPercent(box, image, 200, 50)).toBeNull(); // top bar
        expect(clientToFlatPercent(box, image, 200, 350)).toBeNull(); // bottom bar
    });

    it('accounts for the box offset in the page', () => {
        const offsetBox = { left: 100, top: 50, width: 400, height: 400 };
        expect(clientToFlatPercent(offsetBox, image, 300, 250)).toEqual({ x: 50, y: 50 });
    });

    it('returns null when the box or image rect is empty', () => {
        expect(clientToFlatPercent({ ...box, width: 0 }, image, 0, 0)).toBeNull();
        expect(clientToFlatPercent(box, { ...image, width: 0 }, 0, 0)).toBeNull();
    });

    it('accepts the exact boundary values', () => {
        expect(clientToFlatPercent(box, image, 0, 100)).toEqual({ x: 0, y: 0 });
        expect(clientToFlatPercent(box, image, 400, 300)).toEqual({ x: 100, y: 100 });
        // 1px beyond the edge is outside.
        expect(clientToFlatPercent(box, image, 401, 200)).toBeNull();
        expect(clientToFlatPercent(box, image, 200, 99)).toBeNull();
    });
});

describe('flatPercentToPosition', () => {
    const image = { left: 0, top: 100, width: 400, height: 200 };

    it('is the inverse of clientToFlatPercent for in-image points', () => {
        expect(flatPercentToPosition(image, 0, 0)).toEqual({ x: 0, y: 100 });
        expect(flatPercentToPosition(image, 100, 100)).toEqual({ x: 400, y: 300 });
        expect(flatPercentToPosition(image, 50, 50)).toEqual({ x: 200, y: 200 });
    });

    it('clamps out-of-range percentages', () => {
        expect(flatPercentToPosition(image, -20, 140)).toEqual({ x: 0, y: 300 });
    });
});
