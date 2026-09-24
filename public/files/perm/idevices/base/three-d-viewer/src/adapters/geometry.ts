/**
 * Renderer-specific geometry, kept as pure functions so projection, occlusion
 * and pointer maths can be unit-tested with a small Three.js stub instead of a
 * live WebGL context.
 */

import type { Vector3 } from '../shared/types';

/**
 * A surface facing away from the camera hides its marker. The threshold is
 * slightly negative so a marker exactly on the silhouette stays visible instead
 * of flickering as the model turns.
 */
export const FACING_THRESHOLD = -0.15;

export interface ScreenPosition {
    x: number;
    y: number;
}

/** Normalized device coordinates as produced by `Vector3.project(camera)`. */
export interface NormalizedDeviceCoords {
    x: number;
    y: number;
    z: number;
}

/** Convert NDC to pixel coordinates inside a canvas of the given size. */
export function ndcToScreen(ndc: NormalizedDeviceCoords, width: number, height: number): ScreenPosition {
    return {
        x: (ndc.x * 0.5 + 0.5) * width,
        y: (-ndc.y * 0.5 + 0.5) * height,
    };
}

/** True when the projected point is inside the frustum and the viewport. */
export function isOnScreen(ndc: NormalizedDeviceCoords): boolean {
    const inFrustum = ndc.z < 1 && ndc.z > -1;
    return inFrustum && ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1;
}

/** True when a surface normal points towards the camera. */
export function isFacingCamera(normal: Vector3, toCamera: Vector3): boolean {
    return normal.x * toCamera.x + normal.y * toCamera.y + normal.z * toCamera.z > FACING_THRESHOLD;
}

/** Whether a marker at these coordinates should be shown. */
export function isMarkerVisible(ndc: NormalizedDeviceCoords, normal: Vector3, toCamera: Vector3): boolean {
    return isFacingCamera(normal, toCamera) && isOnScreen(ndc);
}

/** Parse an `"x y z"` triple, defaulting each missing component to 0. */
export function parseTriple(value: unknown): Vector3 {
    const parts = String(value ?? '')
        .trim()
        .split(/\s+/)
        .map(Number.parseFloat);
    return {
        x: Number.isFinite(parts[0]) ? (parts[0] as number) : 0,
        y: Number.isFinite(parts[1]) ? (parts[1] as number) : 0,
        z: Number.isFinite(parts[2]) ? (parts[2] as number) : 0,
    };
}

/** Format a vector as the `"x y z"` triple the hotspot API and storage use. */
export function formatTriple(vector: Vector3): string {
    return `${vector.x} ${vector.y} ${vector.z}`;
}

/** Pointer position converted to normalized device coordinates in an element. */
export function pointerToNdc(rect: DOMRect, clientX: number, clientY: number): ScreenPosition | null {
    if (!rect.width || !rect.height) {
        return null;
    }
    return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
}
