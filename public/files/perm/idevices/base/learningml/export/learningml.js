/* eslint-disable no-undef */
/**
 * LearningML iDevice (export code)
 *
 * The three LearningML columns: training data, train and result. Students
 * add examples to the teacher's classes, train a text or numeric classifier
 * in the browser and try it. Optional evaluation examples grade the model
 * through the shared SCORM 1.2 activity registry.
 *
 * Classifiers follow LearningML NG (Gaussian Naive Bayes and k-nearest
 * neighbours over bag-of-words or numeric vectors); no TensorFlow.js, no
 * network and no stored workspace.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
var $learningml = {
    instances: 0,

    /** Content string: c_() exists in the editor, not in exported pages. */
    t(text) {
        return typeof c_ === 'function' ? c_(text) : text;
    },

    escape(value) {
        return String(value).replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
        );
    },

    /** Version 1 configuration with every field defaulted and bounded. */
    normalize(raw) {
        const d = raw && typeof raw === 'object' ? raw : {};
        if (d.version !== undefined && d.version !== 1) throw new Error('Unsupported LearningML data version.');
        const lines = (v) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : []);
        const bounded = (v, min, max, fallback) => {
            const n = Number(v);
            return Number.isFinite(n) && v !== '' && v !== null ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
        };
        return {
            version: 1,
            title: String(d.title ?? ''),
            instructions: String(d.instructions ?? ''),
            dataType: d.dataType === 'numbers' ? 'numbers' : 'text',
            algorithm: d.algorithm === 'knn' ? 'knn' : 'naive-bayes',
            classes: (Array.isArray(d.classes) ? d.classes : [])
                .map((c) => ({
                    name: String(c?.name ?? '').trim(),
                    examples: lines(c?.examples),
                    tests: lines(c?.tests),
                }))
                .filter((c) => c.name),
            graded: d.graded === true,
            weight: bounded(d.weight, 1, 100, 100),
            pass: bounded(d.pass, 0, 100, 50),
        };
    },

    /** First authoring problem, as an English source string, or ''. */
    check(config) {
        if (config.classes.length < 2) return 'Add at least two classes.';
        const names = config.classes.map((c) => c.name.toLowerCase());
        if (new Set(names).size !== names.length) return 'Class names must be different.';
        if (config.dataType === 'numbers') {
            const all = config.classes.flatMap((c) => c.examples.concat(c.tests));
            const vectors = all.map((s) => this.ml.numbers(s));
            if (vectors.some((v) => !v)) return 'Numeric examples must be numbers separated by commas, such as 1.5, 2.';
            if (new Set(vectors.map((v) => v.length)).size > 1) return 'All numeric examples must have the same number of values.';
        }
        if (config.graded && !config.classes.some((c) => c.tests.length))
            return 'Add evaluation examples to grade this activity.';
        return '';
    },

    ml: {
        /** Lowercase words without accents, so "Canción" and "cancion" match. */
        tokens(text) {
            return text
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

        softmax(logs) {
            const max = Math.max(...logs);
            const exp = logs.map((l) => Math.exp(l - max));
            const sum = exp.reduce((a, b) => a + b, 0) || 1;
            return exp.map((e) => e / sum);
        },

        /** Gaussian Naive Bayes, as LearningML's (variance smoothing 1e-9, prior smoothing 1). */
        naiveBayes(rows, classCount) {
            const dim = rows[0].x.length;
            const stats = Array.from({ length: classCount }, () => ({
                n: 0,
                sum: new Array(dim).fill(0),
                sq: new Array(dim).fill(0),
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
         * Weighted k-NN with k = 3: cosine similarity for word counts,
         * 1 / (1 + Euclidean distance) for numbers (cosine would ignore
         * magnitude, so 1 and 10 would look identical). A neighbour sharing
         * no word with the input has no say.
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
                        ? x.reduce((s, v, i) => s + v * q[i], 0)
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
         * Train on every class's examples. Throws an English source message
         * when the data cannot be trained.
         */
        train(dataType, algorithm, classes) {
            if (classes.length < 2) throw new Error('At least two classes are needed.');
            if (classes.some((c) => !c.examples.length)) throw new Error('Every class needs at least one example.');
            let encode;
            if (dataType === 'text') {
                const vocabulary = new Map();
                for (const c of classes)
                    for (const e of c.examples)
                        for (const t of this.tokens(e)) if (!vocabulary.has(t)) vocabulary.set(t, vocabulary.size);
                encode = (text) => {
                    const v = new Array(vocabulary.size).fill(0);
                    for (const t of this.tokens(text)) if (vocabulary.has(t)) v[vocabulary.get(t)]++;
                    return v;
                };
            } else {
                const dim = this.numbers(classes[0].examples[0])?.length;
                encode = (text) => {
                    const v = this.numbers(text);
                    if (!v || v.length !== dim) throw new Error('Write the same number of values as the examples.');
                    return v;
                };
            }
            const rows = classes.flatMap((c, y) => c.examples.map((e) => ({ x: encode(e), y })));
            const predict =
                algorithm === 'knn'
                    ? this.knn(rows, classes.length, dataType === 'text')
                    : this.naiveBayes(rows, classes.length);
            return {
                /** [[label, confidence 0..1], ...], most likely first. */
                classify: (text) =>
                    predict(encode(text))
                        .map((p, i) => [classes[i].name, p])
                        .sort((a, b) => b[1] - a[1]),
            };
        },

        /** Percentage of evaluation examples classified as their class, or null. */
        evaluate(model, classes) {
            let total = 0;
            let correct = 0;
            for (const c of classes)
                for (const test of c.tests) {
                    total++;
                    try {
                        if (model.classify(test)[0][0] === c.name) correct++;
                    } catch {
                        // An unclassifiable evaluation example counts as wrong.
                    }
                }
            return total ? Math.round((100 * correct) / total) : null;
        },
    },

    renderView(data, accessibility, template) {
        let config;
        try {
            config = this.normalize(data);
        } catch {
            return template.replace(
                '{content}',
                `<p class="lml-error">${this.escape(this.t('This LearningML activity contains invalid data.'))}</p>`
            );
        }
        const html =
            `<section class="lml-activity" data-learningml="${this.escape(encodeURIComponent(JSON.stringify(config)))}">` +
            (config.title ? `<h3 class="lml-title">${this.escape(config.title)}</h3>` : '') +
            (config.instructions ? `<p class="lml-instructions">${this.escape(config.instructions)}</p>` : '') +
            '</section>';
        return template.replace('{content}', html);
    },

    renderBehaviour() {
        this.scan();
    },

    init() {
        this.scan();
    },

    mounted: new WeakSet(),

    scan() {
        document.querySelectorAll('[data-learningml]').forEach((root) => {
            if (this.mounted.has(root)) return;
            this.mounted.add(root);
            try {
                this.mount(root, this.normalize(JSON.parse(decodeURIComponent(root.dataset.learningml))));
            } catch {
                root.textContent = this.t('This LearningML activity contains invalid data.');
            }
        });
    },

    el(tag, parent, text, attrs) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
        parent?.append(node);
        return node;
    },

    /** Build the three columns for one activity; state stays in this closure. */
    mount(root, config) {
        const t = (s) => this.t(s);
        const el = (...args) => this.el(...args);
        const id = `lml${++this.instances}`;
        const classes = config.classes.map((c) => ({ name: c.name, examples: c.examples.slice(), tests: c.tests }));
        const hasTests = classes.some((c) => c.tests.length);
        let model = null;

        root.querySelector('.lml-columns')?.remove();
        if (classes.length < 2) {
            el('p', root, t('This activity has no classes yet.'), { class: 'lml-error' });
            return;
        }
        const columns = el('div', root, undefined, { class: 'lml-columns' });
        const column = (n, title) => {
            const section = el('section', columns, undefined, { class: 'lml-column', 'aria-labelledby': `${id}c${n}` });
            el('h4', section, `${n}. ${title}`, { id: `${id}c${n}` });
            return section;
        };
        const form = (parent, label, inputId, buttonText, onSubmit) => {
            const f = el('form', parent, undefined, { class: 'lml-form' });
            el('label', f, label, { for: inputId, class: 'lml-label' });
            const input = el('input', f, undefined, { id: inputId, type: 'text', autocomplete: 'off' });
            el('button', f, buttonText, { type: 'submit', class: 'btn btn-primary' });
            f.addEventListener('submit', (event) => {
                event.preventDefault();
                onSubmit(input);
            });
            return input;
        };
        const placeholder =
            config.dataType === 'numbers' ? t('Numbers separated by commas') : t('Write an example');

        // 1. Training data
        const data = column(1, t('Training data'));
        const invalidate = () => {
            model = null;
            status.textContent = t('Train the model again to use the new examples.');
            renderResult([]);
        };
        classes.forEach((c, ci) => {
            const card = el('div', data, undefined, { class: 'lml-class' });
            el('h5', card, c.name);
            const list = el('ul', card, undefined, { class: 'lml-examples' });
            const count = el('p', card, '', { class: 'lml-count' });
            const renderList = () => {
                list.replaceChildren();
                c.examples.forEach((example, ei) => {
                    const item = el('li', list, undefined);
                    el('span', item, example);
                    const remove = el('button', item, '×', {
                        type: 'button',
                        class: 'lml-remove',
                        'aria-label': `${t('Remove example')}: ${example}`,
                    });
                    remove.addEventListener('click', () => {
                        c.examples.splice(ei, 1);
                        renderList();
                        invalidate();
                    });
                });
                count.textContent = `${t('Examples')}: ${c.examples.length}`;
            };
            const input = form(card, `${t('New example for')} ${c.name}`, `${id}e${ci}`, t('Add'), (field) => {
                const value = field.value.trim();
                if (!value) return;
                if (config.dataType === 'numbers' && !this.ml.numbers(value)) {
                    status.textContent = t('Numeric examples must be numbers separated by commas, such as 1.5, 2.');
                    return;
                }
                c.examples.push(value);
                field.value = '';
                renderList();
                invalidate();
            });
            input.placeholder = placeholder;
            renderList();
        });

        // 2. Train
        const train = column(2, t('Train'));
        el('label', train, t('Algorithm'), { for: `${id}alg`, class: 'lml-label' });
        const algorithm = el('select', train, undefined, { id: `${id}alg` });
        el('option', algorithm, t('Naive Bayes'), { value: 'naive-bayes' });
        el('option', algorithm, t('Nearest neighbours (k-NN)'), { value: 'knn' });
        algorithm.value = config.algorithm;
        algorithm.addEventListener('change', invalidate);
        const trainButton = el('button', train, t('Train the model'), { type: 'button', class: 'btn btn-primary' });
        const status = el('p', train, t('Add examples to every class and train the model.'), {
            class: 'lml-status',
            role: 'status',
        });
        trainButton.addEventListener('click', () => {
            try {
                model = this.ml.train(config.dataType, algorithm.value, classes);
                const total = classes.reduce((n, c) => n + c.examples.length, 0);
                status.textContent = `${t('Model trained with')} ${total} ${t('examples')}.`;
            } catch (error) {
                model = null;
                status.textContent = t(error.message);
            }
            renderResult([]);
        });

        // 3. Result
        const result = column(3, t('Result'));
        const tryInput = form(result, t('Example to classify'), `${id}try`, t('Classify'), (field) => {
            if (!model) {
                status.textContent = t('Train the model first.');
                return renderResult([]);
            }
            try {
                renderResult(model.classify(field.value));
            } catch (error) {
                renderResult([], t(error.message));
            }
        });
        tryInput.placeholder = placeholder;
        const output = el('div', result, undefined, { class: 'lml-result', 'aria-live': 'polite' });
        const renderResult = (ranking, message) => {
            output.replaceChildren();
            if (message) el('p', output, message);
            if (!ranking.length) return;
            el('p', output, `${t('The model says')}: ${ranking[0][0]}`, { class: 'lml-prediction' });
            for (const [label, p] of ranking) {
                const percent = Math.round(p * 100);
                const row = el('div', output, undefined, { class: 'lml-bar' });
                el('span', row, `${label}: ${percent}%`);
                el('span', row, undefined, { class: 'lml-bar-fill', style: `width:${percent}%` });
            }
        };

        if (!hasTests) return;
        const check = el('button', result, t('Check my model'), { type: 'button', class: 'btn btn-secondary' });
        const score = el('p', result, '', { class: 'lml-score', role: 'status' });
        const scorm = this.register(root, config);
        if (scorm) {
            const record = window.exeScorm12.activities.get(scorm.game.ideviceId);
            if (record && record.score !== null && record.score !== undefined)
                score.textContent = `${t('Saved score')}: ${record.score}/100`;
        }
        check.addEventListener('click', () => {
            if (!model) {
                score.textContent = t('Train the model first.');
                return;
            }
            const value = this.ml.evaluate(model, classes);
            score.textContent = `${t('Score')}: ${value}/100`;
            if (config.graded)
                score.textContent += `. ${value >= config.pass ? t('Passed.') : t('Add better examples and try again.')}`;
            if (!scorm) return;
            scorm.game.scorerp = value / 10;
            scorm.game.answered = 1;
            try {
                scorm.api.updateActivity(scorm.game, {}, true);
            } catch {
                score.textContent += ` ${t('The LMS score could not be saved. Check again to retry.')}`;
            }
        });
    },

    /** Register with the shared SCORM 1.2 registry; null outside an LMS package or in the editor. */
    register(root, config) {
        if (!config.graded || window.eXeLearning) return null;
        const api = window.$exeDevices?.iDevice?.gamification?.scorm;
        const wrapper = root.closest('.idevice_node');
        if (!window.exeScorm12?.activities || !api || !wrapper?.id) return null;
        const game = {
            ideviceId: wrapper.id,
            ideviceNumber: Array.from(document.querySelectorAll('.idevice_node')).indexOf(wrapper) + 1,
            isScorm: 2,
            weighted: config.weight,
            passScoreMode: 'custom',
            passScoreCustom: config.pass / 10,
            title: config.title,
            msgs: { msgYouScore: this.t('Score'), msgScore: this.t('Score'), msgWeight: this.t('Weight') },
        };
        api.reportActivity(game, { total: 1, legacyIndex: game.ideviceNumber });
        return { api, game };
    },
};
