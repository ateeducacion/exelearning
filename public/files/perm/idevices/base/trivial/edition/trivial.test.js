/**
 * Unit tests for trivial iDevice (edition)
 *
 * Covers:
 * - stripHtmlTags: HTML-tag sanitizer used when importing glossary entries.
 *   It must remove tags even from obfuscated/nested payloads that would
 *   survive a single-pass strip.
 * - Numeric field limits: the silence-time field truncates on keyup; capping
 *   it at one digit made ordinary values impossible to enter.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('trivial iDevice (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;
    $exeDevice = global.loadIdevice(join(__dirname, 'trivial.js'));
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

describe('trivial iDevice edition', () => {
  let $exeDevice;
  let previousItinerary;

  beforeEach(() => {
    global.$exeDevice = undefined;
    previousItinerary = $exeDevicesEdition.iDevice.gamification.itinerary;
    // addEvents wires the whole editor. The itinerary component lives outside
    // this iDevice's source, so it is stubbed rather than exercised here.
    $exeDevicesEdition.iDevice.gamification.itinerary = {
      addEvents: () => {},
      getTab: () => '',
      init: () => {},
      setValues: () => {},
    };
    document.body.innerHTML = `
      <script></script>
      <form id="gameQEIdeviceForm">
            <input id="trivialETimeSilence" />
      </form>`;
    $exeDevice = global.loadIdevice(join(__dirname, 'trivial.js'));
    $exeDevice.addEvents();
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
    document.body.innerHTML = '';
  });

  describe('numeric field limits', () => {
    it('keeps a 3-digit silence time', () => {
      $('#trivialETimeSilence').val('120').trigger('keyup');

      expect($('#trivialETimeSilence').val()).toBe('120');
    });

    it('truncates the silence time beyond 3 digits and drops non-digits', () => {
      $('#trivialETimeSilence').val('1a2345').trigger('keyup');

      expect($('#trivialETimeSilence').val()).toBe('123');
    });
  });
});
