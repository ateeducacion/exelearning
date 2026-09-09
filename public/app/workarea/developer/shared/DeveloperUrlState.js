/**
 * DeveloperUrlState
 *
 * Serializes/deserializes Developer-tools lab state to/from URL query
 * parameters so each scenario is shareable, bookmarkable, and reachable
 * by Playwright/AI agents through a deterministic URL.
 *
 * Parameters accepted:
 *
 *   Style Lab        → fixture, themeSource, theme, export, viewport, preset,
 *                      search, pageCounter, navigation, icons, collapsible
 *   iDevice Lab      → idevice, sample, themeSource, theme, export, viewport
 *
 * The parser is intentionally tolerant: unknown keys are ignored and invalid
 * values fall back to the supplied defaults. The serializer only emits
 * parameters whose value differs from the default so URLs stay short.
 */

export const VIEWPORTS = Object.freeze(['desktop', 'tablet', 'mobile']);
export const EXPORT_TARGETS = Object.freeze(['website', 'single-page', 'scorm12', 'scorm2004', 'ims', 'epub3']);
export const THEME_SOURCES = Object.freeze(['base', 'site', 'user']);

const BOOLEAN_FLAGS = Object.freeze(['search', 'pageCounter', 'navigation', 'icons', 'collapsible']);
const STRING_KEYS_STYLE = Object.freeze(['fixture', 'theme', 'preset']);
const STRING_KEYS_IDEVICE = Object.freeze(['idevice', 'sample', 'theme']);
// Identifier sanitization: alphanumerics, dash, underscore. Length-capped.
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function sanitizeId(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return SAFE_ID_RE.test(trimmed) ? trimmed : null;
}

function sanitizeEnum(value, allowed) {
    return typeof value === 'string' && allowed.includes(value) ? value : null;
}

function sanitizeBool(value) {
    if (value === true || value === false) return value;
    if (typeof value !== 'string') return null;
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
    return null;
}

/**
 * Parse Style Lab state from a URLSearchParams-compatible object or query string.
 */
export function parseStyleLabState(input, defaults = {}) {
    const params = toSearchParams(input);
    const state = {
        fixture: defaults.fixture ?? null,
        themeSource: defaults.themeSource ?? 'base',
        theme: defaults.theme ?? null,
        export: defaults.export ?? 'website',
        viewport: defaults.viewport ?? 'desktop',
        preset: defaults.preset ?? null,
        options: {
            search: defaults.options?.search ?? false,
            pageCounter: defaults.options?.pageCounter ?? false,
            navigation: defaults.options?.navigation ?? true,
            icons: defaults.options?.icons ?? true,
            collapsible: defaults.options?.collapsible ?? false,
        },
    };

    for (const key of STRING_KEYS_STYLE) {
        if (params.has(key)) {
            const v = sanitizeId(params.get(key));
            if (v !== null) state[key] = v;
        }
    }
    if (params.has('themeSource')) {
        const v = sanitizeEnum(params.get('themeSource'), THEME_SOURCES);
        if (v !== null) state.themeSource = v;
    }
    if (params.has('export')) {
        const v = sanitizeEnum(params.get('export'), EXPORT_TARGETS);
        if (v !== null) state.export = v;
    }
    if (params.has('viewport')) {
        const v = sanitizeEnum(params.get('viewport'), VIEWPORTS);
        if (v !== null) state.viewport = v;
    }
    for (const flag of BOOLEAN_FLAGS) {
        if (params.has(flag)) {
            const v = sanitizeBool(params.get(flag));
            if (v !== null) state.options[flag] = v;
        }
    }
    return state;
}

/**
 * Serialize Style Lab state back into URLSearchParams.
 * Only emits parameters whose value differs from the default.
 */
export function serializeStyleLabState(state, defaults = {}) {
    const baseDefaults = {
        themeSource: 'base',
        export: 'website',
        viewport: 'desktop',
        options: { search: false, pageCounter: false, navigation: true, icons: true, collapsible: false },
        ...defaults,
    };
    const params = new URLSearchParams();
    for (const key of STRING_KEYS_STYLE) {
        const v = state[key];
        if (v && sanitizeId(v)) params.set(key, v);
    }
    if (state.themeSource && state.themeSource !== baseDefaults.themeSource) {
        params.set('themeSource', state.themeSource);
    }
    if (state.export && state.export !== baseDefaults.export) {
        params.set('export', state.export);
    }
    if (state.viewport && state.viewport !== baseDefaults.viewport) {
        params.set('viewport', state.viewport);
    }
    const opts = state.options ?? {};
    for (const flag of BOOLEAN_FLAGS) {
        if (typeof opts[flag] !== 'undefined' && opts[flag] !== baseDefaults.options[flag]) {
            params.set(flag, opts[flag] ? '1' : '0');
        }
    }
    return params;
}

/**
 * Parse iDevice Lab state from a URLSearchParams-compatible object or query string.
 */
export function parseIdeviceLabState(input, defaults = {}) {
    const params = toSearchParams(input);
    const state = {
        idevice: defaults.idevice ?? null,
        sample: defaults.sample ?? null,
        themeSource: defaults.themeSource ?? 'base',
        theme: defaults.theme ?? null,
        export: defaults.export ?? 'website',
        viewport: defaults.viewport ?? 'desktop',
    };
    for (const key of STRING_KEYS_IDEVICE) {
        if (params.has(key)) {
            const v = sanitizeId(params.get(key));
            if (v !== null) state[key] = v;
        }
    }
    if (params.has('themeSource')) {
        const v = sanitizeEnum(params.get('themeSource'), THEME_SOURCES);
        if (v !== null) state.themeSource = v;
    }
    if (params.has('export')) {
        const v = sanitizeEnum(params.get('export'), EXPORT_TARGETS);
        if (v !== null) state.export = v;
    }
    if (params.has('viewport')) {
        const v = sanitizeEnum(params.get('viewport'), VIEWPORTS);
        if (v !== null) state.viewport = v;
    }
    return state;
}

/**
 * Serialize iDevice Lab state back into URLSearchParams.
 */
export function serializeIdeviceLabState(state, defaults = {}) {
    const baseDefaults = {
        themeSource: 'base',
        export: 'website',
        viewport: 'desktop',
        ...defaults,
    };
    const params = new URLSearchParams();
    for (const key of STRING_KEYS_IDEVICE) {
        const v = state[key];
        if (v && sanitizeId(v)) params.set(key, v);
    }
    if (state.idevice && sanitizeId(state.idevice)) params.set('idevice', state.idevice);
    if (state.themeSource && state.themeSource !== baseDefaults.themeSource) {
        params.set('themeSource', state.themeSource);
    }
    if (state.export && state.export !== baseDefaults.export) {
        params.set('export', state.export);
    }
    if (state.viewport && state.viewport !== baseDefaults.viewport) {
        params.set('viewport', state.viewport);
    }
    return params;
}

function toSearchParams(input) {
    if (input instanceof URLSearchParams) return input;
    if (typeof input === 'string') {
        return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
    }
    if (input && typeof input === 'object') {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(input)) {
            if (v !== undefined && v !== null) p.set(k, String(v));
        }
        return p;
    }
    return new URLSearchParams();
}
