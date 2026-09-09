/**
 * Unit tests for udl-content iDevice (edition code).
 *
 * Focus: the "accessible hidden text | visible label" parsing that splits the
 * button text on the FIRST "|" only. These tests pin the security-relevant
 * behavior of the split (CodeQL incomplete-sanitization fixes) and guard
 * against regressions for legitimate inputs whose visible label contains
 * additional "|" characters.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load the iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

describe('udl-content iDevice (edition)', () => {
    let $exeDevice;
    let appended;

    beforeEach(() => {
        // i18n helpers are invoked eagerly while building the object literal.
        global._ = (s) => s;
        global.c_ = (s) => s;

        // createBlockForm() touches the DOM through a tiny set of jQuery
        // calls. Provide a chainable no-op stub; only .append() captures the
        // generated HTML so the split logic can be asserted.
        appended = '';
        const makeJq = () => {
            const node = {
                append: (html) => {
                    appended += html;
                    return node;
                },
            };
            const passthrough = ['hide', 'show', 'html', 'addClass', 'removeClass'];
            for (const m of passthrough) node[m] = () => node;
            return node;
        };
        global.$ = () => makeJq();

        global.$exeDevice = undefined;

        const filePath = join(__dirname, 'udl-content.js');
        const code = readFileSync(filePath, 'utf-8');
        $exeDevice = loadIdevice(code);
        $exeDevice.idevicePath = '/idevice/';
    });

    /** Build the block HTML and return what createBlockForm appended. */
    function renderBlock(btnTxt) {
        appended = '';
        $exeDevice.createBlockForm({
            btnTxt,
            btnType: 0,
            contMain: '',
            contAlt1: '',
            contAlt2: '',
            contAlt3: '',
        });
        return appended;
    }

    describe('createBlockForm — split on first "|"', () => {
        it('splits "hidden | visible" into the two accessibility spans', () => {
            const html = renderBlock('hidden | visible');
            // Accessible-hidden part (before the first "|").
            expect(html).toContain('class="sr-only-explanation"');
            expect(html).toContain('>hidden </span>');
            // Visible part (after the first "|").
            expect(html).toContain('> visible</span>');
        });

        it('keeps every "|" after the first one in the visible label (no global replace)', () => {
            // Legitimate input: the visible label itself contains pipe characters.
            const html = renderBlock('hidden|a|b|c');
            // Everything after the FIRST pipe stays intact, including later pipes.
            expect(html).toContain('>hidden</span>');
            expect(html).toContain('>a|b|c</span>');
        });

        it('parses purely on the first "|" without a tilde sentinel collision', () => {
            // Older code used "~~" as an intermediate sentinel; the new split is
            // sentinel-free, so input is parsed purely on the first "|".
            const html = renderBlock('left | right side');
            expect(html).toContain('>left </span>');
            expect(html).toContain('> right side</span>');
        });

        it('leaves the explanation block hidden when there is no "|"', () => {
            const html = renderBlock('plain label');
            // btnTextPartsStyle stays display:none (no accessible-hidden parts).
            expect(html).toContain(
                'udlContentFormBlockButtonTxtExplanation" style="display:none"',
            );
        });
    });
});
