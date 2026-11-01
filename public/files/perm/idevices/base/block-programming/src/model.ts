/** Block Programming data boundary and deterministic interpreter. SPDX-License-Identifier: AGPL-3.0-or-later */
const c_ = (s: string): string => (typeof globalThis.c_ === 'function' ? globalThis.c_(s) : s);
export const TYPES = [
    'start',
    'move',
    'turn',
    'position',
    'repeat',
    'if',
    'wait',
    'number',
    'arithmetic',
    'compare',
    'boolean',
    'logic',
    'not',
    'set',
    'change',
    'variable',
    'say',
    'visible',
] as const;
export type Kind = (typeof TYPES)[number];
export type Block = {
    type: string;
    fields?: Record<string, string | number | boolean>;
    inputs?: Record<string, { block?: Block; shadow?: Block }>;
    next?: { block?: Block };
    [key: string]: unknown;
};
export type Workspace = { blocks: { languageVersion: number; blocks: Block[] } };
export type Action = { action: 'move' | 'turn' | 'say' | 'visible' | 'position'; value: string };
export type Config = {
    version: 1;
    title: string;
    instructions: string;
    objective: string;
    hint: string;
    success: string;
    retry: string;
    challenge: 'destination' | 'sequence' | 'calculation';
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    variable: string;
    expected: number;
    sequence: Action[];
    allowed: Kind[];
    starter: Workspace;
    graded: boolean;
    weight: number;
    pass: number;
    maxAttempts: number;
};
export const starter = (): Workspace => ({
    blocks: { languageVersion: 0, blocks: [{ type: 'ms_start', x: 20, y: 20 }] },
});
export function defaults(challenge: Config['challenge'] = 'destination'): Config {
    return {
        version: 1,
        title: c_('Block Programming'),
        instructions:
            challenge === 'destination'
                ? c_('Move the character to the target (3, 0).')
                : challenge === 'sequence'
                  ? c_('Move forward 1 step, turn right, then display Hello.')
                  : c_('Calculate 1 + 2 + 3 + 4 + 5 and store it in result.'),
        objective:
            challenge === 'calculation'
                ? c_('Use variables and repetition to calculate a sum.')
                : c_('Use a sequence of instructions and repetition.'),
        hint: c_('Connect your blocks below When program starts.'),
        success: c_('Passing threshold reached.'),
        retry: c_('Review the criteria and try again.'),
        challenge,
        startX: 0,
        startY: 0,
        targetX: 3,
        targetY: 0,
        variable: 'result',
        expected: 15,
        sequence: [
            { action: 'move', value: '1' },
            { action: 'turn', value: 'right' },
            { action: 'say', value: 'Hello' },
        ],
        allowed: [...TYPES],
        starter: starter(),
        graded: true,
        weight: 100,
        pass: 100,
        maxAttempts: 0,
    };
}
const fail = (message: string): never => {
    throw new Error(message);
};
function number(value: unknown, low: number, high: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
        fail(c_('Invalid number.'));
    return value as number;
}
function text(value: unknown, max = 4000): string {
    if (typeof value !== 'string' || value.length > max) fail(c_('Invalid text.'));
    return value as string;
}
export function variableName(value: unknown): string {
    const name = text(value, 32);
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name))
        fail(c_('Use a variable name starting with a letter, with letters, digits or underscores.'));
    return name;
}
/** Rebuild an allowlisted workspace before Blockly deserializes any imported data. */
export function validateWorkspace(raw: unknown, allowed: readonly Kind[] = TYPES): Workspace {
    if (!raw || JSON.stringify(raw).length > 100000) fail(c_('Workspace is too large.'));
    const roots = (raw as Workspace).blocks?.blocks;
    if (!Array.isArray(roots)) fail(c_('Invalid workspace.'));
    let count = 0;
    const visit = (source: Block, depth = 0): Block => {
        if (++count > 200 || depth > 40 || !source || typeof source !== 'object')
            fail(c_('Workspace complexity limit exceeded.'));
        const kind = source.type?.replace(/^ms_/, '') as Kind;
        if (source.type !== `ms_${kind}` || !TYPES.includes(kind) || !allowed.includes(kind))
            fail(c_('This block is not allowed.'));
        const block: Block = { type: source.type };
        if (source.fields) {
            block.fields = {};
            for (const [key, value] of Object.entries(source.fields)) {
                if (!/^[A-Z_]{1,20}$/.test(key)) fail(c_('Invalid field.'));
                if (!['string', 'number', 'boolean'].includes(typeof value) || String(value).length > 200)
                    fail(c_('Invalid field value.'));
                block.fields[key] = value;
            }
        }
        if (source.inputs) {
            block.inputs = {};
            for (const [key, input] of Object.entries(source.inputs)) {
                if (!['VALUE', 'A', 'B', 'TIMES', 'DO', 'CONDITION', 'ELSE'].includes(key) || !input)
                    fail(c_('Invalid input.'));
                block.inputs[key] = {};
                if (input.block) block.inputs[key].block = visit(input.block, depth + 1);
                if (input.shadow) block.inputs[key].shadow = visit(input.shadow, depth + 1);
            }
        }
        if (source.next) block.next = { block: visit(source.next.block!, depth) };
        for (const axis of ['x', 'y'])
            if (source[axis] !== undefined) block[axis] = number(source[axis], -10000, 10000);
        return block;
    };
    return { blocks: { languageVersion: 0, blocks: roots.map((b) => visit(b)) } };
}
export function validateConfig(raw: unknown): Config {
    const source = raw as Config;
    if (!source || source.version !== 1) fail(c_('Unsupported activity version.'));
    const c = defaults();
    for (const key of ['title', 'instructions', 'objective', 'hint', 'success', 'retry'] as const)
        c[key] = text(source[key]);
    if (!['destination', 'sequence', 'calculation'].includes(source.challenge)) fail(c_('Invalid challenge.'));
    c.challenge = source.challenge;
    for (const key of ['startX', 'startY', 'targetX', 'targetY'] as const) c[key] = number(source[key], -10, 10);
    c.variable = variableName(source.variable);
    c.expected = number(source.expected, -1000000, 1000000);
    c.weight = number(source.weight, 1, 100);
    c.pass = number(source.pass, 0, 100);
    c.maxAttempts = number(source.maxAttempts, 0, 100);
    if (!Number.isInteger(c.maxAttempts) || typeof source.graded !== 'boolean')
        fail(c_('Invalid assessment settings.'));
    c.graded = source.graded;
    if (
        !Array.isArray(source.allowed) ||
        !source.allowed.includes('start') ||
        source.allowed.some((k) => !TYPES.includes(k))
    )
        fail(c_('Invalid toolbox.'));
    c.allowed = [...new Set(source.allowed)];
    if (!Array.isArray(source.sequence) || source.sequence.length < 1 || source.sequence.length > 30)
        fail(c_('Use between 1 and 30 sequence actions.'));
    c.sequence = source.sequence.map((item) => {
        if (!['move', 'turn', 'say', 'visible', 'position'].includes(item.action)) fail(c_('Invalid sequence action.'));
        let value = text(item.value, 200);
        const numericText = (raw: string, limit = 1000000) => {
            if (!raw.trim()) fail(c_('Enter a numeric action value.'));
            return String(number(Number(raw), -limit, limit));
        };
        if (item.action === 'move') value = numericText(value);
        if (item.action === 'turn' && !['left', 'right'].includes(value)) fail(c_('Choose left or right.'));
        if (item.action === 'visible' && !['true', 'false'].includes(value)) fail(c_('Choose true or false.'));
        if (item.action === 'position') {
            const coordinates = value.split(',');
            if (coordinates.length !== 2) fail(c_('Enter both coordinates.'));
            value = coordinates.map((v) => numericText(v, 10)).join(',');
        }
        return { action: item.action, value };
    });
    c.starter = validateWorkspace(source.starter, c.allowed);
    return c;
}
export type State = {
    x: number;
    y: number;
    direction: number;
    message: string;
    visible: boolean;
    variables: Record<string, number>;
    trace: Action[];
    steps: number;
};
export type Frame = { state: State; delay: number };
export function initialState(c: Config): State {
    return {
        x: c.startX,
        y: c.startY,
        direction: 0,
        message: '',
        visible: true,
        variables: Object.create(null),
        trace: [],
        steps: 0,
    };
}
/** Yields on every statement. Expression work also consumes the global instruction budget. */
export function* execute(raw: unknown, c: Config): Generator<Frame, State> {
    const workspace = validateWorkspace(raw, c.allowed);
    const roots = workspace.blocks.blocks;
    if (roots.length !== 1 || roots[0].type !== 'ms_start' || !roots[0].next)
        fail(c_('Connect one program to When program starts. Remove disconnected blocks.'));
    const state = initialState(c);
    const tick = () => {
        if (++state.steps > 2000) fail(c_('Execution step limit exceeded.'));
    };
    const field = (b: Block, name: string) => b.fields?.[name];
    const numeric = (v: unknown) => number(v, -1000000, 1000000);
    const input = (b: Block, name: string) => b.inputs?.[name]?.block || b.inputs?.[name]?.shadow;
    const value = (b?: Block): number | boolean => {
        tick();
        if (!b) return fail(c_('A value or condition is missing.'));
        const a = () => value(input(b, 'A'));
        const d = () => value(input(b, 'B'));
        switch (b.type) {
            case 'ms_number':
                return numeric(Number(field(b, 'NUM')));
            case 'ms_variable': {
                const name = variableName(field(b, 'NAME'));
                if (!(name in state.variables)) fail(c_('Set a variable before reading it.'));
                return state.variables[name];
            }
            case 'ms_boolean':
                if (!['TRUE', 'FALSE'].includes(String(field(b, 'BOOL')))) fail(c_('Choose true or false.'));
                return field(b, 'BOOL') === 'TRUE';
            case 'ms_not':
                return !Boolean(a());
            case 'ms_logic':
                if (!['AND', 'OR'].includes(String(field(b, 'OP')))) fail(c_('Choose and or or.'));
                return field(b, 'OP') === 'AND' ? Boolean(a()) && Boolean(d()) : Boolean(a()) || Boolean(d());
            case 'ms_compare': {
                const x = numeric(a());
                const y = numeric(d());
                switch (field(b, 'OP')) {
                    case 'EQ':
                        return x === y;
                    case 'LT':
                        return x < y;
                    case 'GT':
                        return x > y;
                    default:
                        return fail(c_('Invalid comparison.'));
                }
            }
            case 'ms_arithmetic': {
                const x = numeric(a());
                const y = numeric(d());
                switch (field(b, 'OP')) {
                    case 'ADD':
                        return numeric(x + y);
                    case 'SUB':
                        return numeric(x - y);
                    case 'MUL':
                        return numeric(x * y);
                    case 'DIV':
                        return numeric(x / y);
                    default:
                        return fail(c_('Invalid calculation.'));
                }
            }
            default:
                return fail(c_('A value block was expected.'));
        }
    };
    const record = (action: Action['action'], v: unknown) => {
        state.trace.push({ action, value: String(v) });
    };
    function* statements(first?: Block): Generator<Frame> {
        for (let b = first; b; b = b.next?.block) {
            tick();
            let delay = 0;
            switch (b.type) {
                case 'ms_move': {
                    const distance = numeric(value(input(b, 'VALUE')));
                    const vectors = [
                        [1, 0],
                        [0, 1],
                        [-1, 0],
                        [0, -1],
                    ];
                    state.x = numeric(state.x + vectors[state.direction][0] * distance);
                    state.y = numeric(state.y + vectors[state.direction][1] * distance);
                    record('move', distance);
                    break;
                }
                case 'ms_turn': {
                    if (!['left', 'right'].includes(String(field(b, 'DIR')))) fail(c_('Choose left or right.'));
                    const right = field(b, 'DIR') === 'right';
                    state.direction = (state.direction + (right ? 1 : 3)) % 4;
                    record('turn', right ? 'right' : 'left');
                    break;
                }
                case 'ms_position':
                    state.x = numeric(Number(field(b, 'X')));
                    state.y = numeric(Number(field(b, 'Y')));
                    record('position', `${state.x},${state.y}`);
                    break;
                case 'ms_say':
                    state.message = text(field(b, 'TEXT'), 200);
                    record('say', state.message);
                    break;
                case 'ms_visible':
                    if (!['TRUE', 'FALSE'].includes(String(field(b, 'SHOW')))) fail(c_('Choose true or false.'));
                    state.visible = field(b, 'SHOW') === 'TRUE';
                    record('visible', state.visible);
                    break;
                case 'ms_wait': {
                    const seconds = value(input(b, 'VALUE'));
                    if (typeof seconds !== 'number' || seconds < 0 || seconds > 5)
                        fail(c_('Wait must be between 0 and 5 seconds.'));
                    delay = Number(seconds) * 1000;
                    break;
                }
                case 'ms_set':
                    state.variables[variableName(field(b, 'NAME'))] = numeric(value(input(b, 'VALUE')));
                    break;
                case 'ms_change': {
                    const name = variableName(field(b, 'NAME'));
                    if (!(name in state.variables)) fail(c_('Set a variable before changing it.'));
                    state.variables[name] = numeric(state.variables[name] + numeric(value(input(b, 'VALUE'))));
                    break;
                }
                case 'ms_repeat': {
                    const times = value(input(b, 'TIMES'));
                    if (typeof times !== 'number' || !Number.isInteger(times) || times < 0 || times > 1000)
                        fail(c_('Repeat needs a whole number from 0 to 1000.'));
                    for (let i = 0; i < Number(times); i++) {
                        tick();
                        yield { state, delay: 0 };
                        yield* statements(input(b, 'DO'));
                    }
                    break;
                }
                case 'ms_if':
                    yield* statements(input(b, Boolean(value(input(b, 'CONDITION'))) ? 'DO' : 'ELSE'));
                    break;
                default:
                    fail(c_('A statement block was expected.'));
            }
            yield { state, delay };
        }
    }
    yield* statements(roots[0].next!.block);
    return state;
}
export function assess(state: State, c: Config): { score: number; criteria: boolean[] } {
    let criteria: boolean[];
    if (c.challenge === 'destination')
        criteria = [Math.abs(state.x - c.targetX) < 0.001, Math.abs(state.y - c.targetY) < 0.001];
    else if (c.challenge === 'calculation')
        criteria = [
            Object.hasOwn(state.variables, c.variable) && Math.abs(state.variables[c.variable] - c.expected) < 0.001,
        ];
    else {
        criteria = c.sequence.map(
            (item, i) => item.action === state.trace[i]?.action && item.value === state.trace[i]?.value,
        );
        const matched = criteria.filter(Boolean).length;
        criteria.push(state.trace.length === c.sequence.length);
        return { score: Math.round((matched / Math.max(c.sequence.length, state.trace.length)) * 100), criteria };
    }
    return { score: Math.round((criteria.filter(Boolean).length / criteria.length) * 100), criteria };
}
