import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR, normalizeColor } from './colors';

describe('normalizeColor', () => {
    it('accepts #RRGGBB and lowercases it', () => {
        expect(normalizeColor('#AABBCC')).toBe('#aabbcc');
    });

    it('expands #RGB to #RRGGBB', () => {
        expect(normalizeColor('#ABC')).toBe('#aabbcc');
        expect(normalizeColor('#000')).toBe('#000000');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeColor('  #123456  ')).toBe('#123456');
    });

    it('falls back for anything that is not a hex colour', () => {
        for (const value of ['red', 'rgb(1,2,3)', '#12345', '', null, undefined, 42]) {
            expect(normalizeColor(value)).toBe(DEFAULT_MODEL_COLOR);
        }
    });

    it('uses the caller-provided fallback', () => {
        expect(normalizeColor('nope', DEFAULT_BACKGROUND_COLOR)).toBe(DEFAULT_BACKGROUND_COLOR);
    });
});
