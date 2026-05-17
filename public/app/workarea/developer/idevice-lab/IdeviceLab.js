/**
 * IdeviceLab
 *
 * Top-level controller for the Developer > iDevice Lab page. Coordinates:
 *
 *   - iDevice/sample/theme/export/viewport selection (deterministic URL state)
 *   - Tabbed edition / saved-state / export / roundtrip / SCORM panels
 *   - The save/load roundtrip validator
 *
 * The actual iDevice registry is read from `window.eXeLearning.app.idevices`
 * at runtime so the lab uses the same source as the workarea. When the
 * registry is missing (e.g. during isolated unit tests) the lab falls back
 * to the samples manifest so it still has something selectable.
 */

import {
    parseIdeviceLabState,
    serializeIdeviceLabState,
} from '../shared/DeveloperUrlState.js';
import { ViewportManager } from '../shared/ViewportManager.js';
import { DeveloperStatusReporter, STATUS } from '../shared/DeveloperStatusReporter.js';
import { RoundtripValidator, ROUNDTRIP_STATUS } from '../shared/RoundtripValidator.js';

import samplesManifest from './samples.manifest.json';

export class IdeviceLab {
    constructor({ root, window: win = window, registry = null } = {}) {
        this.root = root;
        this.window = win;
        this.registry = registry ?? readRegistryFromWindow(win);
        this.samples = samplesManifest;
        this.iframe = root?.querySelector('#developer-idevice-lab-export-frame') ?? null;
        this.viewport = new ViewportManager(this.iframe);
        this.reporter = new DeveloperStatusReporter({
            statusEl: root?.querySelector('[data-testid="developer-idevice-lab-status"]'),
            stateEl: root?.querySelector('[data-testid="developer-idevice-lab-state"]'),
        });
        this.state = parseIdeviceLabState(win.location?.search ?? '');
    }

    init() {
        try {
            this.populateIdeviceSelect();
            this.populateSampleSelect();
            this.bindControls();
            this.applyStateToControls();
            this.applyState();
            this.reporter.setStatus(STATUS.READY, 'Ready');
        } catch (err) {
            this.reporter.setError(err);
        }
        return this;
    }

    listIdevices() {
        if (this.registry && Array.isArray(this.registry)) return this.registry;
        // Fallback: derive from the samples manifest so the lab always has
        // something selectable in tests/CI.
        return this.samples.map(entry => ({ id: entry.idevice, label: entry.idevice }));
    }

    listSamplesFor(idevice) {
        const entry = this.samples.find(s => s.idevice === idevice);
        return entry?.samples ?? [];
    }

    populateIdeviceSelect() {
        const select = this.root?.querySelector('[data-testid="developer-idevice-lab-idevice-select"]');
        if (!select) return;
        select.innerHTML = '';
        for (const entry of this.listIdevices()) {
            const opt = this.window.document.createElement('option');
            opt.value = entry.id;
            opt.textContent = entry.label ?? entry.id;
            select.appendChild(opt);
        }
        if (!this.state.idevice && select.options.length > 0) {
            this.state.idevice = select.options[0].value;
        }
        if (this.state.idevice) select.value = this.state.idevice;
    }

    populateSampleSelect() {
        const select = this.root?.querySelector('[data-testid="developer-idevice-lab-sample-select"]');
        if (!select || !this.state.idevice) return;
        select.innerHTML = '';
        const samples = this.listSamplesFor(this.state.idevice);
        if (samples.length === 0) {
            const opt = this.window.document.createElement('option');
            opt.value = '';
            opt.textContent = '(blank instance)';
            select.appendChild(opt);
            this.state.sample = null;
            return;
        }
        for (const sample of samples) {
            const opt = this.window.document.createElement('option');
            opt.value = sample.id;
            opt.textContent = sample.label;
            select.appendChild(opt);
        }
        if (!this.state.sample) this.state.sample = samples[0].id;
        select.value = this.state.sample;
    }

    bindControls() {
        const r = this.root;
        if (!r) return;

        const onChange = (selector, key, after) => {
            const el = r.querySelector(selector);
            if (!el) return;
            el.addEventListener('change', () => {
                this.state[key] = el.value || null;
                if (after) after();
                this.syncUrl();
                this.applyState();
            });
        };

        onChange('[data-testid="developer-idevice-lab-idevice-select"]', 'idevice', () => {
            this.state.sample = null;
            this.populateSampleSelect();
        });
        onChange('[data-testid="developer-idevice-lab-sample-select"]', 'sample');
        onChange('[data-testid="developer-idevice-lab-theme-source-select"]', 'themeSource');
        onChange('[data-testid="developer-idevice-lab-theme-select"]', 'theme');
        onChange('[data-testid="developer-idevice-lab-export-target-select"]', 'export');
        onChange('[data-testid="developer-idevice-lab-viewport-select"]', 'viewport');

        // Tab switching
        r.querySelectorAll('[role="tab"][data-tab]').forEach(tab => {
            tab.addEventListener('click', () => this.activateTab(tab.getAttribute('data-tab')));
        });

        const roundtripBtn = r.querySelector('[data-testid="developer-idevice-lab-run-roundtrip"]');
        if (roundtripBtn) roundtripBtn.addEventListener('click', () => this.runRoundtrip());

        const copyBtn = r.querySelector('[data-testid="developer-idevice-lab-copy-state"]');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copySavedState());
    }

    activateTab(name) {
        const r = this.root;
        if (!r) return;
        r.querySelectorAll('[role="tab"][data-tab]').forEach(tab => {
            tab.setAttribute('aria-selected', String(tab.getAttribute('data-tab') === name));
        });
        r.querySelectorAll('[data-panel]').forEach(panel => {
            const active = panel.getAttribute('data-panel') === name;
            if (active) {
                panel.removeAttribute('hidden');
                panel.classList.add('is-active');
            } else {
                panel.setAttribute('hidden', '');
                panel.classList.remove('is-active');
            }
        });
        this.reporter.setState({ activeTab: name });
    }

    applyStateToControls() {
        const r = this.root;
        if (!r) return;
        const setValue = (selector, value) => {
            const el = r.querySelector(selector);
            if (el && value != null) el.value = value;
        };
        setValue('[data-testid="developer-idevice-lab-idevice-select"]', this.state.idevice);
        setValue('[data-testid="developer-idevice-lab-sample-select"]', this.state.sample);
        setValue('[data-testid="developer-idevice-lab-theme-source-select"]', this.state.themeSource);
        setValue('[data-testid="developer-idevice-lab-theme-select"]', this.state.theme);
        setValue('[data-testid="developer-idevice-lab-export-target-select"]', this.state.export);
        setValue('[data-testid="developer-idevice-lab-viewport-select"]', this.state.viewport);
    }

    applyState() {
        this.viewport.apply(this.state.viewport);
        this.reporter.replaceState({
            idevice: this.state.idevice,
            sample: this.state.sample,
            themeSource: this.state.themeSource,
            theme: this.state.theme,
            export: this.state.export,
            viewport: this.state.viewport,
            status: this.reporter.statusValue,
            roundtrip: { status: ROUNDTRIP_STATUS.IDLE },
        });
    }

    syncUrl() {
        const params = serializeIdeviceLabState(this.state);
        const search = params.toString();
        const next = (this.window.location?.pathname ?? '') + (search ? `?${search}` : '');
        if (this.window.history?.replaceState) {
            this.window.history.replaceState({}, '', next);
        }
    }

    /**
     * Run the save/load roundtrip validator against the current iDevice's
     * sample data. The validator uses an injectable sandbox so the lab does
     * not need iDevice-specific knowledge; consumers can override
     * `createSandboxFor(idevice)` to supply a real sandbox.
     */
    async runRoundtrip() {
        const r = this.root;
        const statusEl = r?.querySelector('[data-testid="developer-idevice-lab-roundtrip-status"]');
        const outputEl = r?.querySelector('#developer-idevice-lab-roundtrip-output');
        if (statusEl) statusEl.setAttribute('data-status', ROUNDTRIP_STATUS.RUNNING);
        this.reporter.setState({ roundtrip: { status: ROUNDTRIP_STATUS.RUNNING } });

        const sandbox = this.createSandboxFor(this.state.idevice);
        const validator = new RoundtripValidator({ sandbox });
        const initialData = this.loadSampleData(this.state.idevice, this.state.sample);
        const result = await validator.run(initialData);

        if (statusEl) statusEl.setAttribute('data-status', result.status);
        if (outputEl) outputEl.textContent = JSON.stringify(result, null, 2);
        this.reporter.setState({
            roundtrip: {
                status: result.status,
                lostFields: result.lostFields ?? [],
                addedFields: result.addedFields ?? [],
                mutatedFields: result.mutatedFields ?? [],
                error: result.error,
            },
        });
        return result;
    }

    /**
     * Default sandbox: pass-through. Real implementations should replace this
     * with one that instantiates the iDevice's edition module, calls
     * loadData/save, and returns the serialized state.
     */
    createSandboxFor(_idevice) {
        return {
            loadAndSave: async data => (data === undefined || data === null ? null : JSON.parse(JSON.stringify(data))),
        };
    }

    /**
     * Default sample loader: return a synthetic shape with the sample id so
     * the validator has something to chew on. Real implementations load
     * the JSON fixture pointed to by the manifest.
     */
    loadSampleData(idevice, sample) {
        if (!idevice) return {};
        if (!sample) return { idevice, _emptySample: true };
        return { idevice, sample, content: 'sample-content' };
    }

    copySavedState() {
        const text = this.root?.querySelector('#developer-idevice-lab-saved-state-content')?.textContent ?? '';
        if (this.window.navigator?.clipboard?.writeText) {
            return this.window.navigator.clipboard.writeText(text).catch(() => undefined);
        }
        return Promise.resolve();
    }
}

function readRegistryFromWindow(win) {
    try {
        const idevices = win?.eXeLearning?.app?.idevices;
        if (!idevices) return null;
        if (Array.isArray(idevices)) return idevices;
        if (typeof idevices.list === 'function') return idevices.list();
        return null;
    } catch {
        return null;
    }
}

export default IdeviceLab;

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const start = () => {
        const root = document.querySelector('[data-testid="developer-idevice-lab-root"]');
        if (root) new IdeviceLab({ root, window }).init();
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
}
