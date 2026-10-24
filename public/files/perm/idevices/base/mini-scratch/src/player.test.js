import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { defaults } from './model';
globalThis.Blockly = Blockly;
const Blocks = await import('./blocks');
const { Player, renderView, escapeAttribute } = await import('./player');
const connected = (steps = 3) => ({
    blocks: {
        languageVersion: 0,
        blocks: [
            {
                type: 'ms_start',
                next: {
                    block: {
                        type: 'ms_move',
                        inputs: { VALUE: { block: { type: 'ms_number', fields: { NUM: steps } } } },
                    },
                },
            },
        ],
    },
});
const live = [];
let registry;
let shared;
function make(config = defaults(), preview = false) {
    const wrapper = document.createElement('article');
    wrapper.className = 'idevice_node';
    wrapper.id = `activity-${live.length}`;
    const root = document.createElement('section');
    wrapper.append(root);
    document.body.append(wrapper);
    const player = new Player(root, config, '/local/media/', preview);
    live.push(player);
    return player;
}
function load(player, data) {
    Blockly.serialization.workspaces.load(data, player.workspace);
}
async function execute(player, submit) {
    const pending = player.run(submit);
    await vi.runAllTimersAsync();
    await pending;
}
beforeAll(() => Blocks.registerBlocks());
beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        },
    );
    vi.spyOn(Blocks, 'inject').mockImplementation((_element, c) => {
        const ws = new Blockly.Workspace();
        ws.updateToolbox = vi.fn();
        Blockly.serialization.workspaces.load(c.starter, ws);
        return ws;
    });
    registry = new Map();
    shared = {
        reportActivity: vi.fn((game, state) => registry.set(game.ideviceId, { score: null, answered: 0, ...state })),
        updateActivity: vi.fn((game, _data, completed) =>
            registry.set(game.ideviceId, { score: game.scorerp * 10, answered: game.answered, completed }),
        ),
    };
    vi.stubGlobal('exeScorm12', { activities: { get: (id) => registry.get(id) } });
    vi.stubGlobal('$exeDevices', { iDevice: { gamification: { scorm: shared } } });
    vi.stubGlobal('eXeLearning', undefined);
});
afterEach(() => {
    live.splice(0).forEach((player) => player.dispose());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});
describe('Mini Scratch learner lifecycle', () => {
    it('renders safe serializable HTML with Unicode and malicious markup as data', () => {
        const c = defaults();
        c.title = '<img src=x onerror=alert(1)>';
        c.instructions = ']]> " & <script>你好</script>';
        document.body.innerHTML = renderView(c);
        const root = document.querySelector('[data-mini-scratch]');
        expect(root.querySelector('img,script')).toBeNull();
        expect(JSON.parse(decodeURIComponent(root.dataset.miniScratch))).toEqual(c);
        expect(root.textContent).toContain(c.title);
        expect(escapeAttribute('\'&<>"')).toBe('&#39;&amp;&lt;&gt;&quot;');
    });
    it('registers the real wrapper identity with weight, pass mark, and no initial grade', () => {
        const c = defaults();
        c.weight = 30;
        c.pass = 70;
        make(c);
        expect(shared.reportActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                ideviceId: 'activity-0',
                ideviceNumber: 1,
                weighted: 30,
                passScoreCustom: 7,
                isScorm: 2,
            }),
            expect.objectContaining({ total: 1 }),
        );
        expect(shared.updateActivity).not.toHaveBeenCalled();
    });
    it('runs practice without consuming an attempt, then reports on submission once', async () => {
        const player = make();
        load(player, connected());
        await execute(player, false);
        expect(player.root.querySelector('.ms-score').textContent).toContain('Practice score: 100');
        expect(player.root.textContent).toContain('Submit attempt (0)');
        expect(shared.updateActivity).not.toHaveBeenCalled();
        await execute(player, true);
        expect(shared.updateActivity).toHaveBeenCalledTimes(1);
        expect(registry.get('activity-0')).toMatchObject({ score: 100, answered: 1, completed: true });
        await execute(player, true);
        expect(shared.updateActivity).toHaveBeenCalledTimes(1);
        expect(player.root.textContent).toContain('Change your program');
    });
    it('supports revised attempts with partial credit and preserves isolation', async () => {
        const first = make();
        const second = make();
        load(first, connected(1));
        load(second, connected(3));
        await execute(first, true);
        await execute(second, true);
        expect(registry.get('activity-0').score).toBe(50);
        expect(registry.get('activity-1').score).toBe(100);
        load(first, connected(3));
        await execute(first, true);
        expect(registry.get('activity-0')).toMatchObject({ score: 100, answered: 1 });
        expect(registry.get('activity-1').answered).toBe(1);
    });
    it('limits attempts, including errors; Reset never resets the attempt counter', async () => {
        const c = defaults();
        c.maxAttempts = 1;
        const player = make(c);
        await execute(player, true);
        expect(registry.get('activity-0')).toMatchObject({ score: 0, answered: 1 });
        expect(player.root.textContent).toContain('Connect one program');
        player.reset();
        load(player, connected());
        await execute(player, true);
        expect(shared.updateActivity).toHaveBeenCalledTimes(1);
        expect(player.root.textContent).toContain('No attempts remaining');
    });
    it('restores the score but keeps attempt limits scoped to the current page visit', async () => {
        const c = defaults();
        c.maxAttempts = 2;
        const player = make(c);
        registry.set('activity-0', { score: 40, answered: 1 });
        load(player, connected());
        await execute(player, true);
        expect(shared.updateActivity).toHaveBeenCalledOnce();
        expect(player.root.textContent).toContain('Submit attempt (1/2)');
    });
    it('keeps ungraded exploration out of LMS score writes', async () => {
        const c = defaults();
        c.graded = false;
        const player = make(c);
        load(player, connected());
        await execute(player, true);
        expect(shared.reportActivity.mock.calls[0][0].isScorm).toBe(0);
        expect(shared.updateActivity).not.toHaveBeenCalled();
    });
    it.each(['plain-html', 'editor', 'teacher-preview', 'missing-wrapper'])(
        'works without LMS writes in %s',
        async (mode) => {
            if (mode === 'plain-html') vi.stubGlobal('exeScorm12', undefined);
            if (mode === 'editor') vi.stubGlobal('eXeLearning', {});
            if (mode === 'missing-wrapper') {
                const detached = document.createElement('section');
                document.body.append(detached);
                const player = new Player(detached, defaults(), '/media/');
                live.push(player);
                load(player, connected());
                await execute(player, true);
            } else {
                const player = make(defaults(), mode === 'teacher-preview');
                load(player, connected());
                await execute(player, true);
            }
            expect(shared.reportActivity).not.toHaveBeenCalled();
            expect(shared.updateActivity).not.toHaveBeenCalled();
        },
    );
    it('blocks simultaneous runs and cancels a submitted execution safely', async () => {
        const player = make();
        load(player, connected());
        const pending = player.run(true);
        await player.run(true);
        player.root.querySelector('[aria-label="Stop the running program"]').click();
        await vi.runAllTimersAsync();
        await pending;
        expect(shared.updateActivity).toHaveBeenCalledTimes(1);
        expect(registry.get('activity-0').score).toBe(0);
    });
    it('cleans up while running without submitting from a removed player', async () => {
        const player = make();
        load(player, connected());
        const pending = player.run(true);
        const dispose = vi.spyOn(player.workspace, 'dispose');
        player.dispose();
        player.dispose();
        await vi.runAllTimersAsync();
        await pending;
        await player.run(true);
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(shared.updateActivity).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
    it('enforces the wall-clock deadline for waits and restores usable controls', async () => {
        const player = make();
        const p = connected();
        let tail = p.blocks.blocks[0];
        for (let i = 0; i < 4; i++) {
            tail.next = {
                block: { type: 'ms_wait', inputs: { VALUE: { block: { type: 'ms_number', fields: { NUM: 5 } } } } },
            };
            tail = tail.next.block;
        }
        load(player, p);
        await execute(player, true);
        expect(player.root.textContent).toContain('Execution time limit exceeded');
        expect(registry.get('activity-0').score).toBe(0);
        expect(player.root.querySelector('button').disabled).toBe(false);
    });
    it('renders hints and restores the starter via actual controls', async () => {
        const player = make();
        load(player, connected());
        const buttons = Array.from(player.root.querySelectorAll('button'));
        buttons.find((b) => b.textContent === 'Hint').click();
        expect(player.root.textContent).toContain(defaults().hint);
        buttons.find((b) => b.textContent === 'Reset').click();
        expect(player.workspace.getAllBlocks(false)).toHaveLength(1);
        buttons.find((b) => b.textContent === 'Run').click();
        await vi.runAllTimersAsync();
        expect(player.root.textContent).toContain('Connect one program');
    });
});

it('keeps feedback usable if LMS reporting fails', async () => {
    shared.updateActivity.mockImplementation(() => {
        throw new Error('LMS disconnected');
    });
    const c = defaults();
    c.maxAttempts = 1;
    const player = make(c);
    load(player, connected());
    await execute(player, true);
    expect(player.root.textContent).toContain('The LMS score could not be saved. Submit again to retry.');
    expect(player.root.textContent).toContain('Submit attempt (0/1)');
    shared.updateActivity.mockImplementation(() => {});
    await execute(player, true);
    expect(shared.updateActivity).toHaveBeenCalledTimes(2);
    expect(player.root.textContent).toContain('No attempts remaining');
});

it('renders malformed imported configuration as safe feedback', () => {
    document.body.innerHTML = renderView({ version: 999, title: '<script>bad</script>' });
    expect(document.body.textContent).toContain('invalid data');
    expect(document.querySelector('script,[data-mini-scratch]')).toBeNull();
});
