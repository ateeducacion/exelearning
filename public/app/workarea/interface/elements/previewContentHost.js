/**
 * PreviewContentHost
 *
 * Workarea side of the preview transport used in content domain mode
 * (EXE_CONTENT_DOMAIN). The preview iframe then shows a small host page on a
 * per-project content origin (previewHostPage.js); the workarea cannot reach
 * into that document, so everything goes through messages:
 *
 *   workarea  <--exe-preview-host-ready + MessagePort--  host page
 *   workarea  --SET_CONTENT / VERIFY_READY / GET_STATUS / NAVIGATE-->  host page  -->  its Service Worker
 *   workarea  <--replies, CONTENT_NEEDED, exe-download-elpx--  host page
 *
 * A window message is accepted only when `event.source` is the preview iframe's
 * window and `event.origin` is the content origin the server gave for the open
 * project. The client never computes that origin.
 *
 * The iframe is one of the panel's, or the one in the tab the preview was opened
 * in (`win` is then that tab, an empty page of this origin).
 */
export default class PreviewContentHost {
    /** How long to wait for the host page to become ready, or to answer a request (ms). */
    static TIMEOUT = 15000;

    /**
     * @param {Object} options
     * @param {string} options.hostUrl - Host page URL provided by the server
     * @param {HTMLIFrameElement} options.iframe - Preview iframe that shows the host page
     * @param {(message: Object) => void} [options.onMessage] - Unsolicited messages from the host page
     * @param {Window} [options.win] - Window that embeds the iframe
     */
    constructor({ hostUrl, iframe, onMessage = () => {}, win = window }) {
        this.hostUrl = hostUrl;
        this.origin = new URL(hostUrl).origin;
        this.iframe = iframe;
        this.onMessage = onMessage;
        this.win = win;

        this._port = null;
        this._connecting = null;
        this._settleConnecting = null;
        this._pending = new Map();
        this._nextId = 1;

        this._onWindowMessage = (event) => this._handleWindowMessage(event);
        this.win.addEventListener('message', this._onWindowMessage);
    }

    /**
     * Load the host page in the iframe (if needed) and wait until it accepted the channel.
     * @returns {Promise<void>}
     */
    connect() {
        if (this._port) return Promise.resolve();
        if (this._connecting) return this._connecting;

        this._connecting = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._settleConnecting = null;
                this._connecting = null;
                reject(new Error('The preview could not be loaded from the content domain'));
            }, PreviewContentHost.TIMEOUT);
            this._settleConnecting = (error) => {
                clearTimeout(timer);
                this._settleConnecting = null;
                this._connecting = null;
                if (error) reject(error);
                else resolve();
            };
        });

        this.iframe.removeAttribute('srcdoc');
        this.iframe.src = this.hostUrl;
        return this._connecting;
    }

    /** Forget the current connection, so the next connect() loads the host page again. */
    reset() {
        this._port?.close();
        this._port = null;
        for (const { reject, timer } of this._pending.values()) {
            clearTimeout(timer);
            reject(new Error('The preview connection was reset'));
        }
        this._pending.clear();
    }

    /**
     * Send the generated preview and show it.
     * @param {Object} files - Map of file paths to content (ArrayBuffers are transferred)
     * @param {Object} [options] - Serving options for the Service Worker
     * @param {Object} [show] - Options for showContent()
     * @returns {Promise<{fileCount: number}>}
     */
    async sendContent(files, options = {}, show = {}) {
        await this.connect();
        const buffers = Object.values(files).filter((value) => value instanceof ArrayBuffer);
        const stored = await this._request('SET_CONTENT', { files, options }, buffers);
        if (stored?.type !== 'CONTENT_READY') {
            throw new Error(stored?.message || 'The preview content was not accepted');
        }
        return this.showContent(show);
    }

    /**
     * Show the preview that the content origin's Service Worker holds. Every frame of one
     * content origin shares that worker, so one sendContent() serves all of them.
     * @param {Object} [options]
     * @param {boolean} [options.keepPage] - Reload the page on screen instead of going to the first one
     * @returns {Promise<{fileCount: number}>}
     */
    async showContent({ keepPage = false } = {}) {
        await this.connect();
        const verified = await this._request('VERIFY_READY');
        if (!verified?.ready) {
            throw new Error(verified?.message || 'The preview content is not ready');
        }
        // The author is the teacher: make the Teacher Mode toggle available, as the
        // same-origin preview does.
        await this._request('NAVIGATE', { path: 'index.html?exe-teacher=1', keepPage });
        return { fileCount: verified.fileCount };
    }

    /**
     * Whether the content origin's Service Worker still holds the preview.
     * @returns {Promise<boolean>}
     */
    async hasContent() {
        if (!this._port) return false;
        try {
            const status = await this._request('GET_STATUS');
            return Boolean(status?.ready && status.fileCount > 0);
        } catch {
            return false;
        }
    }

    /** Stop listening and drop the connection. */
    destroy() {
        this._settleConnecting?.(new Error('The preview was closed'));
        this.reset();
        try {
            this.win.removeEventListener('message', this._onWindowMessage);
        } catch {
            // A tab that showed the preview and was taken to another site.
        }
    }

    /**
     * @param {string} type
     * @param {Object} [data]
     * @param {Transferable[]} [transfer]
     * @returns {Promise<Object>} The host page's reply
     * @private
     */
    _request(type, data, transfer = []) {
        return new Promise((resolve, reject) => {
            const id = this._nextId++;
            const timer = setTimeout(() => {
                this._pending.delete(id);
                reject(new Error('The preview on the content domain did not answer'));
            }, PreviewContentHost.TIMEOUT);
            this._pending.set(id, { resolve, reject, timer });
            this._port.postMessage({ id, type, data }, transfer);
        });
    }

    /**
     * Messages posted to the workarea window. Only the preview iframe, on the expected
     * content origin, is listened to.
     * @private
     */
    _handleWindowMessage(event) {
        if (event.source !== this.iframe.contentWindow || event.origin !== this.origin) return;

        const type = event.data?.type;
        if (type === 'exe-preview-host-ready' && event.ports?.[0]) {
            // Also fires when the host page reloads: replace the channel.
            this.reset();
            this._port = event.ports[0];
            this._port.onmessage = (message) => this._handlePortMessage(message.data);
            this._settleConnecting?.();
        } else if (type === 'exe-preview-host-error') {
            this._settleConnecting?.(new Error(String(event.data.message || 'The preview host failed to start')));
        }
    }

    /** @private */
    _handlePortMessage(message) {
        const pending = message?.id !== undefined ? this._pending.get(message.id) : null;
        if (!pending) {
            if (message?.id === undefined && message?.type) this.onMessage(message);
            return;
        }
        this._pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.reply?.type === 'ERROR') {
            pending.reject(new Error(message.reply.message || 'The preview host reported an error'));
        } else {
            pending.resolve(message.reply);
        }
    }
}
