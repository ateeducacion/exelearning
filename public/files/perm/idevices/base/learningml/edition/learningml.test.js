/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEdition() {
    window._ = value => value;
    window.c_ = value => value;
    window.eXe = {
        app: {
            alert: vi.fn(),
            clearHistory: vi.fn(),
            _confirmResponses: { clear: vi.fn() },
        },
    };
    window.$exeDevicesEdition = { iDevice: { common: { getIdeviceDescription: () => '' } } };
    const runtimeCode = readFileSync(join(__dirname, 'learningml-runtime.js'), 'utf-8');
    (0, eval)(runtimeCode);
    const code = readFileSync(join(__dirname, 'learningml.js'), 'utf-8');
    (0, eval)(code.replace(/var\s+\$exeDevice\s*=/, 'window.$exeDevice ='));
    return window.$exeDevice;
}

describe('learningml edition', () => {
    let idevice;
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="editor" idevice-id="IDEV1"></div>';
        container = document.getElementById('editor');
        idevice = loadEdition();
    });

    it('round-trips all MVP configuration fields without Blockly loaded', () => {
        const previous = idevice.getDefaultData();
        previous.title = 'Train a simple classifier';
        previous.instructions = 'Improve the model.';
        previous.activityMode = 'free-lab';
        previous.toolboxPreset = 'intro-ml';
        previous.studentEditing.allowEditInitialBlocks = false;
        previous.studentEditing.allowDeleteInitialBlocks = false;
        previous.studentEditing.maxBlocks = 25;
        previous.runtime.maxSteps = 500;
        previous.runtime.maxRuntimeMs = 1200;
        previous.assessment.enabled = true;
        previous.assessment.passingScore = 85;
        previous.assessment.attemptsLimit = 2;
        previous.assessment.tests = [{ id: 'complete', type: 'runtime-completion', score: 100 }];

        idevice.init(container, previous);
        const saved = idevice.save();

        expect(saved.title).toBe('Train a simple classifier');
        expect(saved.instructions).toBe('Improve the model.');
        expect(saved.activityMode).toBe('free-lab');
        expect(saved.toolboxPreset).toBe('intro-ml');
        expect(saved.studentEditing.allowEditInitialBlocks).toBe(false);
        expect(saved.studentEditing.allowDeleteInitialBlocks).toBe(false);
        expect(saved.studentEditing.maxBlocks).toBe(25);
        expect(saved.runtime.maxSteps).toBe(500);
        expect(saved.runtime.maxRuntimeMs).toBe(1200);
        expect(saved.assessment.passingScore).toBe(85);
        expect(saved.assessment.attemptsLimit).toBe(2);
        expect(saved.assessment.tests).toEqual(previous.assessment.tests);
        expect(saved.ideviceId).toBe('IDEV1');
    });

    it('blocks saving invalid workspace JSON', () => {
        idevice.init(container, idevice.getDefaultData());
        container.querySelector('#learningmlWorkspaceJson').value = '{';

        expect(idevice.save()).toBe(false);
        expect(window.eXe.app.alert).toHaveBeenCalled();
    });
});
