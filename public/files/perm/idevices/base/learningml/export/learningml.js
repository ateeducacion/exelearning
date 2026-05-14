/* eslint-disable no-undef */
(function () {
    'use strict';

    const DEFAULT_WORKSPACE = {
        blocks: {
            languageVersion: 0,
            blocks: [
                {
                    type: 'learningml_when_run',
                    x: 24,
                    y: 24,
                    next: {
                        block: {
                            type: 'learningml_move',
                            fields: { STEPS: 80 },
                            next: {
                                block: {
                                    type: 'learningml_turn_right',
                                    fields: { DEGREES: 90 },
                                },
                            },
                        },
                    },
                },
            ],
        },
    };

    const DEFAULTS = {
        schemaVersion: 1,
        activityMode: 'guided-challenge',
        title: 'LearningML activity',
        instructions: 'Run the blocks, inspect the result, and improve the program.',
        toolboxPreset: 'turtle',
        initialWorkspace: DEFAULT_WORKSPACE,
        studentEditing: {
            allowEditInitialBlocks: true,
            allowDeleteInitialBlocks: true,
            maxBlocks: 50,
        },
        runtime: {
            type: 'canvas-ml-world',
            width: 640,
            height: 360,
            maxSteps: 1000,
            maxRuntimeMs: 2000,
        },
        assessment: {
            enabled: true,
            passingScore: 70,
            attemptsLimit: 0,
            tests: [
                { id: 'completes', type: 'runtime-completion', score: 40 },
                { id: 'target', type: 'final-position', x: 400, y: 180, tolerance: 120, score: 40 },
                { id: 'uses-move', type: 'block-usage', requires: ['learningml_move'], score: 20 },
            ],
        },
        ml: {
            trainingExamples: [
                { features: [1, 1], label: 'small' },
                { features: [8, 8], label: 'large' },
            ],
            testExamples: [
                { features: [2, 2], label: 'small' },
                { features: [9, 9], label: 'large' },
            ],
        },
        scorm: {
            enabled: true,
            weighted: 100,
            evaluation: false,
            evaluationID: '',
        },
    };

    const BLOCK_TYPES = new Set([
        'learningml_when_run',
        'learningml_move',
        'learningml_turn_left',
        'learningml_turn_right',
        'learningml_pen_up',
        'learningml_pen_down',
        'learningml_say',
        'learningml_reset_world',
        'learningml_add_training_example',
        'learningml_train_model',
        'learningml_classify',
        'learningml_if_class_is',
        'controls_repeat_ext',
        'controls_if',
        'logic_compare',
        'logic_boolean',
        'math_number',
    ]);

    const TOOLBOXES = {
        basic: {
            kind: 'categoryToolbox',
            contents: [
                { kind: 'category', name: 'Events', colour: '#5b67a5', contents: [{ kind: 'block', type: 'learningml_when_run' }] },
                { kind: 'category', name: 'Control', colour: '#a55b80', contents: [{ kind: 'block', type: 'controls_repeat_ext' }, { kind: 'block', type: 'controls_if' }] },
                { kind: 'category', name: 'Logic', colour: '#5c81a6', contents: [{ kind: 'block', type: 'logic_compare' }, { kind: 'block', type: 'logic_boolean' }] },
                { kind: 'category', name: 'Math', colour: '#5ca65c', contents: [{ kind: 'block', type: 'math_number' }] },
            ],
        },
        turtle: {
            kind: 'categoryToolbox',
            contents: [
                { kind: 'category', name: 'Events', colour: '#5b67a5', contents: [{ kind: 'block', type: 'learningml_when_run' }] },
                { kind: 'category', name: 'Control', colour: '#a55b80', contents: [{ kind: 'block', type: 'controls_repeat_ext' }, { kind: 'block', type: 'controls_if' }] },
                { kind: 'category', name: 'Logic', colour: '#5c81a6', contents: [{ kind: 'block', type: 'logic_compare' }] },
                { kind: 'category', name: 'Math', colour: '#5ca65c', contents: [{ kind: 'block', type: 'math_number' }] },
                {
                    kind: 'category',
                    name: 'Turtle',
                    colour: '#2f8f6f',
                    contents: [
                        { kind: 'block', type: 'learningml_move' },
                        { kind: 'block', type: 'learningml_turn_left' },
                        { kind: 'block', type: 'learningml_turn_right' },
                        { kind: 'block', type: 'learningml_pen_up' },
                        { kind: 'block', type: 'learningml_pen_down' },
                        { kind: 'block', type: 'learningml_say' },
                        { kind: 'block', type: 'learningml_reset_world' },
                    ],
                },
            ],
        },
        'intro-ml': {
            kind: 'categoryToolbox',
            contents: [
                { kind: 'category', name: 'Events', colour: '#5b67a5', contents: [{ kind: 'block', type: 'learningml_when_run' }] },
                { kind: 'category', name: 'Control', colour: '#a55b80', contents: [{ kind: 'block', type: 'controls_repeat_ext' }, { kind: 'block', type: 'learningml_if_class_is' }] },
                { kind: 'category', name: 'Math', colour: '#5ca65c', contents: [{ kind: 'block', type: 'math_number' }] },
                {
                    kind: 'category',
                    name: 'Intro ML',
                    colour: '#7c5fb0',
                    contents: [
                        { kind: 'block', type: 'learningml_add_training_example' },
                        { kind: 'block', type: 'learningml_train_model' },
                        { kind: 'block', type: 'learningml_classify' },
                        { kind: 'block', type: 'learningml_if_class_is' },
                    ],
                },
                { kind: 'category', name: 'Turtle', colour: '#2f8f6f', contents: [{ kind: 'block', type: 'learningml_say' }] },
            ],
        },
    };

    function mergeDeep(base, value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return structuredCloneSafe(base);
        const result = structuredCloneSafe(base);
        Object.keys(value).forEach((key) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
            if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key]) && result[key]) {
                result[key] = mergeDeep(result[key], value[key]);
            } else {
                result[key] = value[key];
            }
        });
        return result;
    }

    function structuredCloneSafe(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeConfig(data) {
        const config = mergeDeep(DEFAULTS, data || {});
        config.schemaVersion = 1;
        config.studentEditing.maxBlocks = clampInt(config.studentEditing.maxBlocks, 1, 250, 50);
        config.runtime.maxSteps = clampInt(config.runtime.maxSteps, 1, 10000, 1000);
        config.runtime.maxRuntimeMs = clampInt(config.runtime.maxRuntimeMs, 250, 5000, 2000);
        config.assessment.passingScore = clampInt(config.assessment.passingScore, 0, 100, 70);
        if (!TOOLBOXES[config.toolboxPreset]) config.toolboxPreset = 'turtle';
        return config;
    }

    function clampInt(value, min, max, fallback) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    }

    function defineBlocks(Blockly) {
        if (!Blockly || Blockly.Blocks.learningml_when_run) return;
        Blockly.common.defineBlocksWithJsonArray([
            { type: 'learningml_when_run', message0: 'when run', nextStatement: null, colour: 230 },
            { type: 'learningml_move', message0: 'move forward %1', args0: [{ type: 'field_number', name: 'STEPS', value: 40 }], previousStatement: null, nextStatement: null, colour: 150 },
            { type: 'learningml_turn_left', message0: 'turn left %1 degrees', args0: [{ type: 'field_number', name: 'DEGREES', value: 90 }], previousStatement: null, nextStatement: null, colour: 150 },
            { type: 'learningml_turn_right', message0: 'turn right %1 degrees', args0: [{ type: 'field_number', name: 'DEGREES', value: 90 }], previousStatement: null, nextStatement: null, colour: 150 },
            { type: 'learningml_pen_up', message0: 'pen up', previousStatement: null, nextStatement: null, colour: 150 },
            { type: 'learningml_pen_down', message0: 'pen down', previousStatement: null, nextStatement: null, colour: 150 },
            { type: 'learningml_say', message0: 'say %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello' }], previousStatement: null, nextStatement: null, colour: 150 },
            { type: 'learningml_reset_world', message0: 'reset world', previousStatement: null, nextStatement: null, colour: 150 },
            { type: 'learningml_add_training_example', message0: 'example x %1 y %2 label %3', args0: [{ type: 'field_number', name: 'X', value: 1 }, { type: 'field_number', name: 'Y', value: 1 }, { type: 'field_input', name: 'LABEL', text: 'small' }], previousStatement: null, nextStatement: null, colour: 280 },
            { type: 'learningml_train_model', message0: 'train model', previousStatement: null, nextStatement: null, colour: 280 },
            { type: 'learningml_classify', message0: 'classify x %1 y %2', args0: [{ type: 'field_number', name: 'X', value: 2 }, { type: 'field_number', name: 'Y', value: 2 }], previousStatement: null, nextStatement: null, colour: 280 },
            { type: 'learningml_if_class_is', message0: 'if class is %1 do %2', args0: [{ type: 'field_input', name: 'LABEL', text: 'small' }, { type: 'input_statement', name: 'DO' }], previousStatement: null, nextStatement: null, colour: 280 },
        ]);
    }

    function getBlocks(state) {
        return state && state.blocks && Array.isArray(state.blocks.blocks) ? state.blocks.blocks : [];
    }

    function countBlocksInState(state) {
        let count = 0;
        walkBlocks(getBlocks(state), () => { count += 1; });
        return count;
    }

    function collectBlockTypes(state) {
        const types = [];
        walkBlocks(getBlocks(state), block => types.push(block.type));
        return types;
    }

    function walkBlocks(blocks, visit) {
        blocks.forEach((block) => walkBlock(block, visit));
    }

    function walkBlock(block, visit) {
        if (!block || typeof block !== 'object') return;
        visit(block);
        Object.values(block.inputs || {}).forEach((input) => {
            if (input && input.block) walkBlock(input.block, visit);
        });
        if (block.next && block.next.block) walkBlock(block.next.block, visit);
    }

    function validateWorkspaceState(state, config) {
        const serialized = JSON.stringify(state || {});
        if (serialized.length > 262144) return { valid: false, message: 'Workspace data is too large.' };
        let blockCount = 0;
        let invalidType = '';
        walkBlocks(getBlocks(state), (block) => {
            blockCount += 1;
            if (!BLOCK_TYPES.has(block.type)) invalidType = block.type;
        });
        if (blockCount > config.studentEditing.maxBlocks) {
            return { valid: false, message: `The workspace has ${blockCount} blocks. The limit is ${config.studentEditing.maxBlocks}.` };
        }
        if (invalidType) return { valid: false, message: `Unsupported block: ${invalidType}.` };
        return { valid: true, blockCount };
    }

    function createRuntime(config, canvas, output) {
        const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
        const state = {
            x: 120,
            y: 180,
            heading: 0,
            penDown: true,
            stopped: false,
            completed: false,
            error: '',
            steps: 0,
            output: [],
            model: {
                examples: structuredCloneSafe(config.ml.trainingExamples || []),
                trained: false,
                prediction: '',
                confidence: 0,
            },
        };
        function log(message) {
            state.output.push(String(message).slice(0, 160));
            if (state.output.length > 500) state.output.shift();
            if (output) output.textContent = state.output.join('\n');
        }
        function reset() {
            state.x = 120;
            state.y = 180;
            state.heading = 0;
            state.penDown = true;
            state.stopped = false;
            state.completed = false;
            state.error = '';
            state.steps = 0;
            state.output = [];
            state.model = {
                examples: structuredCloneSafe(config.ml.trainingExamples || []),
                trained: false,
                prediction: '',
                confidence: 0,
            };
            draw();
            if (output) output.textContent = '';
        }
        function draw() {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#d7dee8';
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(400, 180, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.translate(state.x, state.y);
            ctx.rotate((state.heading * Math.PI) / 180);
            ctx.fillStyle = '#2f5f8f';
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(-10, -8);
            ctx.lineTo(-10, 8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        function move(distance) {
            const previous = { x: state.x, y: state.y };
            const radians = (state.heading * Math.PI) / 180;
            state.x += Math.cos(radians) * distance;
            state.y += Math.sin(radians) * distance;
            if (ctx && state.penDown) {
                ctx.strokeStyle = '#1f2937';
                ctx.beginPath();
                ctx.moveTo(previous.x, previous.y);
                ctx.lineTo(state.x, state.y);
                ctx.stroke();
            }
            draw();
        }
        reset();
        return { state, log, reset, draw, move };
    }

    function executeWorkspace(state, config, runtime) {
        const validation = validateWorkspaceState(state, config);
        if (!validation.valid) {
            runtime.state.error = validation.message;
            runtime.log(validation.message);
            return runtime.state;
        }
        const startedAt = Date.now();
        const blocks = getBlocks(state);
        const runBlock = blocks.find(block => block.type === 'learningml_when_run') || blocks[0];
        try {
            executeSequence(runBlock, config, runtime, startedAt, runBlock && runBlock.type === 'learningml_when_run');
            runtime.state.completed = !runtime.state.error && !runtime.state.stopped;
        } catch (error) {
            runtime.state.error = error.message || 'The program stopped with an error.';
            runtime.log(runtime.state.error);
        }
        return runtime.state;
    }

    function tick(config, runtime, startedAt) {
        runtime.state.steps += 1;
        if (runtime.state.stopped) throw new Error('Program stopped.');
        if (runtime.state.steps > config.runtime.maxSteps) throw new Error('The program reached the step limit.');
        if (Date.now() - startedAt > config.runtime.maxRuntimeMs) throw new Error('The program reached the time limit.');
    }

    function executeSequence(block, config, runtime, startedAt, skipFirst) {
        let current = block;
        let skip = skipFirst;
        while (current) {
            if (!skip) executeBlock(current, config, runtime, startedAt);
            skip = false;
            current = current.next && current.next.block;
        }
    }

    function executeBlock(block, config, runtime, startedAt) {
        tick(config, runtime, startedAt);
        switch (block.type) {
            case 'learningml_move':
                runtime.move(getNumberField(block, 'STEPS', 0));
                break;
            case 'learningml_turn_left':
                runtime.state.heading -= getNumberField(block, 'DEGREES', 90);
                runtime.draw();
                break;
            case 'learningml_turn_right':
                runtime.state.heading += getNumberField(block, 'DEGREES', 90);
                runtime.draw();
                break;
            case 'learningml_pen_up':
                runtime.state.penDown = false;
                break;
            case 'learningml_pen_down':
                runtime.state.penDown = true;
                break;
            case 'learningml_say':
                runtime.log(getTextField(block, 'TEXT', ''));
                break;
            case 'learningml_reset_world':
                runtime.reset();
                break;
            case 'learningml_add_training_example':
                runtime.state.model.examples.push({
                    features: [getNumberField(block, 'X', 0), getNumberField(block, 'Y', 0)],
                    label: getTextField(block, 'LABEL', 'class'),
                });
                break;
            case 'learningml_train_model':
                runtime.state.model.trained = true;
                runtime.log(`Model trained with ${runtime.state.model.examples.length} examples.`);
                break;
            case 'learningml_classify':
                classify(runtime.state.model, [getNumberField(block, 'X', 0), getNumberField(block, 'Y', 0)]);
                runtime.log(`Prediction: ${runtime.state.model.prediction}`);
                break;
            case 'learningml_if_class_is':
                if (runtime.state.model.prediction === getTextField(block, 'LABEL', '')) {
                    executeSequence(block.inputs && block.inputs.DO && block.inputs.DO.block, config, runtime, startedAt, false);
                }
                break;
            case 'controls_repeat_ext': {
                const repeats = Math.min(100, Math.max(0, Math.floor(getInputNumber(block, 'TIMES', 0))));
                for (let i = 0; i < repeats; i += 1) {
                    executeSequence(block.inputs && block.inputs.DO && block.inputs.DO.block, config, runtime, startedAt, false);
                }
                break;
            }
            case 'controls_if':
                if (getInputBoolean(block, 'IF0', false)) {
                    executeSequence(block.inputs && block.inputs.DO0 && block.inputs.DO0.block, config, runtime, startedAt, false);
                }
                break;
            default:
                if (block.type !== 'learningml_when_run') throw new Error(`Unsupported executable block: ${block.type}.`);
        }
    }

    function getTextField(block, field, fallback) {
        const value = block.fields && block.fields[field];
        return String(value == null ? fallback : value).slice(0, 120);
    }

    function getNumberField(block, field, fallback) {
        const value = Number(block.fields && block.fields[field]);
        return Number.isFinite(value) ? value : fallback;
    }

    function getInputNumber(block, name, fallback) {
        const input = block.inputs && block.inputs[name] && block.inputs[name].block;
        if (!input) return fallback;
        if (input.type === 'math_number') return getNumberField(input, 'NUM', fallback);
        return fallback;
    }

    function getInputBoolean(block, name, fallback) {
        const input = block.inputs && block.inputs[name] && block.inputs[name].block;
        if (!input) return fallback;
        if (input.type === 'logic_boolean') return input.fields && input.fields.BOOL === 'TRUE';
        if (input.type === 'logic_compare') {
            const left = getInputNumber(input, 'A', 0);
            const right = getInputNumber(input, 'B', 0);
            const op = input.fields && input.fields.OP;
            if (op === 'EQ') return left === right;
            if (op === 'LT') return left < right;
            if (op === 'GT') return left > right;
        }
        return fallback;
    }

    function classify(model, features) {
        if (!model.trained || !model.examples.length) {
            model.prediction = '';
            model.confidence = 0;
            return model;
        }
        let best = null;
        model.examples.forEach((example) => {
            const dx = Number(example.features && example.features[0]) - features[0];
            const dy = Number(example.features && example.features[1]) - features[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (!best || distance < best.distance) best = { label: example.label, distance };
        });
        model.prediction = best ? String(best.label) : '';
        model.confidence = best ? 1 / (1 + best.distance) : 0;
        return model;
    }

    function assess(state, config, runtimeState) {
        const tests = Array.isArray(config.assessment.tests) ? config.assessment.tests : [];
        const blockTypes = collectBlockTypes(state);
        const results = [];
        let score = 0;
        let maxScore = 0;
        tests.forEach((test) => {
            const points = clampInt(test.score, 0, 100, 0);
            maxScore += points;
            let passed = false;
            let message = '';
            if (test.type === 'runtime-completion') {
                passed = runtimeState.completed && !runtimeState.error;
                message = passed ? 'The program completed.' : runtimeState.error || 'The program did not complete.';
            } else if (test.type === 'block-usage') {
                const requires = Array.isArray(test.requires) ? test.requires : [];
                passed = requires.every(type => blockTypes.includes(type));
                message = passed ? 'Required blocks are present.' : 'Some required blocks are missing.';
            } else if (test.type === 'final-position') {
                const distance = Math.sqrt((runtimeState.x - Number(test.x)) ** 2 + (runtimeState.y - Number(test.y)) ** 2);
                passed = distance <= Number(test.tolerance || 20);
                message = `Distance to target: ${Math.round(distance)}.`;
            } else if (test.type === 'classification-accuracy') {
                const accuracy = classificationAccuracy(runtimeState.model, config.ml.testExamples || []);
                passed = accuracy >= Number(test.minAccuracy || 0.8);
                message = `Accuracy is ${Math.round(accuracy * 100)}%.`;
            }
            const awarded = passed ? points : 0;
            score += awarded;
            results.push({ id: test.id || test.type, passed, score: awarded, maxScore: points, message });
        });
        const normalized = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        return {
            score: normalized,
            passed: normalized >= config.assessment.passingScore,
            completed: runtimeState.completed,
            tests: results,
        };
    }

    function classificationAccuracy(model, examples) {
        if (!model.trained || !examples.length) return 0;
        let correct = 0;
        examples.forEach((example) => {
            const copy = structuredCloneSafe(model);
            classify(copy, example.features || []);
            if (copy.prediction === example.label) correct += 1;
        });
        return correct / examples.length;
    }

    function createStorage(instanceId) {
        const key = `exe:learningml:v1:${location.pathname}:${instanceId}`;
        return {
            key,
            save(payload) {
                try {
                    localStorage.setItem(key, JSON.stringify({ version: 1, ideviceId: instanceId, updatedAt: Date.now(), payload }));
                    return true;
                } catch (_error) {
                    return false;
                }
            },
            load() {
                try {
                    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
                    if (!parsed || parsed.version !== 1 || parsed.ideviceId !== instanceId) return null;
                    return parsed.payload || null;
                } catch (_error) {
                    return null;
                }
            },
        };
    }

    function createScormAdapter(instanceId, config) {
        function available() {
            return !!(document.body && document.body.classList.contains('exe-scorm') && config.scorm.enabled && window.scorm);
        }
        return {
            saveProgress(payload) {
                if (!available() || !window.scorm.set) return false;
                const compact = JSON.stringify({ learningml: { [instanceId]: payload } });
                if (compact.length > 3500) return false;
                try {
                    window.scorm.set('cmi.suspend_data', compact);
                    if (window.scorm.save) window.scorm.save();
                    return true;
                } catch (_error) {
                    return false;
                }
            },
            report(assessment) {
                const score = Math.max(0, Math.min(100, Number(assessment.score) || 0));
                if (window.$exeDevices && $exeDevices.iDevice && $exeDevices.iDevice.gamification && $exeDevices.iDevice.gamification.scorm) {
                    $exeDevices.iDevice.gamification.scorm.sendScoreNew(true, {
                        ideviceId: instanceId,
                        title: config.title,
                        scorerp: score,
                        weighted: config.scorm.weighted || 100,
                        evaluation: !!config.scorm.evaluation,
                        evaluationID: config.scorm.evaluationID || '',
                    });
                    return true;
                }
                if (!available() || !window.scorm.set) return false;
                try {
                    window.scorm.set('cmi.core.score.raw', String(score));
                    window.scorm.set('cmi.core.lesson_status', assessment.passed ? 'passed' : 'failed');
                    if (window.scorm.save) window.scorm.save();
                    return true;
                } catch (_error) {
                    return false;
                }
            },
        };
    }

    function renderResults(element, assessment, runtimeState) {
        element.textContent = '';
        const status = document.createElement('p');
        status.textContent = `Score: ${assessment.score}. ${assessment.passed ? 'Passed' : 'Not passed'}.`;
        element.appendChild(status);
        if (runtimeState.error) {
            const error = document.createElement('p');
            error.textContent = runtimeState.error;
            element.appendChild(error);
        }
        const list = document.createElement('ul');
        assessment.tests.forEach((test) => {
            const item = document.createElement('li');
            item.textContent = `${test.passed ? 'Pass' : 'Needs work'}: ${test.message}`;
            list.appendChild(item);
        });
        element.appendChild(list);
    }

    function getWorkspaceState(instance) {
        if (instance.workspace && window.Blockly && Blockly.serialization) {
            return Blockly.serialization.workspaces.save(instance.workspace);
        }
        return structuredCloneSafe(instance.config.initialWorkspace);
    }

    function init(container, rawConfig) {
        const config = normalizeConfig(rawConfig);
        const instanceId = config.ideviceId || container.id || `learningml-${Math.random().toString(36).slice(2)}`;
        container.textContent = '';

        const app = document.createElement('div');
        app.className = 'learningml-app';
        const header = document.createElement('div');
        header.className = 'learningml-header';
        const title = document.createElement('h3');
        title.className = 'learningml-title';
        title.textContent = config.title;
        const instructions = document.createElement('p');
        instructions.className = 'learningml-instructions';
        instructions.textContent = config.instructions;
        header.append(title, instructions);

        const row = document.createElement('div');
        row.className = 'learningml-workspace-row';
        const blocklyDiv = document.createElement('div');
        blocklyDiv.className = 'learningml-blockly';
        blocklyDiv.setAttribute('aria-label', 'Blockly workspace');
        const side = document.createElement('div');
        side.className = 'learningml-side';
        const canvas = document.createElement('canvas');
        canvas.className = 'learningml-canvas';
        canvas.width = config.runtime.width;
        canvas.height = config.runtime.height;
        canvas.setAttribute('aria-label', 'Execution canvas');
        const output = document.createElement('pre');
        output.className = 'learningml-summary';
        const controls = document.createElement('div');
        controls.className = 'learningml-controls';
        const results = document.createElement('div');
        results.className = 'learningml-results';
        results.setAttribute('aria-live', 'polite');

        const buttons = {};
        ['Run', 'Step', 'Stop', 'Reset', 'Check', 'Save progress', 'Restore progress'].forEach((label) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.setAttribute('aria-label', label);
            controls.appendChild(button);
            buttons[label] = button;
        });

        side.append(canvas, controls, output, results);
        row.append(blocklyDiv, side);
        app.append(header, row);
        container.appendChild(app);

        const runtime = createRuntime(config, canvas, output);
        const storage = createStorage(instanceId);
        const scorm = createScormAdapter(instanceId, config);
        const instance = { container, config, instanceId, runtime, storage, scorm, workspace: null };

        if (window.Blockly && Blockly.inject) {
            defineBlocks(Blockly);
            instance.workspace = Blockly.inject(blocklyDiv, {
                toolbox: TOOLBOXES[config.toolboxPreset],
                trashcan: !!config.studentEditing.allowDeleteInitialBlocks,
                readOnly: !config.studentEditing.allowEditInitialBlocks,
                grid: { spacing: 20, length: 3, colour: '#d7dee8', snap: true },
                zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.5 },
            });
            try {
                Blockly.serialization.workspaces.load(config.initialWorkspace || DEFAULT_WORKSPACE, instance.workspace);
            } catch (_error) {
                Blockly.serialization.workspaces.load(DEFAULT_WORKSPACE, instance.workspace);
            }
            instance.workspace.addChangeListener((event) => {
                if (Blockly.Events && Blockly.Events.isTransient && Blockly.Events.isTransient(event)) return;
                const validation = validateWorkspaceState(getWorkspaceState(instance), config);
                if (!validation.valid) results.textContent = validation.message;
            });
            setTimeout(() => Blockly.svgResize(instance.workspace), 0);
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'learningml-fallback';
            fallback.textContent = 'Blockly could not be loaded. The activity can still run the teacher workspace.';
            blocklyDiv.appendChild(fallback);
        }

        buttons.Run.addEventListener('click', () => {
            runtime.reset();
            executeWorkspace(getWorkspaceState(instance), config, runtime);
        });
        buttons.Step.addEventListener('click', () => {
            runtime.reset();
            const stepConfig = mergeDeep(config, { runtime: { maxSteps: 1 } });
            executeWorkspace(getWorkspaceState(instance), stepConfig, runtime);
        });
        buttons.Stop.addEventListener('click', () => {
            runtime.state.stopped = true;
            runtime.log('Program stopped.');
        });
        buttons.Reset.addEventListener('click', () => {
            runtime.reset();
            results.textContent = '';
        });
        buttons.Check.addEventListener('click', () => {
            runtime.reset();
            executeWorkspace(getWorkspaceState(instance), config, runtime);
            const assessment = assess(getWorkspaceState(instance), config, runtime.state);
            renderResults(results, assessment, runtime.state);
            scorm.report(assessment);
        });
        buttons['Save progress'].addEventListener('click', () => {
            const payload = { workspace: getWorkspaceState(instance), score: null };
            const saved = scorm.saveProgress(payload) || storage.save(payload);
            results.textContent = saved ? 'Progress saved.' : 'Progress could not be saved in this browser.';
        });
        buttons['Restore progress'].addEventListener('click', () => {
            const payload = storage.load();
            if (payload && payload.workspace && instance.workspace && window.Blockly) {
                Blockly.serialization.workspaces.load(payload.workspace, instance.workspace);
                results.textContent = 'Progress restored.';
            } else {
                results.textContent = 'No saved progress was found for this activity.';
            }
        });

        return instance;
    }

    function initAll() {
        document.querySelectorAll('.idevice_node.learningml').forEach((node) => {
            if (node.dataset.learningmlReady === '1') return;
            node.dataset.learningmlReady = '1';
            let config = {};
            try {
                config = JSON.parse(node.getAttribute('data-idevice-json-data') || '{}');
            } catch (_error) {
                config = {};
            }
            config.ideviceId = config.ideviceId || node.id;
            init(node, config);
        });
    }

    const api = {
        DEFAULTS,
        TOOLBOXES,
        normalizeConfig,
        defineBlocks,
        validateWorkspaceState,
        countBlocksInState,
        collectBlockTypes,
        createRuntime,
        executeWorkspace,
        assess,
        createStorage,
        createScormAdapter,
        init,
        initAll,
        renderView(data, _accessibility, template) {
            return template || '<div class="learningml-template"></div>';
        },
        renderBehaviour(data, _accessibility, ideviceId) {
            const node = document.getElementById(ideviceId || data.ideviceId);
            if (node) init(node, data);
        },
    };

    window.eXeLearning = window.eXeLearning || {};
    window.eXeLearning.iDevices = window.eXeLearning.iDevices || {};
    window.eXeLearning.iDevices.learningml = api;
    window.$learningml = api;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
