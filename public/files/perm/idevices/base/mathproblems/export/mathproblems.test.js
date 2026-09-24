/**
 * Unit tests for mathproblems iDevice (export/runtime).
 *
 * Covers:
 * - Placeholder-matching regex: `{X}` used to use `[a-zA-z]`, an overly-large
 *   range (CodeQL js/overly-large-range). The fix narrows it to `[a-zA-Z]`.
 * - SCORM completion: common.js derives completion from
 *   `gameOver === true || auto !== true`, so without the flag a page stayed
 *   `incomplete` in the LMS. gameOver() after the reveal delay comes too late
 *   for the report that carries the final score.
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TWINS = {
    export: join(__dirname, 'mathproblems.js'),
    edition: join(__dirname, '..', 'edition', 'mathproblems.js'),
};

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeMathProblems\s*=/, 'global.$eXeMathProblems =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$eXeMathProblems\.init\(\);\s*\}\);?/g,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeMathProblems;
}

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

describe('mathproblems iDevice export', () => {
    let $eXeMathProblems;

    beforeEach(() => {
        global.$eXeMathProblems = undefined;
        const code = readFileSync(join(__dirname, 'mathproblems.js'), 'utf-8');
        $eXeMathProblems = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('completion on the last question', () => {
        function setupAnswer(overrides) {
            document.body.innerHTML = `
                <div id="mthpMainContainer-0">
                    <div id="mthpPHits-0"></div>
                    <div id="mthpPErrors-0"></div>
                    <div id="mthpPScore-0"></div>
                    <div id="mthpRepeatActivity-0"></div>
                </div>`;
            $eXeMathProblems.initialScore = '';
            $eXeMathProblems.options[0] = Object.assign(
                {
                    id: 0,
                    isScorm: 1,
                    scorm: { repeatActivity: true },
                    gameOver: false,
                    hits: 2,
                    errors: 0,
                    numberQuestions: 3,
                    obtainedClue: false,
                    itinerary: { showClue: false, percentageClue: 0, clueGame: '' },
                    msgs: { msgYouScore: 'Score', msgInformation: 'info' },
                },
                overrides
            );
            vi.spyOn($eXeMathProblems, 'getMessageAnswer').mockReturnValue('');
            vi.spyOn($eXeMathProblems, 'sendScore').mockImplementation(() => {});
            vi.spyOn($eXeMathProblems, 'showMessage').mockImplementation(() => {});
            vi.spyOn($eXeMathProblems, 'saveEvaluation').mockImplementation(() => {});
        }

        it('marks the activity finished when no questions are left', () => {
            // 2 hits + this one = 3 of 3.
            setupAnswer({ hits: 2, errors: 0, numberQuestions: 3 });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(true);
        });

        // Running out of questions through errors ends the attempt just the same.
        it('marks it finished when the last question is answered wrongly', () => {
            setupAnswer({ hits: 1, errors: 1, numberQuestions: 3 });

            $eXeMathProblems.updateScore(false, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(true);
        });

        // An intermediate answer must not close the attempt: the page would go
        // to passed/failed while the learner is still playing.
        it('leaves the activity unfinished while questions remain', () => {
            setupAnswer({ hits: 0, errors: 0, numberQuestions: 3 });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(false);
        });

        it('raises the flag before it reports, so the two cannot disagree', () => {
            setupAnswer({ hits: 2, errors: 0, numberQuestions: 3 });
            let flagWhenReported;
            $eXeMathProblems.sendScore.mockImplementation(() => {
                flagWhenReported = $eXeMathProblems.options[0].gameOver;
            });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.sendScore).toHaveBeenCalledWith(true, 0);
            expect(flagWhenReported).toBe(true);
        });
    });
});
