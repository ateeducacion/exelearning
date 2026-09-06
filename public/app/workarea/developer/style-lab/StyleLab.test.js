import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StyleLab } from './StyleLab.js';

function buildDom() {
    document.body.innerHTML = `
        <div data-testid="developer-style-lab-root">
            <select data-testid="developer-style-lab-fixture-select"></select>
            <select data-testid="developer-style-lab-theme-source-select">
                <option value="base">base</option>
                <option value="site">site</option>
                <option value="user">user</option>
            </select>
            <select data-testid="developer-style-lab-theme-select">
                <option value="modern">modern</option>
                <option value="classic">classic</option>
            </select>
            <select data-testid="developer-style-lab-export-target-select">
                <option value="website">website</option>
                <option value="single-page">single-page</option>
                <option value="scorm12">scorm12</option>
            </select>
            <select data-testid="developer-style-lab-viewport-select">
                <option value="desktop">desktop</option>
                <option value="tablet">tablet</option>
                <option value="mobile">mobile</option>
            </select>
            <button data-viewport="desktop" data-testid="developer-style-lab-viewport-desktop">D</button>
            <button data-viewport="tablet" data-testid="developer-style-lab-viewport-tablet">T</button>
            <button data-viewport="mobile" data-testid="developer-style-lab-viewport-mobile">M</button>
            <div data-testid="developer-style-lab-export-options-panel">
                <input type="checkbox" name="search" />
                <input type="checkbox" name="pageCounter" />
                <input type="checkbox" name="navigation" checked />
                <input type="checkbox" name="icons" checked />
                <input type="checkbox" name="collapsible" />
            </div>
            <iframe data-testid="developer-style-lab-preview-frame"></iframe>
            <button data-testid="developer-style-lab-reload-theme">Reload</button>
            <div data-testid="developer-style-lab-status" data-status="initializing">init</div>
            <div data-testid="developer-style-lab-error" hidden></div>
            <script type="application/json" data-testid="developer-style-lab-state">{}</script>
        </div>
    `;
    return document.querySelector('[data-testid="developer-style-lab-root"]');
}

function makeWindow({ search = '' } = {}) {
    const calls = [];
    return {
        location: { pathname: '/developer/style-lab', search },
        history: {
            replaceState(_state, _title, url) {
                calls.push(url);
            },
        },
        document,
        requestAnimationFrame: cb => {
            cb(0);
            return 1;
        },
        __calls: calls,
    };
}

describe('StyleLab', () => {
    let root;
    let win;

    beforeEach(() => {
        root = buildDom();
        win = makeWindow();
    });

    it('populates the fixture select from the manifest', () => {
        new StyleLab({ root, window: win }).init();
        const select = root.querySelector('[data-testid="developer-style-lab-fixture-select"]');
        expect(select.children.length).toBeGreaterThan(0);
        const ids = Array.from(select.options).map(o => o.value);
        expect(ids).toContain('leer-para-aprender');
    });

    it('reports ready status after init', () => {
        new StyleLab({ root, window: win }).init();
        const status = root.querySelector('[data-testid="developer-style-lab-status"]');
        expect(status.getAttribute('data-status')).toBe('ready');
    });

    it('writes machine-readable state', () => {
        new StyleLab({ root, window: win }).init();
        const stateEl = root.querySelector('[data-testid="developer-style-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.export).toBe('website');
        expect(parsed.viewport).toBe('desktop');
        expect(parsed.status).toBe('ready');
        expect(parsed.options).toBeDefined();
    });

    it('restores state from URL parameters', () => {
        win = makeWindow({ search: '?viewport=mobile&export=scorm12&fixture=basic-content' });
        new StyleLab({ root, window: win }).init();
        const stateEl = root.querySelector('[data-testid="developer-style-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.viewport).toBe('mobile');
        expect(parsed.export).toBe('scorm12');
        expect(parsed.fixture).toBe('basic-content');
    });

    it('updates URL when viewport quick button is clicked', () => {
        new StyleLab({ root, window: win }).init();
        const mobileBtn = root.querySelector('[data-testid="developer-style-lab-viewport-mobile"]');
        mobileBtn.click();
        expect(win.__calls.length).toBeGreaterThan(0);
        const lastUrl = win.__calls[win.__calls.length - 1];
        expect(lastUrl).toContain('viewport=mobile');
    });

    it('updates viewport on iframe when changed', () => {
        new StyleLab({ root, window: win }).init();
        const tabletBtn = root.querySelector('[data-testid="developer-style-lab-viewport-tablet"]');
        tabletBtn.click();
        const iframe = root.querySelector('[data-testid="developer-style-lab-preview-frame"]');
        expect(iframe.getAttribute('data-viewport')).toBe('tablet');
    });

    it('updates URL when export target changes via select', () => {
        new StyleLab({ root, window: win }).init();
        const exportSel = root.querySelector('[data-testid="developer-style-lab-export-target-select"]');
        exportSel.value = 'scorm12';
        exportSel.dispatchEvent(new Event('change', { bubbles: true }));
        const lastUrl = win.__calls[win.__calls.length - 1];
        expect(lastUrl).toContain('export=scorm12');
    });

    it('falls back gracefully when fixture URL parameter is unknown', () => {
        win = makeWindow({ search: '?fixture=does-not-exist' });
        new StyleLab({ root, window: win }).init();
        const stateEl = root.querySelector('[data-testid="developer-style-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.fixture).toBe('leer-para-aprender');
    });

    it('reload-from-disk action moves status through loading -> ready', () => {
        const lab = new StyleLab({ root, window: win }).init();
        const reloadBtn = root.querySelector('[data-testid="developer-style-lab-reload-theme"]');
        reloadBtn.click();
        const stateEl = root.querySelector('[data-testid="developer-style-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.status).toBe('ready');
        expect(typeof parsed.reloadToken).toBe('number');
        expect(typeof parsed.reloadedAt).toBe('string');
        // Sanity: lab has presets exposed
        expect(lab.presets).toContain('all');
    });

    it('updates options when a checkbox is toggled', () => {
        new StyleLab({ root, window: win }).init();
        const cb = root.querySelector('[data-testid="developer-style-lab-export-options-panel"] input[name="search"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        const stateEl = root.querySelector('[data-testid="developer-style-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.options.search).toBe(true);
    });

    it('reports an error when init fails', () => {
        // Force the populate step to throw by giving an invalid window.document
        const brokenWin = { ...win, document: null };
        // Mock the fixture select to throw on appendChild
        const select = root.querySelector('[data-testid="developer-style-lab-fixture-select"]');
        vi.spyOn(select, 'appendChild').mockImplementation(() => {
            throw new Error('append failed');
        });
        const lab = new StyleLab({ root, window: brokenWin });
        lab.init();
        const status = root.querySelector('[data-testid="developer-style-lab-status"]');
        expect(status.getAttribute('data-status')).toBe('error');
    });
});
