import { describe, expect, it } from 'vitest';
import { isSafeLinkUrl, normalizeLinkUrl, videoEmbedUrl } from './urls';

describe('isSafeLinkUrl', () => {
    it('accepts http(s), mailto, tel, asset and relative URLs', () => {
        expect(isSafeLinkUrl('https://example.com')).toBe(true);
        expect(isSafeLinkUrl('http://example.com/a?b=c')).toBe(true);
        expect(isSafeLinkUrl('mailto:someone@example.com')).toBe(true);
        expect(isSafeLinkUrl('tel:+34123456789')).toBe(true);
        expect(isSafeLinkUrl('asset://uploads/photo.jpg')).toBe(true);
        expect(isSafeLinkUrl('../page.html')).toBe(true);
        expect(isSafeLinkUrl('#anchor')).toBe(true);
    });

    it('rejects scripting and data URLs', () => {
        expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeLinkUrl('JAVASCRIPT:alert(1)')).toBe(false);
        expect(isSafeLinkUrl('data:text/html,<script>1</script>')).toBe(false);
        expect(isSafeLinkUrl('vbscript:x')).toBe(false);
    });

    it('rejects empty and blank input', () => {
        expect(isSafeLinkUrl('')).toBe(false);
        expect(isSafeLinkUrl('   ')).toBe(false);
    });
});

describe('normalizeLinkUrl', () => {
    it('trims safe URLs and empties unsafe or non-string values', () => {
        expect(normalizeLinkUrl('  https://example.com  ')).toBe('https://example.com');
        expect(normalizeLinkUrl('javascript:alert(1)')).toBe('');
        expect(normalizeLinkUrl(42)).toBe('');
        expect(normalizeLinkUrl(undefined)).toBe('');
    });
});

describe('videoEmbedUrl', () => {
    it('maps YouTube URLs (watch, embed, short) to the embed form', () => {
        expect(videoEmbedUrl('https://www.youtube.com/watch?v=abc-123')).toBe('https://www.youtube.com/embed/abc-123');
        expect(videoEmbedUrl('https://youtube.com/embed/xYz_9')).toBe('https://www.youtube.com/embed/xYz_9');
        expect(videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123');
    });

    it('maps Vimeo URLs including unlisted hashes', () => {
        expect(videoEmbedUrl('https://vimeo.com/12345')).toBe('https://player.vimeo.com/video/12345');
        expect(videoEmbedUrl('https://vimeo.com/video/12345')).toBe('https://player.vimeo.com/video/12345');
        expect(videoEmbedUrl('https://vimeo.com/12345/abcdef')).toBe('https://player.vimeo.com/video/12345?h=abcdef');
    });

    it('maps EducaMadrid Mediateca URLs', () => {
        expect(videoEmbedUrl('https://mediateca.educa.madrid.org/video/some-id')).toBe(
            'https://mediateca.educa.madrid.org/video/some-id/fs',
        );
        expect(videoEmbedUrl('https://mediateca.educa.madrid.org/media/other_id')).toBe(
            'https://mediateca.educa.madrid.org/video/other_id/fs',
        );
    });

    it('returns null for direct media files and unknown providers', () => {
        expect(videoEmbedUrl('https://example.com/movie.mp4')).toBeNull();
        expect(videoEmbedUrl('asset://videos/clip.webm')).toBeNull();
        expect(videoEmbedUrl('')).toBeNull();
    });
});
