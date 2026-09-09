import { describe, expect, it } from 'vitest';
import { isAbsoluteUrl, joinAppUrl, normalizePath, safeUrl, stripQueryAndHash, stripUnsafeUrl } from './urls';

describe('stripUnsafeUrl', () => {
    it('rejects the ephemeral and executable schemes', () => {
        for (const url of ['blob:http://x/1', 'data:image/png;base64,AA', 'javascript:alert(1)', ' vbscript:x']) {
            expect(stripUnsafeUrl(url)).toBe('');
        }
    });

    it('keeps and trims everything else', () => {
        expect(stripUnsafeUrl('  asset://a.png  ')).toBe('asset://a.png');
        expect(stripUnsafeUrl('https://example.org/a')).toBe('https://example.org/a');
        expect(stripUnsafeUrl(undefined)).toBe('');
    });
});

describe('safeUrl', () => {
    it('allows the safe schemes plus blob:, which only ever appears at render time', () => {
        for (const url of ['https://a', 'http://a', 'mailto:a@b', 'tel:+1', 'asset://a.png', 'blob:http://x/1']) {
            expect(safeUrl(url)).toBe(url);
        }
    });

    it('allows relative and fragment URLs', () => {
        expect(safeUrl('page.html')).toBe('page.html');
        expect(safeUrl('#anchor')).toBe('#anchor');
        expect(safeUrl('../content/resources/a.png')).toBe('../content/resources/a.png');
    });

    it('rejects executable and unknown schemes', () => {
        for (const url of ['javascript:alert(1)', ' JavaScript:alert(1)', 'vbscript:x', 'gopher://a']) {
            expect(safeUrl(url)).toBe('');
        }
    });

    it('returns an empty string for empty or non-string input', () => {
        expect(safeUrl('')).toBe('');
        expect(safeUrl(null)).toBe('');
    });
});

describe('normalizePath', () => {
    it('unifies slashes and strips the leading one', () => {
        expect(normalizePath('\\a\\b/c')).toBe('a/b/c');
        expect(normalizePath('/a/b')).toBe('a/b');
    });

    it('passes absolute URLs through untouched', () => {
        expect(normalizePath('https://example.org/a')).toBe('https://example.org/a');
        expect(normalizePath('//cdn/a.glb')).toBe('//cdn/a.glb');
    });

    it('returns an empty string for nullish input', () => {
        expect(normalizePath(undefined)).toBe('');
        expect(normalizePath('   ')).toBe('');
    });
});

describe('stripQueryAndHash', () => {
    it('drops the query string and the fragment', () => {
        expect(stripQueryAndHash('a/b.glb?v=2#frag')).toBe('a/b.glb');
        expect(stripQueryAndHash('a/b.glb')).toBe('a/b.glb');
    });
});

describe('isAbsoluteUrl', () => {
    it('recognises protocol and protocol-relative URLs', () => {
        expect(isAbsoluteUrl('https://a')).toBe(true);
        expect(isAbsoluteUrl('//a')).toBe(true);
        expect(isAbsoluteUrl('/a')).toBe(false);
        expect(isAbsoluteUrl('a')).toBe(false);
    });
});

describe('joinAppUrl', () => {
    it('joins the base URL, the base path and the path', () => {
        expect(joinAppUrl('https://host', 'app', 'files/a.js')).toBe('https://host/app/files/a.js');
    });

    it('tolerates stray slashes on every part', () => {
        expect(joinAppUrl('https://host///', '/app/', '///files/a.js')).toBe('https://host/app/files/a.js');
    });

    it('returns a rooted path when there is no base', () => {
        expect(joinAppUrl('', '', 'files/a.js')).toBe('/files/a.js');
        expect(joinAppUrl(undefined, undefined, 'files/a.js')).toBe('/files/a.js');
    });
});
