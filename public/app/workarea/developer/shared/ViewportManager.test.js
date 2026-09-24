import { describe, it, expect, beforeEach } from 'vitest';
import { ViewportManager, PRESETS } from './ViewportManager.js';

function makeIframeStub() {
    const attrs = {};
    return {
        style: {},
        getAttribute(key) {
            return attrs[key];
        },
        setAttribute(key, value) {
            attrs[key] = value;
        },
    };
}

describe('ViewportManager', () => {
    let iframe;

    beforeEach(() => {
        iframe = makeIframeStub();
    });

    it('lists desktop, tablet, mobile presets', () => {
        expect(ViewportManager.list()).toEqual(['desktop', 'tablet', 'mobile']);
    });

    it('returns desktop dimensions for an unknown preset', () => {
        expect(ViewportManager.dimensions('unknown')).toEqual(PRESETS.desktop);
    });

    it('applies desktop preset by default', () => {
        const vm = new ViewportManager(iframe);
        expect(vm.preset).toBe('desktop');
        expect(iframe.style.width).toBe('1440px');
        expect(iframe.style.height).toBe('900px');
        expect(iframe.getAttribute('data-viewport')).toBe('desktop');
    });

    it('honors an initial preset', () => {
        const vm = new ViewportManager(iframe, { preset: 'mobile' });
        expect(vm.preset).toBe('mobile');
        expect(iframe.style.width).toBe('390px');
        expect(iframe.style.height).toBe('844px');
    });

    it('falls back to desktop when given an unknown preset', () => {
        const vm = new ViewportManager(iframe, { preset: 'cinema' });
        expect(vm.preset).toBe('desktop');
    });

    it('switches presets via apply()', () => {
        const vm = new ViewportManager(iframe);
        vm.apply('tablet');
        expect(vm.preset).toBe('tablet');
        expect(iframe.style.width).toBe('768px');
        expect(iframe.style.height).toBe('1024px');
        expect(iframe.getAttribute('data-viewport')).toBe('tablet');
    });

    it('apply returns the resolved preset name', () => {
        const vm = new ViewportManager(iframe);
        expect(vm.apply('mobile')).toBe('mobile');
        expect(vm.apply('nonsense')).toBe('desktop');
    });

    it('does not throw when iframe is null', () => {
        const vm = new ViewportManager(null);
        expect(() => vm.apply('mobile')).not.toThrow();
        expect(vm.preset).toBe('mobile');
    });
});
