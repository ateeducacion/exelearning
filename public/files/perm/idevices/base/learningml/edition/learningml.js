/* eslint-disable no-undef */
/**
 * LearningML iDevice (edition code)
 *
 * Native iDevice tabs: general settings, the classes with their training
 * and evaluation examples, the shared Grading tab and custom learner texts.
 * Validation and defaults come from the export runtime ($learningml), loaded
 * first by config.xml.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
var $exeDevice = {
    formId: 'learningmlIdeviceForm',

    /** Author photos: resized, stored in the media library, within the package budget. */
    IMAGE_SIZE: 128,
    IMAGE_BUDGET: 280000,

    EXAMPLES: [
        { file: 'sentimientos', dataType: 'text', label: _('Feelings (positive or negative)') },
        { file: 'asistente-virtual', dataType: 'text', label: _('Virtual assistant (lights and fan)') },
        { file: 'iris', dataType: 'numbers', label: _('Iris flowers (petal and sepal sizes)') },
        { file: 'cuadrantes', dataType: 'numbers', label: _('Quadrants of the plane') },
        { file: 'insectos', dataType: 'images', label: _('Insects (photos)') },
    ],

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePath = path || '';
        this.loaded = false;
        let config;
        try {
            config = $learningml.normalize(
                previousData && previousData.classes ? previousData : this.getDefaultData()
            );
        } catch {
            element.textContent = _(
                'This LearningML activity could not be loaded. Original data is preserved; discard to leave without changes.'
            );
            return;
        }
        this.classes = config.classes;
        this.dataType = config.dataType;
        this.createForm(config);
        this.loaded = true;
    },

    getDefaultData: function () {
        return {
            version: 1,
            instructions: c_('Add examples to each class, train the model and check what it has learnt.'),
            dataType: 'text',
            algorithm: 'neural-network',
            classes: [
                { name: c_('Class 1'), examples: [], tests: [] },
                { name: c_('Class 2'), examples: [], tests: [] },
            ],
        };
    },

    field: function (name) {
        return this.ideviceBody.querySelector(`[data-field="${name}"]`);
    },

    createForm: function (config) {
        const gamification = $exeDevicesEdition.iDevice.gamification;
        const option = (value, label) => `<option value="${value}">${label}</option>`;
        const examples = ['text', 'numbers', 'images']
            .map((type) => {
                const items = this.EXAMPLES.filter((e) => e.dataType === type);
                return `<optgroup label="${this.typeLabel(type)}">${items.map((e) => option(e.file, e.label)).join('')}</optgroup>`;
            })
            .join('');
        this.ideviceBody.innerHTML = `
            <div id="${this.formId}" class="lml-author">
                ${$exeDevicesEdition.iDevice.common.getIdeviceDescription(
                    _('Learners add examples to each class, train a model and try it with new data, as in LearningML. Text, numbers and images work offline, without sending data anywhere.')
                )}
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${gamification.instructions.getFieldset('')}
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Model')}</a></legend>
                        <div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                <label for="lmlDataType">${_('Type of data')}:</label>
                                <select id="lmlDataType" data-field="dataType" class="form-select w-auto">
                                    ${['text', 'numbers', 'images'].map((t) => option(t, this.typeLabel(t))).join('')}
                                </select>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                <label for="lmlAlgorithm">${_('Default algorithm')}:</label>
                                <select id="lmlAlgorithm" data-field="algorithm" class="form-select w-auto">
                                    ${option('neural-network', _('Neural network'))}
                                    ${option('naive-bayes', _('Naive Bayes'))}
                                    ${option('knn', _('Nearest neighbours (k-NN)'))}
                                </select>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                <label for="lmlExample">${_('Start from an example')}:</label>
                                <select id="lmlExample" data-field="example" class="form-select w-auto">${examples}</select>
                                <button type="button" class="btn btn-secondary" data-action="load-example">${_('Load example')}</button>
                            </div>
                        </div>
                    </fieldset>
                </div>
                <div class="exe-form-tab" title="${_('Classes')}">
                    <p class="exe-block-info lml-help" data-field="help"></p>
                    <div class="lml-author-classes"></div>
                    <div class="d-flex align-items-center gap-3 flex-wrap mb-3">
                        <button type="button" class="btn btn-secondary" data-action="add-class">${_('Add class')}</button>
                        <span class="lml-size" data-field="size"></span>
                    </div>
                </div>
                ${gamification.scorm.getTab(this.idevicePath)}
                ${gamification.common.getLanguageTab($learningml.defaultMessages())}
            </div>`;
        this.field('dataType').value = config.dataType;
        this.field('algorithm').value = config.algorithm;
        this.ideviceBody.querySelector('#eXeGameInstructions').value = config.instructions;
        $exeDevicesEdition.iDevice.tabs.init(this.formId);
        gamification.scorm.init();
        gamification.scorm.setValues(config.isScorm, config.textButtonScorm || _('Save score'), true, config.weighted);
        gamification.progressBar.setValues(config);
        gamification.passScore.setValues(config);
        gamification.progressBar.addEvents();
        gamification.passScore.addEvents();
        gamification.common.setLanguageTabValues(config.msgs);
        this.renderClasses();

        const self = this;
        this.field('dataType').addEventListener('change', function () {
            const next = this.value;
            this.value = self.dataType;
            self.changeDataType(next);
        });
        this.ideviceBody.querySelector('[data-action="add-class"]').addEventListener('click', () => {
            this.classes.push({ name: `${c_('Class')} ${this.classes.length + 1}`, examples: [], tests: [] });
            this.renderClasses();
        });
        this.ideviceBody
            .querySelector('[data-action="load-example"]')
            .addEventListener('click', () => this.loadExample(this.field('example').value));
    },

    typeLabel: function (type) {
        return { text: _('Text'), numbers: _('Numbers'), images: _('Images') }[type];
    },

    hasExamples: function () {
        return this.classes.some((c) => c.examples.length || c.tests.length);
    },

    /** Run `apply` now, or after the author confirms losing the current examples. */
    confirmReplace: function (message, apply) {
        if (!this.hasExamples()) return apply();
        eXe.app.confirm(_('Attention'), message, apply);
    },

    changeDataType: function (type) {
        if (type === this.dataType) return;
        const compatible = type !== 'images' && this.dataType !== 'images';
        const apply = () => {
            if (!compatible)
                this.classes.forEach((c) => {
                    c.examples = [];
                    c.tests = [];
                });
            this.dataType = type;
            this.field('dataType').value = type;
            this.renderClasses();
        };
        if (compatible) apply();
        else this.confirmReplace(_('Text or numbers and images cannot be mixed. Remove the current examples?'), apply);
    },

    loadExample: async function (file) {
        const example = this.EXAMPLES.find((e) => e.file === file);
        if (!example) return;
        let data;
        try {
            const response = await fetch(`${this.idevicePath}examples/${file}.json`, { signal: this.$lifecycle?.signal });
            data = $learningml.normalize(await response.json());
        } catch (error) {
            if (error?.name !== 'AbortError') eXe.app.alert(_('The example could not be loaded.'));
            return;
        }
        this.confirmReplace(_('The example replaces the current classes and examples. Continue?'), async () => {
            if (data.dataType === 'images')
                for (const c of data.classes)
                    for (const key of ['examples', 'tests'])
                        for (const [i, url] of c[key].entries())
                            c[key][i] = await this.storeImage(url, `${file}-${c.name}-${key}-${i + 1}.jpg`);
            if (this.$lifecycle && !this.$lifecycle.isActive()) return;
            this.classes = data.classes;
            this.dataType = data.dataType;
            this.field('dataType').value = data.dataType;
            this.renderClasses();
        });
    },

    /** Folder of the media library that receives this iDevice's photos. */
    FOLDER: 'learningml',

    assets: function () {
        return window.eXeLearning?.app?.project?._yjsBridge?.assetManager || null;
    },

    /** Put an image data URL into the project's media library; returns its asset:// URL. */
    storeImage: async function (dataUrl, name) {
        const assets = this.assets();
        if (!assets || !dataUrl.startsWith('data:')) return dataUrl;
        const [head, body] = dataUrl.split(',');
        const bytes = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
        const type = head.slice(5, head.indexOf(';'));
        const safe = name.normalize('NFD').replace(/[^\w.-]+/g, '-');
        return assets.insertImage(new File([bytes], safe, { type }), { folderPath: this.FOLDER });
    },

    /**
     * Bytes of the activity's photos, as stored in the media library. Saved
     * data comes back from the workarea with blob: URLs for its assets.
     */
    imageBytes: function () {
        const assets = this.assets();
        const id = (url) =>
            url.startsWith('asset://') ? assets?.extractAssetId(url) : assets?.reverseBlobCache?.get(url);
        const size = (url) => {
            const assetId = url.startsWith('data:') ? null : id(url);
            return assetId ? assets.getAssetMetadata(assetId)?.size || 0 : url.length;
        };
        return this.classes.reduce((n, c) => n + [...c.examples, ...c.tests].reduce((m, u) => m + size(u), 0), 0);
    },

    renderSize: function () {
        const size = this.field('size');
        if (this.dataType !== 'images') return (size.textContent = '');
        const kb = (n) => Math.ceil(n / 1000);
        size.textContent = `${_('Images')}: ${kb(this.imageBytes())} kB / ${kb(this.IMAGE_BUDGET)} kB`;
        size.classList.toggle('text-danger', this.imageBytes() > this.IMAGE_BUDGET);
    },

    renderClasses: function () {
        const images = this.dataType === 'images';
        this.field('help').textContent = images
            ? _('Add photos to each class. Learners see the training images and can add their own; evaluation images are only used to grade the trained model.')
            : _('Write one example per line. Learners see the training examples and can add their own; evaluation examples are only used to grade the trained model. For numbers, separate the values with commas, such as 1.5, 2.');
        const container = this.ideviceBody.querySelector('.lml-author-classes');
        container.replaceChildren(...this.classes.map((c, i) => this.classRow(c, i)));
        this.renderSize();
    },

    nextId: 0,

    classRow: function (c, index) {
        const n = ++this.nextId;
        const row = document.createElement('fieldset');
        row.className = 'exe-fieldset lml-author-class';
        row.innerHTML = `
            <legend><a href="#">${$learningml.escape(c.name)}</a></legend>
            <div>
                <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                    <label for="lmlClassName${n}">${_('Class name')}:</label>
                    <input type="text" id="lmlClassName${n}" data-class-field="name" class="form-control w-auto" />
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove-class">${_('Remove class')}</button>
                </div>
                ${this.examplesField(n, 'examples', _('Training examples'))}
                ${this.examplesField(n, 'tests', _('Evaluation examples (hidden from learners)'))}
            </div>`;
        const name = row.querySelector('[data-class-field="name"]');
        name.value = c.name;
        name.addEventListener('input', () => {
            c.name = name.value;
            row.querySelector('legend a').textContent = name.value;
        });
        row.querySelector('[data-action="remove-class"]').addEventListener('click', () => {
            this.classes.splice(index, 1);
            this.renderClasses();
        });
        for (const key of ['examples', 'tests']) {
            if (this.dataType === 'images') this.bindImages(row, c, key);
            else {
                const area = row.querySelector(`[data-class-field="${key}"]`);
                area.value = c[key].join('\n');
                area.addEventListener('input', () => (c[key] = area.value.split('\n')));
            }
        }
        return row;
    },

    examplesField: function (n, key, label) {
        if (this.dataType !== 'images')
            return `<div class="mb-3">
                    <label for="lml${key}${n}">${label}:</label>
                    <textarea id="lml${key}${n}" data-class-field="${key}" class="form-control" rows="4"></textarea>
                </div>`;
        return `<div class="mb-3">
                <span class="lml-images-label">${label}:</span>
                <ul class="lml-examples lml-images" data-class-field="${key}"></ul>
                <input type="file" id="lml${key}${n}" data-class-upload="${key}" accept="image/*" multiple class="lml-upload-input" />
                <label for="lml${key}${n}" class="btn btn-sm btn-secondary lml-upload">${_('Add images')}</label>
                ${window.eXeLearning?.app?.modals?.filemanager ? `<button type="button" class="btn btn-sm btn-secondary lml-upload" data-class-library="${key}">${_('Choose from the media library')}</button>` : ''}
            </div>`;
    },

    bindImages: function (row, c, key) {
        const list = row.querySelector(`[data-class-field="${key}"]`);
        const render = () => {
            list.replaceChildren();
            c[key].forEach((url, i) => {
                const item = document.createElement('li');
                const img = $learningml.showImage(document.createElement('img'), url);
                img.alt = `${c.name} ${i + 1}`;
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'lml-remove';
                remove.textContent = '×';
                remove.setAttribute('aria-label', `${_('Remove image')} ${i + 1}`);
                remove.addEventListener('click', () => {
                    c[key].splice(i, 1);
                    render();
                });
                item.append(img, remove);
                list.append(item);
            });
            this.renderSize();
        };
        const input = row.querySelector(`[data-class-upload="${key}"]`);
        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []);
            input.value = '';
            for (const file of files) {
                try {
                    const resized = await $learningml.image.fromFile(file, this.IMAGE_SIZE);
                    c[key].push(await this.storeImage(resized, file.name.replace(/\.[^.]*$/, '') + '.jpg'));
                } catch {
                    eXe.app.alert(_('The image could not be read.'));
                }
            }
            render();
        });
        row.querySelector(`[data-class-library="${key}"]`)?.addEventListener('click', () => {
            const add = (result) => {
                for (const asset of [].concat(result || [])) if (asset?.assetUrl) c[key].push(asset.assetUrl);
                render();
            };
            eXeLearning.app.modals.filemanager.show({
                accept: 'image',
                multiSelect: true,
                // The modal outlives the form: a late selection must not reach a closed editor.
                onSelect: this.$lifecycle ? this.$lifecycle.bind(add) : add,
            });
        });
        render();
    },

    getData: function (report) {
        const gamification = $exeDevicesEdition.iDevice.gamification;
        const scorm = gamification.scorm.getValues();
        const editor = window.tinyMCE?.get('eXeGameInstructions');
        const msgs = {};
        for (const key of Object.keys($learningml.defaultMessages())) {
            const value = this.ideviceBody.querySelector(`#ci18n_${key}`)?.value;
            if (value) msgs[key] = value;
        }
        return $learningml.normalize({
            version: 1,
            instructions: editor ? editor.getContent() : this.ideviceBody.querySelector('#eXeGameInstructions').value,
            dataType: this.dataType,
            algorithm: this.field('algorithm').value,
            classes: this.classes,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            weighted: scorm.weighted,
            ...gamification.passScore.getValues(),
            evaluation: report.evaluation,
            evaluationID: report.evaluationID,
            msgs,
        });
    },

    save: function () {
        if (!this.loaded) {
            eXe.app.alert(_('The activity could not be loaded and has not been changed.'));
            return false;
        }
        const progressBar = $exeDevicesEdition.iDevice.gamification.progressBar.getValues();
        if (!progressBar) return false;
        const data = this.getData(progressBar);
        let error = $learningml.check(data);
        if (!error && this.imageBytes() > this.IMAGE_BUDGET)
            error = 'The images take too much space. Remove some images to stay within the limit.';
        if (error) {
            eXe.app.alert(_(error));
            return false;
        }
        return data;
    },
};
