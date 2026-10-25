/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEdition() {
    // config.xml loads the export runtime before the edition script.
    (0, eval)(readFileSync(join(__dirname, '../export/learningml.js'), 'utf-8'));
    const code = readFileSync(join(__dirname, 'learningml.js'), 'utf-8');
    (0, eval)(code.replace(/var\s+\$exeDevice\s*=/, 'window.$exeDevice ='));
    return window.$exeDevice;
}

const saved = {
    version: 1,
    title: 'Fruit or vegetable',
    instructions: 'Teach the model "both" <kinds>',
    dataType: 'numbers',
    algorithm: 'knn',
    classes: [
        { name: 'Light', examples: ['1, 2', '2, 1'], tests: ['1, 1'] },
        { name: 'Heavy', examples: ['9, 8'], tests: ['8, 9', '9, 9'] },
    ],
    graded: true,
    weight: 30,
    pass: 70,
};

describe('LearningML edition', () => {
    let device;
    let element;

    beforeEach(() => {
        document.body.innerHTML = '<div id="editor" idevice-id="IDEV1"></div>';
        element = document.getElementById('editor');
        window._ = (s) => s;
        eXe.app.clearHistory();
        device = loadEdition();
    });

    it('round-trips every field of saved data', () => {
        device.init(element, saved);
        expect(element.querySelector('[data-field="instructions"]').value).toBe(saved.instructions);
        expect(device.save()).toEqual(saved);
    });

    it('starts new activities with two empty classes and the default settings', () => {
        device.init(element, {});
        expect(device.classRows()).toHaveLength(2);
        device.classRows()[0].querySelector('[data-class-field="examples"]').value = 'hello\n\n hi \n';
        expect(device.save()).toMatchObject({
            dataType: 'text',
            algorithm: 'naive-bayes',
            graded: false,
            weight: 100,
            pass: 50,
            classes: [
                { name: 'Class 1', examples: ['hello', 'hi'], tests: [] },
                { name: 'Class 2', examples: [], tests: [] },
            ],
        });
    });

    it('adds and removes classes', () => {
        device.init(element, saved);
        element.querySelector('[data-action="add-class"]').click();
        expect(device.classRows()[2].querySelector('[data-class-field="name"]').value).toBe('Class 3');
        device.classRows()[0].querySelector('[data-action="remove-class"]').click();
        expect(device.save().classes.map((c) => c.name)).toEqual(['Heavy', 'Class 3']);
    });

    it('rejects invalid configurations with the shared validation message', () => {
        device.init(element, saved);
        device.classRows()[1].querySelector('[data-class-field="tests"]').value = 'heavy';
        expect(device.save()).toBe(false);
        expect(eXe.app._alertHistory[0]).toContain('numbers separated by commas');
    });

    it('preserves unreadable data instead of overwriting it', () => {
        device.init(element, { version: 99 });
        expect(element.textContent).toContain('could not be loaded');
        expect(device.save()).toBe(false);
        expect(eXe.app._alertHistory).toEqual(['The activity could not be loaded and has not been changed.']);
    });
});
