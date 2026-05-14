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
                <fieldset>
                    <legend>${_('Activity')}</legend>
                    <label for="learningmlTitle">${_('Title')}</label>
                    <input id="learningmlTitle" type="text" class="form-control" />
                    <label for="learningmlInstructions">${_('Instructions')}</label>
                    <textarea id="learningmlInstructions" class="form-control"></textarea>
                    <div class="learningml-inline">
                        <div>
                            <label for="learningmlMode">${_('Activity mode')}</label>
                            <select id="learningmlMode" class="form-select">
                                <option value="demo">${_('Demo mode')}</option>
                                <option value="guided-challenge">${_('Guided challenge mode')}</option>
                                <option value="free-lab">${_('Free lab mode')}</option>
                            </select>
                        </div>
                        <div>
                            <label for="learningmlToolbox">${_('Toolbox preset')}</label>
                            <select id="learningmlToolbox" class="form-select">
                                <option value="basic">${_('Basic Logic')}</option>
                                <option value="turtle">${_('Turtle/Canvas')}</option>
                                <option value="intro-ml">${_('Intro ML')}</option>
                            </select>
                        </div>
                    </div>
                </fieldset>
                <fieldset>
                    <legend>${_('Initial blocks')}</legend>
                    <div class="learningml-checkboxes">
                        <label><input id="learningmlAllowEdit" type="checkbox" /> ${_('Students may edit initial blocks')}</label>
                        <label><input id="learningmlAllowDelete" type="checkbox" /> ${_('Students may delete initial blocks')}</label>
                    </div>
                    <div class="learningml-inline">
                        <div>
                            <label for="learningmlMaxBlocks">${_('Maximum number of blocks')}</label>
                            <input id="learningmlMaxBlocks" type="number" min="1" max="250" class="form-control" />
                        </div>
                        <div>
                            <label for="learningmlMaxSteps">${_('Maximum execution steps')}</label>
                            <input id="learningmlMaxSteps" type="number" min="1" max="10000" class="form-control" />
                        </div>
                        <div>
                            <label for="learningmlMaxTime">${_('Maximum execution time (ms)')}</label>
                            <input id="learningmlMaxTime" type="number" min="250" max="5000" class="form-control" />
                        </div>
                    </div>
                    <div id="learningmlAuthorWorkspace" class="learningml-author-workspace" aria-label="${_('Initial Blockly workspace')}"></div>
                    <label for="learningmlWorkspaceJson">${_('Workspace JSON')}</label>
                    <textarea id="learningmlWorkspaceJson" class="form-control"></textarea>
                </fieldset>
                <fieldset>
                    <legend>${_('Assessment')}</legend>
                    <label><input id="learningmlAssessmentEnabled" type="checkbox" /> ${_('Enable assessment')}</label>
                    <div class="learningml-inline">
                        <div>
                            <label for="learningmlPassingScore">${_('Passing score')}</label>
                            <input id="learningmlPassingScore" type="number" min="0" max="100" class="form-control" />
                        </div>
                        <div>
                            <label for="learningmlAttemptsLimit">${_('Attempts limit')}</label>
                            <input id="learningmlAttemptsLimit" type="number" min="0" max="99" class="form-control" />
                        </div>
                    </div>
                    <label for="learningmlAssessmentJson">${_('Assessment tests JSON')}</label>
                    <textarea id="learningmlAssessmentJson" class="form-control"></textarea>
                </fieldset>
            </div>
        `;
        this.ideviceBody.innerHTML = html;
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
        this.ideviceBody.querySelector('#learningmlToolbox').addEventListener('change', () => {
            this.workspace.updateToolbox(api.TOOLBOXES[this.ideviceBody.querySelector('#learningmlToolbox').value] || api.TOOLBOXES.turtle);
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
