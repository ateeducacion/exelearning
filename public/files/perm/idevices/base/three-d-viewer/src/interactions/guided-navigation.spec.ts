import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, resetDom } from '../test/helpers';
import { createGuidedNavigation, resolveStepIndex } from './guided-navigation';

afterEach(resetDom);

describe('resolveStepIndex', () => {
    it('returns null when there is nothing to navigate', () => {
        expect(resolveStepIndex(-1, 1, 0, false)).toBeNull();
    });

    it('starts at the first marker for next and the last for previous', () => {
        expect(resolveStepIndex(-1, 1, 3, false)).toBe(0);
        expect(resolveStepIndex(-1, -1, 3, false)).toBe(2);
    });

    it('steps forwards and backwards', () => {
        expect(resolveStepIndex(0, 1, 3, false)).toBe(1);
        expect(resolveStepIndex(2, -1, 3, false)).toBe(1);
    });

    it('stops at the ends without wrapping', () => {
        expect(resolveStepIndex(2, 1, 3, false)).toBeNull();
        expect(resolveStepIndex(0, -1, 3, false)).toBeNull();
    });

    it('wraps around both ends when wrapping is on', () => {
        expect(resolveStepIndex(2, 1, 3, true)).toBe(0);
        expect(resolveStepIndex(0, -1, 3, true)).toBe(2);
    });
});

describe('createGuidedNavigation', () => {
    const t = (key: string): string => key;

    it('creates the controls when the markup did not bake them in', () => {
        const wrapper = createWrapper();
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: 0, total: 2, wrap: false });
        const nav = wrapper.querySelector<HTMLElement>('.tdv-guided-nav');
        expect(nav).not.toBeNull();
        expect(nav?.hidden).toBe(false);
        expect(nav?.querySelector('.tdv-nav-prev')?.textContent).toBe('Previous');
        expect(nav?.querySelector('.tdv-guided-status')?.getAttribute('aria-live')).toBe('polite');
    });

    it('reuses controls the export markup already shipped', () => {
        const wrapper = createWrapper();
        wrapper.innerHTML =
            '<div class="tdv-guided-nav" data-guided hidden>' +
            '<button class="tdv-nav-prev">Anterior</button>' +
            '<span class="tdv-guided-status"></span>' +
            '<button class="tdv-nav-next">Siguiente</button></div>';
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: 0, total: 2, wrap: false });
        expect(wrapper.querySelectorAll('.tdv-guided-nav')).toHaveLength(1);
        // The baked translations are kept.
        expect(wrapper.querySelector('.tdv-nav-prev')?.textContent).toBe('Anterior');
    });

    it('hides the controls when guided mode is off', () => {
        const wrapper = createWrapper();
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: 0, total: 2, wrap: false });
        view.update({ enabled: false, index: 0, total: 2, wrap: false });
        expect(wrapper.querySelector<HTMLElement>('.tdv-guided-nav')?.hidden).toBe(true);
    });

    it('disables the ends when wrapping is off', () => {
        const wrapper = createWrapper();
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: 0, total: 3, wrap: false });
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-nav-prev')?.disabled).toBe(true);
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-nav-next')?.disabled).toBe(false);

        view.update({ enabled: true, index: 2, total: 3, wrap: false });
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-nav-next')?.disabled).toBe(true);
    });

    it('keeps both directions available when wrapping is on', () => {
        const wrapper = createWrapper();
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: 0, total: 3, wrap: true });
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-nav-prev')?.disabled).toBe(false);
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-nav-next')?.disabled).toBe(false);
    });

    it('disables both buttons when there are no markers', () => {
        const wrapper = createWrapper();
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: -1, total: 0, wrap: true });
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-nav-prev')?.disabled).toBe(true);
        expect(wrapper.querySelector<HTMLButtonElement>('.tdv-nav-next')?.disabled).toBe(true);
    });

    it('announces the position, showing 0 before anything is selected', () => {
        const wrapper = createWrapper();
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: -1, total: 3, wrap: false });
        expect(wrapper.querySelector('.tdv-guided-status')?.textContent).toBe('Marker 0 / 3');
        view.update({ enabled: true, index: 1, total: 3, wrap: false });
        expect(wrapper.querySelector('.tdv-guided-status')?.textContent).toBe('Marker 2 / 3');
    });

    it('binds the click handlers exactly once across repeated updates', () => {
        const wrapper = createWrapper();
        const onGo = vi.fn();
        const view = createGuidedNavigation(wrapper, { t, onGo });
        for (let i = 0; i < 3; i += 1) {
            view.update({ enabled: true, index: 0, total: 3, wrap: true });
        }
        wrapper.querySelector<HTMLButtonElement>('.tdv-nav-next')?.click();
        expect(onGo).toHaveBeenCalledTimes(1);
        expect(onGo).toHaveBeenCalledWith(1);
        wrapper.querySelector<HTMLButtonElement>('.tdv-nav-prev')?.click();
        expect(onGo).toHaveBeenLastCalledWith(-1);
    });

    it('removes the controls it created and stops listening on destroy', () => {
        const wrapper = createWrapper();
        const onGo = vi.fn();
        const view = createGuidedNavigation(wrapper, { t, onGo });
        view.update({ enabled: true, index: 0, total: 3, wrap: true });
        const next = wrapper.querySelector<HTMLButtonElement>('.tdv-nav-next');
        view.destroy();
        expect(wrapper.querySelector('.tdv-guided-nav')).toBeNull();
        next?.click();
        expect(onGo).not.toHaveBeenCalled();
    });

    it('leaves controls it did not create in place on destroy', () => {
        const wrapper = createWrapper();
        wrapper.innerHTML = '<div class="tdv-guided-nav"><button class="tdv-nav-prev"></button></div>';
        const view = createGuidedNavigation(wrapper, { t, onGo: vi.fn() });
        view.update({ enabled: true, index: 0, total: 1, wrap: false });
        view.destroy();
        expect(wrapper.querySelector('.tdv-guided-nav')).not.toBeNull();
    });

    it('does nothing without a wrapper', () => {
        const view = createGuidedNavigation(null, { t, onGo: vi.fn() });
        expect(() => view.update({ enabled: true, index: 0, total: 1, wrap: false })).not.toThrow();
        expect(() => view.destroy()).not.toThrow();
    });
});
