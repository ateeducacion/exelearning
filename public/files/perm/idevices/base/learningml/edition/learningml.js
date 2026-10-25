/* eslint-disable no-undef */
var $exeDevice = {
    i18n: {
        category: _('Interactive activities'),
        name: _('LearningML'),
    },
    ideviceBody: null,
    idevicePreviousData: null,
    workspace: null,

    init: function (element, previousData) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData || {};
        this.createForm();
        this.loadPreviousValues();
        this.initBlockly();
        this.setBehaviour();
    },

    getDefaultData: function () {
        const defaults = window.eXeLearning && window.eXeLearning.iDevices && window.eXeLearning.iDevices.learningml
            ? window.eXeLearning.iDevices.learningml.DEFAULTS
            : {
                schemaVersion: 1,
                activityMode: 'guided-challenge',
                title: c_('LearningML activity'),
                instructions: c_('Run the blocks, inspect the result, and improve the program.'),
                toolboxPreset: 'turtle',
                initialWorkspace: { blocks: { languageVersion: 0, blocks: [] } },
                studentEditing: { allowEditInitialBlocks: true, allowDeleteInitialBlocks: true, maxBlocks: 50 },
                runtime: { type: 'canvas-ml-world', width: 640, height: 360, maxSteps: 1000, maxRuntimeMs: 2000 },
                assessment: { enabled: true, passingScore: 70, attemptsLimit: 0, tests: [] },
                ml: { trainingExamples: [], testExamples: [] },
                scorm: { enabled: true, weighted: 100, evaluation: false, evaluationID: '' },
            };
        return JSON.parse(JSON.stringify(defaults));
    },

    createForm: function () {
        const html = `
            <div class="learningml-edition" id="learningmlEditionForm">
                ${$exeDevicesEdition && $exeDevicesEdition.iDevice && $exeDevicesEdition.iDevice.common
                    ? $exeDevicesEdition.iDevice.common.getIdeviceDescription(
                        _('Create a small editable Blockly activity for turtle and introductory machine learning concepts.'),
                        '',
                    )
                    : ''}
                <fieldset class="exe-fieldset exe-fieldset-open">
                    <legend class="exe-text-legend"><a href="#">${_('Activity')}</a></legend>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlTitle">${_('Title')}:</label>
                        <input type="text" id="learningmlTitle" class="ideviceTextfield" />
                    </div>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlInstructions">${_('Instructions')}:</label>
                        <textarea id="learningmlInstructions" class="ideviceTextfield" rows="3"></textarea>
                    </div>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlMode">${_('Activity mode')}:</label>
                        <select id="learningmlMode" class="ideviceTextfield">
                            <option value="demo">${_('Demo mode')}</option>
                            <option value="guided-challenge">${_('Guided challenge')}</option>
                            <option value="free-lab">${_('Free lab')}</option>
                        </select>
                    </div>
                </fieldset>

                <fieldset class="exe-fieldset exe-fieldset-open">
                    <legend class="exe-text-legend"><a href="#">${_('Blockly workspace')}</a></legend>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlToolbox">${_('Toolbox preset')}:</label>
                        <select id="learningmlToolbox" class="ideviceTextfield">
                            <option value="basic">${_('Basic logic')}</option>
                            <option value="turtle">${_('Turtle / Canvas')}</option>
                            <option value="intro-ml">${_('Intro ML')}</option>
                        </select>
                    </div>
                    <div id="learningmlAuthorWorkspace" class="learningml-author-workspace"></div>
                    <div class="learningml-checkboxes">
                        <label><input type="checkbox" id="learningmlAllowEdit" /> ${_('Allow students to edit initial blocks')}</label>
                        <label><input type="checkbox" id="learningmlAllowDelete" /> ${_('Allow students to delete initial blocks')}</label>
                    </div>
                </fieldset>

                <fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend class="exe-text-legend"><a href="#">${_('Execution limits')}</a></legend>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlMaxBlocks">${_('Maximum blocks')}:</label>
                        <input type="number" id="learningmlMaxBlocks" class="ideviceTextfield" min="1" max="250" />
                    </div>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlMaxSteps">${_('Maximum steps')}:</label>
                        <input type="number" id="learningmlMaxSteps" class="ideviceTextfield" min="1" max="10000" />
                    </div>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlMaxTime">${_('Maximum time (ms)')}:</label>
                        <input type="number" id="learningmlMaxTime" class="ideviceTextfield" min="250" max="5000" step="250" />
                    </div>
                </fieldset>

                <fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend class="exe-text-legend"><a href="#">${_('Assessment')}</a></legend>
                    <div class="learningml-checkboxes">
                        <label><input type="checkbox" id="learningmlAssessmentEnabled" /> ${_('Enable assessment')}</label>
                    </div>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlPassingScore">${_('Passing score')}:</label>
                        <input type="number" id="learningmlPassingScore" class="ideviceTextfield" min="0" max="100" />
                    </div>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlAttemptsLimit">${_('Attempts limit (0 for unlimited)')}:</label>
                        <input type="number" id="learningmlAttemptsLimit" class="ideviceTextfield" min="0" />
                    </div>
                </fieldset>

                <fieldset class="exe-advanced exe-fieldset exe-fieldset-closed">
                    <legend class="exe-text-legend"><a href="#">${_('Advanced JSON')}</a></legend>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlWorkspaceJson">${_('Initial workspace JSON')}:</label>
                        <textarea id="learningmlWorkspaceJson" class="ideviceTextfield" rows="5"></textarea>
                    </div>
                    <div class="exe-field exe-text-field">
                        <label for="learningmlAssessmentJson">${_('Assessment tests JSON')}:</label>
                        <textarea id="learningmlAssessmentJson" class="ideviceTextfield" rows="5"></textarea>
                    </div>
                </fieldset>

                <p class="learningml-editor-buttons">
                    <button type="button" class="btn btn-primary btn-save-footer">${_('Save')}</button>
                    <button type="button" class="btn btn-secondary btn-cancel-footer">${_('Cancel')}</button>
                </p>
            </div>
        `;
        this.ideviceBody.innerHTML = html;
    },

    setBehaviour: function () {
        const ideviceId = this.ideviceBody.getAttribute('idevice-id');
        const root = this.ideviceBody;

        root.querySelector('.btn-save-footer').addEventListener('click', () => {
            const saveBtn = document.getElementById('saveIdevice' + ideviceId);
            if (saveBtn) saveBtn.click();
        });

        root.querySelector('.btn-cancel-footer').addEventListener('click', () => {
            const undoBtn = document.getElementById('undoIdevice' + ideviceId);
            if (undoBtn) undoBtn.click();
        });

        root.querySelector('#learningmlToolbox').addEventListener('change', (e) => {
            if (this.workspace && window.eXeLearning && window.eXeLearning.iDevices && window.eXeLearning.iDevices.learningml) {
                const api = window.eXeLearning.iDevices.learningml;
                this.workspace.updateToolbox(api.TOOLBOXES[e.target.value] || api.TOOLBOXES.turtle);
            }
        });
    },

    initBlockly: function () {
        if (!window.Blockly || !window.eXeLearning || !window.eXeLearning.iDevices || !window.eXeLearning.iDevices.learningml) return;
        const api = window.eXeLearning.iDevices.learningml;
        api.defineBlocks(window.Blockly);
        const workspaceNode = this.ideviceBody.querySelector('#learningmlAuthorWorkspace');
        this.workspace = Blockly.inject(workspaceNode, {
            toolbox: api.TOOLBOXES[this.ideviceBody.querySelector('#learningmlToolbox').value] || api.TOOLBOXES.turtle,
            trashcan: true,
            zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.5 },
        });
        this.loadWorkspaceFromTextarea();
        this.workspace.addChangeListener((event) => {
            if (Blockly.Events && Blockly.Events.isTransient && Blockly.Events.isTransient(event)) return;
            this.ideviceBody.querySelector('#learningmlWorkspaceJson').value = JSON.stringify(
                Blockly.serialization.workspaces.save(this.workspace),
                null,
                2,
            );
        });
        setTimeout(() => Blockly.svgResize(this.workspace), 0);
    },

    loadWorkspaceFromTextarea: function () {
        if (!this.workspace || !window.Blockly) return;
        try {
            Blockly.serialization.workspaces.load(JSON.parse(this.ideviceBody.querySelector('#learningmlWorkspaceJson').value), this.workspace);
        } catch (_error) {
            Blockly.serialization.workspaces.load(this.getDefaultData().initialWorkspace, this.workspace);
        }
    },

    save: function () {
        let workspace = {};
        let tests = [];
        try {
            workspace = this.workspace && window.Blockly
                ? Blockly.serialization.workspaces.save(this.workspace)
                : JSON.parse(this.ideviceBody.querySelector('#learningmlWorkspaceJson').value);
        } catch (_error) {
            eXe.app.alert(_('Workspace JSON is not valid.'));
            return false;
        }
        try {
            tests = JSON.parse(this.ideviceBody.querySelector('#learningmlAssessmentJson').value || '[]');
        } catch (_error) {
            eXe.app.alert(_('Assessment tests JSON is not valid.'));
            return false;
        }
        const title = this.ideviceBody.querySelector('#learningmlTitle').value.trim();
        if (!title) {
            eXe.app.alert(_('Please provide a title.'));
            return false;
        }
        return {
            schemaVersion: 1,
            ideviceId: this.ideviceBody.getAttribute('idevice-id') || '',
            activityMode: this.ideviceBody.querySelector('#learningmlMode').value,
            title,
            instructions: this.ideviceBody.querySelector('#learningmlInstructions').value,
            toolboxPreset: this.ideviceBody.querySelector('#learningmlToolbox').value,
            initialWorkspace: workspace,
            studentEditing: {
                allowEditInitialBlocks: this.ideviceBody.querySelector('#learningmlAllowEdit').checked,
                allowDeleteInitialBlocks: this.ideviceBody.querySelector('#learningmlAllowDelete').checked,
                maxBlocks: Number.parseInt(this.ideviceBody.querySelector('#learningmlMaxBlocks').value, 10) || 50,
            },
            runtime: {
                type: 'canvas-ml-world',
                width: 640,
                height: 360,
                maxSteps: Number.parseInt(this.ideviceBody.querySelector('#learningmlMaxSteps').value, 10) || 1000,
                maxRuntimeMs: Number.parseInt(this.ideviceBody.querySelector('#learningmlMaxTime').value, 10) || 2000,
            },
            assessment: {
                enabled: this.ideviceBody.querySelector('#learningmlAssessmentEnabled').checked,
                passingScore: Number.parseInt(this.ideviceBody.querySelector('#learningmlPassingScore').value, 10) || 70,
                attemptsLimit: Number.parseInt(this.ideviceBody.querySelector('#learningmlAttemptsLimit').value, 10) || 0,
                tests,
            },
            ml: this.getDefaultData().ml,
            scorm: this.getDefaultData().scorm,
        };
    },

    loadPreviousValues: function () {
        const data = Object.assign(this.getDefaultData(), this.idevicePreviousData || {});
        this.ideviceBody.querySelector('#learningmlTitle').value = data.title || '';
        this.ideviceBody.querySelector('#learningmlInstructions').value = data.instructions || '';
        this.ideviceBody.querySelector('#learningmlMode').value = data.activityMode || 'guided-challenge';
        this.ideviceBody.querySelector('#learningmlToolbox').value = data.toolboxPreset || 'turtle';
        this.ideviceBody.querySelector('#learningmlAllowEdit').checked = !!data.studentEditing.allowEditInitialBlocks;
        this.ideviceBody.querySelector('#learningmlAllowDelete').checked = !!data.studentEditing.allowDeleteInitialBlocks;
        this.ideviceBody.querySelector('#learningmlMaxBlocks').value = data.studentEditing.maxBlocks;
        this.ideviceBody.querySelector('#learningmlMaxSteps').value = data.runtime.maxSteps;
        this.ideviceBody.querySelector('#learningmlMaxTime').value = data.runtime.maxRuntimeMs;
        this.ideviceBody.querySelector('#learningmlAssessmentEnabled').checked = !!data.assessment.enabled;
        this.ideviceBody.querySelector('#learningmlPassingScore').value = data.assessment.passingScore;
        this.ideviceBody.querySelector('#learningmlAttemptsLimit').value = data.assessment.attemptsLimit;
        this.ideviceBody.querySelector('#learningmlWorkspaceJson').value = JSON.stringify(data.initialWorkspace, null, 2);
        this.ideviceBody.querySelector('#learningmlAssessmentJson').value = JSON.stringify(data.assessment.tests || [], null, 2);
    },
};
