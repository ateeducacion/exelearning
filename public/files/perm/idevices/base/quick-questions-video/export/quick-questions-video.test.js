/**
 * Unit tests for quick-questions-video iDevice (export/runtime)
 *
 * Focused on getIDMediaTeca, which resolves Mediateca (educa.madrid.org)
 * video sharing URLs into streaming URLs. The resolution must validate the
 * host/path exactly so that look-alike URLs cannot be smuggled through
 * (incomplete-url-substring-sanitization).
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $quickquestionsvideo globally.
 * Replaces 'var $quickquestionsvideo' with 'global.$quickquestionsvideo' to
 * make it accessible from the test.
 */
function loadExportIdevice(code) {
  const modifiedCode = code.replace(
    /var\s+\$quickquestionsvideo\s*=/,
    'global.$quickquestionsvideo =',
  );

  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$quickquestionsvideo;
}

describe('quick-questions-video iDevice export', () => {
  let $quickquestionsvideo;

  beforeEach(() => {
    global.$quickquestionsvideo = undefined;
    // Mock jQuery. The trailing `$(function () { ... })` ready handler must not
    // execute init() during eval, so the callback is simply ignored.
    global.$ = () => ({ html: () => {}, eq: () => ({ attr: () => '' }), length: 0 });
    global.$.fn = {};

    const filePath = join(__dirname, 'quick-questions-video.js');
    const code = readFileSync(filePath, 'utf-8');

    $quickquestionsvideo = loadExportIdevice(code);
  });

  afterEach(() => {
    delete global.$quickquestionsvideo;
    delete global.$;
  });

  describe('getIDMediaTeca', () => {
    it('resolves a legitimate Mediateca video sharing URL', () => {
      const result = $quickquestionsvideo.getIDMediaTeca(
        'https://mediateca.educa.madrid.org/video/ABC123',
      );
      expect(result).toBe(
        'http://mediateca.educa.madrid.org/streaming.php?id=ABC123',
      );
    });

    it('strips the query string when extracting the id', () => {
      const result = $quickquestionsvideo.getIDMediaTeca(
        'https://mediateca.educa.madrid.org/video/ABC123?autoplay=1',
      );
      expect(result).toBe(
        'http://mediateca.educa.madrid.org/streaming.php?id=ABC123',
      );
    });

    it('preserves nested path segments after /video/', () => {
      const result = $quickquestionsvideo.getIDMediaTeca(
        'https://mediateca.educa.madrid.org/video/ABC/DEF',
      );
      expect(result).toBe(
        'http://mediateca.educa.madrid.org/streaming.php?id=ABC/DEF',
      );
    });

    it('rejects a look-alike host (subdomain attack)', () => {
      expect(
        $quickquestionsvideo.getIDMediaTeca(
          'https://mediateca.educa.madrid.org.evil.com/video/ABC123',
        ),
      ).toBe('');
    });

    it('rejects a URL that only embeds the target as a query parameter', () => {
      expect(
        $quickquestionsvideo.getIDMediaTeca(
          'https://evil.com/?x=https://mediateca.educa.madrid.org/video/ABC123',
        ),
      ).toBe('');
    });

    it('rejects the correct host on a non-/video/ path', () => {
      expect(
        $quickquestionsvideo.getIDMediaTeca(
          'https://mediateca.educa.madrid.org/audio/ABC123',
        ),
      ).toBe('');
    });

    it('rejects the correct host and path over plain http', () => {
      expect(
        $quickquestionsvideo.getIDMediaTeca(
          'http://mediateca.educa.madrid.org/video/ABC123',
        ),
      ).toBe('');
    });

    it('rejects an empty /video/ path with no id', () => {
      expect(
        $quickquestionsvideo.getIDMediaTeca(
          'https://mediateca.educa.madrid.org/video/',
        ),
      ).toBe('');
    });

    it('returns empty string for an invalid URL', () => {
      expect($quickquestionsvideo.getIDMediaTeca('not a url')).toBe('');
    });

    it('returns empty string for a falsy input', () => {
      expect($quickquestionsvideo.getIDMediaTeca('')).toBe('');
      expect($quickquestionsvideo.getIDMediaTeca(undefined)).toBe('');
      expect($quickquestionsvideo.getIDMediaTeca(null)).toBe('');
    });
  });
});
