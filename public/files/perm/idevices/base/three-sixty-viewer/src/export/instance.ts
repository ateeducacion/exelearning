/**
 * One running viewer instance per iDevice node. Each instance owns ALL of its
 * runtime state — scene controller, renderers, hotspot layer, controls,
 * animation frame, resize handling, modal — and `destroy()` releases every
 * one of them. Multiple instances on the same page never share state.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { Rect } from '../shared/geometry';
import { findSceneById, getStartScene } from '../shared/normalization';
import type { Hotspot, ThreeSixtyDocumentV2 } from '../shared/types';
import { resolveAssetSrc } from '../viewer/assets';
import { blockNativeDragInside, captureDragEvents, createFullscreenButton, createNavControls } from '../viewer/controls';
import { createFlatImageRenderer } from '../viewer/flat-image-renderer';
import { createHotspotLayer } from '../viewer/hotspot-renderer';
import { createDisposerBag, createRenderLoop, defaultFrameScheduler, prefersReducedMotion } from '../viewer/lifecycle';
import type { FrameScheduler } from '../viewer/lifecycle';
import { createPanoramaRenderer } from '../viewer/panorama-renderer';
import { createSceneController } from '../viewer/scene-controller';
import type { ThreeNamespace } from '../viewer/types';
import { activateHotspot, defaultHotspotLabel } from './actions';
import { openContentModal } from './modal';
import type { ContentModal } from './modal';

export interface ThreeSixtyInstance {
    readonly wrapper: HTMLElement;
    start: () => void;
    goToScene: (sceneId: string) => void;
    destroy: () => void;
}

export interface InstanceDeps {
    readonly three: ThreeNamespace;
    readonly resolveSrc?: (src: string) => string;
    readonly scheduler?: FrameScheduler;
    readonly reducedMotion?: boolean;
}

function wrapperRect(wrapper: HTMLElement): Rect {
    const rect = wrapper.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function createInstance(
    wrapper: HTMLElement,
    document360: ThreeSixtyDocumentV2,
    deps: InstanceDeps,
): ThreeSixtyInstance {
    const resolveSrc = deps.resolveSrc ?? resolveAssetSrc;
    const disposers = createDisposerBag();
    const startScene = getStartScene(document360);
    const reducedMotion = deps.reducedMotion ?? prefersReducedMotion();

    const width = Math.max(wrapper.clientWidth || 640, 1);
    const height = Math.max(wrapper.clientHeight || 360, 1);

    const behaviour = document360.behaviour;
    const panorama = createPanoramaRenderer({
        three: deps.three,
        initialFov: startScene?.initialView.fov ?? 75,
        width,
        height,
        zoomEnabled: behaviour.zoomEnabled,
        // Honour prefers-reduced-motion: never auto-rotate for those users.
        autorotate: { enabled: behaviour.autorotate.enabled && !reducedMotion, speed: behaviour.autorotate.speed },
    });
    disposers.add(() => panorama.dispose());
    panorama.canvas.setAttribute('tabindex', '0');
    wrapper.appendChild(panorama.canvas);
    captureDragEvents(panorama.canvas);

    const flat = createFlatImageRenderer(wrapper, 'three-sixty-viewer-flat-image');
    flat.image.alt = startScene?.alt ?? '';
    disposers.add(() => flat.dispose());

    const controller = createSceneController({
        panorama,
        flat,
        resolveSrc,
        hostRect: () => wrapperRect(wrapper),
    });

    let modal: ContentModal | null = null;
    const closeModal = (): void => {
        modal?.close();
        modal = null;
    };
    disposers.add(closeModal);

    const sceneLabel = (scene: { alt: string; projection: string }): string =>
        scene.alt || (scene.projection === 'flat' ? 'image' : '360° panorama');

    const goToScene = (sceneId: string): void => {
        const scene = findSceneById(document360, sceneId);
        if (!scene || controller.currentSceneId === sceneId) return;
        closeModal();
        controller.applyScene(scene);
        hotspots.setHotspots(scene.hotspots);
        wrapper.setAttribute('aria-label', sceneLabel(scene));
    };

    const hotspots = createHotspotLayer(wrapper, {
        showLabels: behaviour.showLabels,
        labelPosition: behaviour.labelPosition,
        fallbackLabel: defaultHotspotLabel,
        onActivate: (hotspot: Hotspot, button) => {
            activateHotspot(hotspot, button, {
                goToScene,
                openModal: (target, trigger) => {
                    closeModal();
                    modal = openContentModal(wrapper, target, trigger, {
                        resolveSrc,
                        fallbackLabel: defaultHotspotLabel,
                        onClose: () => {
                            modal = null;
                        },
                    });
                },
            });
        },
    });
    disposers.add(() => hotspots.dispose());

    const loop = createRenderLoop(() => {
        if (controller.needsFrameRender()) {
            panorama.renderFrame();
        }
        hotspots.positionAll(hotspot => controller.positionFor(hotspot));
    }, deps.scheduler ?? defaultFrameScheduler());
    disposers.add(() => loop.stop());

    // Resize wiring: observer when available, window resize always.
    const handleResize = (): void => {
        const box = wrapperRect(wrapper);
        if (box.width < 1 || box.height < 1) return;
        panorama.setViewportSize(box.width, box.height);
    };
    if (typeof ResizeObserver !== 'undefined') {
        try {
            const observer = new ResizeObserver(handleResize);
            observer.observe(wrapper);
            disposers.add(() => observer.disconnect());
        } catch {
            // Environments without a working ResizeObserver rely on window resize.
        }
    }
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', handleResize);
        disposers.add(() => window.removeEventListener('resize', handleResize));
    }

    if (behaviour.fullscreenEnabled) {
        const fullscreen = createFullscreenButton(wrapper, { enter: 'Fullscreen', exit: 'Exit fullscreen' });
        disposers.add(() => fullscreen.dispose());
    }
    if (behaviour.showNavControls) {
        const nav = createNavControls(
            wrapper,
            { group: 'Pan navigation', left: 'Pan left', up: 'Pan up', down: 'Pan down', right: 'Pan right' },
            (dYaw, dPitch) => panorama.nudge(dYaw, dPitch),
        );
        disposers.add(() => nav.dispose());
    }
    const dragBlocker = blockNativeDragInside(wrapper);
    disposers.add(() => dragBlocker.dispose());

    return {
        wrapper,
        start() {
            if (disposers.disposed) return;
            if (startScene) {
                controller.applyScene(startScene);
                hotspots.setHotspots(startScene.hotspots);
                wrapper.setAttribute('aria-label', sceneLabel(startScene));
            }
            loop.start();
        },
        goToScene,
        destroy() {
            disposers.dispose();
        },
    };
}
