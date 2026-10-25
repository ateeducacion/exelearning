/* eslint-disable no-undef */
/**
 * LearningML iDevice (edition code)
 *
 * The teacher defines the classes, optional starter examples and hidden
 * evaluation examples. Validation and defaults come from the export
 * runtime ($learningml), loaded first by config.xml.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
var $exeDevice = {
    init: function (element, previousData) {
        this.ideviceBody = element;
        this.loaded = false;
        let config;
        try {
            config = $learningml.normalize(
                previousData && Object.keys(previousData).length ? previousData : this.getDefaultData()
            );
        } catch {
            element.textContent = _(
                'This LearningML activity could not be loaded. Original data is preserved; discard to leave without changes.'
            );
            return;
        }
        this.createForm(config);
        this.loaded = true;
    },

    getDefaultData: function () {
        return {
            version: 1,
            title: '',
            instructions: '',
            dataType: 'text',
            algorithm: 'naive-bayes',
            classes: [
                { name: _('Class 1'), examples: [], tests: [] },
                { name: _('Class 2'), examples: [], tests: [] },
            ],
            graded: false,
            weight: 100,
            pass: 50,
        };
    },

    field: function (name) {
        return this.ideviceBody.querySelector(`[data-field="${name}"]`);
    },

    createForm: function (config) {
        const e = (s) => $learningml.escape(s);
        this.ideviceBody.innerHTML = `
            <div class="lml-author">
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Activity')}</a></legend>
                    <p>
                        <label for="lmlTitle">${_('Title')}:</label>
                        <input type="text" id="lmlTitle" data-field="title" class="ideviceTextfield" value="${e(config.title)}" />
                    </p>
                    <p>
                        <label for="lmlInstructions">${_('Instructions')}:</label>
                        <textarea id="lmlInstructions" data-field="instructions" class="ideviceTextfield" rows="3">${e(config.instructions)}</textarea>
                    </p>
                    <p>
                        <label for="lmlDataType">${_('Type of data')}:</label>
                        <select id="lmlDataType" data-field="dataType">
                            <option value="text">${_('Text')}</option>
                            <option value="numbers">${_('Numbers')}</option>
                        </select>
                        <label for="lmlAlgorithm">${_('Default algorithm')}:</label>
                        <select id="lmlAlgorithm" data-field="algorithm">
                            <option value="naive-bayes">${_('Naive Bayes')}</option>
                            <option value="knn">${_('Nearest neighbours (k-NN)')}</option>
                        </select>
                    </p>
                </fieldset>
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Classes')}</a></legend>
                    <p class="lml-help">${_('Write one example per line. Students see the training examples and can add or remove their own; evaluation examples are only used to grade the trained model. For numbers, separate values with commas, such as 1.5, 2.')}</p>
                    <div class="lml-author-classes"></div>
                    <p><button type="button" class="btn btn-secondary" data-action="add-class">${_('Add class')}</button></p>
                </fieldset>
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Assessment')}</a></legend>
                    <p>
                        <label><input type="checkbox" data-field="graded" ${config.graded ? 'checked' : ''} /> ${_('Grade the trained model with the evaluation examples (SCORM)')}</label>
                    </p>
                    <p>
                        <label for="lmlWeight">${_('Weight')}:</label>
                        <input type="number" id="lmlWeight" data-field="weight" min="1" max="100" value="${config.weight}" />
                        <label for="lmlPass">${_('Passing score (%)')}:</label>
                        <input type="number" id="lmlPass" data-field="pass" min="0" max="100" value="${config.pass}" />
                    </p>
                </fieldset>
            </div>`;
        this.field('dataType').value = config.dataType;
        this.field('algorithm').value = config.algorithm;
        config.classes.forEach((c) => this.addClass(c));
        this.ideviceBody
            .querySelector('[data-action="add-class"]')
            .addEventListener('click', () =>
                this.addClass({ name: `${_('Class')} ${this.classRows().length + 1}`, examples: [], tests: [] })
            );
    },

    classRows: function () {
        return Array.from(this.ideviceBody.querySelectorAll('.lml-author-class'));
    },

    nextRowId: 0,

    addClass: function (c) {
        const e = (s) => $learningml.escape(s);
        const n = ++this.nextRowId;
        const row = document.createElement('div');
        row.className = 'lml-author-class';
        row.innerHTML = `
            <p>
                <label for="lmlClassName${n}">${_('Class name')}:</label>
                <input type="text" id="lmlClassName${n}" data-class-field="name" value="${e(c.name)}" />
                <button type="button" class="btn btn-link" data-action="remove-class">${_('Remove class')}</button>
            </p>
            <p>
                <label for="lmlExamples${n}">${_('Training examples')}:</label>
                <textarea id="lmlExamples${n}" data-class-field="examples" rows="4">${e(c.examples.join('\n'))}</textarea>
            </p>
            <p>
                <label for="lmlTests${n}">${_('Evaluation examples (hidden from students)')}:</label>
                <textarea id="lmlTests${n}" data-class-field="tests" rows="3">${e(c.tests.join('\n'))}</textarea>
            </p>`;
        row.querySelector('[data-action="remove-class"]').addEventListener('click', () => row.remove());
        this.ideviceBody.querySelector('.lml-author-classes').append(row);
    },

    getData: function () {
        const lines = (row, name) => row.querySelector(`[data-class-field="${name}"]`).value.split('\n');
        return $learningml.normalize({
            version: 1,
            title: this.field('title').value.trim(),
            instructions: this.field('instructions').value.trim(),
            dataType: this.field('dataType').value,
            algorithm: this.field('algorithm').value,
            classes: this.classRows().map((row) => ({
                name: row.querySelector('[data-class-field="name"]').value,
                examples: lines(row, 'examples'),
                tests: lines(row, 'tests'),
            })),
            graded: this.field('graded').checked,
            weight: this.field('weight').value,
            pass: this.field('pass').value,
        });
    },

    save: function () {
        if (!this.loaded) {
            eXe.app.alert(_('The activity could not be loaded and has not been changed.'));
            return false;
        }
        const data = this.getData();
        const error = $learningml.check(data);
        if (error) {
            eXe.app.alert(_(error));
            return false;
        }
        return data;
    },
};
