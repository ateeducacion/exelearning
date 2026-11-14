import { describe, expect, it } from 'vitest';
import { escapeAttr, escapeHtml, truncateLabel } from './html';

describe('escapeHtml / escapeAttr', () => {
    it('escapes element-context metacharacters', () => {
        expect(escapeHtml('<b>&"x"</b>')).toBe('&lt;b&gt;&amp;"x"&lt;/b&gt;');
    });

    it('escapes quotes in attribute context', () => {
        expect(escapeAttr('a "quoted" <tag>')).toBe('a &quot;quoted&quot; &lt;tag&gt;');
    });

    it('stringifies non-string and nullish input', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(0)).toBe('0');
        expect(escapeAttr(null)).toBe('');
    });
});

describe('truncateLabel', () => {
    it('returns short labels unchanged', () => {
        expect(truncateLabel('short.jpg')).toBe('short.jpg');
        expect(truncateLabel('x'.repeat(60))).toBe('x'.repeat(60));
    });

    it('keeps both ends of a long label', () => {
        const long = `${'a'.repeat(50)}MIDDLE${'b'.repeat(50)}`;
        const out = truncateLabel(long);
        expect(out.length).toBeLessThan(long.length);
        expect(out.startsWith('a'.repeat(28))).toBe(true);
        expect(out.endsWith('b'.repeat(28))).toBe(true);
        expect(out).toContain('…');
    });
});
