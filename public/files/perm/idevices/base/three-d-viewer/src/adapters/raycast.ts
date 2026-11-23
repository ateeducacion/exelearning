/**
 * Pointer → model-surface raycasting for the STL render path.
 *
 * The hit point is returned in the mesh's LOCAL (normalized, centered) space
 * together with the object-space face normal. Both stay valid across camera
 * moves and auto-rotation because the mesh transform is reapplied at render
 * time — which is exactly what makes a marker anchor renderer-independent.
 */

import type { Vector3 } from '../shared/types';
import { pointerToNdc } from './geometry';

export interface RaycastTarget {
    mesh: ThreeObject3D | null;
    camera: ThreeCamera | null;
    canvas: HTMLCanvasElement | null;
}

export interface RaycastHit {
    position: Vector3;
    normal: Vector3;
}

/** Raycast a client-space pointer position against the instance mesh. */
export function raycastFromPointer(target: RaycastTarget, clientX: number, clientY: number): RaycastHit | null {
    const three = globalThis.THREE;
    if (!three || !target.mesh || !target.camera || !target.canvas) {
        return null;
    }
    const ndc = pointerToNdc(target.canvas.getBoundingClientRect(), clientX, clientY);
    if (!ndc) {
        return null;
    }
    const raycaster = new three.Raycaster();
    raycaster.setFromCamera(new three.Vector2(ndc.x, ndc.y), target.camera);
    const hit = raycaster.intersectObject(target.mesh, true)[0];
    if (!hit) {
        return null;
    }
    const local = target.mesh.worldToLocal(hit.point.clone());
    const faceNormal = hit.face?.normal;
    return {
        position: { x: local.x, y: local.y, z: local.z },
        normal: faceNormal ? { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z } : { x: 0, y: 1, z: 0 },
    };
}
