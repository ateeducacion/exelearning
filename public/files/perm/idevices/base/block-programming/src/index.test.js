import { it, expect, vi } from 'vitest';
import * as Blockly from 'blockly/core';
globalThis.Blockly = Blockly;
const disposed = [];
vi.mock('./player', () => ({
    Player: class {
        constructor(root, data) {
            if (data.bad) throw new Error('Invalid imported activity.');
            this.root = root;
            root.dataset.mounted = 'true';
        }
        dispose() {
            disposed.push(this.root);
        }
    },
    renderView: (data) => JSON.stringify(data),
    node: vi.fn(),
    button: vi.fn(),
}));
it('initializes once, isolates players, reports invalid data and disposes detached players', async () => {
    document.body.innerHTML =
        '<section data-block-programming="%7B%7D"></section><section data-block-programming="%7B%7D"></section><section data-block-programming="%7B%22bad%22%3Atrue%7D"></section><div class="ms-author"><section data-block-programming="%7B%7D"></section></div>';
    const script = document.createElement('script');
    script.src = 'https://offline.test/nested/idevices/block-programming/block-programming.js';
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    vi.stubGlobal('$blockprogramming', undefined);
    await import('./index');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const api = globalThis.$blockprogramming;
    expect(api.authoring.media).toBe('https://offline.test/nested/idevices/block-programming/media/');
    expect(document.querySelectorAll('[data-mounted]')).toHaveLength(2);
    expect(document.body.textContent).toContain('Invalid imported activity.');
    api.init();
    api.renderBehaviour();
    expect(document.querySelectorAll('[data-mounted]')).toHaveLength(2);
    document.querySelector('[data-mounted]').remove();
    await vi.waitFor(() => expect(disposed).toHaveLength(1));
    document.querySelector('[data-mounted]').remove();
    await vi.waitFor(() => expect(disposed).toHaveLength(2));
    document.body.innerHTML = '<section data-block-programming="%7B%7D"></section>';
    api.init();
    expect(document.querySelector('[data-mounted]')).not.toBeNull();
    document.body.replaceChildren();
    await vi.waitFor(() => expect(disposed).toHaveLength(3));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
