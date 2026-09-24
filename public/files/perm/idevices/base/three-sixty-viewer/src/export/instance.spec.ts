import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import type { ThreeSixtyDocumentV2 } from '../shared/types';
import { createManualScheduler, createThreeMock, stubRect } from '../test/helpers';
import { createInstance } from './instance';

function tourDocument(overrides: Record<string, unknown> = {}): ThreeSixtyDocumentV2 {
    const result = hydrateDocument(
        {
            version: 2,
            startSceneId: 's1',
            scenes: [
                {
                    id: 's1',
                    title: 'One',
                    src: 'one.jpg',
                    alt: 'Scene one',
                    hotspots: [
                        { id: 'h-nav', label: 'To two', action: { type: 'goToScene', payload: { sceneId: 's2' } } },
                        { id: 'h-text', label: 'Info', action: { type: 'text', payload: { html: '<p>hi</p>' } } },
                    ],
                },
                { id: 's2', title: 'Two', src: 'two.jpg', alt: 'Scene two', projection: 'flat' },
            ],
            behaviour: { showNavControls: true, fullscreenEnabled: true },
            ...overrides,
        },
        createSequentialIdGenerator(),
    );
    if (result.status !== 'ok') throw new Error('fixture must hydrate');
    return result.document;
}

function makeInstance(document360 = tourDocument(), reducedMotion = false) {
    const wrapper = document.createElement('div');
    stubRect(wrapper, { width: 640, height: 360 });
    document.body.appendChild(wrapper);
    const { three, state } = createThreeMock();
    const manual = createManualScheduler();
    const instance = createInstance(wrapper, document360, {
        three,
        resolveSrc: src => src,
        scheduler: manual.scheduler,
        reducedMotion,
    });
    return { wrapper, instance, state, manual };
}

describe('createInstance', () => {
    it('starts on the start scene, renders hotspots and runs the loop', () => {
        const { wrapper, instance, state, manual } = makeInstance();
        instance.start();
        expect(wrapper.querySelectorAll('.three-sixty-viewer-hotspot')).toHaveLength(2);
        manual.step();
        expect(state.renderers[0]?.render).toHaveBeenCalled();
        // Hotspots positioned at the mock projection centre.
        const button = wrapper.querySelector<HTMLButtonElement>('.three-sixty-viewer-hotspot');
        expect(button?.style.left).toBe('320px');
        instance.destroy();
    });

    it('navigates scenes via goToScene and via a goToScene hotspot', () => {
        const { wrapper, instance } = makeInstance();
        instance.start();
        expect(wrapper.getAttribute('aria-label')).toBe('Scene one');
        const navButton = wrapper.querySelector<HTMLButtonElement>('[data-hotspot-id="h-nav"]');
        navButton?.click();
        expect(wrapper.getAttribute('aria-label')).toBe('Scene two');
        // Flat scene: image layer visible, canvas hidden.
        const image = wrapper.querySelector<HTMLImageElement>('.three-sixty-viewer-flat-image');
        expect(image?.style.display).toBe('');
        expect(image?.getAttribute('src')).toBe('two.jpg');
        // Unknown scene id is ignored.
        instance.goToScene('missing');
        expect(wrapper.getAttribute('aria-label')).toBe('Scene two');
        instance.destroy();
    });

    it('opens and closes a content modal, restoring focus', () => {
        const { wrapper, instance } = makeInstance();
        instance.start();
        const infoButton = wrapper.querySelector<HTMLButtonElement>('[data-hotspot-id="h-text"]');
        infoButton?.click();
        const modal = wrapper.querySelector('.three-sixty-viewer-modal');
        expect(modal).toBeTruthy();
        modal?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(wrapper.querySelector('.three-sixty-viewer-modal')).toBeNull();
        expect(document.activeElement).toBe(infoButton);
        instance.destroy();
    });

    it('navigating away closes any open modal', () => {
        const { wrapper, instance } = makeInstance();
        instance.start();
        wrapper.querySelector<HTMLButtonElement>('[data-hotspot-id="h-text"]')?.click();
        expect(wrapper.querySelector('.three-sixty-viewer-modal')).toBeTruthy();
        instance.goToScene('s2');
        expect(wrapper.querySelector('.three-sixty-viewer-modal')).toBeNull();
        instance.destroy();
    });

    it('respects behaviour toggles for fullscreen and nav controls', () => {
        const with360 = makeInstance();
        with360.instance.start();
        expect(with360.wrapper.querySelector('.three-sixty-viewer-fullscreen-button')).toBeTruthy();
        expect(with360.wrapper.querySelector('.three-sixty-viewer-nav')).toBeTruthy();
        with360.instance.destroy();

        const without = makeInstance(tourDocument({ behaviour: { fullscreenEnabled: false, showNavControls: false } }));
        without.instance.start();
        expect(without.wrapper.querySelector('.three-sixty-viewer-fullscreen-button')).toBeNull();
        expect(without.wrapper.querySelector('.three-sixty-viewer-nav')).toBeNull();
        without.instance.destroy();
    });

    it('disables autorotation under prefers-reduced-motion', () => {
        const rotating = tourDocument({ behaviour: { autorotate: { enabled: true, speed: 2 } } });
        const normal = makeInstance(rotating, false);
        expect(normal.state.controls[0]?.autoRotate).toBe(true);
        normal.instance.destroy();

        const reduced = makeInstance(rotating, true);
        expect(reduced.state.controls[0]?.autoRotate).toBe(false);
        reduced.instance.destroy();
    });

    it('handles window resize through the panorama renderer', () => {
        const { wrapper, instance, state } = makeInstance();
        instance.start();
        stubRect(wrapper, { width: 800, height: 400 });
        window.dispatchEvent(new Event('resize'));
        expect(state.renderers[0]?.setSize).toHaveBeenLastCalledWith(800, 400);
        instance.destroy();
    });

    it('destroy() stops the loop, releases three.js resources and listeners', () => {
        const { instance, state, manual } = makeInstance();
        instance.start();
        manual.step();
        const renderCount = state.renderers[0]?.render.mock.calls.length ?? 0;
        instance.destroy();
        expect(manual.pendingCount()).toBe(0);
        manual.step();
        expect(state.renderers[0]?.render.mock.calls.length).toBe(renderCount);
        expect(state.controls[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.geometries[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.materials[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(state.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
        // start() after destroy is inert.
        instance.start();
        expect(manual.pendingCount()).toBe(0);
    });

    it('two instances on the same page keep independent scene state', () => {
        const first = makeInstance();
        const second = makeInstance();
        first.instance.start();
        second.instance.start();
        first.instance.goToScene('s2');
        expect(first.wrapper.getAttribute('aria-label')).toBe('Scene two');
        expect(second.wrapper.getAttribute('aria-label')).toBe('Scene one');
        first.instance.destroy();
        // The surviving instance still works after the other is gone.
        second.instance.goToScene('s2');
        expect(second.wrapper.getAttribute('aria-label')).toBe('Scene two');
        second.instance.destroy();
    });
});
