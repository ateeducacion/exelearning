/**
 * DeveloperStatusReporter
 *
 * Centralizes how developer-tool labs surface their state to:
 *
 *   1. The user      — via a status DOM node
 *   2. Playwright    — via `data-status` attributes
 *   3. AI agents     — via a JSON state element they can read with one
 *                      `evaluate` call
 *
 * The reporter is deliberately small: any lab that wants "machine readable
 * status" can wrap a status node + a state node and forget about the wiring.
 */

export const STATUS = Object.freeze({
    INITIALIZING: 'initializing',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
});

export class DeveloperStatusReporter {
    constructor({ statusEl = null, errorEl = null, stateEl = null } = {}) {
        this.statusEl = statusEl;
        this.errorEl = errorEl;
        this.stateEl = stateEl;
        this.state = {};
        this.statusValue = STATUS.INITIALIZING;
    }

    /**
     * Update the machine-readable state payload (merged shallowly).
     * Also re-renders the JSON state element if attached.
     */
    setState(patch) {
        if (patch && typeof patch === 'object') {
            this.state = { ...this.state, ...patch };
        }
        this.#renderState();
        return this.state;
    }

    /**
     * Replace the entire state payload.
     */
    replaceState(next) {
        this.state = next && typeof next === 'object' ? { ...next } : {};
        this.#renderState();
        return this.state;
    }

    /**
     * Set the human-visible status text and the data-status attribute.
     */
    setStatus(value, message) {
        this.statusValue = value;
        if (this.statusEl) {
            this.statusEl.setAttribute('data-status', value);
            if (typeof message === 'string') this.statusEl.textContent = message;
        }
        this.setState({ status: value });
    }

    /**
     * Display an error message and switch status to "error".
     */
    setError(message) {
        const text = typeof message === 'string' ? message : (message?.message ?? 'Unknown error');
        this.setStatus(STATUS.ERROR, text);
        if (this.errorEl) {
            this.errorEl.hidden = false;
            this.errorEl.textContent = text;
        }
        this.setState({ error: text });
    }

    /**
     * Clear an error and switch status back to "ready".
     */
    clearError() {
        if (this.errorEl) {
            this.errorEl.hidden = true;
            this.errorEl.textContent = '';
        }
        const next = { ...this.state };
        delete next.error;
        this.replaceState(next);
    }

    getState() {
        return { ...this.state };
    }

    #renderState() {
        if (this.stateEl) {
            try {
                this.stateEl.textContent = JSON.stringify(this.state);
            } catch {
                this.stateEl.textContent = '{}';
            }
        }
    }
}

export default DeveloperStatusReporter;
