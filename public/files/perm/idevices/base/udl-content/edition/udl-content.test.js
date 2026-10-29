/**
 * Unit tests for the udl-content iDevice (edition code).
 *
 * Covers:
 * - The "accessible hidden text | visible label" parsing that splits the
 *   button text on the FIRST "|" only. These tests pin the security-relevant
 *   behavior of the split (CodeQL incomplete-sanitization fixes) and guard
 *   against regressions for legitimate inputs whose visible label contains
 *   additional "|" characters.
 * - The edition lifecycle. `loadPreviousValues()` listens on the node chrome
 *   around the form (`#activeIdevice`) and on the icon image the style panel
 *   swaps in (`#iconiDevice`). Neither lives inside the edition form, so
 *   emptying the form never removed them: every re-open stacked another pair,
 *   and the icon `load` event — which fires asynchronously — drove whichever
 *   iDevice happened to be in the `$exeDevice` global at that moment.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('udl-content iDevice edition lifecycle', () => {
    let $exeDevice;

    /** Build the node chrome the handlers target, outside any edition form. */
    const buildNodeChrome = () => {
        document.body.innerHTML = `
      <div id="activeIdevice">
        <button class="js-show-icon-panel-button" type="button"></button>
        <input type="text" />
      </div>
      <img id="iconiDevice" />
      <div id="udlContentTypeOptions"></div>
      <input type="radio" id="udlContentType-engagement" />
      <input type="radio" id="udlContentType-representation" />
      <input type="radio" id="udlContentType-expression" />`;
    };

    /** Run loadPreviousValues far enough to wire the chrome handlers. */
    const openEdition = device => {
        device.idevicePreviousData = '';
        device.jsonToForm = () => {};
        device.loadPreviousValues();
    };

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'udl-content.js'));
        buildNodeChrome();
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
    });

    const selectIcon = filename => {
        document.querySelector('#activeIdevice .js-show-icon-panel-button').click();
        const icon = document.getElementById('iconiDevice');
        icon.src = `http://localhost/style/icon_${filename}`;
        $(icon).trigger('load');
    };

    it('switches the content type when an icon is picked while the edition is open', () => {
        const setActiveType = vi.spyOn($exeDevice, 'setActiveType').mockImplementation(() => {});
        openEdition($exeDevice);

        selectIcon('udl_eng_star.png');

        expect(setActiveType).toHaveBeenCalledWith('engagement');
        expect(document.getElementById('udlContentType-engagement').checked).toBe(true);
        setActiveType.mockRestore();
    });

    it('recognises representation and expression icons too', () => {
        const setActiveType = vi.spyOn($exeDevice, 'setActiveType').mockImplementation(() => {});
        openEdition($exeDevice);

        selectIcon('udl_rep_book.png');
        expect(setActiveType).toHaveBeenLastCalledWith('representation');

        selectIcon('udl_exp_pen.png');
        expect(setActiveType).toHaveBeenLastCalledWith('expression');
        setActiveType.mockRestore();
    });

    it('stops reacting to the icon panel once the edition closes', () => {
        const setActiveType = vi.spyOn($exeDevice, 'setActiveType').mockImplementation(() => {});
        openEdition($exeDevice);
        selectIcon('udl_eng_star.png');
        expect(setActiveType).toHaveBeenCalledTimes(1);

        $exeDevice.$lifecycle.destroy();
        selectIcon('udl_rep_book.png');

        expect(setActiveType).toHaveBeenCalledTimes(1);
        setActiveType.mockRestore();
    });

    it('never drives the iDevice that replaced this one', () => {
        const first = $exeDevice;
        openEdition(first);
        // Arm the icon handler, then close the editor before the image loads.
        document.querySelector('#activeIdevice .js-show-icon-panel-button').click();
        first.$lifecycle.destroy();

        const second = { setActiveType: vi.fn() };
        global.$exeDevice = second;
        const icon = document.getElementById('iconiDevice');
        icon.src = 'http://localhost/style/icon_udl_exp_pen.png';
        $(icon).trigger('load');

        expect(second.setActiveType).not.toHaveBeenCalled();
        global.$exeDevice = first;
    });

    it('leaves unrelated handlers on the same chrome elements alone', () => {
        openEdition($exeDevice);
        const onButton = vi.fn();
        const onIcon = vi.fn();
        $('#activeIdevice .js-show-icon-panel-button').on('click', onButton);
        $('#iconiDevice').on('load', onIcon);

        $exeDevice.$lifecycle.destroy();
        document.querySelector('#activeIdevice .js-show-icon-panel-button').click();
        $(document.getElementById('iconiDevice')).trigger('load');

        expect(onButton).toHaveBeenCalledTimes(1);
        expect(onIcon).toHaveBeenCalledTimes(1);
    });
});

describe('udl-content iDevice (edition)', () => {
    let $exeDevice;
    let appended;
    let saved;

    beforeEach(() => {
        saved = { $: global.$, _: global._, c_: global.c_ };

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

        $exeDevice = global.loadIdevice(join(__dirname, 'udl-content.js'));
        $exeDevice.idevicePath = '/idevice/';
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
        // Restore the real jQuery and i18n helpers the stubs above replaced,
        // so the lifecycle suite below runs against the real ones.
        global.$ = saved.$;
        global._ = saved._;
        global.c_ = saved.c_;
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

/**
 * Re-editing tests (#2646). The form used to be built by concatenating the saved
 * HTML inside the TEXTAREA markup, where the parser decodes character references:
 * escaped code (`&lt;div&gt;`) reached TinyMCE as real markup, and a quote in the
 * button text ended its value attribute.
 */
describe('udl-content iDevice edition form', () => {
    let $exeDevice;

    const contents = {
        main: '<pre><code>&lt;div class="box"&gt;Hola&lt;/div&gt;</code></pre>',
        simplified: '<p>&lt;b&gt;hola&lt;/b&gt;</p>',
        audio: '<p>a &lt; b &amp;&amp; c &gt; d</p>',
        visual: '<pre><code>&lt;/textarea&gt;</code></pre>',
    };

    /** One block as save() stores it, with its button header and four contents. */
    const savedBlock = ({ header = '', main, simplified, audio, visual }) => {
        const alt = (type, content) =>
            `<article class="exe-udlContent-content-${type} js-hidden">` +
            "<header class='exe-udlContent-alt-content-title'><h2>Title</h2></header>" +
            content +
            '<button class="exe-udlContent-alt-content-hide">Hide</button></article>';
        return (
            '<div class="exe-udlContent exe-udlContent-engagement">' +
            `<section class="exe-udlContent-block js-hidden">${header}` +
            '<div class="exe-udlContent-content">' +
            `<div class="exe-udlContent-content-main">${main}</div>` +
            alt('simplified', simplified) +
            alt('audio', audio) +
            alt('visual', visual) +
            '</div></section></div>'
        );
    };

    /** Open the edition of a saved iDevice and return its first block form. */
    const openEdition = previousData => {
        $exeDevice.idevicePreviousData = previousData;
        $exeDevice.loadPreviousValues();
        return $('#udlContentFormBlock-0');
    };

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'udl-content.js'));
        $exeDevice.idevicePath = '/udl-content/';
        document.body.innerHTML = '<div id="udlContentFormBlocks"></div>';
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
    });

    it('keeps escaped code as code in every content tab', () => {
        openEdition(savedBlock(contents));

        expect($('#udlContentFormTxt-0').val()).toBe(contents.main);
        expect($('#udlContentFormTxt-0-0').val()).toBe(contents.main);
        expect($('#udlContentFormTxt-0-1').val()).toBe(contents.simplified);
        expect($('#udlContentFormTxt-0-2').val()).toBe(contents.audio);
        expect($('#udlContentFormTxt-0-3').val()).toBe(contents.visual);
    });

    it('keeps a quote and markup-like text in the button text', () => {
        const header =
            '<header class="exe-udlContent-header"><h2 style="display:none;">' +
            '<span class="sr-av">Read "more" </span>Show &lt;code&gt;</h2></header>';
        const block = openEdition(savedBlock({ ...contents, header }));

        expect(block.find("input[type='text']").val()).toBe('Read "more" | Show <code>');
        const explanation = block.find('.udlContentFormBlockButtonTxtExplanation span');
        expect(explanation.eq(0).text()).toBe('Read "more" ');
        expect(explanation.eq(1).text()).toBe(' Show <code>');
    });

    it('keeps the form intact when the content holds a real TEXTAREA', () => {
        const visual = '<p>a</p><textarea>x</textarea><p>b</p>';
        const block = openEdition(savedBlock({ ...contents, visual }));

        expect($('#udlContentFormTxt-0-3').val()).toBe(visual);
        expect(block.find('textarea')).toHaveLength(5);
        // Nothing of the content leaks out of its field into the form
        expect(block.find('.udlContentFormBlockTxt > p')).toHaveLength(0);
    });

    it('saves again the same contents and button text it loaded', () => {
        const header =
            '<header class="exe-udlContent-header"><h2 style="display:none;">Open "the code"</h2></header>';
        openEdition(savedBlock({ ...contents, header }));
        // TinyMCE hands back the content of the TEXTAREA it was started on
        const get = vi
            .spyOn(tinymce, 'get')
            .mockImplementation(id => ({ getContent: () => document.getElementById(id).value }));

        const [block] = $exeDevice.formToJSON();
        get.mockRestore();

        expect(block).toMatchObject({
            btnTxt: 'Open "the code"',
            contMain: contents.main,
            contAlt1: contents.simplified,
            contAlt2: contents.audio,
            contAlt3: contents.visual,
        });
    });
});
