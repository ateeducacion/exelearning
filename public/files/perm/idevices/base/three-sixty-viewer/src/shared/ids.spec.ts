import { describe, expect, it } from 'vitest';
import { createIdGenerator, createSequentialIdGenerator } from './ids';

describe('createIdGenerator', () => {
    it('produces the legacy id formats from injected entropy', () => {
        const ids = createIdGenerator({ now: () => 36 ** 2, random: () => 0.5 });
        expect(ids.scene()).toBe(`scene-100-${Math.floor(0.5 * 1e6).toString(36)}`);
        expect(ids.hotspot()).toBe(`hs-100-${Math.floor(0.5 * 1e6).toString(36)}`);
    });

    it('uses real entropy by default and stays within the expected shape', () => {
        const ids = createIdGenerator();
        expect(ids.scene()).toMatch(/^scene-[0-9a-z]+-[0-9a-z]+$/);
        expect(ids.hotspot()).toMatch(/^hs-[0-9a-z]+-[0-9a-z]+$/);
    });
});

describe('createSequentialIdGenerator', () => {
    it('is deterministic and independent per kind', () => {
        const ids = createSequentialIdGenerator();
        expect(ids.scene()).toBe('scene-1');
        expect(ids.scene()).toBe('scene-2');
        expect(ids.hotspot()).toBe('hs-1');
        expect(ids.hotspot()).toBe('hs-2');
        expect(ids.scene()).toBe('scene-3');
    });
});
