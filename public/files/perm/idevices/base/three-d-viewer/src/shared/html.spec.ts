import { describe, expect, it } from 'vitest';
import { escapeHtml, escapeJsonForScript, sanitizeHtml, stripHtmlToText } from './html';

describe('escapeHtml', () => {
    it('escapes every markup metacharacter', () => {
        expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    });

    it('renders null and undefined as an empty string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('stripHtmlToText', () => {
    it('flattens markup to collapsed plain text', () => {
        expect(stripHtmlToText('<p>Hello   <b>world</b></p>')).toBe('Hello world');
    });

    it('returns an empty string for nullish input', () => {
        expect(stripHtmlToText(undefined)).toBe('');
    });
});

describe('escapeJsonForScript', () => {
    it('escapes `<` so a payload cannot terminate the script element', () => {
        const json = escapeJsonForScript({ html: '</script><img onerror=alert(1)>' });
        expect(json).not.toContain('</script>');
        expect(json).toContain('\\u003c/script');
        expect(JSON.parse(json)).toEqual({ html: '</script><img onerror=alert(1)>' });
    });
});

describe('sanitizeHtml', () => {
    it('keeps benign markup untouched', () => {
        expect(sanitizeHtml('<p>Hello <strong>world</strong></p>')).toBe('<p>Hello <strong>world</strong></p>');
    });

    it('returns an empty string for empty or non-string input', () => {
        expect(sanitizeHtml('')).toBe('');
        expect(sanitizeHtml(undefined)).toBe('');
        expect(sanitizeHtml(42)).toBe('');
    });

    it('removes scripts, styles, iframes, objects, embeds and forms', () => {
        const dirty =
            '<p>ok</p><script>evil()</script><style>body{}</style><iframe src="x"></iframe>' +
            '<object data="x"></object><embed src="x"><form action="/x"><input></form>';
        const clean = sanitizeHtml(dirty);
        for (const tag of ['<script', '<style', '<iframe', '<object', '<embed', '<form']) {
            expect(clean.toLowerCase()).not.toContain(tag);
        }
        expect(clean).toContain('<p>ok</p>');
    });

    it('removes inline event handlers regardless of case', () => {
        const clean = sanitizeHtml('<img src="a.png" onerror="alert(1)" ONLOAD="alert(2)">');
        expect(clean).not.toContain('onerror');
        expect(clean.toLowerCase()).not.toContain('onload');
        expect(clean).toContain('a.png');
    });

    it('removes unsafe URL schemes from href and src', () => {
        const clean = sanitizeHtml('<a href="javascript:alert(1)">x</a><img src="vbscript:msgbox">');
        expect(clean).not.toContain('javascript:');
        expect(clean).not.toContain('vbscript:');
    });

    it('keeps safe and relative URLs', () => {
        const clean = sanitizeHtml('<a href="https://example.org">x</a><a href="page.html">y</a>');
        expect(clean).toContain('https://example.org');
        expect(clean).toContain('page.html');
    });

    it('removes lowercase SVG foreign-content elements that a tagName check would miss', () => {
        // Inside <svg>, `tagName` preserves the author's casing, so a naive
        // uppercase lookup would let `script` and `foreignObject` through.
        const clean = sanitizeHtml('<svg><script>alert(1)</script><foreignObject><b>x</b></foreignObject></svg>');
        expect(clean.toLowerCase()).not.toContain('<script');
        expect(clean.toLowerCase()).not.toContain('foreignobject');
    });

    it('removes MathML annotation-xml, which can smuggle HTML', () => {
        const clean = sanitizeHtml('<math><annotation-xml encoding="text/html"><b>x</b></annotation-xml></math>');
        expect(clean.toLowerCase()).not.toContain('annotation-xml');
    });

    it('strips an unsafe xlink:href on an SVG <use>', () => {
        const clean = sanitizeHtml('<svg><use xlink:href="javascript:alert(1)"></use></svg>');
        expect(clean).not.toContain('javascript:');
    });

    it('strips formaction, ping, poster and srcdoc when they carry an unsafe scheme', () => {
        const clean = sanitizeHtml(
            '<button formaction="javascript:a()"></button><a ping="javascript:b()">x</a>' +
                '<video poster="javascript:c()"></video><div srcdoc="javascript:d()"></div>',
        );
        expect(clean).not.toContain('javascript:');
    });

    it('sanitizes nested content, not just the top level', () => {
        const clean = sanitizeHtml('<div><section><a href="javascript:x()" onclick="y()">deep</a></section></div>');
        expect(clean).not.toContain('javascript:');
        expect(clean).not.toContain('onclick');
        expect(clean).toContain('deep');
    });
});
