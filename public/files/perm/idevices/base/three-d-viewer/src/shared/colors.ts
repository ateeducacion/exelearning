/** CSS colour coercion shared by the schema, the editor form and the renderers. */

export const DEFAULT_MODEL_COLOR = '#888888';
export const DEFAULT_BACKGROUND_COLOR = '#f5f5f5';

const HEX6 = /^#[0-9a-f]{6}$/;
const HEX3 = /^#[0-9a-f]{3}$/;

/**
 * Coerce a colour to lowercase `#rrggbb`. Accepts `#RGB` and `#RRGGBB`;
 * anything else (including non-strings) falls back.
 */
export function normalizeColor(value: unknown, fallback: string = DEFAULT_MODEL_COLOR): string {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim().toLowerCase();
    if (HEX6.test(trimmed)) {
        return trimmed;
    }
    if (HEX3.test(trimmed)) {
        const r = trimmed[1] ?? '0';
        const g = trimmed[2] ?? '0';
        const b = trimmed[3] ?? '0';
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return fallback;
}
