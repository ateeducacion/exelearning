import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const nativeTabs = require('../../../../../../app/common/common_edition.js').iDevice.tabs;
import { defaults } from './model';
globalThis.Blockly = Blockly;
const Blocks = await import('./blocks');
const Runtime = await import('./player');
let lastWorkspace;
const fakeInject = (_root, c) => {
    const ws = new Blockly.Workspace();
    ws.updateToolbox = vi.fn();
    Blockly.serialization.workspaces.load(c.starter, ws);
    lastWorkspace = ws;
    return ws;
};
const svgResize = vi.fn();
globalThis.$blockprogramming = {
    authoring: { ...Blocks, ...Runtime, Blockly: { ...Blockly, svgResize }, inject: fakeInject, media: '/media/' },
};
const { Editor } = await import('./editor');
let editor;
let root;
beforeAll(() => Blocks.registerBlocks());
beforeEach(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        },
    );
    vi.spyOn(Blocks, 'inject').mockImplementation(fakeInject);
    svgResize.mockClear();
    vi.stubGlobal('$exeDevicesEdition', { iDevice: { tabs: nativeTabs } });
    root = document.createElement('div');
    document.body.replaceChildren(root);
});
afterEach(() => {
    editor?.dispose();
    editor = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
const field = (name) => root.querySelector(`[data-field="${name}"]`);
const click = (text) =>
    Array.from(root.querySelectorAll('button'))
        .find((b) => b.textContent === text)
        .click();
describe('Block Programming teacher forms', () => {
    it('uses native iDevice tabs with linked accessible panels and keyboard navigation', () => {
        editor = new Editor(root, {}, '/media/');
        const tabs = root.querySelectorAll('[role="tab"]');
        const panels = root.querySelectorAll('[role="tabpanel"]');
        expect(Array.from(tabs, (tab) => tab.textContent)).toEqual([
            'Activity',
            'Programming',
            'Assessment',
            'Preview',
        ]);
        expect(tabs[0].getAttribute('aria-selected')).toBe('true');
        expect(panels[0].hidden).toBe(false);
        expect(panels[1].hidden).toBe(true);
        tabs.forEach((tab, i) => {
            expect(tab.getAttribute('aria-controls')).toBe(panels[i].id);
            expect(panels[i].getAttribute('aria-labelledby')).toBe(tab.id);
        });
        tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(document.activeElement).toBe(tabs[1]);
        expect(tabs[1].tabIndex).toBe(0);
        expect(panels[1].hidden).toBe(false);
        expect(svgResize).toHaveBeenCalledWith(lastWorkspace);
        tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        expect(document.activeElement).toBe(tabs[3]);
        expect(root.querySelector('.ms-activity')).not.toBeNull();
        tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        expect(document.activeElement).toBe(tabs[0]);
        expect(root.querySelector('.ms-activity')).toBeNull();
        tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(document.activeElement).toBe(tabs[3]);
        tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(tabs[3].getAttribute('aria-selected')).toBe('true');
        tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(tabs[3].getAttribute('aria-selected')).toBe('true');
    });
    it('keeps unsaved fields and starter blocks while moving between tabs', () => {
        editor = new Editor(root, {}, '/media/');
        const tabs = root.querySelectorAll('[role="tab"]');
        field('title').value = 'Unsaved task';
        field('targetX').value = '8';
        const before = editor.save();
        tabs[1].click();
        tabs[2].click();
        tabs[3].click();
        expect(root.querySelector('.ms-activity h3').textContent).toBe('Unsaved task');
        tabs[0].click();
        expect(editor.save()).toEqual(before);
        expect(field('title').labels[0].textContent).toBe('Activity title');
        expect(field('graded').labels[0].textContent).toBe('Report grade to SCORM 1.2');
        expect(root.querySelector('details').open).toBe(false);
        const resize = svgResize.mock.calls.length;
        editor.dispose();
        tabs[1].click();
        expect(svgResize).toHaveBeenCalledTimes(resize);
    });
    it('isolates tab and field identifiers across two editors', () => {
        editor = new Editor(root, {}, '/media/');
        const secondRoot = document.createElement('div');
        document.body.append(secondRoot);
        const second = new Editor(secondRoot, {}, '/media/');
        try {
            const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
            expect(new Set(ids).size).toBe(ids.length);
            secondRoot.querySelectorAll('[role="tab"]')[2].click();
            expect(root.querySelector('[role="tab"]').getAttribute('aria-selected')).toBe('true');
            expect(secondRoot.querySelectorAll('[role="tabpanel"]')[2].hidden).toBe(false);
        } finally {
            second.dispose();
        }
    });
    it('follows reading direction when navigating tabs', () => {
        editor = new Editor(root, {}, '/media/');
        root.querySelector('[role="tablist"]').style.direction = 'rtl';
        const tabs = root.querySelectorAll('[role="tab"]');
        tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        expect(document.activeElement).toBe(tabs[3]);
        tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(document.activeElement).toBe(tabs[0]);
    });
    it('clears a stale preview when a changed configuration is invalid', () => {
        editor = new Editor(root, {}, '/media/');
        const tab = root.querySelectorAll('[role="tab"]')[3];
        tab.click();
        expect(root.querySelector('.ms-activity')).not.toBeNull();
        field('variable').value = 'invalid name';
        click('Preview activity');
        expect(root.querySelector('.ms-activity')).toBeNull();
        expect(root.querySelector('[role="status"]').textContent).toContain('Use a variable name');
    });
    it.each(['destination', 'sequence', 'calculation'])(
        'reopens every stored field and starter for %s',
        (challenge) => {
            const c = defaults(challenge);
            c.title = 'My task';
            c.instructions = 'Unicode 🐢 <img>';
            c.objective = '';
            c.hint = '';
            c.success = 'Yes';
            c.retry = 'Keep trying';
            c.startX = -2;
            c.startY = 4;
            c.targetX = 9;
            c.targetY = 7;
            c.expected = 37;
            c.variable = 'sum';
            c.graded = false;
            c.maxAttempts = 3;
            c.pass = 70;
            c.weight = 20;
            editor = new Editor(root, JSON.parse(JSON.stringify(c)), '/media/');
            expect(editor.save()).toEqual(c);
            expect(root.querySelector('img')).toBeNull();
        },
    );
    it('creates sensible defaults without requiring JSON or source', () => {
        editor = new Editor(root, {}, '/media/');
        expect(editor.save()).toEqual(defaults());
        field('title').value = 'Changed';
        field('maxAttempts').value = '4';
        field('pass').value = '80';
        field('graded').checked = false;
        expect(editor.save()).toMatchObject({ title: 'Changed', maxAttempts: 4, pass: 80, graded: false });
    });
    it('switches assessment forms and persists sequence actions including edits and ordering', () => {
        editor = new Editor(root, {}, '/media/');
        field('challenge').value = 'sequence';
        field('challenge').dispatchEvent(new Event('change'));
        click('Add action');
        const rows = root.querySelectorAll('.ms-sequence-row');
        const last = rows[3];
        last.querySelector('select').value = 'position';
        last.querySelector('select').dispatchEvent(new Event('change'));
        const values = last.children[1].querySelectorAll('input');
        values[0].value = '4';
        values[1].value = '2';
        Array.from(last.querySelectorAll('button'))
            .find((b) => b.textContent === 'Move action up')
            .click();
        expect(editor.save().sequence[2]).toEqual({ action: 'position', value: '4,2' });
        click('Remove action');
        expect(editor.save().sequence).toHaveLength(3);
    });
    it('provides understandable turn, visibility and message controls', () => {
        editor = new Editor(root, {}, '/media/');
        const row = root.querySelector('.ms-sequence-row');
        const select = row.querySelector('select');
        for (const [type, value] of [
            ['turn', 'right'],
            ['visible', 'true'],
            ['say', 'Hello'],
            ['move', '1'],
        ]) {
            select.value = type;
            select.dispatchEvent(new Event('change'));
            expect(editor.save().sequence[0]).toEqual({ action: type, value });
        }
        row.querySelector('button').click();
        expect(editor.save().sequence).toHaveLength(3);
    });
    it('updates the student toolbox and refuses a disallowed starter block', () => {
        editor = new Editor(root, {}, '/media/');
        const control = field('block-move');
        control.checked = false;
        control.dispatchEvent(new Event('change'));
        expect(lastWorkspace.updateToolbox).toHaveBeenCalled();
        expect(editor.save().allowed).not.toContain('move');
        const b = lastWorkspace.newBlock('ms_move');
        expect(() => editor.save()).toThrow('not allowed');
        b.dispose();
        expect(field('block-start').disabled).toBe(true);
    });
    it('loads all three examples and releases prior workspaces', () => {
        editor = new Editor(root, {}, '/media/');
        const first = lastWorkspace;
        const dispose = vi.spyOn(first, 'dispose');
        field('example').value = 'calculation';
        click('Load example (replaces this form)');
        expect(dispose).toHaveBeenCalledOnce();
        expect(editor.save()).toEqual(defaults('calculation'));
        field('example').value = 'sequence';
        click('Load example (replaces this form)');
        expect(editor.save()).toEqual(defaults('sequence'));
    });
    it('previews the exact saved activity and closes preview without changing the starter', () => {
        editor = new Editor(root, {}, '/media/');
        const before = editor.save();
        click('Preview activity');
        expect(root.querySelector('.ms-activity h3').textContent).toBe('Block Programming');
        click('Preview activity');
        click('Close preview');
        expect(root.querySelector('.ms-activity h3')).toBeNull();
        expect(editor.save()).toEqual(before);
    });
    it('shows validation errors in preview and refuses malformed imported activities', () => {
        editor = new Editor(root, {}, '/media/');
        field('variable').value = 'bad variable';
        click('Preview activity');
        expect(root.textContent).toContain('Use a variable name');
        expect(() => new Editor(document.createElement('div'), { version: 2 }, '/media/')).toThrow('version');
    });
    it('caps authored action lists at thirty', () => {
        editor = new Editor(root, {}, '/media/');
        for (let i = 0; i < 35; i++) click('Add action');
        expect(editor.save().sequence).toHaveLength(30);
    });
});
it('owns the native edition instance and reports validation failures through the application alert', async () => {
    vi.stubGlobal('$blockprogramming', { authoring: { ...Blocks, ...Runtime, inject: fakeInject, media: '/media/' } });
    const alert = vi.fn();
    vi.stubGlobal('eXe', { app: { alert } });
    vi.stubGlobal('_', (s) => s);
    await import('./edition');
    const device = globalThis.$exeDevice;
    const own = vi.fn();
    device.$lifecycle = { own };
    device.init(root, {});
    editor = device.editor;
    expect(own).toHaveBeenCalledWith(editor, 'dispose');
    expect(device.save()).toEqual(defaults());
    field('variable').value = 'invalid name';
    expect(device.save()).toBe(false);
    expect(alert).toHaveBeenCalledOnce();
    device.init(root, { version: 999 });
    expect(root.textContent).toContain('Original data is preserved');
    expect(device.save()).toBe(false);
    expect(alert).toHaveBeenCalledTimes(2);
});
