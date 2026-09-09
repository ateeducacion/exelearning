import { describe, it, expect } from 'vitest';
import { ExportPresetManager, EXPORT_OPTIONS, PRESETS } from './ExportPresetManager.js';

describe('ExportPresetManager', () => {
    it('lists every preset', () => {
        expect(ExportPresetManager.list()).toEqual(['minimal', 'default', 'all', 'stress-test']);
    });

    it('reports membership via has()', () => {
        expect(ExportPresetManager.has('all')).toBe(true);
        expect(ExportPresetManager.has('made-up')).toBe(false);
    });

    it('returns each preset shape', () => {
        for (const preset of ExportPresetManager.list()) {
            const opts = ExportPresetManager.optionsFor(preset);
            for (const key of EXPORT_OPTIONS) {
                expect(typeof opts[key]).toBe('boolean');
            }
        }
    });

    it('minimal preset disables everything', () => {
        const opts = ExportPresetManager.optionsFor('minimal');
        for (const key of EXPORT_OPTIONS) {
            expect(opts[key]).toBe(false);
        }
    });

    it('all preset enables everything', () => {
        const opts = ExportPresetManager.optionsFor('all');
        for (const key of EXPORT_OPTIONS) {
            expect(opts[key]).toBe(true);
        }
    });

    it('falls back to default for unknown preset names', () => {
        expect(ExportPresetManager.optionsFor('nope')).toEqual(PRESETS.default);
    });

    it('matchPreset finds a preset that matches the options', () => {
        const opts = ExportPresetManager.optionsFor('all');
        const match = ExportPresetManager.matchPreset(opts);
        expect(match).toBe('all');
    });

    it('matchPreset finds the minimal preset for an all-false options object', () => {
        const opts = ExportPresetManager.optionsFor('minimal');
        expect(ExportPresetManager.matchPreset(opts)).toBe('minimal');
    });

    it('matchPreset returns null when no preset matches', () => {
        expect(
            ExportPresetManager.matchPreset({
                search: true,
                pageCounter: true,
                navigation: false,
                icons: false,
                collapsible: false,
                printControls: false,
            }),
        ).toBeNull();
    });

    it('matchPreset returns null for non-object input', () => {
        expect(ExportPresetManager.matchPreset(null)).toBeNull();
        expect(ExportPresetManager.matchPreset('all')).toBeNull();
    });

    it('merge overlays overrides on top of preset defaults', () => {
        const merged = ExportPresetManager.merge('default', { search: true });
        expect(merged.search).toBe(true);
        expect(merged.navigation).toBe(true);
        expect(merged.icons).toBe(true);
    });

    it('merge coerces override values to boolean', () => {
        const merged = ExportPresetManager.merge('minimal', { search: 'truthy' });
        expect(merged.search).toBe(true);
    });

    it('merge ignores keys outside EXPORT_OPTIONS', () => {
        const merged = ExportPresetManager.merge('default', { unknownKey: true });
        expect(merged).not.toHaveProperty('unknownKey');
    });
});
