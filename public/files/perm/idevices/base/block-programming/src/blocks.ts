/** Blockly public API adapter. SPDX-License-Identifier: AGPL-3.0-or-later */
import type * as BlocklyTypes from 'blockly/core';
const Blockly = globalThis.Blockly as typeof BlocklyTypes;
import { TYPES, type Config, type Workspace, validateWorkspace } from './model';
export { Blockly };
export const content = (s: string): string => (typeof globalThis.c_ === 'function' ? globalThis.c_(s) : s);
export const gui = (s: string): string => (typeof globalThis._ === 'function' ? globalThis._(s) : s);
const c_ = content;
let registered = false;
export function registerBlocks(): void {
    if (registered) return;
    const statement = { previousStatement: null, nextStatement: null, colour: 215 };
    const value = (name: string, check?: string) => ({ type: 'input_value', name, ...(check ? { check } : {}) });
    const name = { type: 'field_input', name: 'NAME', text: 'result', spellcheck: false };
    const body = (id: string, message: string, args: unknown[], extra = {}) => ({
        type: `ms_${id}`,
        message0: message,
        args0: args,
        ...statement,
        ...extra,
        tooltip: message.replace(/%\d/g, '').trim(),
        helpUrl: '',
    });
    const dropdown = (id: string, options: string[][]) => ({ type: 'field_dropdown', name: id, options });
    Blockly.defineBlocksWithJsonArray([
        body('start', c_('When program starts'), [], { previousStatement: undefined, colour: 30 }),
        body('move', c_('move forward %1 steps'), [value('VALUE', 'Number')]),
        body('turn', c_('turn %1'), [
            dropdown('DIR', [
                [c_('right'), 'right'],
                [c_('left'), 'left'],
            ]),
        ]),
        body('position', c_('go to x %1 y %2'), [
            { type: 'field_number', name: 'X', value: 0, min: -10, max: 10 },
            { type: 'field_number', name: 'Y', value: 0, min: -10, max: 10 },
        ]),
        body(
            'repeat',
            c_('repeat %1 times %2 %3'),
            [value('TIMES', 'Number'), { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
            { colour: 30 },
        ),
        body(
            'if',
            c_('if %1 then %2 else %3'),
            [
                value('CONDITION', 'Boolean'),
                { type: 'input_statement', name: 'DO' },
                { type: 'input_statement', name: 'ELSE' },
            ],
            { colour: 30 },
        ),
        body('wait', c_('wait %1 seconds'), [value('VALUE', 'Number')], { colour: 30 }),
        body('number', '%1', [{ type: 'field_number', name: 'NUM', value: 1, min: -1000000, max: 1000000 }], {
            previousStatement: undefined,
            nextStatement: undefined,
            output: 'Number',
            colour: 230,
        }),
        body(
            'arithmetic',
            '%1 %2 %3',
            [
                value('A', 'Number'),
                dropdown('OP', [
                    ['+', 'ADD'],
                    ['−', 'SUB'],
                    ['×', 'MUL'],
                    ['÷', 'DIV'],
                ]),
                value('B', 'Number'),
            ],
            { previousStatement: undefined, nextStatement: undefined, output: 'Number', colour: 230 },
        ),
        body(
            'compare',
            '%1 %2 %3',
            [
                value('A', 'Number'),
                dropdown('OP', [
                    ['=', 'EQ'],
                    ['<', 'LT'],
                    ['>', 'GT'],
                ]),
                value('B', 'Number'),
            ],
            { previousStatement: undefined, nextStatement: undefined, output: 'Boolean', colour: 120 },
        ),
        body(
            'boolean',
            '%1',
            [
                dropdown('BOOL', [
                    [c_('true'), 'TRUE'],
                    [c_('false'), 'FALSE'],
                ]),
            ],
            { previousStatement: undefined, nextStatement: undefined, output: 'Boolean', colour: 120 },
        ),
        body(
            'logic',
            '%1 %2 %3',
            [
                value('A', 'Boolean'),
                dropdown('OP', [
                    [c_('and'), 'AND'],
                    [c_('or'), 'OR'],
                ]),
                value('B', 'Boolean'),
            ],
            { previousStatement: undefined, nextStatement: undefined, output: 'Boolean', colour: 120 },
        ),
        body('not', c_('not %1'), [value('A', 'Boolean')], {
            previousStatement: undefined,
            nextStatement: undefined,
            output: 'Boolean',
            colour: 120,
        }),
        body('set', c_('set %1 to %2'), [name, value('VALUE', 'Number')], { colour: 290 }),
        body('change', c_('change %1 by %2'), [name, value('VALUE', 'Number')], { colour: 290 }),
        body('variable', '%1', [name], {
            previousStatement: undefined,
            nextStatement: undefined,
            output: 'Number',
            colour: 290,
        }),
        body('say', c_('display %1'), [{ type: 'field_input', name: 'TEXT', text: 'Hello' }], { colour: 290 }),
        body(
            'visible',
            c_('character visible %1'),
            [
                dropdown('SHOW', [
                    [c_('true'), 'TRUE'],
                    [c_('false'), 'FALSE'],
                ]),
            ],
            { colour: 290 },
        ),
    ]);
    registered = true;
}
export const blockLabels = () => [
    c_('When program starts'),
    c_('Move forward'),
    c_('Turn'),
    c_('Go to position'),
    c_('Repeat'),
    c_('If / else'),
    c_('Wait'),
    c_('Number'),
    c_('Arithmetic'),
    c_('Comparison'),
    c_('Boolean'),
    c_('Boolean operators'),
    c_('Not'),
    c_('Set variable'),
    c_('Change variable'),
    c_('Read variable'),
    c_('Display a message'),
    c_('Show / hide character'),
];
export function toolbox(c: Config): BlocklyTypes.utils.toolbox.ToolboxDefinition {
    return {
        kind: 'flyoutToolbox',
        contents: c.allowed.map((kind) => {
            const block: BlocklyTypes.utils.toolbox.BlockInfo = { kind: 'block', type: `ms_${kind}` };
            const names =
                kind === 'repeat'
                    ? ['TIMES']
                    : ['move', 'wait', 'set', 'change'].includes(kind)
                      ? ['VALUE']
                      : ['arithmetic', 'compare'].includes(kind)
                        ? ['A', 'B']
                        : [];
            if (names.length && c.allowed.includes('number'))
                block.inputs = Object.fromEntries(
                    names.map((name) => [name, { shadow: { type: 'ms_number', fields: { NUM: 1 } } }]),
                );
            return block;
        }),
    };
}
export function inject(element: HTMLElement, c: Config, media: string): BlocklyTypes.WorkspaceSvg {
    registerBlocks();
    const workspace = Blockly.inject(element, {
        toolbox: toolbox(c),
        media,
        sounds: false,
        trashcan: false,
        maxBlocks: 200,
        collapse: false,
        comments: false,
        disable: false,
        zoom: { controls: true, wheel: false, startScale: 0.9 },
        move: { scrollbars: true, drag: true, wheel: true },
    });
    try {
        Blockly.serialization.workspaces.load(validateWorkspace(c.starter, c.allowed), workspace);
    } catch (error) {
        workspace.dispose();
        throw error;
    }
    return workspace;
}
export function snapshot(workspace: BlocklyTypes.Workspace, c: Config): Workspace {
    return validateWorkspace(Blockly.serialization.workspaces.save(workspace), c.allowed);
}
