/**
 * A `<model-viewer>` stand-in for unit tests.
 *
 * happy-dom will not register the real custom element (it needs WebGL), so the
 * stub is an ordinary element carrying the handful of members the adapter and
 * the export controller call.
 */

export interface ModelViewerStub extends ModelViewerElement {
    /** The camera view `captureCamera()` should report. */
    __camera: { orbit: string; target: string; fieldOfView: number };
    /** The hit `positionAndNormalFromPoint()` should return, or null. */
    __hit: { position: string; normal: string } | null;
    /** Whether `jumpCameraToGoal()` was called. */
    __jumped: boolean;
    __played: boolean;
    __paused: boolean;
}

/** Create a stub `<model-viewer>`, optionally appended to a parent. */
export function createModelViewerStub(parent?: HTMLElement): ModelViewerStub {
    const element = document.createElement('model-viewer') as ModelViewerStub;
    element.__camera = { orbit: '1rad 2rad 3m', target: '0m 0m 0m', fieldOfView: 40 };
    element.__hit = { position: '1 2 3', normal: '0 1 0' };
    element.__jumped = false;
    element.__played = false;
    element.__paused = false;
    element.availableAnimations = [];
    element.getCameraOrbit = () => ({
        theta: 1,
        phi: 2,
        radius: 3,
        toString: () => element.__camera.orbit,
    });
    element.getCameraTarget = () => ({ toString: () => element.__camera.target });
    element.getFieldOfView = () => element.__camera.fieldOfView;
    element.jumpCameraToGoal = () => {
        element.__jumped = true;
    };
    element.play = () => {
        element.__played = true;
    };
    element.pause = () => {
        element.__paused = true;
    };
    element.positionAndNormalFromPoint = () =>
        element.__hit
            ? {
                  position: { toString: () => element.__hit?.position ?? '' },
                  normal: { toString: () => element.__hit?.normal ?? '' },
              }
            : null;
    parent?.appendChild(element);
    return element;
}
