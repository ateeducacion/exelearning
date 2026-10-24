import { describe, it, expect } from 'vitest';
import {
    TYPES,
    defaults,
    starter,
    validateConfig,
    validateWorkspace,
    variableName,
    execute,
    initialState,
    assess,
} from './model';
const num = (value) => ({ type: 'ms_number', fields: { NUM: value } });
const input = (block) => ({ block });
const op = (type, fields = {}, inputs = {}) => ({ type: `ms_${type}`, fields, inputs });
const chain = (...blocks) => {
    const copies = structuredClone(blocks);
    for (let i = 0; i < copies.length - 1; i++) copies[i].next = { block: copies[i + 1] };
    return copies[0];
};
const workspace = (...blocks) => ({ blocks: { languageVersion: 0, blocks: [chain(op('start'), ...blocks)] } });
const move = (n) => op('move', {}, { VALUE: input(num(n)) });
function run(program, config = defaults()) {
    const iterator = execute(program, config);
    for (;;) {
        const next = iterator.next();
        if (next.done) return next.value;
    }
}
describe('Block Programming configuration boundary', () => {
    it('uses the new product name for defaults while preserving previously authored titles', () => {
        expect(defaults().title).toBe('Block Programming');
        const previous = { ...defaults(), title: 'Mini Scratch' };
        expect(validateConfig(JSON.parse(JSON.stringify(previous)))).toEqual(previous);
    });
    it.each(['destination', 'sequence', 'calculation'])('round-trips every field for %s', (challenge) => {
        const c = defaults(challenge);
        c.title = '<script>not markup</script>';
        c.hint = '';
        c.retry = '';
        c.success = '';
        c.objective = '';
        c.graded = false;
        c.weight = 1;
        c.pass = 0;
        c.maxAttempts = 0;
        c.startX = -10;
        c.startY = 10;
        expect(validateConfig(JSON.parse(JSON.stringify(c)))).toEqual(c);
    });
    it.each([
        null,
        {},
        { ...defaults(), version: 2 },
        { ...defaults(), challenge: 'code' },
        { ...defaults(), title: 4 },
        { ...defaults(), title: 'a'.repeat(4001) },
        { ...defaults(), graded: 'true' },
        { ...defaults(), maxAttempts: 1.5 },
        { ...defaults(), sequence: [] },
        { ...defaults(), sequence: [{ action: 'eval', value: '' }] },
        { ...defaults(), sequence: [{ action: 'say', value: 1 }] },
        { ...defaults(), allowed: [] },
        { ...defaults(), allowed: ['start', 'eval'] },
    ])('rejects invalid config %#', (c) => expect(() => validateConfig(c)).toThrow());
    it.each(['startX', 'startY', 'targetX', 'targetY', 'weight', 'pass', 'maxAttempts', 'expected'])(
        'rejects out-of-range %s',
        (key) => {
            expect(() => validateConfig({ ...defaults(), [key]: Infinity })).toThrow();
            expect(() => validateConfig({ ...defaults(), [key]: '1' })).toThrow();
        },
    );
    it.each(['', '__proto__', '<img>', 'a b', '9x', 'x'.repeat(33)])('rejects unsafe variable %s', (name) =>
        expect(() => variableName(name)).toThrow(),
    );
    it('accepts case-sensitive names including constructor without prototype mutation', () => {
        expect(variableName('constructor')).toBe('constructor');
        const state = run(workspace(op('set', { NAME: 'constructor' }, { VALUE: input(num(15)) })));
        expect(Object.getPrototypeOf(state.variables)).toBeNull();
        expect(state.variables.constructor).toBe(15);
    });
    it('requires a supported version even when fields are missing', () =>
        expect(() => validateConfig({ version: 1 })).toThrow());
});
describe('Block Programming workspace boundary', () => {
    it('round-trips public Blockly coordinates and fields, discarding executable metadata and IDs', () => {
        const source = starter();
        Object.assign(source.blocks.blocks[0], {
            id: 'old',
            x: 20,
            y: 30,
            extraState: { malicious: true },
            data: '<script>',
        });
        expect(validateWorkspace(source)).toEqual({
            blocks: { languageVersion: 0, blocks: [{ type: 'ms_start', x: 20, y: 30 }] },
        });
    });
    it.each([
        null,
        {},
        { blocks: {} },
        { blocks: { blocks: [null] } },
        { blocks: { blocks: [{ type: 'ms_eval' }] } },
        { blocks: { blocks: [{ type: 'start' }] } },
        workspace(op('say', { TEXT: 'x'.repeat(201) })),
        workspace(op('say', { 'bad-field': 1 })),
        workspace(op('say', { TEXT: {} })),
        workspace(op('move', {}, { BAD: input(num(1)) })),
        { blocks: { blocks: [{ type: 'ms_start', next: {} }] } },
    ])('rejects invalid workspace %#', (data) => expect(() => validateWorkspace(data)).toThrow());
    it('rejects large, deep and disallowed programs before deserialization', () => {
        expect(() => validateWorkspace({ blocks: { blocks: [] }, padding: 'x'.repeat(100001) })).toThrow('large');
        expect(() => validateWorkspace({ blocks: { blocks: Array.from({ length: 201 }, () => op('start')) } })).toThrow(
            'complexity',
        );
        let nested = move(1);
        for (let i = 0; i < 42; i++) nested = op('repeat', {}, { TIMES: input(num(1)), DO: input(nested) });
        expect(() => validateWorkspace(workspace(nested))).toThrow('complexity');
        expect(validateWorkspace(workspace(...Array.from({ length: 60 }, () => move(1))))).toBeDefined();
        expect(() => validateWorkspace(workspace(move(1)), ['start'])).toThrow('not allowed');
        expect(() => validateWorkspace({ blocks: { blocks: [{ type: 'ms_start', x: 10001 }] } })).toThrow();
    });
    it('preserves connected values and shadows', () => {
        const data = workspace(op('move', {}, { VALUE: { block: num(2), shadow: num(1) } }));
        expect(validateWorkspace(data)).toEqual(data);
    });
});
describe('Block Programming interpreter and behavior assessment', () => {
    it('accepts alternative correct programs for the same destination', () => {
        const direct = run(workspace(move(3)));
        const repeated = run(workspace(op('repeat', {}, { TIMES: input(num(3)), DO: input(move(1)) })));
        expect(assess(direct, defaults()).score).toBe(100);
        expect(assess(repeated, defaults()).score).toBe(100);
    });
    it('allows alternative loop structures for a sequence', () => {
        const c = defaults('sequence');
        c.sequence = [
            { action: 'move', value: '1' },
            { action: 'move', value: '1' },
        ];
        expect(assess(run(workspace(move(1), move(1)), c), c).score).toBe(100);
        expect(assess(run(workspace(op('repeat', {}, { TIMES: input(num(2)), DO: input(move(1)) })), c), c).score).toBe(
            100,
        );
    });
    it('gives partial credit and rejects extra observable actions', () => {
        expect(assess(run(workspace(move(1))), defaults()).score).toBe(50);
        const c = defaults('sequence');
        expect(
            assess(run(workspace(move(1), op('turn', { DIR: 'right' }), op('say', { TEXT: 'Hello' })), c), c).score,
        ).toBe(100);
        expect(
            assess(run(workspace(move(1), op('turn', { DIR: 'left' }), op('say', { TEXT: 'Hello' })), c), c).score,
        ).toBe(67);
        expect(
            assess(run(workspace(move(1), op('turn', { DIR: 'right' }), op('say', { TEXT: 'Hello' }), move(1)), c), c)
                .score,
        ).toBe(75);
    });
    it('supports rotations, position, negative movement, visibility and messages', () => {
        const state = run(
            workspace(
                op('turn', { DIR: 'left' }),
                move(2),
                op('turn', { DIR: 'right' }),
                move(-3),
                op('position', { X: 4, Y: -2 }),
                op('visible', { SHOW: 'FALSE' }),
                op('say', { TEXT: '<img onerror=alert(1)>' }),
            ),
        );
        expect(state).toMatchObject({ x: 4, y: -2, direction: 0, visible: false, message: '<img onerror=alert(1)>' });
    });
    it('evaluates calculated variable state instead of requiring a visual solution', () => {
        const c = defaults('calculation');
        const sum = op('arithmetic', { OP: 'ADD' }, { A: input(num(10)), B: input(num(5)) });
        const calculate = workspace(op('set', { NAME: 'result' }, { VALUE: input(sum) }));
        const repeat = workspace(
            op('set', { NAME: 'result' }, { VALUE: input(num(0)) }),
            op(
                'repeat',
                {},
                { TIMES: input(num(5)), DO: input(op('change', { NAME: 'result' }, { VALUE: input(num(3)) })) },
            ),
        );
        expect(assess(run(calculate, c), c).score).toBe(100);
        expect(assess(run(repeat, c), c).score).toBe(100);
        expect(assess(initialState(c), c).score).toBe(0);
    });
    it.each([
        ['ADD', 12],
        ['SUB', 4],
        ['MUL', 32],
        ['DIV', 2],
    ])('supports %s', (OP, expected) => {
        const state = run(
            workspace(
                op(
                    'set',
                    { NAME: 'result' },
                    { VALUE: input(op('arithmetic', { OP }, { A: input(num(8)), B: input(num(4)) })) },
                ),
            ),
        );
        expect(state.variables.result).toBe(expected);
    });
    it.each([
        ['EQ', 1, 1, true],
        ['LT', 1, 2, true],
        ['GT', 3, 2, true],
        ['EQ', 1, 2, false],
    ])('branches on %s', (OP, a, b, yes) => {
        const condition = op('compare', { OP }, { A: input(num(a)), B: input(num(b)) });
        const state = run(
            workspace(op('if', {}, { CONDITION: input(condition), DO: input(move(3)), ELSE: input(move(1)) })),
        );
        expect(state.x).toBe(yes ? 3 : 1);
    });
    it.each([
        ['AND', 'TRUE', 'TRUE', true],
        ['AND', 'TRUE', 'FALSE', false],
        ['OR', 'FALSE', 'TRUE', true],
        ['OR', 'FALSE', 'FALSE', false],
    ])('supports boolean %s', (OP, a, b, yes) => {
        const condition = op(
            'logic',
            { OP },
            { A: input(op('boolean', { BOOL: a })), B: input(op('boolean', { BOOL: b })) },
        );
        expect(
            run(workspace(op('if', {}, { CONDITION: input(condition), DO: input(move(3)), ELSE: input(move(1)) }))).x,
        ).toBe(yes ? 3 : 1);
    });
    it('supports negation, variable reads and numeric shadows', () => {
        const set = op('set', { NAME: 'x' }, { VALUE: { shadow: num(4) } });
        const condition = op('not', {}, { A: input(op('boolean', { BOOL: 'FALSE' })) });
        const body = op('move', {}, { VALUE: input(op('variable', { NAME: 'x' })) });
        expect(run(workspace(set, op('if', {}, { CONDITION: input(condition), DO: input(body) }))).x).toBe(4);
    });
    it('wait produces a controlled delay, never executing source', () => {
        const iterator = execute(workspace(op('wait', {}, { VALUE: input(num(0.1)) })), defaults());
        expect(iterator.next().value.delay).toBe(100);
        expect(iterator.next().done).toBe(true);
    });
    it.each([
        starter(),
        { blocks: { blocks: [move(1)] } },
        { blocks: { blocks: [op('start'), move(1)] } },
        workspace(op('move')),
        workspace(op('start')),
        workspace(op('move', {}, { VALUE: input(op('say', { TEXT: 'x' })) })),
        workspace(op('set', { NAME: 'x' }, { VALUE: input(op('variable', { NAME: 'unset' })) })),
        workspace(op('change', { NAME: 'unset' }, { VALUE: input(num(1)) })),
        workspace(op('repeat', {}, { TIMES: input(num(1.5)) })),
        workspace(op('wait', {}, { VALUE: input(num(6)) })),
        workspace(
            op(
                'set',
                { NAME: 'x' },
                { VALUE: input(op('arithmetic', { OP: 'DIV' }, { A: input(num(1)), B: input(num(0)) })) },
            ),
        ),
        workspace(
            op(
                'set',
                { NAME: 'x' },
                { VALUE: input(op('arithmetic', { OP: 'BAD' }, { A: input(num(1)), B: input(num(1)) })) },
            ),
        ),
        workspace(
            op('if', {}, { CONDITION: input(op('compare', { OP: 'BAD' }, { A: input(num(1)), B: input(num(1)) })) }),
        ),
    ])('rejects incomplete or invalid program %#', (data) => expect(() => run(data)).toThrow());
    it('limits nested repetition even with empty bodies and never hangs the caller', () => {
        const inner = op('repeat', {}, { TIMES: input(num(1000)) });
        const outer = op('repeat', {}, { TIMES: input(num(1000)), DO: input(inner) });
        expect(() => run(workspace(outer))).toThrow('step limit');
    });
    it('gives the same result on repeated execution and isolates variables', () => {
        const p = workspace(op('set', { NAME: 'x' }, { VALUE: input(num(2)) }), move(3));
        expect(run(p)).toEqual(run(p));
        expect(run(workspace(move(1))).variables).toEqual({});
    });
});

it('normalizes equivalent numeric sequence values and rejects invalid expectations', () => {
    const c = defaults('sequence');
    c.sequence = [
        { action: 'move', value: '01.00' },
        { action: 'position', value: '2.0, 3' },
    ];
    expect(validateConfig(c).sequence).toEqual([
        { action: 'move', value: '1' },
        { action: 'position', value: '2,3' },
    ]);
    for (const item of [
        { action: 'move', value: '' },
        { action: 'move', value: 'text' },
        { action: 'turn', value: 'up' },
        { action: 'visible', value: '1' },
        { action: 'position', value: '2' },
        { action: 'position', value: '20,0' },
    ]) {
        expect(() => validateConfig({ ...c, sequence: [item] })).toThrow();
    }
});
it('rejects unknown boolean and turn operations in imported programs', () => {
    for (const body of [
        op('turn', { DIR: 'up' }),
        op('visible', { SHOW: 'maybe' }),
        op('if', {}, { CONDITION: input(op('boolean', { BOOL: 'maybe' })) }),
        op('if', {}, { CONDITION: input(op('logic', { OP: 'XOR' })) }),
    ]) {
        expect(() => run(workspace(body))).toThrow();
    }
});

it('never rewards an incorrect sequence merely for having the expected action count', () => {
    const c = defaults('sequence');
    expect(
        assess(
            run(workspace(op('say', { TEXT: 'wrong' }), op('say', { TEXT: 'wrong' }), op('say', { TEXT: 'wrong' })), c),
            c,
        ).score,
    ).toBe(0);
});
