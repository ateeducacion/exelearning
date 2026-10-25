/* eslint-disable no-undef */
import { readdirSync, readFileSync, statSync } from 'fs';
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
    instructions: '<p>Teach the model</p>',
    dataType: 'text',
    algorithm: 'naive-bayes',
    classes: [
        { name: 'Hello', examples: ['hello friend', 'good morning'], tests: ['hello there', 'good morning teacher'] },
        { name: 'Bye', examples: ['goodbye friend', 'see you later'], tests: ['see you tomorrow', 'goodbye'] },
    ],
    isScorm: 1,
    weighted: 40,
    passScoreMode: 'custom',
    passScoreCustom: 6,
    ...overrides,
});

function mount(lml, data, id = 'node1') {
    const wrapper = document.createElement('div');
    wrapper.className = 'idevice_node learningml';
    wrapper.id = id;
    wrapper.innerHTML = lml.renderView(data, null, '{content}', id);
    document.body.append(wrapper);
    lml.init({ ...data, ideviceId: id });
    return wrapper.querySelector('.lml-activity');
}

const button = (root, name) => [...root.querySelectorAll('button')].find((b) => b.textContent === name);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check) {
    for (let i = 0; i < 200 && !check(); i++) await settle();
    expect(check()).toBeTruthy();
}
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

    it.each(['neural-network', 'naive-bayes', 'knn'])('classifies text with %s', async (algorithm) => {
        const c = config();
        const model = await lml.ml.train('text', algorithm, c.classes);
        const ranking = await model.classify('hello my friend');
        expect(ranking[0][0]).toBe('Hello');
        expect(ranking.reduce((s, [, p]) => s + p, 0)).toBeCloseTo(1);
        await expect(model.classify('unrelated words')).rejects.toThrow('msgUnknownWords');
    });

    it.each(['neural-network', 'naive-bayes', 'knn'])('classifies standardized numbers with %s', async (algorithm) => {
        const classes = [
            { name: 'Small', examples: ['1, 100', '2, 300', '3, 200'], tests: ['1.5, 150'] },
            { name: 'Large', examples: ['10, 200', '11, 100', '12, 300'], tests: ['11.5, 250'] },
        ];
        const model = await lml.ml.train('numbers', algorithm, classes);
        expect((await model.classify('2.5, 250'))[0][0]).toBe('Small');
        expect((await model.classify('9, 120'))[0][0]).toBe('Large');
        expect(await lml.ml.evaluate(model, classes)).toBe(100);
        await expect(model.classify('1')).rejects.toThrow('msgSameCount');
        await expect(model.classify('one')).rejects.toThrow('msgNumbersFormat');
    });

    it('trains the neural network deterministically and reports every epoch', async () => {
        const epochs = [];
        const classes = config().classes;
        const a = await lml.ml.train('text', 'neural-network', classes, {
            onEpoch: (epoch, total, loss) => epochs.push([epoch, total, loss]),
        });
        const b = await lml.ml.train('text', 'neural-network', classes);
        expect(epochs.map(([e, t]) => `${e}/${t}`)).toEqual(Array.from({ length: 20 }, (_, i) => `${i + 1}/20`));
        expect(epochs[19][2]).toBeLessThan(epochs[0][2]);
        expect(await a.classify('see you')).toEqual(await b.classify('see you'));
    });

    it('weights k-NN votes by closeness and stays uniform without overlap', async () => {
        const classes = [
            { name: 'A', examples: ['0'] },
            { name: 'B', examples: ['5'] },
            { name: 'C', examples: ['100'] },
        ];
        const ranking = await (await lml.ml.train('numbers', 'knn', classes)).classify('4');
        expect(ranking.map(([label]) => label)).toEqual(['B', 'A', 'C']);
        const cosine = lml.ml.knn(
            [
                { x: [1, 0], y: 0 },
                { x: [0, 1], y: 1 },
            ],
            2,
            true
        );
        expect(cosine([-1, -1])).toEqual([0.5, 0.5]);
    });

    it('encodes images through the injected extractor, normalized', async () => {
        const encodeImage = vi.fn(async (url) => (url.startsWith('a') ? [3, 4] : [-4, 3]));
        const classes = [
            { name: 'A', examples: ['a1', 'a2'] },
            { name: 'B', examples: ['b1'] },
        ];
        const model = await lml.ml.train('images', 'knn', classes, { encodeImage });
        expect((await model.classify('a3'))[0]).toEqual(['A', 1]);
        expect(encodeImage).toHaveBeenCalledTimes(4);
    });

    it('refuses to train without two classes with examples', async () => {
        await expect(lml.ml.train('text', 'knn', [{ name: 'A', examples: ['a'] }])).rejects.toThrow('msgTwoClasses');
        await expect(
            lml.ml.train('text', 'knn', [
                { name: 'A', examples: ['a'] },
                { name: 'B', examples: [] },
            ])
        ).rejects.toThrow('msgEveryClass');
        await expect(
            lml.ml.train('numbers', 'knn', [
                { name: 'A', examples: ['1'] },
                { name: 'B', examples: ['1, 2'] },
            ])
        ).rejects.toThrow('msgSameCount');
    });

    it('scores unclassifiable evaluation examples as wrong and returns null without tests', async () => {
        const classes = [
            { name: 'Small', examples: ['1'], tests: ['1', '1, 2'] },
            { name: 'Large', examples: ['9'], tests: [] },
        ];
        const model = await lml.ml.train('numbers', 'naive-bayes', classes);
        expect(await lml.ml.evaluate(model, classes)).toBe(50);
        expect(await lml.ml.evaluate(model, [{ name: 'Small', tests: [] }])).toBeNull();
    });
});

describe('LearningML image feature extractor', () => {
    let lml;
    beforeEach(() => {
        (0, eval)(readFileSync(join(__dirname, 'learningml-mobilenet.js'), 'utf-8'));
        lml = load();
    });

    it('computes "same"-padded convolutions, depthwise and pointwise layers with ReLU6 and average pooling', () => {
        const layers = [
            // 3×3 stride 2 on 4×4 with one input channel: TensorFlow pads only the bottom/right.
            { kind: 0, stride: 2, cin: 1, cout: 1, w: Float32Array.from({ length: 9 }, () => 1), bias: Float32Array.of(0) },
            { kind: 1, stride: 1, cin: 1, cout: 1, w: Float32Array.of(0, 0, 0, 0, 1, 0, 0, 0, 0), bias: Float32Array.of(-1) },
            { kind: 2, stride: 1, cin: 1, cout: 2, w: Float32Array.of(1, -1), bias: Float32Array.of(0, 10) },
        ];
        const input = Float32Array.from({ length: 16 }, (_, i) => i / 16);
        // conv windows: rows 0-2 × cols 0-2, 0-2 × 2-3, 2-3 × 0-2, 2-3 × 2-3.
        const sums = [
            [0, 1, 2, 4, 5, 6, 8, 9, 10],
            [2, 3, 6, 7, 10, 11],
            [8, 9, 10, 12, 13, 14],
            [10, 11, 14, 15],
        ].map((cells) => Math.min(6, cells.reduce((s, c) => s + c / 16, 0)));
        const first = sums.map((s) => Math.max(0, s - 1));
        const pooled = lml.image.forward(layers, input, 4);
        expect(pooled[0]).toBeCloseTo(first.reduce((a, b) => a + b, 0) / 4, 5);
        expect(pooled[1]).toBeCloseTo(first.reduce((a, b) => a + Math.min(6, Math.max(0, 10 - b)), 0) / 4, 5);
    });

    it('decodes the shipped int8 MobileNet and matches TensorFlow.js closely', () => {
        const layers = lml.image.load();
        expect(lml.image.load()).toBe(layers);
        expect(layers).toHaveLength(27);
        expect(layers.at(-1).cout).toBe(256);
        const input = new Float32Array(224 * 224 * 3);
        for (let y = 0; y < 224; y++)
            for (let x = 0; x < 224; x++)
                for (let c = 0; c < 3; c++)
                    input[(y * 224 + x) * 3 + c] = Math.sin((x * (c + 1)) / 17) * Math.cos((y * (3 - c)) / 23);
        const out = lml.image.forward(layers, input);
        let dot = 0;
        let a = 0;
        let b = 0;
        TFJS_REFERENCE.forEach((r, i) => {
            dot += out[i] * r;
            a += out[i] ** 2;
            b += r ** 2;
        });
        // FP32 folded weights match TensorFlow.js to 6e-5; int8 keeps the direction.
        expect(dot / Math.sqrt(a * b)).toBeGreaterThan(0.9);
    });

    it('fails clearly when the extractor script is missing', () => {
        delete window.$learningmlMobilenet;
        lml.image.layers = null;
        expect(() => lml.image.load()).toThrow('msgImageError');
    });

    it('keeps every distributed file of the iDevice within 640,000 bytes', () => {
        const files = readdirSync(__dirname).filter((f) => !f.endsWith('.test.js'));
        const total = files.reduce((n, f) => n + statSync(join(__dirname, f)).size, 0);
        // Leaves room for 280 kB of author images per activity (see edition IMAGE_BUDGET).
        expect(total).toBeLessThan(640000 - 280000);
    });
});

describe('LearningML configuration', () => {
    let lml;
    beforeEach(() => {
        lml = load();
    });

    it('defaults, trims and bounds every field', () => {
        const empty = lml.normalize(null);
        expect(empty).toMatchObject({
            version: 1,
            instructions: '',
            dataType: 'text',
            algorithm: 'neural-network',
            classes: [],
            isScorm: 0,
            weighted: 100,
            passScoreMode: 'global',
            passScoreCustom: 5,
            evaluation: false,
            evaluationID: '',
        });
        expect(empty.msgs.msgTrain).toBe('Train');
        const c = lml.normalize({
            dataType: 'numbers',
            algorithm: 'knn',
            classes: [{ name: ' A ', examples: [' 1 ', ''], tests: ['2'] }, { name: '' }, 'bad'],
            isScorm: '2',
            weighted: '500',
            passScoreMode: 'custom',
            passScoreCustom: '-4',
            msgs: { msgTrain: 'Entrenar', msgResult: '', other: 'x' },
        });
        expect(c.classes).toEqual([{ name: 'A', examples: ['1'], tests: ['2'] }]);
        expect([c.dataType, c.algorithm, c.isScorm, c.weighted, c.passScoreCustom]).toEqual(['numbers', 'knn', 2, 100, 0]);
        expect([c.msgs.msgTrain, c.msgs.msgResult, c.msgs.other]).toEqual(['Entrenar', 'Result', undefined]);
        expect(lml.normalize({ isScorm: 7, weighted: '' })).toMatchObject({ isScorm: 0, weighted: 100 });
        expect(() => lml.normalize({ version: 2 })).toThrow('Unsupported');
    });

    it('keeps only image data URLs in image activities', () => {
        const png = 'data:image/png;base64,iVBORw0KGgo=';
        const c = lml.normalize({
            dataType: 'images',
            classes: [{ name: 'A', examples: [png, 'javascript:alert(1)', 'data:text/html;base64,PGI+'] }],
        });
        expect(c.classes[0].examples).toEqual([png]);
    });

    it('reports the first authoring problem', () => {
        const c = lml.normalize(config());
        expect(lml.check(c)).toBe('');
        expect(lml.check({ ...c, classes: c.classes.slice(0, 1) })).toContain('two classes');
        expect(lml.check({ ...c, classes: [c.classes[0], { ...c.classes[1], name: 'hello' }] })).toContain('different');
        const noTests = c.classes.map((k) => ({ ...k, tests: [] }));
        expect(lml.check({ ...c, classes: noTests })).toContain('evaluation');
        expect(lml.check({ ...c, isScorm: 0, evaluation: true, classes: noTests })).toContain('evaluation');
        expect(lml.check({ ...c, isScorm: 0, classes: noTests })).toBe('');
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

    it('translates content strings with c_ when the editor provides it', () => {
        window.c_ = (s) => `[${s}]`;
        try {
            expect(lml.defaultMessages().msgTrain).toBe('[Train]');
        } finally {
            delete window.c_;
        }
    });
});

describe('LearningML learner activity', () => {
    let lml;
    let shared;
    beforeEach(() => {
        document.body.innerHTML = '';
        window.eXeLearning = undefined;
        lml = load();
        shared = {
            scorm: {
                addButtonScoreNew: vi.fn((game) =>
                    game.isScorm === 2 ? '<div class="Games-BottonContainer"><input type="button" class="Games-SendScore" /></div>' : ''
                ),
                registerActivity: vi.fn(),
                sendScoreNew: vi.fn(),
            },
            report: { saveEvaluation: vi.fn(), updateEvaluationIcon: vi.fn() },
        };
        window.$exeDevices = { iDevice: { gamification: shared } };
    });
    afterEach(() => {
        delete window.$exeDevices;
    });

    it('renders the instructions and the progress report marker, without the configuration', () => {
        const c = config({ instructions: '<p>Do <b>this</b></p>', evaluation: true, evaluationID: 'report-1' });
        const html = lml.renderView(c, null, '<div>{content}</div>', 'node"9');
        document.body.innerHTML = html;
        expect(document.querySelector('.lml-instructions b').textContent).toBe('this');
        const marker = document.querySelector('.game-evaluation-ids');
        expect(marker.dataset).toMatchObject({ id: 'node"9', evaluationb: 'true', evaluationid: 'report-1' });
        expect(html).not.toContain('hello friend');
        expect(lml.renderView({ version: 9 }, null, '{content}')).toContain('invalid data');
    });

    it('trains, classifies and checks the model across the three columns', async () => {
        const root = mount(lml, config({ isScorm: 0 }));
        expect([...root.querySelectorAll('h4')].map((h) => h.textContent)).toEqual([
            '1. Training data',
            '2. Train',
            '3. Result',
        ]);
        const status = root.querySelector('.lml-status');
        submit(root, 'Example to classify', 'hello');
        await until(() => root.querySelector('.lml-result').textContent === 'Train the model first.');
        button(root, 'Check my model').click();
        expect(root.querySelector('.lml-score').textContent).toBe('Train the model first.');

        submit(root, 'New example for Hello', 'hi there');
        expect(root.querySelectorAll('.lml-class')[0].querySelectorAll('li')).toHaveLength(3);
        button(root, 'Train the model').click();
        await until(() => status.textContent === 'Model trained with 5 examples.');
        submit(root, 'Example to classify', 'hi');
        await until(() => root.querySelector('.lml-prediction')?.textContent === 'The model says: Hello');
        expect(root.querySelectorAll('.lml-bar')).toHaveLength(2);
        submit(root, 'Example to classify', 'nothing known');
        await until(() => root.querySelector('.lml-result').textContent.includes('does not know any'));
        button(root, 'Check my model').click();
        await until(() => root.querySelector('.lml-score').textContent === 'Score: 100/100. Passed.');
        expect(shared.scorm.registerActivity).not.toHaveBeenCalled();

        root.querySelector('.lml-remove').click();
        expect(status.textContent).toContain('Train the model again');
        expect(root.querySelector('.lml-result').textContent).toBe('');
    });

    it('shows neural network progress and ignores clicks while training', async () => {
        const root = mount(lml, config({ isScorm: 0, algorithm: 'neural-network' }));
        const train = button(root, 'Train the model');
        train.click();
        train.click();
        expect(train.disabled).toBe(true);
        await until(() => root.querySelector('.lml-status').textContent.startsWith('Epoch'));
        await until(() => root.querySelector('.lml-status').textContent === 'Model trained with 4 examples.');
        expect(root.querySelector('progress').value).toBe(1);
        expect(train.disabled).toBe(false);
    });

    it('validates numeric input and explains training failures', async () => {
        const c = config({
            dataType: 'numbers',
            isScorm: 0,
            classes: [
                { name: 'Small', examples: ['1'], tests: [] },
                { name: 'Large', examples: [], tests: [] },
            ],
        });
        const root = mount(lml, c);
        expect(button(root, 'Check my model')).toBeUndefined();
        expect(root.querySelector('input[type="text"]').placeholder).toBe('Numbers separated by commas');
        submit(root, 'New example for Small', 'two');
        expect(root.querySelector('.lml-status').textContent).toContain('numbers separated by commas');
        submit(root, 'New example for Small', '   ');
        expect(root.querySelectorAll('.lml-class')[0].querySelectorAll('li')).toHaveLength(1);
        button(root, 'Train the model').click();
        await until(() => root.querySelector('.lml-status').textContent === 'Every class needs at least one example.');
        submit(root, 'New example for Large', '9');
        root.querySelector('select').value = 'knn';
        root.querySelector('select').dispatchEvent(new Event('change'));
        button(root, 'Train the model').click();
        await until(() => root.querySelector('.lml-status').textContent.startsWith('Model trained'));
        submit(root, 'Example to classify', '1, 2');
        await until(() => root.querySelector('.lml-result').textContent.includes('same number of values'));
    });

    it('collects, trains and classifies images through the extractor', async () => {
        const red = 'data:image/png;base64,AAAA';
        const blue = 'data:image/png;base64,BBBB';
        lml.image.fromFile = vi.fn(async (file) => (file.name.startsWith('red') ? red : blue));
        lml.image.embed = vi.fn(async (url) => (url === red ? [1, 0] : [0, 1]));
        const root = mount(
            lml,
            config({
                dataType: 'images',
                algorithm: 'knn',
                isScorm: 0,
                classes: [
                    { name: 'Red', examples: [red], tests: [] },
                    { name: 'Blue', examples: [], tests: [] },
                ],
            })
        );
        expect(root.querySelector('.lml-images img').alt).toBe('Red 1');
        const upload = root.querySelector('#lml1e1');
        Object.defineProperty(upload, 'files', { value: [new File(['x'], 'blue.png')], configurable: true });
        upload.dispatchEvent(new Event('change'));
        await until(() => root.querySelectorAll('.lml-class')[1].querySelectorAll('img').length === 1);
        button(root, 'Train the model').click();
        await until(() => root.querySelector('.lml-status').textContent === 'Model trained with 2 examples.');
        const probe = root.querySelector('#lml1try');
        Object.defineProperty(probe, 'files', { value: [new File(['x'], 'red-probe.png')], configurable: true });
        probe.dispatchEvent(new Event('change'));
        await until(() => root.querySelector('.lml-prediction')?.textContent === 'The model says: Red');
        expect(root.querySelector('.lml-preview').src).toBe(red);

        lml.image.fromFile = vi.fn(async () => {
            throw new Error('broken');
        });
        upload.dispatchEvent(new Event('change'));
        await until(() => root.querySelector('.lml-status').textContent === 'The image could not be read.');
    });

    it('mounts each activity once, isolated, and reports bad data in place', () => {
        const first = mount(lml, config({ isScorm: 0 }), 'a');
        const second = mount(lml, config({ isScorm: 0 }), 'b');
        lml.init({ ...config(), ideviceId: 'a' });
        lml.init({});
        lml.renderBehaviour();
        expect(document.querySelectorAll('.lml-columns')).toHaveLength(2);
        submit(first, 'New example for Hello', 'only in the first');
        expect(second.textContent).not.toContain('only in the first');
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        mount(lml, { classes: [] }, 'empty');
        expect(document.body.textContent).toContain('no classes yet');
        document.body.insertAdjacentHTML('beforeend', '<div class="idevice_node" id="bad"><div class="lml-activity"></div></div>');
        lml.init({ version: 3, ideviceId: 'bad' });
        expect(document.getElementById('bad').textContent).toContain('contains invalid data');
    });

    it('saves the score automatically through the shared SCORM helpers and the progress report', async () => {
        const root = mount(lml, config({ evaluation: true, evaluationID: 'report-1' }));
        expect(shared.scorm.registerActivity).toHaveBeenCalledWith(
            expect.objectContaining({ main: root.id, isScorm: 1, weighted: 40, numberQuestions: 4, idevice: 'learningml' })
        );
        expect(shared.report.updateEvaluationIcon).toHaveBeenCalled();
        button(root, 'Train the model').click();
        await until(() => root.querySelector('.lml-status').textContent.startsWith('Model trained'));
        button(root, 'Check my model').click();
        await until(() => shared.scorm.sendScoreNew.mock.calls.length === 1);
        const game = shared.scorm.sendScoreNew.mock.calls[0][1];
        expect(shared.scorm.sendScoreNew.mock.calls[0][0]).toBe(true);
        expect(game).toMatchObject({ scorerp: 10, gameStarted: true, gameOver: true });
        expect(shared.report.saveEvaluation).toHaveBeenCalledWith(game);
    });

    it('offers the shared save button in manual mode and fails the pass mark when the model is weak', async () => {
        const c = config({ isScorm: 2, textButtonScorm: 'Save', passScoreMode: 'global' });
        c.classes[0].tests = ['goodbye friend'];
        c.classes[1].tests = ['hello friend'];
        const root = mount(lml, c);
        root.querySelector('.Games-SendScore').click();
        expect(shared.scorm.sendScoreNew).toHaveBeenCalledWith(false, expect.objectContaining({ gameStarted: false }));
        button(root, 'Train the model').click();
        await until(() => root.querySelector('.lml-status').textContent.startsWith('Model trained'));
        button(root, 'Check my model').click();
        await until(() => root.querySelector('.lml-score').textContent.includes('try again'));
        expect(shared.scorm.sendScoreNew).toHaveBeenCalledTimes(1);
        expect(lml.passMark({ passScoreMode: 'global' })).toBe(5);
        window.$exe = { passScore: { get: () => 7 } };
        expect(lml.passMark({ passScoreMode: 'global' })).toBe(7);
        delete window.$exe;
    });

    it('does not register in the editor or when it neither scores nor reports', () => {
        mount(lml, config({ isScorm: 0 }), 'x');
        window.eXeLearning = {};
        mount(lml, config(), 'z');
        expect(shared.scorm.registerActivity).not.toHaveBeenCalled();
    });
});

// TensorFlow.js 4.22 (CPU) embedding of the test input above, from the original FP32
// tfjs-models mobilenet_v1_0.25_224 truncated at reshape_1.
const TFJS_REFERENCE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.00437, 0.19716, 0.30099, 0.02078, 0, 0, 1.44062, 0, 0.25299, 0, 0.03972, 0.02049, 0, 0, 0, 0, 0, 3.58266, 0, 0, 0.01105, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.09141, 0, 0.19147, 0, 0, 0.07292, 0, 0, 0.01188, 0, 0, 0, 5.31753, 0.28544, 0, 0, 0, 0, 0, 0, 0.28508, 0, 0, 1.20965, 0, 0, 0.08733, 0, 0.07322, 0, 0, 0, 0, 0, 0.15668, 0.47203, 0, 0, 0, 0, 0, 0, 0, 0.10796, 0.38822, 2.92822, 0.00689, 0, 0, 0.06085, 0, 0, 1.95571, 0.47345, 0.27336, 0, 0, 0, 0, 0.4645, 0.2216, 0, 0, 0.62654, 0, 0, 0, 0, 0, 0.26068, 0, 0, 1.95665, 0, 0, 0.03078, 0.10081, 0.09566, 0.00697, 0.14823, 0, 0.03572, 0, 0.09857, 0, 0, 0.12054, 0, 0, 0.04912, 0.09134, 0, 0, 2.0834, 0, 0, 0.26198, 3.1834, 0.02283, 0, 0, 1.12171, 0, 0, 0, 0, 0.50846, 0, 0, 1.36394, 0, 0, 0.10223, 0.33967, 0, 0, 0.28941, 0, 0, 0.49056, 0, 0, 2.87824, 0, 0.16331, 0, 0, 0.0242, 0.02445, 0.38645, 0.01926, 0, 0, 0, 0, 6, 0, 0.34898, 0.39445, 0, 0, 0, 0.98096, 0, 0, 0, 0, 0, 0, 0, 0.04097, 0, 0, 0, 0, 0.03764, 0, 0, 0, 0.07943, 0.07502, 0, 0.06929, 0.23467, 0.23679, 0, 0.02167, 0, 0.74059, 0.14816, 2.96914, 0, 0, 0, 0.44802, 0, 0.09538, 0.20674, 0, 0, 0, 0, 0, 0.01177, 0.08304, 0, 0.08515, 0, 0, 0.01558, 0.81967, 0.56778, 0.35965, 0, 0, 0, 0, 0, 1.93169, 0.51353, 0, 0.04887, 0, 0, 0, 0, 0.1728, 0, 0, 0, 0, 0, 0];
