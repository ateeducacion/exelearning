/**
 * Safe URL handling for hotspot links and embedded video providers.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

const SAFE_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * True when a link hotspot may open this URL: an absolute URL with an allowed
 * scheme, a project asset (`asset://`), or a relative/anchor reference.
 * Rejects `javascript:`, `data:`, `vbscript:` and any other scripting scheme.
 */
export function isSafeLinkUrl(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('asset://')) return true;
    const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
    if (!schemeMatch) {
        // Relative path, anchor or protocol-relative URL.
        return true;
    }
    return SAFE_LINK_SCHEMES.includes(`${schemeMatch[1]?.toLowerCase()}:`);
}

/** Trim a user-entered URL; returns '' for unsafe or empty input. */
export function normalizeLinkUrl(url: unknown): string {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    return isSafeLinkUrl(trimmed) ? trimmed : '';
}

/**
 * Map a pasted video page URL to an embeddable iframe src for a known
 * provider, or return null for anything else (direct media files). The embed
 * URL is rebuilt from the captured id rather than echoing the raw input,
 * which is also safer than dropping an arbitrary URL into an iframe.
 */
export function videoEmbedUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/.exec(url);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vimeo = /vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/.exec(url);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}${vimeo[2] ? `?h=${vimeo[2]}` : ''}`;
    const mediateca = /mediateca\.educa\.madrid\.org\/(?:video|media)\/([\w-]+)/.exec(url);
    if (mediateca) return `https://mediateca.educa.madrid.org/video/${mediateca[1]}/fs`;
    return null;
}
