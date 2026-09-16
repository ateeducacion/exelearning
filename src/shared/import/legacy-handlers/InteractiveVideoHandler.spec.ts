/**
 * InteractiveVideoHandler Unit Tests
 *
 * Focused tests for the HTML entity decoding chain used when transforming
 * legacy Interactive Video iDevices. The decode order matters for security:
 * ampersand must be decoded LAST so that double-encoded entities such as
 * "&amp;lt;" decode to the literal text "&lt;" and not to "<".
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { InteractiveVideoHandler } from './InteractiveVideoHandler';

/**
 * Test subclass exposing the private decodeHtmlEntities method.
 */
class TestableInteractiveVideoHandler extends InteractiveVideoHandler {
    public decode(str: string): string {
        // Access the private method through the instance for testing.
        return (this as unknown as { decodeHtmlEntities(s: string): string }).decodeHtmlEntities(str);
    }
}

describe('InteractiveVideoHandler.decodeHtmlEntities', () => {
    let handler: TestableInteractiveVideoHandler;

    beforeEach(() => {
        handler = new TestableInteractiveVideoHandler();
    });

    it('returns empty string for empty input', () => {
        expect(handler.decode('')).toBe('');
    });

    it('decodes simple named entities', () => {
        expect(handler.decode('&lt;div&gt;')).toBe('<div>');
        expect(handler.decode('&quot;hi&quot;')).toBe('"hi"');
        expect(handler.decode('&#39;x&#39;')).toBe("'x'");
        expect(handler.decode('a&nbsp;b')).toBe('a b');
        expect(handler.decode('a&amp;b')).toBe('a&b');
    });

    it('does not double-decode encoded entities (ampersand decoded last)', () => {
        // Security property: the literal text "&lt;" was encoded as "&amp;lt;".
        // It must decode back to "&lt;", NOT to "<".
        expect(handler.decode('&amp;lt;')).toBe('&lt;');
        expect(handler.decode('&amp;gt;')).toBe('&gt;');
        expect(handler.decode('&amp;quot;')).toBe('&quot;');
        // "&amp;amp;" is the encoded form of "&amp;" and must decode to "&amp;".
        expect(handler.decode('&amp;amp;')).toBe('&amp;');
    });

    it('does not let a double-encoded script tag inject markup', () => {
        // "&amp;lt;script&amp;gt;" is the safe encoded form of the literal
        // text "&lt;script&gt;" and must NOT decode to a real "<script>" tag.
        const decoded = handler.decode('&amp;lt;script&amp;gt;');
        expect(decoded).toBe('&lt;script&gt;');
        expect(decoded).not.toContain('<script>');
    });
});
