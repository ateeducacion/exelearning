/**
 * Unit tests for relate iDevice (edition code).
 *
 * Focused on the sanitization helpers flagged by CodeQL:
 * - encodeURIComponentSafe / decodeURIComponentSafe: percent escaping must be
 *   global so that strings with more than one '%' round-trip correctly
 *   (incomplete-sanitization).
 * - importGlosary: HTML stripping of glossary definitions must be applied
 *   repeatedly until stable so nested/obfuscated tags cannot be recomposed
 *   (incomplete-multi-character-sanitization).
 *
 * iDevice files use 'var $exeDevice = {...}', so they are loaded via the
 * global.loadIdevice helper (see public/vitest.setup.js).
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('relate iDevice (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;
    $exeDevice = global.loadIdevice(join(__dirname, 'relate.js'));
  });

  describe('encodeURIComponentSafe / decodeURIComponentSafe', () => {
    it('escapes every percent sign, not just the first', () => {
      // Before the fix, only the first '%' was escaped (replace without /g).
      const encoded = $exeDevice.encodeURIComponentSafe('a%b%c');
      // No raw '%' from the original input should survive un-escaped.
      expect(encoded).toBe('a%26percnt%3Bb%26percnt%3Bc');
    });

    it('round-trips a string containing multiple percent signs', () => {
      const original = '50% off, 100% sure, 0% risk';
      const encoded = $exeDevice.encodeURIComponentSafe(original);
      const decoded = $exeDevice.decodeURIComponentSafe(encoded);
      expect(decoded).toBe(original);
    });

    it('round-trips a single percent sign', () => {
      const original = 'value is 25%';
      const encoded = $exeDevice.encodeURIComponentSafe(original);
      expect($exeDevice.decodeURIComponentSafe(encoded)).toBe(original);
    });

    it('round-trips a string with no percent signs', () => {
      const original = 'plain text';
      const encoded = $exeDevice.encodeURIComponentSafe(original);
      expect($exeDevice.decodeURIComponentSafe(encoded)).toBe(original);
    });

    it('returns falsy input unchanged for encode', () => {
      expect($exeDevice.encodeURIComponentSafe('')).toBe('');
      expect($exeDevice.encodeURIComponentSafe(undefined)).toBe(undefined);
    });

    it('returns falsy input unchanged for decode', () => {
      expect($exeDevice.decodeURIComponentSafe('')).toBe('');
      expect($exeDevice.decodeURIComponentSafe(undefined)).toBe(undefined);
    });
  });

  describe('importGlosary HTML stripping', () => {
    const buildGlossaryXml = (definition) =>
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<GLOSSARY><INFO></INFO><ENTRIES><ENTRY>` +
      `<CONCEPT>Term</CONCEPT>` +
      `<DEFINITION>${definition}</DEFINITION>` +
      `</ENTRY></ENTRIES></GLOSSARY>`;

    beforeEach(() => {
      // importGlosary pushes parsed cards into cardsGame and then runs
      // postImportProcessing(), which touches DOM that is irrelevant to the
      // sanitization behavior under test. Isolate the sanitization path by
      // stubbing postImportProcessing and starting from an empty list.
      $exeDevice.cardsGame = [];
      $exeDevice.postImportProcessing = () => {};
    });

    it('strips simple HTML tags from definitions', () => {
      $exeDevice.importGlosary(buildGlossaryXml('<b>Hello</b> world'));
      expect($exeDevice.cardsGame).toHaveLength(1);
      expect($exeDevice.cardsGame[0].eTextBk).toBe('Hello world');
    });

    it('strips nested/obfuscated tag payloads, leaving no tag opener behind', () => {
      // Entity-encoding in the XML means DEFINITION.text() decodes back to the
      // literal payload with "<script" substrings, reproducing the seam the
      // sanitizer operates on. The fixed-point loop guarantees the output is
      // stable: re-running the strip cannot expose any further "<...>" tag.
      const encoded =
        '&lt;scr&lt;script&gt;ipt&gt;alert(1)&lt;/scr&lt;/script&gt;ipt&gt;safe';
      $exeDevice.importGlosary(buildGlossaryXml(encoded));
      expect($exeDevice.cardsGame).toHaveLength(1);
      const cleaned = $exeDevice.cardsGame[0].eTextBk;
      // The security property: no tag-opener survives, so no "<script" (or any
      // other tag) remains, and a further strip pass would be a no-op.
      expect(cleaned.toLowerCase()).not.toContain('<script');
      expect(cleaned).not.toContain('<');
      expect(cleaned).toBe(cleaned.replace(/<[^>]*>/g, ''));
      // The non-tag text survives the sanitization.
      expect(cleaned).toContain('safe');
      expect(cleaned).toContain('alert(1)');
    });

    it('keeps plain-text definitions untouched', () => {
      $exeDevice.importGlosary(buildGlossaryXml('A plain definition'));
      expect($exeDevice.cardsGame).toHaveLength(1);
      expect($exeDevice.cardsGame[0].eTextBk).toBe('A plain definition');
    });

    it('returns false when there are no glossary entries', () => {
      const emptyXml =
        `<?xml version="1.0" encoding="UTF-8"?><GLOSSARY></GLOSSARY>`;
      expect($exeDevice.importGlosary(emptyXml)).toBe(false);
    });
  });
});
