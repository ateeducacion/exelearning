/**
 * Unit tests for mathproblems iDevice — placeholder-matching regex.
 *
 * The export and edition runtimes locate `{X}` answer placeholders with a
 * regex character class. It previously read `[a-zA-z]`, an overly-large range
 * (CodeQL js/overly-large-range): `A-z` spans the six ASCII punctuation
 * characters between `Z` and `a` (`[ \ ] ^ _ ` `), so `{[}`, `{\}`, `{^}` etc.
 * were wrongly treated as placeholders. The fix narrows it to `[a-zA-Z]`.
 *
 * Both runtime twins (export + edition) embed this regex inline with no module
 * seam, so these tests (a) guard against the broad range reappearing in either
 * file and (b) assert the intended letters-only matching semantics.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TWINS = {
    export: join(__dirname, 'mathproblems.js'),
    edition: join(__dirname, '..', 'edition', 'mathproblems.js'),
};

describe('mathproblems placeholder regex', () => {
    describe('regression guard — no overly-large range in either twin', () => {
        for (const [name, path] of Object.entries(TWINS)) {
            it(`${name} runtime uses [a-zA-Z], never [a-zA-z]`, () => {
                const code = readFileSync(path, 'utf-8');
                expect(code).not.toMatch(/\[a-zA-z\]/);
                expect(code).toContain('/\\{[a-zA-Z]\\}/g');
            });
        }
    });

    describe('matching semantics of /\\{[a-zA-Z]\\}/g', () => {
        const placeholder = () => /\{[a-zA-Z]\}/g;

        it('matches single-letter placeholders', () => {
            for (const token of ['{x}', '{A}', '{Z}', '{a}', '{m}']) {
                expect(token.match(placeholder())).toEqual([token]);
            }
        });

        it('does NOT match the punctuation chars that [a-zA-z] wrongly included', () => {
            for (const token of ['{[}', '{\\}', '{]}', '{^}', '{_}', '{`}']) {
                expect(token.match(placeholder())).toBeNull();
            }
        });

        it('finds every placeholder in a wording string', () => {
            const wording = 'Solve {a} plus {B} for the value {z}.';
            expect(wording.match(placeholder())).toEqual(['{a}', '{B}', '{z}']);
        });
    });
});
