/**
 * The per-wrapper controller of the exported page: applies the boot config to
 * `<model-viewer>` (or hands STL to the shared runtime), wires the fullscreen
 * and nav-pad controls, and manages animation playback.
 */

import { resolveAssetUrlAsync } from '../runtime/asset-resolver';
import { getExportLibBaseUrl } from '../runtime/paths';
import { ensureThreeJsLoaded } from '../runtime/three-loader';
import { publishViewerRuntime } from '../runtime/viewer-runtime';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR } from '../shared/colors';
import { isStlSource } from '../shared/model-source';
import type { ViewerDisplayConfig } from '../shared/types';
import { translate } from './i18n';
import { computeEmptyStateDisplay } from './renderer';
import { resolveRuntimeSrc } from './source-resolver';

/** Camera nudge step, matching the 360 viewer's feel. */
const YAW_STEP = (15 * Math.PI) / 180;
const PITCH_STEP = (10 * Math.PI) / 180;

/** Minimum/maximum polar angle, keeping the camera off the poles. */
const MIN_POLAR = 0.05;
const MAX_POLAR = Math.PI - 0.05;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** `file://` has no module loading and no CORS; say so instead of failing silently. */
export function isLocalFileProtocol(): boolean {
    try {
        return globalThis.location?.protocol === 'file:';
    } catch {
        return false;
    }
}

function buildLocalWarning(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'three-d-viewer-local-warning';
    const title = document.createElement('strong');
    title.className = 'three-d-viewer-local-warning-title';
    title.textContent = translate('viewer.local_warning_title');
    const message = document.createElement('p');
    message.className = 'three-d-viewer-local-warning-message';
    message.textContent = translate('viewer.local_warning_message');
    container.append(title, message);
    return container;
}

/**
 * Orbit a camera by (dAzimuth, dPolar) radians around the origin.
 * Pure spherical maths, shared by the STL and model-viewer nudge paths.
 */
export function orbitPosition(
    position: { x: number; y: number; z: number },
    dAzimuth: number,
    dPolar: number,
    currentAngles?: { azimuth: number; polar: number },
): { x: number; y: number; z: number } {
    const radius = Math.hypot(position.x, position.y, position.z) || 1;
    const azimuth = (currentAngles?.azimuth ?? Math.atan2(position.x, position.z)) + dAzimuth;
    const polar = clamp(
        (currentAngles?.polar ?? Math.acos(clamp(position.y / radius, -1, 1))) + dPolar,
        MIN_POLAR,
        MAX_POLAR,
    );
    const sinPolar = Math.sin(polar);
    return {
        x: radius * sinPolar * Math.sin(azimuth),
        y: radius * Math.cos(polar),
        z: radius * sinPolar * Math.cos(azimuth),
    };
}

/** How long to wait for an `asset://` handle to become fetchable. */
const ASSET_TIMEOUT_MS = 10000;

export interface ViewerControllerOptions {
    /** Overridable so tests do not sit through the real polling window. */
    assetTimeoutMs?: number;
}

export class ThreeDViewerController {
    readonly wrapper: HTMLElement;
    readonly ideviceId: string;
    readonly config: ViewerDisplayConfig;
    private readonly modelViewer: ModelViewerElement | null;
    private readonly emptyState: HTMLElement | null;
    private readonly ariaLive: HTMLElement | null;
    private readonly observers: MutationObserver[] = [];
    private readonly assetTimeoutMs: number;
    private availableAnimations: string[] = [];

    constructor(wrapper: HTMLElement, config: ViewerDisplayConfig, options: ViewerControllerOptions = {}) {
        this.wrapper = wrapper;
        this.ideviceId = wrapper.id;
        this.config = config;
        this.assetTimeoutMs = options.assetTimeoutMs ?? ASSET_TIMEOUT_MS;
        this.modelViewer = wrapper.querySelector<ModelViewerElement>('model-viewer');
        this.emptyState = wrapper.querySelector<HTMLElement>('[data-empty]');
        this.ariaLive = wrapper.querySelector<HTMLElement>('[data-live]');
    }

    /** Boot the viewer. Never throws: a failure leaves the empty state visible. */
    async start(): Promise<void> {
        if (isLocalFileProtocol()) {
            this.showLocalWarning();
            return;
        }
        if (isStlSource(this.config.src)) {
            await this.renderStl();
        } else {
            await this.applyModelViewerConfig();
            this.observeModelViewer();
        }
        this.setupControls();
    }

    private showLocalWarning(): void {
        if (this.modelViewer) {
            this.modelViewer.style.display = 'none';
        }
        if (this.emptyState) {
            this.emptyState.style.display = 'none';
        }
        this.wrapper.appendChild(buildLocalWarning());
    }

    private async renderStl(): Promise<void> {
        let url = resolveRuntimeSrc(this.config.src);
        if (!url && this.config.src.startsWith('asset://')) {
            url = (await resolveAssetUrlAsync(this.config.src, this.assetTimeoutMs)) ?? '';
        }
        if (!url) {
            console.warn('[3D Viewer] No STL URL resolved for:', this.config.src);
            this.toggleEmptyState();
            return;
        }
        try {
            await ensureThreeJsLoaded(getExportLibBaseUrl());
            const runtime = publishViewerRuntime();
            runtime.destroy(this.wrapper);
            runtime.init(this.wrapper, {
                src: url,
                type: 'stl',
                modelColor: this.config.modelColor || DEFAULT_MODEL_COLOR,
                backgroundColor: this.config.backgroundColor || DEFAULT_BACKGROUND_COLOR,
                cameraControls: this.config.cameraControls,
                autoRotate: this.config.autoRotate,
                autoRotateSpeed: this.config.autoRotateSpeed || 30,
            });
            // Hide the overlay here rather than waiting on the async parse, so
            // STL and GLB/GLTF behave the same regardless of load timing.
            this.toggleEmptyState();
        } catch (error) {
            console.error('[3D Viewer] Failed to render STL:', error);
            this.toggleEmptyState();
        }
    }

    private async applyModelViewerConfig(): Promise<void> {
        const modelViewer = this.modelViewer;
        if (!modelViewer) {
            return;
        }
        let src = resolveRuntimeSrc(this.config.src);
        if (!src && this.config.src.startsWith('asset://')) {
            src = (await resolveAssetUrlAsync(this.config.src, this.assetTimeoutMs)) ?? '';
        }
        if (src) {
            modelViewer.src = src;
            // The custom element does not always reflect the property to the
            // attribute in time; set both.
            modelViewer.setAttribute('src', src);
        }
        modelViewer.alt = this.config.alt;
        if (this.config.alt) {
            modelViewer.setAttribute('aria-label', this.config.alt);
        } else {
            modelViewer.removeAttribute('aria-label');
        }
        if (this.config.backgroundColor) {
            modelViewer.style.backgroundColor = this.config.backgroundColor;
        }
        modelViewer.setAttribute('shadow-intensity', '1');
        modelViewer.setAttribute('tone-mapping', 'pbr-neutral');
        if (this.config.cameraControls) {
            modelViewer.setAttribute('camera-controls', '');
        } else {
            modelViewer.removeAttribute('camera-controls');
        }
        if (this.config.autoRotate) {
            modelViewer.setAttribute('auto-rotate', '');
            modelViewer.setAttribute('rotation-per-second', `${this.config.autoRotateSpeed || 30}deg`);
        } else {
            modelViewer.removeAttribute('auto-rotate');
            modelViewer.removeAttribute('rotation-per-second');
        }
        this.applyAnimation();
        this.toggleEmptyState();
    }

    private observeModelViewer(): void {
        const modelViewer = this.modelViewer;
        if (!modelViewer) {
            return;
        }
        modelViewer.addEventListener('load', () => {
            this.updateAnimationOptions();
            this.applyAnimation();
            this.toggleEmptyState();
        });
        // The src may be set asynchronously (blob resolution); react to it.
        const observer = new MutationObserver(() => this.toggleEmptyState());
        observer.observe(modelViewer, { attributes: true, attributeFilter: ['src'] });
        this.observers.push(observer);
    }

    private setupControls(): void {
        const fullscreenButton = this.wrapper.querySelector<HTMLElement>('[data-fullscreen]');
        if (fullscreenButton) {
            const isFullscreen = (): boolean => document.fullscreenElement === this.wrapper;
            const syncLabel = (): void => {
                const label = translate(isFullscreen() ? 'viewer.exit_fullscreen' : 'viewer.fullscreen');
                fullscreenButton.setAttribute('aria-label', label);
                fullscreenButton.setAttribute('title', label);
            };
            fullscreenButton.addEventListener('click', () => {
                if (isFullscreen()) {
                    void document.exitFullscreen?.();
                } else {
                    void this.wrapper.requestFullscreen?.();
                }
            });
            document.addEventListener('fullscreenchange', syncLabel);
        }

        // Arrow direction matches expectation: pressing → turns the model right,
        // which means orbiting the camera the other way.
        for (const button of Array.from(this.wrapper.querySelectorAll<HTMLElement>('[data-nav]'))) {
            const direction = button.getAttribute('data-nav');
            const dAzimuth = direction === 'right' ? -YAW_STEP : direction === 'left' ? YAW_STEP : 0;
            const dPolar = direction === 'up' ? PITCH_STEP : direction === 'down' ? -PITCH_STEP : 0;
            button.addEventListener('click', () => this.nudgeCamera(dAzimuth, dPolar));
        }
    }

    /** Orbit the camera, dispatching to whichever renderer is live. */
    nudgeCamera(dAzimuth: number, dPolar: number): void {
        // The STL scene boots asynchronously, so re-read the instance on every
        // nudge rather than caching it at construction time.
        const instance = publishViewerRuntime().getInstance(this.wrapper);
        const camera = instance?.camera;
        if (camera) {
            const controls = instance?.controls;
            const angles =
                controls?.getAzimuthalAngle && controls?.getPolarAngle
                    ? { azimuth: controls.getAzimuthalAngle(), polar: controls.getPolarAngle() }
                    : undefined;
            const next = orbitPosition(camera.position, dAzimuth, dPolar, angles);
            camera.position.set(next.x, next.y, next.z);
            camera.lookAt(0, 0, 0);
            controls?.update?.();
            return;
        }
        const modelViewer = this.modelViewer;
        const orbit = modelViewer?.getCameraOrbit?.();
        if (!modelViewer || !orbit) {
            return;
        }
        const theta = (orbit.theta ?? 0) + dAzimuth;
        const phi = clamp((orbit.phi ?? Math.PI / 2) + dPolar, MIN_POLAR, MAX_POLAR);
        modelViewer.cameraOrbit = `${theta}rad ${phi}rad ${orbit.radius ?? 'auto'}m`;
        modelViewer.jumpCameraToGoal?.();
    }

    private updateAnimationOptions(): void {
        const available = Array.from(this.modelViewer?.availableAnimations ?? []);
        this.availableAnimations = available;
        if (available.length === 0) {
            this.config.animation.name = '';
            this.config.animation.enabled = false;
            return;
        }
        if (!available.includes(this.config.animation.name)) {
            this.config.animation.name = available[0] ?? '';
        }
    }

    private applyAnimation(): void {
        const modelViewer = this.modelViewer;
        if (!modelViewer) {
            return;
        }
        const animation = this.config.animation;
        if (!animation.enabled) {
            modelViewer.pause?.();
            this.announce(translate('viewer.animation_paused'));
            return;
        }
        const available = this.availableAnimations.length
            ? this.availableAnimations
            : Array.from(modelViewer.availableAnimations ?? []);
        const name = animation.name && available.includes(animation.name) ? animation.name : available[0];
        if (!name) {
            modelViewer.pause?.();
            return;
        }
        modelViewer.animationName = name;
        modelViewer.animationSpeed = animation.speed || 1;
        modelViewer.play?.({ repetitions: Number.POSITIVE_INFINITY });
        this.announce(`${translate('viewer.animation_enabled')}: ${name}`);
    }

    private toggleEmptyState(): void {
        if (!this.emptyState) {
            return;
        }
        const viewerSrc = this.modelViewer?.getAttribute('src') ?? this.modelViewer?.src ?? '';
        this.emptyState.style.display = computeEmptyStateDisplay(this.config.src, viewerSrc);
    }

    private announce(message: string): void {
        if (this.ariaLive) {
            this.ariaLive.textContent = message;
        }
    }

    /** Release the observers this controller owns. */
    destroy(): void {
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers.length = 0;
        publishViewerRuntime().destroy(this.wrapper);
    }
}
