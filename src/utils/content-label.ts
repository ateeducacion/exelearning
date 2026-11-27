/**
 * Host label of a content item on the content domain (`EXE_CONTENT_DOMAIN`).
 *
 * The label is a keyed hash, so a client cannot choose it or predict the label
 * of another item: every content item gets its own origin, and a request is
 * served only when its host label is the one derived for the content it asks
 * for. The application origin that embeds the content is part of the input, so
 * the `frame-ancestors` value carried in the content URL cannot be swapped.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getJwtSecret } from './jwt-secret';

/** Kinds of content served from the content domain; the key is the label's first character. */
const KIND_PREFIX = { view: 'v', preview: 'p' } as const;

export type ContentKind = keyof typeof KIND_PREFIX;

/** Matches any label this module can produce: a kind letter plus 160 bits of HMAC in hex. */
export const CONTENT_LABEL_PATTERN = /^[a-z][0-9a-f]{40}$/;

/**
 * Derive the DNS-safe label (lowercase alphanumeric, 41 characters) for one
 * content item embedded by one application origin.
 */
export function contentLabel(
    kind: ContentKind,
    id: string,
    appOrigin: string,
    secret: string = getJwtSecret(),
): string {
    const mac = createHmac('sha256', secret)
        .update(JSON.stringify(['exe-content-label-v1', kind, id, appOrigin]))
        .digest('hex');
    return KIND_PREFIX[kind] + mac.slice(0, 40);
}

/** Constant-time check that `label` is the label derived for this content item. */
export function isContentLabel(
    label: string,
    kind: ContentKind,
    id: string,
    appOrigin: string,
    secret: string = getJwtSecret(),
): boolean {
    const expected = Buffer.from(contentLabel(kind, id, appOrigin, secret));
    const actual = Buffer.from(label);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
