/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

function load() {
    (0, eval)(readFileSync(join(__dirname, 'learningml.js'), 'utf-8'));
    return window.$learningml;
}

const config = (overrides = {}) => ({
    version: 1,
    title: 'Greetings',
    instructions: 'Teach the model',
    dataType: 'text',
    algorithm: 'naive-bayes',
    classes: [
        { name: 'Hello', examples: ['hello friend', 'good morning'], tests: ['hello there', 'good morning teacher'] },
        { name: 'Bye', examples: ['goodbye friend', 'see you later'], tests: ['see you tomorrow', 'goodbye'] },
    ],
    graded: true,
    weight: 40,
    pass: 60,
    ...overrides,
});

function mount(lml, data, id = 'node1') {
    const wrapper = document.createElement('div');
    wrapper.className = 'idevice_node learningml';
    wrapper.id = id;
    wrapper.innerHTML = lml.renderView(data, null, '{content}');
    document.body.append(wrapper);
    lml.init(data);
    return wrapper.querySelector('.lml-activity');
}

const button = (root, name) => [...root.querySelectorAll('button')].find((b) => b.textContent === name);
function submit(root, labelText, value) {
    const label = [...root.querySelectorAll('label')].find((l) => l.textContent === labelText);
    const input = root.querySelector(`#${label.getAttribute('for')}`);
    input.value = value;
    input.closest('form').dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('LearningML classifiers', () => {
    let lml;
    beforeEach(() => {
        lml = load();
    });

    it('tokenizes Unicode words without case or accents', () => {
        expect(lml.ml.tokens('¡Canción, ÑANDÚ y 3 niños!')).toEqual(['cancion', 'nandu', 'y', '3', 'ninos']);
    });

    it('parses numeric examples and rejects anything else', () => {
        expect(lml.ml.numbers('1.5, 2; 3  4')).toEqual([1.5, 2, 3, 4]);
        expect(lml.ml.numbers('1, two')).toBeNull();
        expect(lml.ml.numbers('  ')).toBeNull();
    });

    it.each(['naive-bayes', 'knn'])('classifies text with %s', (algorithm) => {
        const c = config();
        const model = lml.ml.train('text', algorithm, c.classes);
        const ranking = model.classify('hello my friend');
        expect(ranking[0][0]).toBe('Hello');
        expect(ranking.reduce((s, [, p]) => s + p, 0)).toBeCloseTo(1);
        expect(lml.ml.evaluate(model, c.classes)).toBe(100);
    });

    it.each(['naive-bayes', 'knn'])('classifies numbers by magnitude with %s', (algorithm) => {
        const classes = [
            { name: 'Small', examples: ['1', '2', '3'], tests: ['1.5'] },
            { name: 'Large', examples: ['10', '11', '12'], tests: ['11.5'] },
        ];
        const model = lml.ml.train('numbers', algorithm, classes);
        expect(model.classify('2.5')[0][0]).toBe('Small');
        expect(model.classify('9')[0][0]).toBe('Large');
        expect(lml.ml.evaluate(model, classes)).toBe(100);
        expect(() => model.classify('1, 2')).toThrow('same number of values');
    });

    it('weights k-NN votes by closeness and stays uniform without overlap', () => {
        const classes = [
            { name: 'A', examples: ['0'] },
            { name: 'B', examples: ['5'] },
            { name: 'C', examples: ['100'] },
        ];
        const ranking = lml.ml.train('numbers', 'knn', classes).classify('4');
        expect(ranking.map(([label]) => label)).toEqual(['B', 'A', 'C']);
        const text = lml.ml.train('text', 'knn', [
            { name: 'A', examples: ['cat'] },
            { name: 'B', examples: ['dog'] },
        ]);
        expect(text.classify('fish').map(([, p]) => p)).toEqual([0.5, 0.5]);
    });

    it('refuses to train without two classes with examples', () => {
        expect(() => lml.ml.train('text', 'knn', [{ name: 'A', examples: ['a'] }])).toThrow('two classes');
        expect(() =>
            lml.ml.train('text', 'knn', [
                { name: 'A', examples: ['a'] },
                { name: 'B', examples: [] },
            ])
        ).toThrow('Every class');
    });

    it('scores unclassifiable evaluation examples as wrong and returns null without tests', () => {
        const classes = [
            { name: 'Small', examples: ['1'], tests: ['1', '1, 2'] },
            { name: 'Large', examples: ['9'], tests: [] },
        ];
        const model = lml.ml.train('numbers', 'naive-bayes', classes);
        expect(lml.ml.evaluate(model, classes)).toBe(50);
        expect(lml.ml.evaluate(model, [{ name: 'Small', tests: [] }])).toBeNull();
    });
});

describe('LearningML configuration', () => {
    let lml;
    beforeEach(() => {
        lml = load();
    });

    it('defaults, trims and bounds every field', () => {
        expect(lml.normalize(null)).toEqual({
            version: 1,
            title: '',
            instructions: '',
            dataType: 'text',
            algorithm: 'naive-bayes',
            classes: [],
            graded: false,
            weight: 100,
            pass: 50,
        });
        const c = lml.normalize({
            dataType: 'numbers',
            algorithm: 'knn',
            classes: [{ name: ' A ', examples: [' 1 ', ''], tests: ['2'] }, { name: '' }, 'bad'],
            graded: true,
            weight: '500',
            pass: '-4',
        });
        expect(c.classes).toEqual([{ name: 'A', examples: ['1'], tests: ['2'] }]);
        expect([c.dataType, c.algorithm, c.graded, c.weight, c.pass]).toEqual(['numbers', 'knn', true, 100, 0]);
        expect(lml.normalize({ weight: '', pass: null })).toMatchObject({ weight: 100, pass: 50 });
        expect(() => lml.normalize({ version: 2 })).toThrow('Unsupported');
    });

    it('reports the first authoring problem', () => {
        const c = lml.normalize(config());
        expect(lml.check(c)).toBe('');
        expect(lml.check({ ...c, classes: c.classes.slice(0, 1) })).toContain('two classes');
        expect(lml.check({ ...c, classes: [c.classes[0], { ...c.classes[1], name: 'hello' }] })).toContain('different');
        expect(lml.check({ ...c, classes: c.classes.map((k) => ({ ...k, tests: [] })) })).toContain('evaluation');
        const numbers = { ...c, dataType: 'numbers' };
        expect(lml.check(numbers)).toContain('numbers separated by commas');
        numbers.classes = [
            { name: 'A', examples: ['1, 2'], tests: [] },
            { name: 'B', examples: ['3'], tests: ['4, 5'] },
        ];
        expect(lml.check(numbers)).toContain('same number of values');
        numbers.classes[1].examples = ['3, 4'];
        expect(lml.check(numbers)).toBe('');
    });
});

describe('LearningML learner activity', () => {
    let lml;
    beforeEach(() => {
        document.body.innerHTML = '';
        window.eXeLearning = undefined;
        lml = load();
    });
    afterEach(() => {
        delete window.exeScorm12;
        delete window.$exeDevices;
    });

    it('escapes authored content and keeps the configuration in the view', () => {
        const c = config({ title: '<img src=x onerror=alert(1)>', instructions: '"quoted" & <b>' });
        document.body.innerHTML = lml.renderView(c, null, '<div>{content}</div>');
        const root = document.querySelector('[data-learningml]');
        expect(document.querySelector('img,b')).toBeNull();
        expect(root.textContent).toContain('"quoted" & <b>');
        expect(JSON.parse(decodeURIComponent(root.dataset.learningml))).toEqual(lml.normalize(c));
        expect(lml.renderView({ version: 9 }, null, '{content}')).toContain('invalid data');
    });

    it('trains, classifies and checks the model across the three columns', () => {
        const root = mount(lml, config({ graded: false }));
        const headings = [...root.querySelectorAll('h4')].map((h) => h.textContent);
        expect(headings).toEqual(['1. Training data', '2. Train', '3. Result']);
        const status = root.querySelector('.lml-status');
        submit(root, 'Example to classify', 'hello');
        expect(status.textContent).toBe('Train the model first.');
        button(root, 'Check my model').click();
        expect(root.querySelector('.lml-score').textContent).toBe('Train the model first.');

        submit(root, 'New example for Hello', 'hi there');
        expect(root.querySelectorAll('.lml-class')[0].querySelectorAll('li')).toHaveLength(3);
        button(root, 'Train the model').click();
        expect(status.textContent).toBe('Model trained with 5 examples.');
        submit(root, 'Example to classify', 'hi');
        expect(root.querySelector('.lml-prediction').textContent).toBe('The model says: Hello');
        expect(root.querySelectorAll('.lml-bar')).toHaveLength(2);
        button(root, 'Check my model').click();
        expect(root.querySelector('.lml-score').textContent).toBe('Score: 100/100');

        root.querySelector('.lml-remove').click();
        expect(status.textContent).toContain('Train the model again');
        expect(root.querySelector('.lml-result').textContent).toBe('');
    });

    it('validates numeric input and shows classification errors', () => {
        const root = mount(
            lml,
            config({
                dataType: 'numbers',
                graded: false,
                classes: [
                    { name: 'Small', examples: ['1'], tests: [] },
                    { name: 'Large', examples: ['9'], tests: [] },
                ],
            })
        );
        expect(button(root, 'Check my model')).toBeUndefined();
        submit(root, 'New example for Small', 'two');
        expect(root.querySelector('.lml-status').textContent).toContain('numbers separated by commas');
        submit(root, 'New example for Small', '   ');
        expect(root.querySelectorAll('.lml-class')[0].querySelectorAll('li')).toHaveLength(1);
        root.querySelector('select').value = 'knn';
        root.querySelector('select').dispatchEvent(new Event('change'));
        button(root, 'Train the model').click();
        submit(root, 'Example to classify', '1, 2');
        expect(root.querySelector('.lml-result').textContent).toContain('same number of values');
    });

    it('explains why training failed', () => {
        const c = config({ graded: false });
        c.classes[1].examples = [];
        const root = mount(lml, c);
        button(root, 'Train the model').click();
        expect(root.querySelector('.lml-status').textContent).toBe('Every class needs at least one example.');
    });

    it('mounts each activity once, isolated, and reports bad data in place', () => {
        const first = mount(lml, config({ graded: false }), 'a');
        const second = mount(lml, config({ graded: false }), 'b');
        lml.renderBehaviour();
        expect(document.querySelectorAll('.lml-columns')).toHaveLength(2);
        submit(first, 'New example for Hello', 'only in the first');
        expect(second.textContent).not.toContain('only in the first');
        expect(new Set([...document.querySelectorAll('input')].map((i) => i.id)).size).toBe(
            document.querySelectorAll('input').length
        );
        document.body.insertAdjacentHTML('beforeend', '<section data-learningml="%7Bbad"></section>');
        document.body.insertAdjacentHTML('beforeend', `<section data-learningml="${encodeURIComponent('{}')}"></section>`);
        lml.init();
        expect(document.body.textContent).toContain('contains invalid data');
        expect(document.body.textContent).toContain('no classes yet');
    });

    it('reports the evaluation score through the shared SCORM 1.2 registry', () => {
        const registry = { get: vi.fn(() => ({ score: 70 })) };
        const scorm = { reportActivity: vi.fn(), updateActivity: vi.fn() };
        window.exeScorm12 = { activities: registry };
        window.$exeDevices = { iDevice: { gamification: { scorm } } };
        const root = mount(lml, config());
        expect(scorm.reportActivity).toHaveBeenCalledWith(
            expect.objectContaining({ ideviceId: 'node1', isScorm: 2, weighted: 40, passScoreCustom: 6 }),
            { total: 1, legacyIndex: 1 }
        );
        expect(root.querySelector('.lml-score').textContent).toBe('Saved score: 70/100');
        button(root, 'Train the model').click();
        button(root, 'Check my model').click();
        expect(root.querySelector('.lml-score').textContent).toBe('Score: 100/100. Passed.');
        expect(scorm.updateActivity).toHaveBeenCalledWith(
            expect.objectContaining({ scorerp: 10, answered: 1 }),
            {},
            true
        );

        scorm.updateActivity.mockImplementation(() => {
            throw new Error('LMS down');
        });
        root.querySelector('.lml-remove').click();
        root.querySelector('.lml-remove').click();
        submit(root, 'New example for Hello', 'see you');
        button(root, 'Train the model').click();
        button(root, 'Check my model').click();
        const text = root.querySelector('.lml-score').textContent;
        expect(text).toContain('Add better examples and try again.');
        expect(text).toContain('could not be saved');
    });

    it('does not register outside an LMS, in the editor or when ungraded', () => {
        const scorm = { reportActivity: vi.fn() };
        window.$exeDevices = { iDevice: { gamification: { scorm } } };
        mount(lml, config(), 'x');
        window.exeScorm12 = { activities: { get: vi.fn() } };
        mount(lml, config({ graded: false }), 'y');
        window.eXeLearning = {};
        mount(lml, config(), 'z');
        expect(scorm.reportActivity).not.toHaveBeenCalled();
    });

    it('translates content strings with c_ when the editor provides it', () => {
        window.c_ = (s) => `[${s}]`;
        try {
            expect(lml.t('Train')).toBe('[Train]');
        } finally {
            delete window.c_;
        }
    });
});
