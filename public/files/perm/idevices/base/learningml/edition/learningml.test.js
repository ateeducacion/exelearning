/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const run = (file, from, to) => (0, eval)(readFileSync(join(__dirname, file), 'utf-8').replace(from, to));

function loadEdition() {
    // The real shared edition helpers, so tabs, Grading and Custom texts are the native ones.
    run('../../../../../../app/common/common_edition.js', /var\s+\$exeDevicesEdition\s*=/, 'window.$exeDevicesEdition =');
    // config.xml loads the export runtime before the edition script.
    run('../export/learningml.js', 'var $learningml ', 'window.$learningml ');
    run('learningml.js', /var\s+\$exeDevice\s*=/, 'window.$exeDevice =');
    return window.$exeDevice;
}

const saved = {
    version: 1,
    instructions: '<p>Teach the model "both" kinds</p>',
    dataType: 'numbers',
    algorithm: 'knn',
    classes: [
        { name: 'Light', examples: ['1, 2', '2, 1'], tests: ['1, 1'] },
        { name: 'Heavy', examples: ['9, 8'], tests: ['8, 9', '9, 9'] },
    ],
    isScorm: 2,
    textButtonScorm: 'Send',
    weighted: 30,
    passScoreMode: 'custom',
    passScoreCustom: 7,
    evaluation: true,
    evaluationID: 'report-1',
};

describe('LearningML edition', () => {
    let device;
    let element;

    beforeEach(() => {
        document.body.innerHTML = '<div id="editor" idevice-id="IDEV1"></div>';
        element = document.getElementById('editor');
        eXe.app.clearHistory();
        eXe.app.confirm = vi.fn((title, message, ok) => ok());
        window.eXeLearning = { app: { project: { odeId: 'ode' } } };
        device = loadEdition();
    });
    afterEach(() => {
        delete window.eXeLearning;
        vi.unstubAllGlobals();
    });

    it('uses the native tabs: general settings, classes, grading and custom texts', () => {
        device.init(element, saved, '/idevices/learningml/edition/');
        const tabs = [...element.querySelectorAll('.exe-form-tabs a')].map((a) => a.textContent);
        expect(tabs).toEqual(['General settings', 'Classes', 'Grading', 'Custom texts']);
        expect(element.querySelector('.alert-info').textContent).toContain('LearningML');
        expect(element.querySelector('#ci18n_msgTrain').value).toBe('Train');
        expect(element.querySelector('img[src="/idevices/learningml/edition/quextIEHelp.png"]')).not.toBeNull();
    });

    it('round-trips every field of saved data', () => {
        device.init(element, { ...saved, msgs: { msgTrain: 'Entrenar' } }, '/edition/');
        expect(element.querySelector('#eXeGameInstructions').value).toBe(saved.instructions);
        expect(element.querySelector('#ci18n_msgTrain').value).toBe('Entrenar');
        const data = device.save();
        expect(data).toMatchObject(saved);
        expect(data.msgs.msgTrain).toBe('Entrenar');
        expect(data.msgs.msgResult).toBe('Result');
    });

    it('reads the instructions from TinyMCE when it is active', () => {
        device.init(element, saved);
        vi.stubGlobal('tinyMCE', { get: () => ({ getContent: () => '<p>Rich</p>' }) });
        expect(device.save().instructions).toBe('<p>Rich</p>');
    });

    it('starts new activities with two empty text classes and the neural network', () => {
        device.init(element, {});
        expect(device.classes.map((c) => c.name)).toEqual(['Class 1', 'Class 2']);
        const examples = element.querySelector('[data-class-field="examples"]');
        examples.value = 'hello\n\n hi \n';
        examples.dispatchEvent(new Event('input'));
        expect(device.save()).toMatchObject({
            dataType: 'text',
            algorithm: 'neural-network',
            isScorm: 0,
            classes: [
                { name: 'Class 1', examples: ['hello', 'hi'], tests: [] },
                { name: 'Class 2', examples: [], tests: [] },
            ],
        });
    });

    it('adds, renames and removes classes', () => {
        device.init(element, saved);
        element.querySelector('[data-action="add-class"]').click();
        const names = element.querySelectorAll('[data-class-field="name"]');
        expect(names[2].value).toBe('Class 3');
        names[2].value = 'Medium';
        names[2].dispatchEvent(new Event('input'));
        expect(element.querySelectorAll('.lml-author-class legend a')[2].textContent).toBe('Medium');
        element.querySelector('[data-action="remove-class"]').click();
        expect(device.save().classes.map((c) => c.name)).toEqual(['Heavy', 'Medium']);
    });

    it('keeps examples between text and numbers and asks before dropping them for images', () => {
        device.init(element, saved);
        const type = element.querySelector('[data-field="dataType"]');
        type.value = 'text';
        type.dispatchEvent(new Event('change'));
        expect(device.classes[0].examples).toEqual(['1, 2', '2, 1']);
        expect(eXe.app.confirm).not.toHaveBeenCalled();
        type.value = 'images';
        type.dispatchEvent(new Event('change'));
        expect(eXe.app.confirm).toHaveBeenCalledTimes(1);
        expect(device.classes[0]).toMatchObject({ examples: [], tests: [] });
        expect(element.querySelector('[data-class-upload="examples"]')).not.toBeNull();
        expect(element.querySelector('.lml-size').textContent).toBe('Images: 0 kB / 280 kB');
        device.classes[0].examples.push('data:image/png;base64,AAAA');
        expect(device.classes[0].tests).toEqual([]);
        eXe.app.confirm = vi.fn();
        type.value = 'text';
        type.dispatchEvent(new Event('change'));
        expect(type.value).toBe('images');
    });

    it('loads an example from the edition folder', async () => {
        const example = { dataType: 'numbers', classes: [{ name: 'A', examples: ['1'], tests: [] }, { name: 'B', examples: ['2'], tests: ['2'] }] };
        vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => example })));
        device.init(element, saved, '/edition/');
        element.querySelector('[data-field="example"]').value = 'iris';
        element.querySelector('[data-action="load-example"]').click();
        await vi.waitFor(() => expect(device.classes.map((c) => c.name)).toEqual(['A', 'B']));
        expect(fetch).toHaveBeenCalledWith('/edition/examples/iris.json', expect.any(Object));
        expect(eXe.app.confirm).toHaveBeenCalled();
        fetch.mockRejectedValueOnce(new Error('offline'));
        await device.loadExample('iris');
        expect(eXe.app._alertHistory).toContain('The example could not be loaded.');
        await device.loadExample('unknown');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('ships every listed example with valid classes', () => {
        loadEdition();
        for (const { file, dataType } of window.$exeDevice.EXAMPLES) {
            const data = window.$learningml.normalize(
                JSON.parse(readFileSync(join(__dirname, 'examples', `${file}.json`), 'utf-8'))
            );
            expect(data.dataType).toBe(dataType);
            expect(window.$learningml.check({ ...data, isScorm: 1 })).toBe('');
            if (dataType === 'images') {
                const bytes = data.classes.reduce((n, c) => n + [...c.examples, ...c.tests].join('').length, 0);
                expect(bytes).toBeLessThan(window.$exeDevice.IMAGE_BUDGET);
            }
        }
    });

    it('adds and removes author images resized by the runtime', async () => {
        device.init(element, { ...saved, dataType: 'images', classes: [{ name: 'A' }, { name: 'B' }] });
        window.$learningml.image.fromFile = vi.fn(async (file, size) => `data:image/jpeg;base64,${file.name}${size}`);
        const upload = element.querySelector('[data-class-upload="tests"]');
        Object.defineProperty(upload, 'files', { value: [new File(['x'], 'cat')], configurable: true });
        upload.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(device.classes[0].tests).toEqual(['data:image/jpeg;base64,cat128']));
        expect(element.querySelectorAll('.lml-images img')).toHaveLength(1);
        element.querySelector('.lml-images .lml-remove').click();
        expect(device.classes[0].tests).toEqual([]);
        window.$learningml.image.fromFile = vi.fn(async () => {
            throw new Error('bad');
        });
        upload.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(eXe.app._alertHistory).toContain('The image could not be read.'));
    });

    it('rejects invalid or oversized configurations with a clear message', () => {
        device.init(element, saved);
        const tests = element.querySelectorAll('[data-class-field="tests"]')[1];
        tests.value = 'heavy';
        tests.dispatchEvent(new Event('input'));
        expect(device.save()).toBe(false);
        expect(eXe.app._alertHistory[0]).toContain('numbers separated by commas');

        device.init(element, { ...saved, isScorm: 0, evaluation: false, dataType: 'images', classes: [{ name: 'A' }, { name: 'B' }] });
        device.classes[0].examples.push(`data:image/png;base64,${'A'.repeat(300000)}`);
        device.renderSize();
        expect(element.querySelector('.lml-size').classList.contains('text-danger')).toBe(true);
        expect(device.save()).toBe(false);
        expect(eXe.app._alertHistory.at(-1)).toContain('take too much space');
    });

    it('stops when the progress report identifier is invalid', () => {
        device.init(element, saved, '/edition/');
        element.querySelector('#eXeProgressReportID').value = 'abc';
        expect(device.save()).toBe(false);
    });

    it('preserves unreadable data instead of overwriting it', () => {
        device.init(element, { version: 99, classes: [] });
        expect(element.textContent).toContain('could not be loaded');
        expect(device.save()).toBe(false);
        expect(eXe.app._alertHistory).toEqual(['The activity could not be loaded and has not been changed.']);
    });
});
