/**
 * HTML escaping and the conservative DOM sanitizer used for author-supplied
 * marker content. Sanitization is always DOM traversal — never a regex scrub of
 * markup — so nesting and entity tricks cannot slip past it.
 */

import { safeUrl } from './urls';

const ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/** Escape a value for interpolation into text or an attribute. */
export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char] ?? char);
}

/** Flatten HTML to plain text for the escaped, no-WebGL fallback list. */
export function stripHtmlToText(html: unknown): string {
    return String(html ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Serialize a value for a `<script type="application/json">` block. `<` is
 * escaped so no payload string can terminate the element early (`</script>`).
 */
export function escapeJsonForScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Elements that never survive sanitization. Compared against an UPPER-CASED
 * tag name so foreign content (SVG/MathML), whose `tagName` preserves the
 * author's casing, cannot slip through as `<script>` or `<foreignObject>`.
 */
const BANNED_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'LINK',
    'META',
    'BASE',
    'FORM',
    'FRAME',
    'FRAMESET',
    'FOREIGNOBJECT',
    'ANNOTATION-XML',
]);

/** Attributes whose value is a URL and therefore has to pass `safeUrl`. */
const URL_ATTRIBUTES = new Set([
    'href',
    'src',
    'srcset',
    'srcdoc',
    'xlink:href',
    'action',
    'formaction',
    'poster',
    'ping',
    'data',
    'background',
]);

function sanitizeElement(element: Element): boolean {
    // `tagName` casing differs between HTML (upper) and foreign content
    // (author-provided); normalize before every comparison.
    if (BANNED_TAGS.has(element.tagName.toUpperCase())) {
        element.remove();
        return false;
    }
    for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith('on')) {
            element.removeAttribute(attribute.name);
            continue;
        }
        if (URL_ATTRIBUTES.has(name) && !safeUrl(attribute.value)) {
            element.removeAttribute(attribute.name);
        }
    }
    return true;
}

function sanitizeChildren(node: Node): void {
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== 1) {
            continue;
        }
        if (sanitizeElement(child as Element)) {
            sanitizeChildren(child);
        }
    }
}

/**
 * Conservative DOM sanitizer for `information` marker HTML. Removes banned
 * elements, inline `on*` handlers and unsafe URL attributes. Falls back to full
 * escaping when there is no DOM (server-side or non-browser test runners).
 */
export function sanitizeHtml(html: unknown): string {
    const source = typeof html === 'string' ? html : '';
    if (!source) {
        return '';
    }
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return escapeHtml(source);
    }
    const template = document.createElement('template');
    template.innerHTML = source;
    sanitizeChildren(template.content);
    return template.innerHTML;
}
