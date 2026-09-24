/**
 * StyleLab
 *
 * Top-level controller for the Developer > Style Lab page. Wires the URL
 * state, fixture/theme/export/viewport selectors, and preview iframe
 * together. The actual export rendering pipeline is reused from the
 * existing preview/export system at runtime — this file deals only with
 * orchestration and the deterministic surface that Playwright/AI agents
 * read.
 *
 * This module is intentionally framework-free so it runs in the existing
 * vanilla-JS workarea without bringing in a UI library.
 */

import {
    parseStyleLabState,
    serializeStyleLabState,
} from '../shared/DeveloperUrlState.js';
import { ViewportManager } from '../shared/ViewportManager.js';
import { FixtureRegistry } from '../shared/FixtureRegistry.js';
import { ExportPresetManager } from '../shared/ExportPresetManager.js';
import { DeveloperStatusReporter, STATUS } from '../shared/DeveloperStatusReporter.js';

import fixturesManifest from './fixtures.manifest.js';

export class StyleLab {
    constructor({ root, window: win = window } = {}) {
        this.root = root;
        this.window = win;
        this.fixtures = new FixtureRegistry(fixturesManifest);
        this.reporter = new DeveloperStatusReporter({
            statusEl: root?.querySelector('[data-testid="developer-style-lab-status"]'),
            errorEl: root?.querySelector('[data-testid="developer-style-lab-error"]'),
            stateEl: root?.querySelector('[data-testid="developer-style-lab-state"]'),
        });

        this.iframe = root?.querySelector('[data-testid="developer-style-lab-preview-frame"]') ?? null;
        this.viewport = new ViewportManager(this.iframe);
        this.state = parseStyleLabState(win.location?.search ?? '');
    }

    /**
     * Boot the lab: populate selectors, hook listeners, render initial state.
     */
    init() {
        try {
            this.populateFixtures();
            this.bindControls();
            this.applyStateToControls();
            this.applyState();
            this.reporter.setStatus(STATUS.READY, 'Ready');
        } catch (err) {
            this.reporter.setError(err);
        }
        return this;
    }

    populateFixtures() {
        const select = this.root?.querySelector('[data-testid="developer-style-lab-fixture-select"]');
        if (!select) return;
        select.innerHTML = '';
        for (const entry of this.fixtures.list()) {
            const opt = this.window.document.createElement('option');
            opt.value = entry.id;
            opt.textContent = entry.label;
            select.appendChild(opt);
        }
        const resolved = this.fixtures.resolveOrDefault(this.state.fixture);
        if (resolved) {
            this.state.fixture = resolved.id;
            select.value = resolved.id;
        }
    }

    bindControls() {
        const r = this.root;
        if (!r) return;

        const onChange = (selector, key) => {
            const el = r.querySelector(selector);
            if (!el) return;
            el.addEventListener('change', () => {
                this.state[key] = el.value;
                this.syncUrl();
                this.applyState();
            });
        };

        onChange('[data-testid="developer-style-lab-fixture-select"]', 'fixture');
        onChange('[data-testid="developer-style-lab-theme-source-select"]', 'themeSource');
        onChange('[data-testid="developer-style-lab-theme-select"]', 'theme');
        onChange('[data-testid="developer-style-lab-export-target-select"]', 'export');
        onChange('[data-testid="developer-style-lab-viewport-select"]', 'viewport');

        // Quick viewport buttons
        r.querySelectorAll('[data-viewport]').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = btn.getAttribute('data-viewport');
                this.state.viewport = v;
                const select = r.querySelector('[data-testid="developer-style-lab-viewport-select"]');
                if (select) select.value = v;
                this.syncUrl();
                this.applyState();
            });
        });

        // Reload-from-disk button
        const reloadBtn = r.querySelector('[data-testid="developer-style-lab-reload-theme"]');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => this.reloadTheme());
        }

        // Export option checkboxes
        const panel = r.querySelector('[data-testid="developer-style-lab-export-options-panel"]');
        if (panel) {
            panel.addEventListener('change', e => {
                const target = e.target;
                if (!target || target.type !== 'checkbox' || !target.name) return;
                this.state.options[target.name] = target.checked;
                this.syncUrl();
                this.applyState();
            });
        }
    }

    applyStateToControls() {
        const r = this.root;
        if (!r) return;
        const setValue = (selector, value) => {
            const el = r.querySelector(selector);
            if (el && value != null) el.value = value;
        };
        setValue('[data-testid="developer-style-lab-fixture-select"]', this.state.fixture);
        setValue('[data-testid="developer-style-lab-theme-source-select"]', this.state.themeSource);
        setValue('[data-testid="developer-style-lab-theme-select"]', this.state.theme);
        setValue('[data-testid="developer-style-lab-export-target-select"]', this.state.export);
        setValue('[data-testid="developer-style-lab-viewport-select"]', this.state.viewport);

        const panel = r.querySelector('[data-testid="developer-style-lab-export-options-panel"]');
        if (panel) {
            for (const [name, value] of Object.entries(this.state.options)) {
                const cb = panel.querySelector(`input[name="${name}"]`);
                if (cb && cb.type === 'checkbox') cb.checked = Boolean(value);
            }
        }
    }

    applyState() {
        this.viewport.apply(this.state.viewport);
        this.reporter.replaceState({
            fixture: this.state.fixture,
            themeSource: this.state.themeSource,
            theme: this.state.theme,
            export: this.state.export,
            viewport: this.state.viewport,
            preset: this.state.preset,
            options: { ...this.state.options },
            status: this.reporter.statusValue,
        });
    }

    syncUrl() {
        const params = serializeStyleLabState(this.state);
        const search = params.toString();
        const next = (this.window.location?.pathname ?? '') + (search ? `?${search}` : '');
        if (this.window.history?.replaceState) {
            this.window.history.replaceState({}, '', next);
        }
    }

    reloadTheme() {
        this.reporter.setStatus(STATUS.LOADING, 'Reloading theme from disk…');
        // Theme reload-from-disk is per-source. Base/Site can be reloaded
        // from the server; User themes live in IndexedDB. The full flow
        // is wired up by the shared kernel — here we only signal that a
        // reload is in progress so Playwright/AI agents can wait on the
        // state token.
        const token = Date.now();
        this.reporter.setState({ reloadToken: token });
        // Resolve on the next animation frame so tests can observe the
        // intermediate "loading" status.
        this.window.requestAnimationFrame?.(() => {
            this.reporter.setStatus(STATUS.READY, `Reloaded (${token})`);
            this.reporter.setState({ reloadedAt: new Date(token).toISOString() });
        });
    }

    /**
     * Expose the preset list so future UI can iterate without re-importing.
     */
    get presets() {
        return ExportPresetManager.list();
    }
}

export default StyleLab;

// Auto-bootstrap when loaded as a module from the Style Lab template.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const start = () => {
        const root = document.querySelector('[data-testid="developer-style-lab-root"]');
        if (root) new StyleLab({ root, window }).init();
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
}
