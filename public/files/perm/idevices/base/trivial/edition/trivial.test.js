/**
 * Unit tests for trivial iDevice (edition code)
 *
 * Focused on stripHtmlTags, the HTML-tag sanitizer used when importing
 * glossary entries. It must remove tags even from obfuscated/nested
 * payloads that would survive a single-pass strip.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$exeDevice;
}

describe('trivial iDevice (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;
    const filePath = join(__dirname, 'trivial.js');
    const code = readFileSync(filePath, 'utf-8');
    $exeDevice = loadIdevice(code);
  });

  describe('stripHtmlTags', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.stripHtmlTags).toBe('function');
    });

    it('removes simple HTML tags but keeps text content', () => {
      expect($exeDevice.stripHtmlTags('<b>hello</b>')).toBe('hello');
      expect($exeDevice.stripHtmlTags('a <i>b</i> c')).toBe('a b c');
    });

    it('preserves plain text without tags unchanged', () => {
      expect($exeDevice.stripHtmlTags('plain definition')).toBe('plain definition');
    });

    it('strips a nested/obfuscated script payload leaving no script tag', () => {
      const payload = '<scr<script>ipt>alert(1)</script>';
      const out = $exeDevice.stripHtmlTags(payload);
      // No reconstituted <script tag should survive (case-insensitive),
      // and the result is stable (a second strip would not change it).
      expect(out.toLowerCase()).not.toContain('<script');
      expect(out).toBe($exeDevice.stripHtmlTags(out));
    });

    it('reaches a fixed point: re-stripping the output never changes it', () => {
      const samples = ['<<a>b>x', '<a><b', '<scr<a>ipt>', '<<script>>'];
      for (const sample of samples) {
        const once = $exeDevice.stripHtmlTags(sample);
        expect($exeDevice.stripHtmlTags(once)).toBe(once);
      }
    });

    it('handles null/undefined by returning an empty string', () => {
      expect($exeDevice.stripHtmlTags(null)).toBe('');
      expect($exeDevice.stripHtmlTags(undefined)).toBe('');
    });
  });
});
