/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadRuntime() {
    window.eXeLearning = undefined;
    window.$learningml = undefined;
    const code = readFileSync(join(__dirname, 'learningml.js'), 'utf-8');
    (0, eval)(code);
    return window.$learningml;
}

function loadScript(filename) {
    const code = readFileSync(join(__dirname, filename), 'utf-8');
    (0, eval)(code);
}

describe('learningml export runtime', () => {
    let runtimeApi;

    beforeEach(() => {
        document.body.innerHTML = '';
        const memoryStorage = new Map();
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem: key => memoryStorage.get(key) || null,
                setItem: (key, value) => memoryStorage.set(key, String(value)),
                removeItem: key => memoryStorage.delete(key),
                clear: () => memoryStorage.clear(),
            },
        });
        runtimeApi = loadRuntime();
    });

    it('validates block limits and unsupported block types', () => {
        const config = runtimeApi.normalizeConfig({ studentEditing: { maxBlocks: 1 } });
        const state = {
            blocks: {
                blocks: [
                    { type: 'learningml_when_run', next: { block: { type: 'learningml_move', fields: { STEPS: 10 } } } },
                ],
            },
        };

        expect(runtimeApi.validateWorkspaceState(state, config).valid).toBe(false);
        expect(runtimeApi.validateWorkspaceState({ blocks: { blocks: [{ type: 'bad_block' }] } }, runtimeApi.normalizeConfig({})).valid).toBe(false);
    });

    it('executes turtle sequence without eval', () => {
        const config = runtimeApi.normalizeConfig({});
        const canvas = document.createElement('canvas');
        const output = document.createElement('pre');
        const runtime = runtimeApi.createRuntime(config, canvas, output);
        const state = {
            blocks: {
                blocks: [
                    {
                        type: 'learningml_when_run',
                        next: {
                            block: {
                                type: 'learningml_move',
                                fields: { STEPS: 50 },
                                next: { block: { type: 'learningml_turn_right', fields: { DEGREES: 90 } } },
                            },
                        },
                    },
                ],
            },
        };

        runtimeApi.executeWorkspace(state, config, runtime);

        expect(Math.round(runtime.state.x)).toBe(170);
        expect(runtime.state.heading).toBe(90);
        expect(runtime.state.completed).toBe(true);
    });

    it('trains a toy classifier and scores classification accuracy', () => {
        const config = runtimeApi.normalizeConfig({
            toolboxPreset: 'intro-ml',
            assessment: {
                enabled: true,
                passingScore: 70,
                tests: [{ id: 'accuracy', type: 'classification-accuracy', minAccuracy: 1, score: 100 }],
            },
        });
        const runtime = runtimeApi.createRuntime(config, document.createElement('canvas'), document.createElement('pre'));
        const state = {
            blocks: {
                blocks: [
                    {
                        type: 'learningml_when_run',
                        next: {
                            block: {
                                type: 'learningml_train_model',
                                next: { block: { type: 'learningml_classify', fields: { X: 2, Y: 2 } } },
                            },
                        },
                    },
                ],
            },
        };

        runtimeApi.executeWorkspace(state, config, runtime);
        const result = runtimeApi.assess(state, config, runtime.state);

        expect(runtime.state.model.prediction).toBe('small');
        expect(result.score).toBe(100);
        expect(result.passed).toBe(true);
    });

    it('keeps localStorage progress scoped by instance id', () => {
        const first = runtimeApi.createStorage('one');
        const second = runtimeApi.createStorage('two');

        expect(first.save({ workspace: { a: 1 } })).toBe(true);

        expect(first.load().workspace).toEqual({ a: 1 });
        expect(second.load()).toBe(null);
    });

    it('initializes multiple exported instances independently', () => {
        document.body.innerHTML = `
            <div id="a" class="idevice_node learningml" data-idevice-json-data='{"title":"A"}'></div>
            <div id="b" class="idevice_node learningml" data-idevice-json-data='{"title":"B"}'></div>
        `;

        runtimeApi.initAll();

        expect(document.querySelector('#a .learningml-title').textContent).toBe('A');
        expect(document.querySelector('#b .learningml-title').textContent).toBe('B');
    });

    it('reports SCORM score through the existing helper when available', () => {
        const sendScoreNew = vi.fn();
        window.$exeDevices = { iDevice: { gamification: { scorm: { sendScoreNew } } } };

        const adapter = runtimeApi.createScormAdapter('abc', runtimeApi.normalizeConfig({ title: 'Task' }));
        expect(adapter.report({ score: 80, passed: true })).toBe(true);
        expect(sendScoreNew).toHaveBeenCalledWith(true, expect.objectContaining({ ideviceId: 'abc', scorerp: 80 }));
    });

    it('loads Blockly browser assets even when an AMD loader is present', () => {
        const amdDefine = vi.fn();
        amdDefine.amd = {};
        globalThis.define = amdDefine;
        window.Blockly = undefined;

        try {
            loadScript('blockly_compressed.js');
            loadScript('blocks_compressed.js');
            loadScript('en.js');

            expect(amdDefine).not.toHaveBeenCalled();
            expect(window.Blockly).toBeDefined();
            expect(window.Blockly.Msg.ADD_COMMENT).toBe('Add Comment');
            expect(window.Blockly.libraryBlocks).toBeDefined();
        } finally {
            delete globalThis.define;
            window.Blockly = undefined;
        }
    });
});
