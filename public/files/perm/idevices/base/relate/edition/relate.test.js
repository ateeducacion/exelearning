/**
 * Unit tests for the Relate iDevice edition script.
 *
 * Covers:
 * - The sanitization helpers flagged by CodeQL:
 *   - encodeURIComponentSafe / decodeURIComponentSafe: percent escaping must be
 *     global so that strings with more than one '%' round-trip correctly
 *     (incomplete-sanitization).
 *   - importGlosary: HTML stripping of glossary definitions must be applied
 *     repeatedly until stable so nested/obfuscated tags cannot be recomposed
 *     (incomplete-multi-character-sanitization).
 * - The resources the edition owns and that outlive the edition form unless
 *   the edition lifecycle releases them: the import FileReader and the audio
 *   preview player.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('relate iDevice', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        // `loadIdevice` also attaches the real EditionLifecycle, exactly as
        // IdeviceNode does before calling init() in the workarea.
        $exeDevice = global.loadIdevice(join(__dirname, 'relate.js'));
    });

    describe('classIdevice', () => {
        it('has correct class identifier', () => {
            expect($exeDevice.classIdevice).toBe('relate');
        });
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

    describe('edition lifecycle', () => {
        let savedGamification;
        let savedMedia;

        beforeEach(() => {
            savedGamification = global.$exeDevicesEdition.iDevice.gamification;
            global.$exeDevicesEdition.iDevice.gamification = {
                ...savedGamification,
                progressBar: { addEvents: vi.fn() },
                itinerary: { addEvents: vi.fn() },
                share: { addEvents: vi.fn(), downloadBlob: vi.fn(() => true) },
                helpers: { stopSound: vi.fn(), playSound: vi.fn() },
            };
            savedMedia = global.$exeDevices.iDevice.gamification.media;
            global.$exeDevices.iDevice.gamification.media = {
                extractURLGD: url => url,
            };

            document.body.innerHTML = `
        <div id="relateQIdeviceForm">
          <input id="eXeGameImportGame" type="file">
        </div>
      `;

            $exeDevice.addEvents();
        });

        afterEach(() => {
            // Close the edition the test opened, so nothing it registered leaks
            // into the next one.
            $exeDevice.$lifecycle.destroy();
            document.body.innerHTML = '';
            global.$exeDevicesEdition.iDevice.gamification = savedGamification;
            global.$exeDevices.iDevice.gamification.media = savedMedia;
        });

        describe('import FileReader', () => {
            /**
             * Drive the file input the way a user picking a file does, and hand back
             * the FileReader the edition created for it.
             *
             * @returns {FileReader}
             */
            function pickFile() {
                const readers = [];
                const RealFileReader = global.FileReader;
                class TrackedFileReader extends RealFileReader {
                    constructor() {
                        super();
                        readers.push(this);
                    }
                }
                global.FileReader = TrackedFileReader;
                try {
                    const input = document.getElementById('eXeGameImportGame');
                    Object.defineProperty(input, 'files', {
                        configurable: true,
                        value: [new File(['card'], 'game.txt', { type: 'text/plain' })],
                    });
                    $(input).trigger('change');
                } finally {
                    global.FileReader = RealFileReader;
                }
                return readers[0];
            }

            it('aborts a read that is still in flight when the edition closes', () => {
                const reader = pickFile();
                expect(reader).toBeDefined();
                const abort = vi.spyOn(reader, 'abort');

                expect(reader.readyState).toBe(1);
                $exeDevice.$lifecycle.destroy();

                expect(abort).toHaveBeenCalledTimes(1);
                abort.mockRestore();
            });

            it('discards a load that resolves after the edition closed', () => {
                const reader = pickFile();
                const importGame = vi.fn();
                $exeDevice.importGame = importGame;

                $exeDevice.$lifecycle.destroy();
                reader.onload({ target: { result: 'card' } });

                expect(importGame).not.toHaveBeenCalled();
            });

            it('imports a load that resolves while the edition is open', () => {
                const reader = pickFile();
                const importGame = vi.fn();
                $exeDevice.importGame = importGame;

                reader.onload({ target: { result: 'card' } });

                expect(importGame).toHaveBeenCalledWith('card', 'text/plain');
            });
        });

        describe('preview audio', () => {
            it('stops playback and releases the stream when the edition closes', () => {
                $exeDevice.playSound('files/beep.mp3');
                const player = $exeDevice.playerAudio;
                const pause = vi.spyOn(player, 'pause');

                $exeDevice.$lifecycle.destroy();

                expect(pause).toHaveBeenCalledTimes(1);
                expect(player.hasAttribute('src')).toBe(false);
                pause.mockRestore();
            });

            it('plays on canplaythrough while open, and stays silent afterwards', () => {
                $exeDevice.playSound('files/beep.mp3');
                const player = $exeDevice.playerAudio;
                const play = vi.spyOn(player, 'play').mockReturnValue(undefined);

                player.dispatchEvent(new Event('canplaythrough'));
                expect(play).toHaveBeenCalledTimes(1);

                $exeDevice.$lifecycle.destroy();
                player.dispatchEvent(new Event('canplaythrough'));

                expect(play).toHaveBeenCalledTimes(1);
                play.mockRestore();
            });
        });
    });

    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'relate.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toContain('gamification.scorm.getTab(');
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });
});

describe('relate minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'relate.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});
