/**
 * Unit tests for word-search iDevice (edition)
 *
 * Focused on importGlosary HTML-tag sanitization of the DEFINITION field.
 * The strip must be applied to a fixed point so nested/obfuscated payloads
 * such as "<scr<script>ipt>" cannot reassemble into a tag after one pass
 * (CodeQL: incomplete-multi-character-sanitization).
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('word-search iDevice (edition)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'word-search.js'));
    });

    /**
     * Build a Moodle glossary XML string with a single ENTRY whose CONCEPT
     * is a short single word (so it passes the import filter) and whose
     * DEFINITION carries the supplied (possibly malicious) markup.
     */
    function glossaryXml(concept, definition) {
        // Moodle glossary exports store HTML inside DEFINITION as XML-escaped
        // entities. Escaping here reproduces that: the markup survives XML
        // parsing and jQuery's .text() decodes it back to the literal tags,
        // which the importer must then strip.
        const escaped = definition
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<?xml version="1.0" encoding="UTF-8"?>
            <GLOSSARY>
                <INFO>
                    <ENTRIES>
                        <ENTRY>
                            <CONCEPT>${concept}</CONCEPT>
                            <DEFINITION>${escaped}</DEFINITION>
                        </ENTRY>
                    </ENTRIES>
                </INFO>
            </GLOSSARY>`;
    }

    it('exposes importGlosary as a function', () => {
        expect(typeof $exeDevice.importGlosary).toBe('function');
    });

    it('strips simple HTML tags from the definition', () => {
        let captured = null;
        $exeDevice.addWords = (words) => {
            captured = words;
        };

        $exeDevice.importGlosary(glossaryXml('term', '<b>hello</b> world'));

        expect(captured).toHaveLength(1);
        expect(captured[0].word).toBe('term');
        expect(captured[0].definition).toBe('hello world');
    });

    it('removes nested/obfuscated tags so no tag survives a single pass', () => {
        let captured = null;
        $exeDevice.addWords = (words) => {
            captured = words;
        };

        // After one naive pass this leaves "<script>alert(1)</script>".
        // The fixed-point loop must keep stripping until nothing remains.
        const payload = '<scr<script>ipt>alert(1)</script>safe';
        $exeDevice.importGlosary(glossaryXml('term', payload));

        expect(captured).toHaveLength(1);
        const definition = captured[0].definition;
        // The security property: no opening tag delimiter survives, so the
        // reassembled "<script" payload is gone. (A stray ">" left as text
        // content is inert and not a tag.)
        expect(definition.toLowerCase()).not.toContain('<script');
        expect(definition).not.toContain('<');
        expect(definition).toContain('safe');
    });

    it('loops to a fixed point when removal reassembles a new tag', () => {
        let captured = null;
        $exeDevice.addWords = (words) => {
            captured = words;
        };

        // A naive single pass on "<<script>script>" removes "<script>" and
        // leaves "<script>" behind. The fixed-point loop must strip it too.
        $exeDevice.importGlosary(glossaryXml('term', '<<script>script>keep'));

        expect(captured).toHaveLength(1);
        expect(captured[0].definition.toLowerCase()).not.toContain('<script');
        expect(captured[0].definition).toContain('keep');
    });

    it('preserves plain-text definitions unchanged', () => {
        let captured = null;
        $exeDevice.addWords = (words) => {
            captured = words;
        };

        $exeDevice.importGlosary(glossaryXml('term', 'just plain text'));

        expect(captured).toHaveLength(1);
        expect(captured[0].definition).toBe('just plain text');
    });
});
