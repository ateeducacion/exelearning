/**
 * Unit tests for the Electrical Circuits iDevice (edition code).
 *
 * Focus: importGlosary() HTML-tag stripping must be complete sanitization.
 * A single-pass strip like .replace(/<[^>]*>/g, '') can be defeated because
 * removing one match can splice the remaining characters into a NEW tag
 * (e.g. "<scr<script>ipt>" -> "<script>"). The fix applies the replacement
 * repeatedly until the string stops changing.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('electrical-circuits iDevice (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;
    $exeDevice = global.loadIdevice(join(__dirname, 'electrical-circuits.js'));
  });

  describe('importGlosary - HTML tag sanitization', () => {
    /**
     * Build a minimal Moodle-style glossary XML document with a single entry.
     * The CONCEPT becomes the solution and the DEFINITION becomes the question.
     */
    const buildGlossaryXml = (concept, definition) =>
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<GLOSSARY><INFO><ENTRIES><ENTRY>` +
      `<CONCEPT>${concept}</CONCEPT>` +
      `<DEFINITION>${definition}</DEFINITION>` +
      `</ENTRY></ENTRIES></INFO></GLOSSARY>`;

    /**
     * Invoke importGlosary with a single glossary entry and return the
     * imported questions captured from addQuestions().
     */
    const importSingleEntry = (concept, definition) => {
      let captured = null;
      $exeDevice.addQuestions = vi.fn((questions) => {
        captured = questions;
      });
      $exeDevice.importGlosary(buildGlossaryXml(concept, definition));
      return captured;
    };

    it('strips simple HTML tags from the definition', () => {
      const captured = importSingleEntry('Ohm', '<p>Voltage law</p>');
      expect(captured).toHaveLength(1);
      expect(captured[0].quextion).toBe('Voltage law');
      expect(captured[0].solutionQuestion).toBe('Ohm');
    });

    it('preserves legitimate plain-text definitions unchanged', () => {
      const captured = importSingleEntry('Ohm', 'Voltage equals current times resistance');
      expect(captured).toHaveLength(1);
      expect(captured[0].quextion).toBe('Voltage equals current times resistance');
    });

    it('keeps text content while removing surrounding tags', () => {
      const captured = importSingleEntry('Node', '<b>A</b> point in a <i>circuit</i>');
      expect(captured).toHaveLength(1);
      expect(captured[0].quextion).toBe('A point in a circuit');
    });

    it('leaves no complete HTML tag behind for a nested/obfuscated <script> payload', () => {
      // The angle brackets must arrive as parsed TEXT (entity-encoded in the
      // source XML) so that the tag strip in importGlosary actually runs on
      // them rather than the XML parser swallowing the markup.
      const captured = importSingleEntry(
        'XSS',
        '&lt;scr&lt;script&gt;ipt&gt;alert(1)&lt;/script&gt;'
      );
      expect(captured).toHaveLength(1);
      const definition = captured[0].quextion;
      // Security property: no complete <...> tag survives, so nothing can be
      // injected as live markup. In particular no "<script" tag remains, and
      // the fixed-point loop guarantees a second pass cannot resurrect one.
      expect(definition.toLowerCase()).not.toContain('<script');
      expect(definition).not.toMatch(/<[^>]*>/);
      // The harmless text node content survives.
      expect(definition).toContain('alert(1)');
    });

    it('leaves no complete tag behind for interleaved opening brackets', () => {
      // "<<a>img src=x onerror=alert(1)>after" exercises overlapping brackets;
      // every complete <...> tag must be gone after stripping.
      const captured = importSingleEntry(
        'XSS2',
        '&lt;&lt;a&gt;img src=x onerror=alert(1)&gt;after'
      );
      expect(captured).toHaveLength(1);
      const definition = captured[0].quextion;
      expect(definition).not.toMatch(/<[^>]*>/);
      expect(definition).toContain('after');
    });

    it('returns false when the XML cannot be parsed', () => {
      $exeDevice.addQuestions = vi.fn();
      const result = $exeDevice.importGlosary('<GLOSSARY><ENTRIES');
      expect(result).toBe(false);
      expect($exeDevice.addQuestions).not.toHaveBeenCalled();
    });

    it('returns false when there are no ENTRIES', () => {
      $exeDevice.addQuestions = vi.fn();
      const result = $exeDevice.importGlosary(
        '<?xml version="1.0"?><GLOSSARY><INFO></INFO></GLOSSARY>'
      );
      expect(result).toBe(false);
      expect($exeDevice.addQuestions).not.toHaveBeenCalled();
    });
  });
});
