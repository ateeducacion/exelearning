/**
 * ViewportManager
 *
 * Applies preset viewport sizes to a preview iframe. Viewport is a responsive
 * testing axis, NOT an export format — `mobile` is a viewport, not an export
 * target.
 *
 * Adding new presets is intentionally cheap: just extend `PRESETS`. The
 * map is exposed for unit tests and for the Style/iDevice Lab UIs to render
 * the "Desktop / Tablet / Mobile" labels.
 */

export const PRESETS = Object.freeze({
    desktop: { width: 1440, height: 900, label: 'Desktop' },
    tablet: { width: 768, height: 1024, label: 'Tablet' },
    mobile: { width: 390, height: 844, label: 'Mobile' },
});

export class ViewportManager {
    constructor(iframe, { preset = 'desktop' } = {}) {
        this.iframe = iframe;
        this.preset = this.#resolvePreset(preset);
        if (iframe) this.apply(this.preset);
    }

    /**
     * Apply a named preset (desktop|tablet|mobile) to the managed iframe.
     * Returns the resolved preset object.
     */
    apply(preset) {
        const resolved = this.#resolvePreset(preset);
        this.preset = resolved;
        if (this.iframe && this.iframe.style) {
            const { width, height } = PRESETS[resolved];
            this.iframe.style.width = `${width}px`;
            this.iframe.style.height = `${height}px`;
            this.iframe.setAttribute('data-viewport', resolved);
        }
        return resolved;
    }

    /**
     * Returns the dimensions for the given preset.
     */
    static dimensions(preset) {
        if (!Object.prototype.hasOwnProperty.call(PRESETS, preset)) return PRESETS.desktop;
        return PRESETS[preset];
    }

    /**
     * Returns the list of known preset names.
     */
    static list() {
        return Object.keys(PRESETS);
    }

    #resolvePreset(preset) {
        return Object.prototype.hasOwnProperty.call(PRESETS, preset) ? preset : 'desktop';
    }
}

export default ViewportManager;
