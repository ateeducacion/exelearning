/**
 * ExportPresetManager
 *
 * Bundles "export option" toggles into deterministic presets used by the
 * Style Lab to reproduce visual scenarios. Each preset is just a map of
 * boolean flags; downstream code is responsible for mapping them onto the
 * concrete export pipeline.
 *
 *   minimal     → least chrome (no search, no navigation, no counter, no icons)
 *   default     → realistic out-of-the-box export
 *   all         → every option enabled (matches the Style Designer
 *                  "all export preferences" recommendation)
 *   stress-test → odd combinations that historically tripped style bugs
 */

export const EXPORT_OPTIONS = Object.freeze([
    'search',
    'pageCounter',
    'navigation',
    'icons',
    'collapsible',
    'printControls',
]);

export const PRESETS = Object.freeze({
    minimal: {
        search: false,
        pageCounter: false,
        navigation: false,
        icons: false,
        collapsible: false,
        printControls: false,
    },
    default: {
        search: false,
        pageCounter: false,
        navigation: true,
        icons: true,
        collapsible: false,
        printControls: false,
    },
    all: {
        search: true,
        pageCounter: true,
        navigation: true,
        icons: true,
        collapsible: true,
        printControls: true,
    },
    'stress-test': {
        search: true,
        pageCounter: false,
        navigation: true,
        icons: false,
        collapsible: true,
        printControls: true,
    },
});

export class ExportPresetManager {
    static list() {
        return Object.keys(PRESETS);
    }

    static has(preset) {
        return Object.prototype.hasOwnProperty.call(PRESETS, preset);
    }

    /**
     * Returns the options object for the named preset, or the `default`
     * preset if the name is unknown.
     */
    static optionsFor(preset) {
        return { ...(PRESETS[preset] ?? PRESETS.default) };
    }

    /**
     * Compute the preset name (if any) that exactly matches the supplied
     * options object. Returns null if no preset matches.
     */
    static matchPreset(options) {
        if (!options || typeof options !== 'object') return null;
        for (const [name, preset] of Object.entries(PRESETS)) {
            const matches = EXPORT_OPTIONS.every(key => Boolean(options[key]) === Boolean(preset[key]));
            if (matches) return name;
        }
        return null;
    }

    /**
     * Merge a partial options object on top of a preset's defaults.
     */
    static merge(preset, overrides = {}) {
        const base = ExportPresetManager.optionsFor(preset);
        for (const key of EXPORT_OPTIONS) {
            if (Object.prototype.hasOwnProperty.call(overrides, key)) {
                base[key] = Boolean(overrides[key]);
            }
        }
        return base;
    }
}

export default ExportPresetManager;
