/**
 * Unit tests for word-search iDevice (edition)
 *
 * Covers:
 * - importGlosary HTML-tag sanitization of the DEFINITION field. The strip
 *   must be applied to a fixed point so nested/obfuscated payloads such as
 *   "<scr<script>ipt>" cannot reassemble into a tag after one pass
 *   (CodeQL: incomplete-multi-character-sanitization).
 * - Numeric field limits: the time field truncates on keyup; capping it at
 *   one digit made ordinary values impossible to enter.
 * - Edition lifecycle teardown of clue-audio preview and game-import file
 *   readers.
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

describe('word-search iDevice edition', () => {
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
            <input id="sopaETime" />
      </form>`;
    $exeDevice = global.loadIdevice(join(__dirname, 'word-search.js'));
    $exeDevice.addEvents();
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
    document.body.innerHTML = '';
  });

  describe('numeric field limits', () => {
    it('keeps a 2-digit time', () => {
      $('#sopaETime').val('45').trigger('keyup');

      expect($('#sopaETime').val()).toBe('45');
    });

    it('truncates the time beyond 2 digits and drops non-digits', () => {
      $('#sopaETime').val('1a234').trigger('keyup');

      expect($('#sopaETime').val()).toBe('12');
    });
  });
});

/**
 * Audio double with a real event target, so `canplaythrough` can be dispatched
 * the way the platform would.
 */
function createFakeAudioClass() {
    return class FakeAudio extends EventTarget {
        constructor(src) {
            super();
            FakeAudio.instances.push(this);
            this.src = src;
            this.pause = vi.fn();
            this.load = vi.fn();
            this.play = vi.fn();
        }

        removeAttribute() {
            this.src = '';
        }
    };
}

/** FileReader double that fires only when a test says so. */
class FakeFileReader {
    constructor() {
        FakeFileReader.instances.push(this);
        this.readyState = 0;
        this.onload = null;
        this.abort = vi.fn(() => {
            this.readyState = 2;
        });
    }

    readAsText() {
        this.readyState = 1;
    }

    fire(result) {
        this.readyState = 2;
        if (this.onload) this.onload({ target: { result } });
    }
}
FakeFileReader.instances = [];

describe('word-search iDevice edition lifecycle', () => {
    let $exeDevice;
    let FakeAudio;
    let originalAudio;
    let originalFileReader;
    let originalMedia;
    let originalItinerary;

    beforeEach(() => {
        FakeAudio = createFakeAudioClass();
        FakeAudio.instances = [];
        FakeFileReader.instances = [];

        originalAudio = global.Audio;
        originalFileReader = global.FileReader;
        originalMedia = $exeDevices.iDevice.gamification.media;
        originalItinerary = $exeDevicesEdition.iDevice.gamification.itinerary;

        global.Audio = FakeAudio;
        window.Audio = FakeAudio;
        global.FileReader = FakeFileReader;
        window.FileReader = FakeFileReader;
        $exeDevices.iDevice.gamification.media = { extractURLGD: u => u };
        $exeDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };

        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'word-search.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
        global.Audio = originalAudio;
        window.Audio = originalAudio;
        global.FileReader = originalFileReader;
        window.FileReader = originalFileReader;
        $exeDevices.iDevice.gamification.media = originalMedia;
        $exeDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
    });

    describe('audio preview', () => {
        it('plays the clip once it can play through while the edition is open', () => {
            $exeDevice.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];

            audio.dispatchEvent(new Event('canplaythrough'));

            expect(audio.play).toHaveBeenCalledTimes(1);
        });

        it('stops the clip when the edition closes', () => {
            $exeDevice.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];

            $exeDevice.$lifecycle.destroy();

            expect(audio.pause).toHaveBeenCalledTimes(1);
            expect(audio.load).toHaveBeenCalledTimes(1);
            expect(audio.src).toBe('');
        });

        it('never starts a clip that finished buffering after the edition closed', () => {
            $exeDevice.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];

            $exeDevice.$lifecycle.destroy();
            audio.dispatchEvent(new Event('canplaythrough'));

            expect(audio.play).not.toHaveBeenCalled();
        });

        it('never plays through the iDevice that replaced this one', () => {
            const first = $exeDevice;
            first.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];
            first.$lifecycle.destroy();

            const secondAudio = { play: vi.fn() };
            global.$exeDevice = { playerAudio: secondAudio };
            audio.dispatchEvent(new Event('canplaythrough'));

            expect(secondAudio.play).not.toHaveBeenCalled();
            global.$exeDevice = first;
        });
    });

    describe('game import', () => {
        const selectFile = () => {
            const input = document.getElementById('eXeGameImportGame');
            Object.defineProperty(input, 'files', {
                value: [{ name: 'game.txt', type: 'text/plain' }],
                configurable: true,
            });
            $(input).trigger('change');
        };

        beforeEach(() => {
            ['eXeGameImportGame', 'eXeGameExportQuestions', 'eXeGameExportImport'].forEach(id => {
                const input = document.createElement('input');
                input.type = 'file';
                input.id = id;
                document.body.appendChild(input);
            });
            $exeDevice.questionsGame = [];
            $exeDevice.addEvents();
        });

        it('imports the game while the edition is open', () => {
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

            selectFile();
            FakeFileReader.instances[0].fire('word list');

            expect(importGame).toHaveBeenCalledWith('word list', 'text/plain');
            importGame.mockRestore();
        });

        it('aborts an in-flight read when the edition closes', () => {
            selectFile();
            const reader = FakeFileReader.instances[0];
            expect(reader.readyState).toBe(1);

            $exeDevice.$lifecycle.destroy();

            expect(reader.abort).toHaveBeenCalledTimes(1);
        });

        it('ignores a late read callback instead of importing into a closed edition', () => {
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

            selectFile();
            const reader = FakeFileReader.instances[0];
            $exeDevice.$lifecycle.destroy();
            reader.fire('word list');

            expect(importGame).not.toHaveBeenCalled();
            importGame.mockRestore();
        });

        it('never imports into the iDevice that replaced this one', () => {
            const first = $exeDevice;
            selectFile();
            const reader = FakeFileReader.instances[0];
            first.$lifecycle.destroy();

            const second = { importGame: vi.fn() };
            global.$exeDevice = second;
            reader.fire('word list');

            expect(second.importGame).not.toHaveBeenCalled();
            global.$exeDevice = first;
        });
    });
});
