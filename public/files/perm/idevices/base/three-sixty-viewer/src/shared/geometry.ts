/**
 * Pure geometry shared by the edition preview and the export runtime, so both
 * agree on the same coordinate basis:
 *
 *  - yaw/pitch (degrees) ↔ unit direction vectors for equirectangular scenes;
 *  - percent x/y inside the letterbox-aware `object-fit: contain` rectangle
 *    for flat scenes.
 *
 * Everything here is DOM- and WebGL-free and fully unit-testable.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export interface Rect {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export interface YawPitch {
    readonly yaw: number;
    readonly pitch: number;
}

export interface PercentPoint {
    readonly x: number;
    readonly y: number;
}

/** Clamp `value` into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/** Parse a finite number out of unknown input, or return `fallback`. */
export function toFiniteNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Rectangle an `object-fit: contain` image occupies inside a box (letterbox
 * aware). Falls back to the full box when natural dimensions are unknown
 * (image not decoded yet, or DOM-less tests).
 */
export function containedImageRect(naturalW: number, naturalH: number, boxW: number, boxH: number): Rect {
    if (!naturalW || !naturalH || !boxW || !boxH) {
        return { left: 0, top: 0, width: boxW || 0, height: boxH || 0 };
    }
    const scale = Math.min(boxW / naturalW, boxH / naturalH);
    const width = naturalW * scale;
    const height = naturalH * scale;
    return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

/** Unit direction vector for a yaw/pitch pair (degrees). */
export function yawPitchToDirection(yaw: number, pitch: number): Vec3 {
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    return {
        x: Math.sin(yawRad) * Math.cos(pitchRad),
        y: Math.sin(pitchRad),
        z: Math.cos(yawRad) * Math.cos(pitchRad),
    };
}

/** Yaw/pitch (degrees, clamped to valid ranges) for a direction vector. */
export function directionToYawPitch(direction: Vec3): YawPitch {
    const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2) || 1;
    const x = direction.x / length;
    const y = direction.y / length;
    const z = direction.z / length;
    const yaw = (Math.atan2(x, z) * 180) / Math.PI;
    const pitch = (Math.asin(clamp(y, -1, 1)) * 180) / Math.PI;
    return { yaw: clamp(yaw, -180, 180), pitch: clamp(pitch, -90, 90) };
}

/** Client coordinates → normalized device coordinates (-1…1) inside a rect. */
export function clientToNdc(rect: Rect, clientX: number, clientY: number): { x: number; y: number } | null {
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
}

/** Projected NDC (-1…1) → pixel offsets inside a box of `width`×`height`. */
export function ndcToScreen(ndcX: number, ndcY: number, width: number, height: number): { x: number; y: number } {
    return {
        x: ((ndcX + 1) / 2) * width,
        y: (1 - (ndcY + 1) / 2) * height,
    };
}

/**
 * Convert a click inside a flat-scene box into x/y percent of the CONTAINED
 * image rectangle. Returns null when the click lands on the letterbox bars or
 * outside the image, so callers can ignore it instead of snapping the hotspot
 * to an edge.
 */
export function clientToFlatPercent(
    boxRect: Rect,
    imageRect: Rect,
    clientX: number,
    clientY: number,
): PercentPoint | null {
    if (boxRect.width <= 0 || boxRect.height <= 0) return null;
    if (imageRect.width <= 0 || imageRect.height <= 0) return null;
    const x = ((clientX - boxRect.left - imageRect.left) / imageRect.width) * 100;
    const y = ((clientY - boxRect.top - imageRect.top) / imageRect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
}

/**
 * Inverse of {@link clientToFlatPercent}: pixel position (relative to the box)
 * of an x/y percent point inside the contained image rectangle.
 */
export function flatPercentToPosition(imageRect: Rect, x: number, y: number): { x: number; y: number } {
    return {
        x: imageRect.left + (clamp(x, 0, 100) / 100) * imageRect.width,
        y: imageRect.top + (clamp(y, 0, 100) / 100) * imageRect.height,
    };
}
