import { describe, expect, it } from 'bun:test';
import { CONTENT_PROXY_LABEL_PATTERN, contentProxyLabel, decodeSourcePrefix, encodeSourcePrefix } from './protocol';

const PREFIX = 'https://app.example/view/abc/_/';
const OTHER_PREFIX = 'https://app.example/view/other/_/';

describe('content proxy protocol', () => {
    it('derives a stable DNS label per prefix', () => {
        const label = contentProxyLabel(PREFIX);
        expect(label).toMatch(CONTENT_PROXY_LABEL_PATTERN);
        expect(label).toBe(contentProxyLabel(PREFIX));
        expect(label).not.toBe(contentProxyLabel(OTHER_PREFIX));
        // Fixed vector: any other implementation of the protocol must agree with it.
        expect(contentProxyLabel('https://app.example/')).toBe('xfd2a43e7e8e26491afda2d66a617ae72016629ba');
    });

    it('round-trips a canonical prefix', () => {
        expect(decodeSourcePrefix(encodeSourcePrefix(PREFIX))).toBe(PREFIX);
    });

    it.each([
        ['not base64url', 'a+b/c='],
        ['not a URL', encodeSourcePrefix('nothing')],
        ['http', encodeSourcePrefix('http://app.example/a/')],
        ['another scheme', encodeSourcePrefix('ftp://app.example/a/')],
        ['no trailing slash', encodeSourcePrefix('https://app.example/a')],
        ['credentials', encodeSourcePrefix('https://user:pass@app.example/a/')],
        ['a query', encodeSourcePrefix('https://app.example/a/?b/')],
        ['a fragment', encodeSourcePrefix('https://app.example/a/#b/')],
        ['dot segments', encodeSourcePrefix('https://app.example/a/../b/')],
        ['an upper-case host', encodeSourcePrefix('https://APP.example/a/')],
        ['a default port', encodeSourcePrefix('https://app.example:443/a/')],
    ])('refuses a prefix with %s', (_name, token) => {
        expect(decodeSourcePrefix(token)).toBeNull();
    });

    it('accepts http only when asked to', () => {
        const token = encodeSourcePrefix('http://app.localhost:3004/exe/view/abc/_/');
        expect(decodeSourcePrefix(token)).toBeNull();
        expect(decodeSourcePrefix(token, true)).toBe('http://app.localhost:3004/exe/view/abc/_/');
    });
});
