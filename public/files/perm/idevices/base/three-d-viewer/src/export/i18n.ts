/**
 * Translation helpers for the exported page.
 *
 * Two vocabularies exist. Chrome strings (`viewer.*`) are translated through
 * the workarea GUI translator with a built-in English fallback, because an
 * exported package may run without any translator at all. Learner-facing
 * micro-strings go through the CONTENT translator (`c_`) so they follow the
 * language of the content, not the language of the authoring UI.
 */

/** English fallbacks for the chrome strings, used when no translator answers. */
export const FALLBACK_TRANSLATIONS: Readonly<Record<string, string>> = {
    'viewer.empty_state': 'Select a 3D model to display',
    'viewer.animation_paused': 'Animation paused',
    'viewer.animation_enabled': 'Animation enabled',
    'viewer.local_warning_title': '3D Viewer not available',
    'viewer.local_warning_message':
        'The 3D viewer requires a web server to work. Open this content from a web server or use eXeLearning preview.',
    'viewer.fullscreen': 'Fullscreen',
    'viewer.exit_fullscreen': 'Exit fullscreen',
    'viewer.rotate_left': 'Rotate left',
    'viewer.rotate_right': 'Rotate right',
    'viewer.tilt_up': 'Tilt up',
    'viewer.tilt_down': 'Tilt down',
};

/** Translate a `viewer.*` chrome string. */
export function translate(key: string): string {
    try {
        const translator = globalThis._;
        if (typeof translator === 'function') {
            const translated = translator(key);
            if (translated && translated !== key) {
                return translated;
            }
        }
    } catch {
        // A broken translator must never stop the viewer from rendering.
    }
    return FALLBACK_TRANSLATIONS[key] ?? key;
}

/** Translate a learner-facing string, preferring the content translator. */
export function translateContent(text: string): string {
    if (typeof globalThis.c_ === 'function') {
        return globalThis.c_(text);
    }
    if (typeof globalThis._ === 'function') {
        return globalThis._(text);
    }
    return text;
}

/** The micro-strings the interaction controller needs, baked into the export. */
export function buildRuntimeI18n(): Record<string, string> {
    const keys = [
        'Marker',
        'Close',
        'Check',
        'Correct',
        'Incorrect',
        'Previous',
        'Next',
        'Please select an answer',
        'No attempts left',
    ];
    const map: Record<string, string> = {};
    for (const key of keys) {
        map[key] = translateContent(key);
    }
    return map;
}
