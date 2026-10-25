/* eslint-disable no-undef */
/**
 * LearningML iDevice (export code)
 *
 * The three LearningML columns: training data, train and result. Learners
 * add examples (text, numbers or images) to the teacher's classes, train a
 * model in the browser and try it. Optional evaluation examples grade the
 * model through the shared gamification SCORM helpers.
 *
 * Everything runs offline: bag of words, Gaussian Naive Bayes, k-NN and the
 * LearningML neural network are plain JavaScript, and images go through a
 * MobileNet v1 0.25 feature extractor (learningml-mobilenet.js) run here
 * without TensorFlow.js.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
var $learningml = {
    instances: 0,

    /** Content strings: c_() exists in the editor, not in exported pages. */
    c_(text) {
        return typeof window.c_ === 'function' ? window.c_(text) : text;
    },

    /** Learner texts, editable in the "Custom texts" tab. */
    defaultMessages() {
        const c_ = (s) => this.c_(s);
        return {
            msgTrainingData: c_('Training data'),
            msgTrain: c_('Train'),
            msgResult: c_('Result'),
            msgNewExample: c_('New example for'),
            msgAddImages: c_('Add images to'),
            msgAdd: c_('Add'),
            msgWriteExample: c_('Write an example'),
            msgNumbersPlaceholder: c_('Numbers separated by commas'),
            msgExamples: c_('Examples'),
            msgRemoveExample: c_('Remove example'),
            msgAlgorithm: c_('Algorithm'),
            msgNeuralNetwork: c_('Neural network'),
            msgNaiveBayes: c_('Naive Bayes'),
            msgKnn: c_('Nearest neighbours (k-NN)'),
            msgTrainModel: c_('Train the model'),
            msgTraining: c_('Training…'),
            msgEpoch: c_('Epoch'),
            msgLoss: c_('loss'),
            msgReadingImages: c_('Reading the images…'),
            msgTrained: c_('Model trained with %s examples.'),
            msgStart: c_('Add examples to every class and train the model.'),
            msgRetrain: c_('Train the model again to use the new examples.'),
            msgTrainFirst: c_('Train the model first.'),
            msgExampleToClassify: c_('Example to classify'),
            msgImageToClassify: c_('Image to classify'),
            msgClassify: c_('Classify'),
            msgModelSays: c_('The model says'),
            msgCheck: c_('Check my model'),
            msgScore: c_('Score'),
            msgYouScore: c_('Your score'),
            msgSavedScore: c_('Saved score'),
            msgPassed: c_('Passed.'),
            msgTryAgain: c_('Add better examples and try again.'),
            msgEndGameScore: c_('Check your model before saving your score.'),
            msgTypeGame: c_('LearningML'),
            msgTwoClasses: c_('At least two classes are needed.'),
            msgEveryClass: c_('Every class needs at least one example.'),
            msgNumbersFormat: c_('Write numbers separated by commas, such as 1.5, 2.'),
            msgSameCount: c_('Write the same number of values as the examples.'),
            msgUnknownWords: c_('The model does not know any of these words.'),
            msgImageError: c_('The image could not be read.'),
            msgNoClasses: c_('This activity has no classes yet.'),
            msgInvalid: c_('This LearningML activity contains invalid data.'),
        };
    },

    escape(value) {
        return String(value).replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
        );
    },

    DATA_TYPES: ['text', 'numbers', 'images'],
    ALGORITHMS: ['neural-network', 'naive-bayes', 'knn'],
    IMAGE_URL: /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i,

    /** Version 1 configuration with every field defaulted and bounded. */
    normalize(raw) {
        const d = raw && typeof raw === 'object' ? raw : {};
        if (d.version !== undefined && d.version !== 1) throw new Error('Unsupported LearningML data version.');
        const dataType = this.DATA_TYPES.includes(d.dataType) ? d.dataType : 'text';
        const valid = (s) => s && (dataType !== 'images' || this.IMAGE_URL.test(s));
        const lines = (v) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(valid) : []);
        const number = (v, min, max, fallback) => {
            const n = Number(v);
            return v !== '' && v !== null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
        };
        const defaults = this.defaultMessages();
        const msgs = d.msgs && typeof d.msgs === 'object' ? d.msgs : {};
        return {
            version: 1,
            instructions: String(d.instructions ?? ''),
            dataType,
            algorithm: this.ALGORITHMS.includes(d.algorithm) ? d.algorithm : 'neural-network',
            classes: (Array.isArray(d.classes) ? d.classes : [])
                .map((c) => ({ name: String(c?.name ?? '').trim(), examples: lines(c?.examples), tests: lines(c?.tests) }))
                .filter((c) => c.name),
            isScorm: [0, 1, 2].includes(Number(d.isScorm)) ? Number(d.isScorm) : 0,
            textButtonScorm: String(d.textButtonScorm ?? ''),
            weighted: number(d.weighted, 1, 100, 100),
            passScoreMode: d.passScoreMode === 'custom' ? 'custom' : 'global',
            passScoreCustom: number(d.passScoreCustom, 0, 10, 5),
            evaluation: d.evaluation === true,
            evaluationID: String(d.evaluationID ?? ''),
            msgs: Object.fromEntries(
                Object.keys(defaults).map((k) => [k, typeof msgs[k] === 'string' && msgs[k] ? msgs[k] : defaults[k]])
            ),
        };
    },

    /** First authoring problem, as an English source string, or ''. */
    check(config) {
        if (config.classes.length < 2) return 'Add at least two classes.';
        const names = config.classes.map((c) => c.name.toLowerCase());
        if (new Set(names).size !== names.length) return 'Class names must be different.';
        if (config.dataType === 'numbers') {
            const vectors = config.classes.flatMap((c) => c.examples.concat(c.tests)).map((s) => this.ml.numbers(s));
            if (vectors.some((v) => !v)) return 'Numeric examples must be numbers separated by commas, such as 1.5, 2.';
            if (new Set(vectors.map((v) => v.length)).size > 1) return 'All numeric examples must have the same number of values.';
        }
        if ((config.isScorm > 0 || config.evaluation) && !config.classes.some((c) => c.tests.length))
            return 'Add evaluation examples to grade this activity.';
        return '';
    },

    ml: {
        /** Lowercase Unicode words without accents, so "Canción" and "cancion" match. */
        tokens(text) {
            return String(text)
                .toLowerCase()
                .normalize('NFD')
                .replace(/\p{M}/gu, '')
                .split(/[^\p{L}\p{N}]+/u)
                .filter(Boolean);
        },

        numbers(text) {
            const values = String(text)
                .split(/[\s,;]+/)
                .filter(Boolean)
                .map(Number);
            return values.length && values.every(Number.isFinite) ? values : null;
        },

        softmax(logits) {
            const max = Math.max(...logits);
            const exp = logits.map((l) => Math.exp(l - max));
            const sum = exp.reduce((a, b) => a + b, 0) || 1;
            return exp.map((e) => e / sum);
        },

        /** Deterministic PRNG, so a dataset always trains the same network. */
        random(seed) {
            return () => {
                seed = (seed + 0x6d2b79f5) | 0;
                let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        },

        /** Gaussian Naive Bayes, as LearningML's (variance smoothing 1e-9, prior smoothing 1). */
        naiveBayes(rows, classCount) {
            const dim = rows[0].x.length;
            const stats = Array.from({ length: classCount }, () => ({
                n: 0,
                sum: new Float64Array(dim),
                sq: new Float64Array(dim),
            }));
            for (const { x, y } of rows) {
                const s = stats[y];
                s.n++;
                for (let d = 0; d < dim; d++) {
                    s.sum[d] += x[d];
                    s.sq[d] += x[d] * x[d];
                }
            }
            return (x) =>
                this.softmax(
                    stats.map((s) => {
                        let score = Math.log((s.n + 1) / (rows.length + classCount));
                        for (let d = 0; d < dim; d++) {
                            const mean = s.sum[d] / s.n;
                            const variance = Math.max(s.sq[d] / s.n - mean * mean, 0) + 1e-9 + Number.EPSILON;
                            const diff = x[d] - mean;
                            score += -0.5 * Math.log(2 * Math.PI * variance) - (diff * diff) / (2 * variance);
                        }
                        return score;
                    })
                );
        },

        /**
         * Weighted k-NN with k = 3: cosine similarity for words and images,
         * 1 / (1 + Euclidean distance) for standardized numbers. A neighbour
         * that shares nothing with the input has no say.
         */
        knn(rows, classCount, cosine) {
            const unit = (v) => {
                const norm = Math.hypot(...v);
                return norm ? v.map((n) => n / norm) : v;
            };
            const data = rows.map((r) => ({ x: cosine ? unit(r.x) : r.x, y: r.y }));
            const k = Math.min(3, data.length);
            return (input) => {
                const q = cosine ? unit(input) : input;
                const weight = (x) =>
                    cosine
                        ? Math.max(0, x.reduce((s, v, i) => s + v * q[i], 0))
                        : 1 / (1 + Math.sqrt(x.reduce((s, v, i) => s + (v - q[i]) ** 2, 0)));
                const votes = new Array(classCount).fill(0);
                data.map((r) => ({ y: r.y, w: weight(r.x) }))
                    .sort((a, b) => b.w - a.w)
                    .slice(0, k)
                    .forEach((n) => (votes[n.y] += n.w));
                const total = votes.reduce((a, b) => a + b, 0);
                return votes.map((v) => (total ? v / total : 1 / classCount));
            };
        },

        /**
         * LearningML's network (lml-algorithms LMLSequential): dense 200 ReLU,
         * dense 100 ReLU, softmax output without bias; Adam, cross-entropy,
         * batches of 10. Plain JavaScript, seeded for repeatable results.
         */
        async neuralNetwork(rows, classCount, options = {}) {
            const { epochs = 20, learningRate = 0.001, onEpoch } = options;
            const rand = this.random(20261025);
            const sizes = [rows[0].x.length, 200, 100, classCount];
            const layer = (inputs, outputs, bias) => {
                const limit = Math.sqrt(6 / (inputs + outputs));
                const w = Float64Array.from({ length: inputs * outputs }, () => (rand() * 2 - 1) * limit);
                return { inputs, outputs, w, b: bias ? new Float64Array(outputs) : null };
            };
            const layers = [layer(sizes[0], 200, true), layer(200, 100, true), layer(100, classCount, false)];
            const params = layers.flatMap((l) => (l.b ? [l.w, l.b] : [l.w]));
            const grads = params.map((p) => new Float64Array(p.length));
            const m = params.map((p) => new Float64Array(p.length));
            const v = params.map((p) => new Float64Array(p.length));
            const forward = (x) => {
                const acts = [x];
                layers.forEach((l, li) => {
                    const input = acts[li];
                    const out = new Float64Array(l.outputs);
                    for (let o = 0; o < l.outputs; o++) {
                        let s = l.b ? l.b[o] : 0;
                        const row = o * l.inputs;
                        for (let i = 0; i < l.inputs; i++) s += l.w[row + i] * input[i];
                        out[o] = li < 2 && s < 0 ? 0 : s;
                    }
                    acts.push(out);
                });
                acts[3] = this.softmax(Array.from(acts[3]));
                return acts;
            };
            let step = 0;
            const order = rows.map((_, i) => i);
            for (let epoch = 1; epoch <= epochs; epoch++) {
                for (let i = order.length - 1; i > 0; i--) {
                    const j = Math.floor(rand() * (i + 1));
                    [order[i], order[j]] = [order[j], order[i]];
                }
                let loss = 0;
                for (let start = 0; start < order.length; start += 10) {
                    const batch = order.slice(start, start + 10);
                    grads.forEach((g) => g.fill(0));
                    for (const index of batch) {
                        const { x, y } = rows[index];
                        const acts = forward(x);
                        loss -= Math.log(Math.max(acts[3][y], 1e-12));
                        let delta = acts[3].map((p, c) => p - (c === y ? 1 : 0));
                        for (let li = 2, gi = grads.length - 1; li >= 0; li--) {
                            const l = layers[li];
                            const input = acts[li];
                            const gb = l.b ? grads[gi--] : null;
                            const gw = grads[gi--];
                            const back = new Float64Array(l.inputs);
                            for (let o = 0; o < l.outputs; o++) {
                                const d = delta[o];
                                if (!d) continue;
                                if (gb) gb[o] += d;
                                const row = o * l.inputs;
                                for (let k = 0; k < l.inputs; k++) {
                                    gw[row + k] += d * input[k];
                                    back[k] += d * l.w[row + k];
                                }
                            }
                            if (li > 0) for (let k = 0; k < l.inputs; k++) if (input[k] <= 0) back[k] = 0;
                            delta = back;
                        }
                    }
                    step++;
                    const c1 = 1 - 0.9 ** step;
                    const c2 = 1 - 0.999 ** step;
                    params.forEach((p, pi) => {
                        const g = grads[pi];
                        for (let k = 0; k < p.length; k++) {
                            const gk = g[k] / batch.length;
                            m[pi][k] = 0.9 * m[pi][k] + 0.1 * gk;
                            v[pi][k] = 0.999 * v[pi][k] + 0.001 * gk * gk;
                            p[k] -= (learningRate * (m[pi][k] / c1)) / (Math.sqrt(v[pi][k] / c2) + 1e-7);
                        }
                    });
                }
                if (onEpoch) await onEpoch(epoch, epochs, loss / rows.length);
            }
            return (x) => forward(x)[3];
        },

        /**
         * Train on every class's examples. `encodeImage` turns an image into
         * its feature vector. Throws an Error whose message is a msgs key.
         */
        async train(dataType, algorithm, classes, options = {}) {
            if (classes.length < 2) throw new Error('msgTwoClasses');
            if (classes.some((c) => !c.examples.length)) throw new Error('msgEveryClass');
            let encode;
            if (dataType === 'text') {
                const vocabulary = new Map();
                for (const c of classes)
                    for (const e of c.examples)
                        for (const t of this.tokens(e)) if (!vocabulary.has(t)) vocabulary.set(t, vocabulary.size);
                encode = async (text) => {
                    const v = new Array(vocabulary.size).fill(0);
                    let known = 0;
                    for (const t of this.tokens(text))
                        if (vocabulary.has(t)) {
                            v[vocabulary.get(t)]++;
                            known++;
                        }
                    if (!known) throw new Error('msgUnknownWords');
                    return v;
                };
            } else if (dataType === 'numbers') {
                const parsed = classes.flatMap((c) => c.examples.map((e) => this.numbers(e)));
                const dim = parsed[0]?.length;
                if (parsed.some((p) => !p || p.length !== dim)) throw new Error('msgSameCount');
                const mean = parsed[0].map((_, d) => parsed.reduce((s, p) => s + p[d], 0) / parsed.length);
                const std = mean.map(
                    (mu, d) => Math.sqrt(parsed.reduce((s, p) => s + (p[d] - mu) ** 2, 0) / parsed.length) || 1
                );
                encode = async (text) => {
                    const v = this.numbers(text);
                    if (!v) throw new Error('msgNumbersFormat');
                    if (v.length !== dim) throw new Error('msgSameCount');
                    return v.map((n, d) => (n - mean[d]) / std[d]);
                };
            } else {
                encode = async (url) => {
                    const v = Array.from(await options.encodeImage(url));
                    const norm = Math.hypot(...v) || 1;
                    return v.map((n) => n / norm);
                };
            }
            const rows = [];
            for (const [y, c] of classes.entries()) for (const e of c.examples) rows.push({ x: await encode(e), y });
            let predict;
            if (algorithm === 'knn') predict = this.knn(rows, classes.length, dataType !== 'numbers');
            else if (algorithm === 'naive-bayes') predict = this.naiveBayes(rows, classes.length);
            else predict = await this.neuralNetwork(rows, classes.length, options);
            return {
                /** [[label, confidence 0..1], ...], most likely first. */
                classify: async (input) =>
                    predict(await encode(input))
                        .map((p, i) => [classes[i].name, p])
                        .sort((a, b) => b[1] - a[1]),
            };
        },

        /** Percentage of evaluation examples classified as their class, or null. */
        async evaluate(model, classes) {
            let total = 0;
            let correct = 0;
            for (const c of classes)
                for (const test of c.tests) {
                    total++;
                    try {
                        if ((await model.classify(test))[0][0] === c.name) correct++;
                    } catch {
                        // An unclassifiable evaluation example counts as wrong.
                    }
                }
            return total ? Math.round((100 * correct) / total) : null;
        },
    },

    image: {
        SIZE: 224,
        layers: null,
        cache: new Map(),

        /** Dequantize the extractor once; the page shares it between activities. */
        load() {
            if (this.layers) return this.layers;
            const model = window.$learningmlMobilenet;
            if (!model) throw new Error('msgImageError');
            const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
            const floats = new Float32Array(bytes(model.floats));
            const ints = new Int8Array(bytes(model.ints));
            let fo = 0;
            let io = 0;
            this.layers = model.layers.map(([kind, stride, cin, cout]) => {
                const per = kind === 0 ? 9 * cin : kind === 1 ? 9 : cin;
                const scales = floats.subarray(fo, fo + cout);
                const bias = floats.slice(fo + cout, fo + 2 * cout);
                fo += 2 * cout;
                const w = new Float32Array(cout * per);
                for (let k = 0; k < w.length; k++) w[k] = ints[io + k] * scales[Math.floor(k / per)];
                io += w.length;
                return { kind, stride, cin, cout, w, bias };
            });
            return this.layers;
        },

        /**
         * MobileNet v1 forward pass (NHWC, TensorFlow "same" padding, ReLU6)
         * up to the global average pool. `input` is SIZE × SIZE × 3 in [-1, 1].
         */
        forward(layers, input, size = this.SIZE) {
            let x = input;
            let h = size;
            for (const { kind, stride, cin, cout, w, bias } of layers) {
                const oh = kind === 2 ? h : Math.ceil(h / stride);
                const out = new Float32Array(oh * oh * cout);
                if (kind === 2) {
                    for (let p = 0; p < h * h; p++)
                        for (let o = 0; o < cout; o++) {
                            let s = bias[o];
                            for (let i = 0, xi = p * cin, wi = o * cin; i < cin; i++) s += x[xi + i] * w[wi + i];
                            out[p * cout + o] = s < 0 ? 0 : s > 6 ? 6 : s;
                        }
                } else {
                    const pad = Math.floor(Math.max((oh - 1) * stride + 3 - h, 0) / 2);
                    for (let oy = 0; oy < oh; oy++)
                        for (let ox = 0; ox < oh; ox++)
                            for (let o = 0; o < cout; o++) {
                                let s = bias[o];
                                for (let ky = 0; ky < 3; ky++) {
                                    const iy = oy * stride + ky - pad;
                                    if (iy < 0 || iy >= h) continue;
                                    for (let kx = 0; kx < 3; kx++) {
                                        const ix = ox * stride + kx - pad;
                                        if (ix < 0 || ix >= h) continue;
                                        const xi = (iy * h + ix) * cin;
                                        if (kind === 1) s += x[xi + o] * w[o * 9 + ky * 3 + kx];
                                        else
                                            for (let i = 0, wi = o * 9 * cin + (ky * 3 + kx) * cin; i < cin; i++)
                                                s += x[xi + i] * w[wi + i];
                                    }
                                }
                                out[(oy * oh + ox) * cout + o] = s < 0 ? 0 : s > 6 ? 6 : s;
                            }
                }
                x = out;
                h = oh;
            }
            const channels = layers[layers.length - 1].cout;
            const pooled = new Float32Array(channels);
            for (let p = 0; p < h * h; p++) for (let c = 0; c < channels; c++) pooled[c] += x[p * channels + c];
            return pooled.map((s) => s / (h * h));
        },

        decode(url) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('msgImageError'));
                img.src = url;
            });
        },

        /** 256 MobileNet features for an image data URL, computed once per image. */
        async embed(url) {
            if (!this.cache.has(url)) {
                const img = await this.decode(url);
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = this.SIZE;
                const context = canvas.getContext('2d');
                context.drawImage(img, 0, 0, this.SIZE, this.SIZE);
                const rgba = context.getImageData(0, 0, this.SIZE, this.SIZE).data;
                const input = new Float32Array(this.SIZE * this.SIZE * 3);
                for (let p = 0; p < this.SIZE * this.SIZE; p++)
                    for (let c = 0; c < 3; c++) input[p * 3 + c] = rgba[p * 4 + c] / 127.5 - 1;
                this.cache.set(url, this.forward(this.load(), input));
            }
            return this.cache.get(url);
        },

        /** A picked file as a JPEG data URL whose longer side is at most `size`. */
        async fromFile(file, size = this.SIZE) {
            const url = URL.createObjectURL(file);
            try {
                const img = await this.decode(url);
                const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL('image/jpeg', 0.85);
            } finally {
                URL.revokeObjectURL(url);
            }
        },
    },

    renderView(data, accessibility, template, ideviceId) {
        let config;
        try {
            config = this.normalize(data);
        } catch {
            return template.replace(
                '{content}',
                `<p class="lml-error">${this.escape(this.defaultMessages().msgInvalid)}</p>`
            );
        }
        const id = this.escape(ideviceId || data?.ideviceId || '');
        const html =
            '<div class="lml-activity">' +
            `<div class="game-evaluation-ids js-hidden" data-id="${id}" data-evaluationb="${config.evaluation}" data-evaluationid="${this.escape(config.evaluationID)}"></div>` +
            (config.instructions ? `<div class="lml-instructions">${config.instructions}</div>` : '') +
            '</div>';
        return template.replace('{content}', html);
    },

    renderBehaviour() {},

    mounted: new WeakSet(),

    init(data) {
        const root = data?.ideviceId && document.getElementById(data.ideviceId)?.querySelector('.lml-activity');
        if (!root || this.mounted.has(root)) return;
        this.mounted.add(root);
        let config;
        try {
            config = this.normalize(data);
        } catch {
            root.textContent = this.defaultMessages().msgInvalid;
            return;
        }
        this.mount(root, config);
    },

    el(tag, parent, text, attrs) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
        parent?.append(node);
        return node;
    },

    /** Build the three columns for one activity; its state stays in this closure. */
    mount(root, config) {
        const msgs = config.msgs;
        const say = (key) => msgs[key] || key;
        const el = (...args) => this.el(...args);
        const id = `lml${++this.instances}`;
        const images = config.dataType === 'images';
        const classes = config.classes.map((c) => ({ name: c.name, examples: c.examples.slice(), tests: c.tests }));
        const hasTests = classes.some((c) => c.tests.length);
        let model = null;
        let busy = false;

        root.querySelector('.lml-columns')?.remove();
        if (classes.length < 2) {
            el('p', root, say('msgNoClasses'), { class: 'lml-error' });
            return;
        }
        const columns = el('div', root, undefined, { class: 'lml-columns' });
        const column = (n, title) => {
            const section = el('section', columns, undefined, { class: 'lml-column', 'aria-labelledby': `${id}c${n}` });
            el('h4', section, `${n}. ${title}`, { id: `${id}c${n}` });
            return section;
        };
        const fileInput = (parent, label, inputId, multiple, onFiles) => {
            const input = el('input', parent, undefined, {
                id: inputId,
                type: 'file',
                accept: 'image/*',
                class: 'lml-upload-input',
            });
            el('label', parent, label, { for: inputId, class: 'btn btn-secondary btn-sm lml-upload' });
            input.multiple = multiple;
            input.addEventListener('change', async () => {
                const files = Array.from(input.files || []);
                input.value = '';
                const urls = [];
                for (const file of files) {
                    try {
                        urls.push(await this.image.fromFile(file));
                    } catch {
                        status.textContent = say('msgImageError');
                    }
                }
                if (urls.length) onFiles(urls);
            });
        };
        const textForm = (parent, label, inputId, buttonText, onSubmit) => {
            const form = el('form', parent, undefined, { class: 'lml-form' });
            el('label', form, label, { for: inputId, class: 'lml-label' });
            const input = el('input', form, undefined, { id: inputId, type: 'text', autocomplete: 'off' });
            input.placeholder = config.dataType === 'numbers' ? say('msgNumbersPlaceholder') : say('msgWriteExample');
            el('button', form, buttonText, { type: 'submit', class: 'btn btn-primary' });
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                onSubmit(input);
            });
        };
        const message = (error) => say(error?.message) || say('msgImageError');

        // 1. Training data
        const data = column(1, say('msgTrainingData'));
        const invalidate = () => {
            model = null;
            status.textContent = say('msgRetrain');
            renderResult([]);
        };
        classes.forEach((c, ci) => {
            const card = el('div', data, undefined, { class: 'lml-class' });
            el('h5', card, c.name);
            const list = el('ul', card, undefined, { class: images ? 'lml-examples lml-images' : 'lml-examples' });
            const count = el('p', card, '', { class: 'lml-count' });
            const renderList = () => {
                list.replaceChildren();
                c.examples.forEach((example, ei) => {
                    const item = el('li', list);
                    if (images) el('img', item, undefined, { src: example, alt: `${c.name} ${ei + 1}` });
                    else el('span', item, example);
                    el('button', item, '×', {
                        type: 'button',
                        class: 'lml-remove',
                        'aria-label': `${say('msgRemoveExample')}: ${images ? `${c.name} ${ei + 1}` : example}`,
                    }).addEventListener('click', () => {
                        c.examples.splice(ei, 1);
                        renderList();
                        invalidate();
                    });
                });
                count.textContent = `${say('msgExamples')}: ${c.examples.length}`;
            };
            const add = (values) => {
                c.examples.push(...values);
                renderList();
                invalidate();
            };
            if (images) fileInput(card, `${say('msgAddImages')} ${c.name}`, `${id}e${ci}`, true, add);
            else
                textForm(card, `${say('msgNewExample')} ${c.name}`, `${id}e${ci}`, say('msgAdd'), (field) => {
                    const value = field.value.trim();
                    if (!value) return;
                    if (config.dataType === 'numbers' && !this.ml.numbers(value)) {
                        status.textContent = say('msgNumbersFormat');
                        return;
                    }
                    field.value = '';
                    add([value]);
                });
            renderList();
        });

        // 2. Train
        const train = column(2, say('msgTrain'));
        el('label', train, say('msgAlgorithm'), { for: `${id}alg`, class: 'lml-label' });
        const algorithm = el('select', train, undefined, { id: `${id}alg`, class: 'form-select' });
        el('option', algorithm, say('msgNeuralNetwork'), { value: 'neural-network' });
        el('option', algorithm, say('msgNaiveBayes'), { value: 'naive-bayes' });
        el('option', algorithm, say('msgKnn'), { value: 'knn' });
        algorithm.value = config.algorithm;
        algorithm.addEventListener('change', invalidate);
        const trainButton = el('button', train, say('msgTrainModel'), { type: 'button', class: 'btn btn-primary' });
        const progress = el('progress', train, undefined, { class: 'lml-progress', max: '1', value: '0' });
        const status = el('p', train, say('msgStart'), { class: 'lml-status', role: 'status' });
        trainButton.addEventListener('click', async () => {
            if (busy) return;
            busy = true;
            trainButton.disabled = true;
            model = null;
            renderResult([]);
            progress.value = 0;
            status.textContent = images ? say('msgReadingImages') : say('msgTraining');
            try {
                model = await this.ml.train(config.dataType, algorithm.value, classes, {
                    encodeImage: (url) => this.image.embed(url),
                    onEpoch: async (epoch, epochs, loss) => {
                        progress.value = epoch / epochs;
                        status.textContent = `${say('msgEpoch')} ${epoch}/${epochs} · ${say('msgLoss')} ${loss.toFixed(3)}`;
                        await new Promise((resolve) => setTimeout(resolve));
                    },
                });
                progress.value = 1;
                const total = classes.reduce((n, c) => n + c.examples.length, 0);
                status.textContent = say('msgTrained').replace('%s', total);
            } catch (error) {
                model = null;
                status.textContent = message(error);
            } finally {
                busy = false;
                trainButton.disabled = false;
            }
        });

        // 3. Result
        const result = column(3, say('msgResult'));
        const classify = async (input) => {
            if (!model) return renderResult([], say('msgTrainFirst'));
            try {
                renderResult(await model.classify(input));
            } catch (error) {
                renderResult([], message(error));
            }
        };
        const preview = images ? el('img', undefined, undefined, { class: 'lml-preview', alt: '' }) : null;
        if (images)
            fileInput(result, say('msgImageToClassify'), `${id}try`, false, (urls) => {
                preview.src = urls[0];
                preview.alt = say('msgImageToClassify');
                result.insertBefore(preview, output);
                classify(urls[0]);
            });
        else textForm(result, say('msgExampleToClassify'), `${id}try`, say('msgClassify'), (field) => classify(field.value));
        const output = el('div', result, undefined, { class: 'lml-result', 'aria-live': 'polite' });
        const renderResult = (ranking, text) => {
            output.replaceChildren();
            if (text) el('p', output, text);
            if (!ranking.length) return;
            el('p', output, `${say('msgModelSays')}: ${ranking[0][0]}`, { class: 'lml-prediction' });
            for (const [label, p] of ranking) {
                const percent = Math.round(p * 100);
                const row = el('div', output, undefined, { class: 'lml-bar' });
                el('span', row, `${label}: ${percent}%`);
                el('span', row, undefined, { class: 'lml-bar-fill', style: `width:${percent}%` });
            }
        };

        if (!hasTests) return;
        const check = el('button', result, say('msgCheck'), { type: 'button', class: 'btn btn-secondary' });
        const score = el('p', result, '', { class: 'lml-score', role: 'status' });
        const game = this.register(root, config, id);
        check.addEventListener('click', async () => {
            if (!model) {
                score.textContent = say('msgTrainFirst');
                return;
            }
            const value = await this.ml.evaluate(model, classes);
            const passed = value / 10 >= this.passMark(config);
            score.textContent = `${say('msgScore')}: ${value}/100. ${passed ? say('msgPassed') : say('msgTryAgain')}`;
            if (!game) return;
            game.scorerp = value / 10;
            game.gameStarted = game.gameOver = true;
            const shared = window.$exeDevices.iDevice.gamification;
            if (config.evaluation) shared.report.saveEvaluation(game);
            if (config.isScorm === 1) shared.scorm.sendScoreNew(true, game);
        });
    },

    /** The activity's pass mark on the 0–10 scale, as the shared policy resolves it. */
    passMark(config) {
        if (config.passScoreMode === 'custom') return config.passScoreCustom;
        return typeof $exe !== 'undefined' && $exe.passScore ? $exe.passScore.get() : 5;
    },

    /**
     * Register with the shared gamification helpers (SCORM registry, save
     * button, progress report), as every scored iDevice does. Null in the
     * editor or when the activity neither saves a score nor reports progress.
     */
    register(root, config, id) {
        const shared = window.$exeDevices?.iDevice?.gamification;
        if (window.eXeLearning || !shared || (config.isScorm === 0 && !config.evaluation)) return null;
        root.id = root.id || `${id}main`;
        const game = {
            ...config,
            main: root.id,
            idevice: 'learningml',
            numberQuestions: config.classes.reduce((n, c) => n + c.tests.length, 0),
            repeatActivity: true,
            gameStarted: false,
            gameOver: false,
            isInExe: false,
        };
        if (config.isScorm > 0) {
            root.insertAdjacentHTML('beforeend', shared.scorm.addButtonScoreNew(game, true, false));
            root.querySelector('.Games-SendScore')?.addEventListener('click', () => shared.scorm.sendScoreNew(false, game));
            shared.scorm.registerActivity(game);
        }
        if (config.evaluation) shared.report.updateEvaluationIcon(game, false);
        return game;
    },
};
