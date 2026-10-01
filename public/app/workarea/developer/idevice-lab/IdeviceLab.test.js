import { describe, it, expect, beforeEach } from 'vitest';
import { IdeviceLab } from './IdeviceLab.js';

function buildDom() {
    document.body.innerHTML = `
        <div data-testid="developer-idevice-lab-root">
            <select data-testid="developer-idevice-lab-idevice-select"></select>
            <select data-testid="developer-idevice-lab-sample-select"></select>
            <select data-testid="developer-idevice-lab-theme-source-select">
                <option value="base">base</option>
            </select>
            <select data-testid="developer-idevice-lab-theme-select">
                <option value="modern">modern</option>
            </select>
            <select data-testid="developer-idevice-lab-export-target-select">
                <option value="website">website</option>
                <option value="scorm12">scorm12</option>
            </select>
            <select data-testid="developer-idevice-lab-viewport-select">
                <option value="desktop">desktop</option>
                <option value="tablet">tablet</option>
                <option value="mobile">mobile</option>
            </select>
            <button role="tab" data-tab="edition" data-testid="developer-idevice-lab-tab-edition" aria-selected="true"></button>
            <button role="tab" data-tab="saved" data-testid="developer-idevice-lab-tab-saved" aria-selected="false"></button>
            <button role="tab" data-tab="export" data-testid="developer-idevice-lab-tab-export" aria-selected="false"></button>
            <button role="tab" data-tab="roundtrip" data-testid="developer-idevice-lab-tab-roundtrip" aria-selected="false"></button>
            <div role="tabpanel" data-panel="edition"></div>
            <div role="tabpanel" data-panel="saved" hidden></div>
            <div role="tabpanel" data-panel="export" hidden>
                <iframe id="developer-idevice-lab-export-frame"></iframe>
            </div>
            <div role="tabpanel" data-panel="roundtrip" hidden>
                <div data-testid="developer-idevice-lab-roundtrip-status" data-status="idle"></div>
                <pre id="developer-idevice-lab-roundtrip-output"></pre>
            </div>
            <button data-testid="developer-idevice-lab-run-roundtrip">Run</button>
            <button data-testid="developer-idevice-lab-copy-state">Copy</button>
            <pre id="developer-idevice-lab-saved-state-content">{"hello":"world"}</pre>
            <div data-testid="developer-idevice-lab-status" data-status="initializing"></div>
            <script type="application/json" data-testid="developer-idevice-lab-state">{}</script>
        </div>
    `;
    return document.querySelector('[data-testid="developer-idevice-lab-root"]');
}

function makeWindow({ search = '' } = {}) {
    const calls = [];
    return {
        location: { pathname: '/developer/idevice-lab', search },
        history: { replaceState(_s, _t, url) { calls.push(url); } },
        document,
        navigator: { clipboard: { writeText: () => Promise.resolve() } },
        __calls: calls,
    };
}

describe('IdeviceLab', () => {
    let root;
    let win;

    beforeEach(() => {
        root = buildDom();
        win = makeWindow();
    });

    it('populates the iDevice select from the registry when supplied', () => {
        const registry = [
            { id: 'rubric', label: 'Rubric' },
            { id: 'checklist', label: 'Checklist' },
        ];
        new IdeviceLab({ root, window: win, registry }).init();
        const select = root.querySelector('[data-testid="developer-idevice-lab-idevice-select"]');
        expect(Array.from(select.options).map(o => o.value)).toEqual(['rubric', 'checklist']);
    });

    it('falls back to the samples manifest when no registry is available', () => {
        new IdeviceLab({ root, window: win }).init();
        const select = root.querySelector('[data-testid="developer-idevice-lab-idevice-select"]');
        const ids = Array.from(select.options).map(o => o.value);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids).toContain('rubric');
    });

    it('reports ready status after init', () => {
        new IdeviceLab({ root, window: win }).init();
        const status = root.querySelector('[data-testid="developer-idevice-lab-status"]');
        expect(status.getAttribute('data-status')).toBe('ready');
    });

    it('writes machine-readable state', () => {
        new IdeviceLab({ root, window: win }).init();
        const stateEl = root.querySelector('[data-testid="developer-idevice-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.export).toBe('website');
        expect(parsed.viewport).toBe('desktop');
        expect(parsed.status).toBe('ready');
        expect(parsed.idevice).toBeDefined();
    });

    it('restores state from URL parameters', () => {
        win = makeWindow({ search: '?idevice=rubric&sample=basic-score&export=scorm12&viewport=mobile' });
        new IdeviceLab({ root, window: win }).init();
        const stateEl = root.querySelector('[data-testid="developer-idevice-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.idevice).toBe('rubric');
        expect(parsed.sample).toBe('basic-score');
        expect(parsed.export).toBe('scorm12');
        expect(parsed.viewport).toBe('mobile');
    });

    it('switches tabs when a tab button is clicked', () => {
        new IdeviceLab({ root, window: win }).init();
        const tab = root.querySelector('[data-testid="developer-idevice-lab-tab-saved"]');
        tab.click();
        expect(tab.getAttribute('aria-selected')).toBe('true');
        const editionTab = root.querySelector('[data-testid="developer-idevice-lab-tab-edition"]');
        expect(editionTab.getAttribute('aria-selected')).toBe('false');
        const editionPanel = root.querySelector('[data-panel="edition"]');
        expect(editionPanel.hasAttribute('hidden')).toBe(true);
        const savedPanel = root.querySelector('[data-panel="saved"]');
        expect(savedPanel.hasAttribute('hidden')).toBe(false);
    });

    it('runs the roundtrip validator and reports status', async () => {
        const lab = new IdeviceLab({ root, window: win }).init();
        const result = await lab.runRoundtrip();
        expect(result.status).toBe('passed');
        const statusEl = root.querySelector('[data-testid="developer-idevice-lab-roundtrip-status"]');
        expect(statusEl.getAttribute('data-status')).toBe('passed');
        const stateEl = root.querySelector('[data-testid="developer-idevice-lab-state"]');
        const parsed = JSON.parse(stateEl.textContent);
        expect(parsed.roundtrip.status).toBe('passed');
    });

    it('reports failed roundtrip status when sandbox drops fields', async () => {
        const lab = new IdeviceLab({ root, window: win }).init();
        let call = 0;
        lab.createSandboxFor = () => ({
            loadAndSave: data => {
                call += 1;
                if (call === 1) return { ...data };
                const clone = { ...data };
                delete clone.sample;
                return clone;
            },
        });
        const result = await lab.runRoundtrip();
        expect(result.status).toBe('failed');
        expect(result.lostFields).toContain('sample');
    });

    it('falls back to a blank instance when no sample exists for the idevice', () => {
        const registry = [{ id: 'unknown-idevice', label: 'unknown' }];
        new IdeviceLab({ root, window: win, registry }).init();
        const sampleSelect = root.querySelector('[data-testid="developer-idevice-lab-sample-select"]');
        expect(Array.from(sampleSelect.options).map(o => o.textContent)).toContain('(blank instance)');
    });

    it('updates URL when an iDevice is selected', () => {
        const registry = [
            { id: 'rubric', label: 'Rubric' },
            { id: 'checklist', label: 'Checklist' },
        ];
        new IdeviceLab({ root, window: win, registry }).init();
        const select = root.querySelector('[data-testid="developer-idevice-lab-idevice-select"]');
        select.value = 'checklist';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(win.__calls[win.__calls.length - 1]).toContain('idevice=checklist');
    });

    it('reads registry from window.eXeLearning.app.idevices when available', () => {
        const winWithRegistry = makeWindow();
        winWithRegistry.eXeLearning = { app: { idevices: [{ id: 'rubric', label: 'R' }] } };
        new IdeviceLab({ root, window: winWithRegistry }).init();
        const select = root.querySelector('[data-testid="developer-idevice-lab-idevice-select"]');
        expect(Array.from(select.options).map(o => o.value)).toEqual(['rubric']);
    });

    it('reads registry from window.eXeLearning.app.idevices.list() when present', () => {
        const winWithRegistry = makeWindow();
        winWithRegistry.eXeLearning = {
            app: { idevices: { list: () => [{ id: 'text', label: 'Text' }] } },
        };
        new IdeviceLab({ root, window: winWithRegistry }).init();
        const select = root.querySelector('[data-testid="developer-idevice-lab-idevice-select"]');
        expect(Array.from(select.options).map(o => o.value)).toEqual(['text']);
    });
});
