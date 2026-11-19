/**
 * HTML/attribute escaping and small text helpers shared by the edition form
 * and the export renderer.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

/** Escape text for use inside an HTML element. */
export function escapeHtml(value: unknown): string {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Escape text for use inside a double-quoted HTML attribute. */
export function escapeAttr(value: unknown): string {
    return escapeHtml(value).replace(/"/g, '&quot;');
}

/** Shorten long labels (e.g. asset URLs) keeping both ends readable. */
export function truncateLabel(value: string, maxLength = 60): string {
    if (value.length <= maxLength) return value;
    const keep = Math.max(4, Math.floor((maxLength - 4) / 2));
    return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
