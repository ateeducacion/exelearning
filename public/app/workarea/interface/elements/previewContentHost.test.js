import PreviewContentHost from './previewContentHost.js';

const HOST_URL = 'https://pabc.content.test/exe/content/token/preview/uuid-1/host.html';
const CONTENT_ORIGIN = 'https://pabc.content.test';

describe('PreviewContentHost', () => {
    let win;
    let iframe;
    let frameWindow;
    let channels;
    let originalMessageChannel;
    let onMessage;
    let host;

    /** Deliver a window message to the workarea, as the browser would. */
    const windowMessage = (data, { source = frameWindow, origin = CONTENT_ORIGIN } = {}) =>
        win.listener({ data, source, origin });

    /** Make the host page announce itself and return the port the workarea keeps. */
    const hostReady = () => {
        windowMessage({ type: 'exe-preview-host-ready' });
        return channels.at(-1).port1;
    };

    /** Answer the request with the given type on the current port. */
    const answer = (port, type, reply) => {
        const request = port.sent.findLast((entry) => entry.message.type === type);
        port.onmessage({ data: { id: request.message.id, reply } });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        channels = [];
        originalMessageChannel = globalThis.MessageChannel;
        globalThis.MessageChannel = function () {
            const port = () => ({
                sent: [],
                onmessage: null,
                close: vi.fn(),
                postMessage(message, transfer) {
                    this.sent.push({ message, transfer });
                },
            });
            this.port1 = port();
            this.port2 = port();
            channels.push(this);
        };

        win = {
            listener: null,
            addEventListener: vi.fn((_type, listener) => {
                win.listener = listener;
            }),
            removeEventListener: vi.fn(),
        };
        frameWindow = { postMessage: vi.fn() };
        iframe = { contentWindow: frameWindow, src: '', removeAttribute: vi.fn() };
        onMessage = vi.fn();
        host = new PreviewContentHost({ hostUrl: HOST_URL, iframe, onMessage, win });
    });

    afterEach(() => {
        host.destroy();
        globalThis.MessageChannel = originalMessageChannel;
        vi.useRealTimers();
    });

    it('takes the content origin from the URL the server provided', () => {
        expect(host.origin).toBe(CONTENT_ORIGIN);
        expect(win.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('uses the global window by default', () => {
        const spy = vi.spyOn(window, 'addEventListener');
        const defaultHost = new PreviewContentHost({ hostUrl: HOST_URL, iframe });
        expect(spy).toHaveBeenCalledWith('message', expect.any(Function));
        defaultHost.onMessage({ type: 'ignored' });
        defaultHost.destroy();
    });

    describe('connect', () => {
        it('loads the host page and hands it a MessagePort once it is ready', async () => {
            const connected = host.connect();
            expect(iframe.src).toBe(HOST_URL);
            expect(iframe.removeAttribute).toHaveBeenCalledWith('srcdoc');

            hostReady();
            await connected;

            expect(frameWindow.postMessage).toHaveBeenCalledWith({ type: 'exe-preview-connect' }, CONTENT_ORIGIN, [
                channels[0].port2,
            ]);
        });

        it('shares one attempt between concurrent callers and is a no-op once connected', async () => {
            const first = host.connect();
            const second = host.connect();
            expect(second).toBe(first);
            hostReady();
            await first;

            iframe.src = 'unchanged';
            await host.connect();
            expect(iframe.src).toBe('unchanged');
        });

        it('ignores messages from another window or another origin', async () => {
            const connected = host.connect();
            let settled = false;
            connected.then(
                () => {
                    settled = true;
                },
                () => {},
            );

            windowMessage({ type: 'exe-preview-host-ready' }, { source: { postMessage: vi.fn() } });
            windowMessage({ type: 'exe-preview-host-ready' }, { origin: 'https://app.test' });
            windowMessage({ type: 'exe-preview-host-ready' }, { origin: 'https://pxyz.content.test' });
            await Promise.resolve();

            expect(settled).toBe(false);
            expect(frameWindow.postMessage).not.toHaveBeenCalled();
            expect(channels).toHaveLength(0);

            hostReady();
            await connected;
        });

        it('rejects when the host page reports that it could not start', async () => {
            const connected = host.connect();
            windowMessage({ type: 'exe-preview-host-error', message: 'Service Workers are not available' });
            await expect(connected).rejects.toThrow('Service Workers are not available');
        });

        it('rejects with a default message when the host page gives none', async () => {
            const connected = host.connect();
            windowMessage({ type: 'exe-preview-host-error' });
            await expect(connected).rejects.toThrow('The preview host failed to start');
        });

        it('rejects when the content domain never answers, and can be retried', async () => {
            const connected = host.connect();
            const rejection = expect(connected).rejects.toThrow('could not be loaded from the content domain');
            vi.advanceTimersByTime(PreviewContentHost.TIMEOUT);
            await rejection;

            const retry = host.connect();
            expect(retry).not.toBe(connected);
            hostReady();
            await retry;
        });

        it('ignores unrelated messages from the preview iframe', () => {
            windowMessage({ type: 'something-else' });
            windowMessage(null);
            expect(channels).toHaveLength(0);
        });

        it('replaces the channel when the host page reloads', async () => {
            const connected = host.connect();
            const firstPort = hostReady();
            await connected;

            const secondPort = hostReady();

            expect(firstPort.close).toHaveBeenCalled();
            expect(secondPort).not.toBe(firstPort);
            expect(channels).toHaveLength(2);
        });
    });

    describe('sendContent', () => {
        it('stores the files, verifies them and shows the first page', async () => {
            const buffer = new ArrayBuffer(8);
            const sending = host.sendContent({ 'index.html': buffer, 'note.txt': 'text' }, { option: true });
            const port = hostReady();
            await vi.waitFor(() => expect(port.sent).toHaveLength(1));

            expect(port.sent[0].message).toEqual({
                id: 1,
                type: 'SET_CONTENT',
                data: { files: { 'index.html': buffer, 'note.txt': 'text' }, options: { option: true } },
            });
            // Only ArrayBuffers are transferred.
            expect(port.sent[0].transfer).toEqual([buffer]);

            answer(port, 'SET_CONTENT', { type: 'CONTENT_READY', fileCount: 2 });
            await vi.waitFor(() => expect(port.sent).toHaveLength(2));
            answer(port, 'VERIFY_READY', { type: 'READY_VERIFIED', ready: true, fileCount: 2 });
            await vi.waitFor(() => expect(port.sent).toHaveLength(3));
            expect(port.sent[2].message).toMatchObject({
                type: 'NAVIGATE',
                data: { path: 'index.html?exe-teacher=1' },
            });
            answer(port, 'NAVIGATE', { type: 'NAVIGATED' });

            await expect(sending).resolves.toEqual({ fileCount: 2 });
        });

        it('fails when the worker does not accept the content', async () => {
            const sending = host.sendContent({});
            const port = hostReady();
            await vi.waitFor(() => expect(port.sent).toHaveLength(1));
            answer(port, 'SET_CONTENT', { type: 'UNEXPECTED' });
            await expect(sending).rejects.toThrow('The preview content was not accepted');
        });

        it('fails when the content cannot be verified', async () => {
            const sending = host.sendContent({});
            const port = hostReady();
            await vi.waitFor(() => expect(port.sent).toHaveLength(1));
            answer(port, 'SET_CONTENT', { type: 'CONTENT_READY' });
            await vi.waitFor(() => expect(port.sent).toHaveLength(2));
            answer(port, 'VERIFY_READY', { ready: false });
            await expect(sending).rejects.toThrow('The preview content is not ready');
        });

        it('reports an error returned by the host page', async () => {
            const sending = host.sendContent({});
            const port = hostReady();
            await vi.waitFor(() => expect(port.sent).toHaveLength(1));
            answer(port, 'SET_CONTENT', { type: 'ERROR', message: 'worker gone' });
            await expect(sending).rejects.toThrow('worker gone');
        });

        it('reports a default error when the host page gives no message', async () => {
            const sending = host.sendContent({});
            const port = hostReady();
            await vi.waitFor(() => expect(port.sent).toHaveLength(1));
            answer(port, 'SET_CONTENT', { type: 'ERROR' });
            await expect(sending).rejects.toThrow('The preview host reported an error');
        });

        it('fails when the host page stops answering', async () => {
            const sending = host.sendContent({});
            const port = hostReady();
            await vi.waitFor(() => expect(port.sent).toHaveLength(1));
            const rejection = expect(sending).rejects.toThrow('did not answer');
            vi.advanceTimersByTime(PreviewContentHost.TIMEOUT);
            await rejection;
        });

        it('fails pending requests when the connection is reset', async () => {
            const sending = host.sendContent({});
            const port = hostReady();
            await vi.waitFor(() => expect(port.sent).toHaveLength(1));
            const rejection = expect(sending).rejects.toThrow('The preview connection was reset');
            host.reset();
            await rejection;
        });
    });

    describe('hasContent', () => {
        it('is false before the host page is connected', async () => {
            await expect(host.hasContent()).resolves.toBe(false);
        });

        it('asks the worker through the host page', async () => {
            const connected = host.connect();
            const port = hostReady();
            await connected;

            const withContent = host.hasContent();
            answer(port, 'GET_STATUS', { ready: true, fileCount: 3 });
            await expect(withContent).resolves.toBe(true);

            const empty = host.hasContent();
            answer(port, 'GET_STATUS', { ready: true, fileCount: 0 });
            await expect(empty).resolves.toBe(false);
        });

        it('is false when the host page does not answer', async () => {
            const connected = host.connect();
            hostReady();
            await connected;

            const status = host.hasContent();
            vi.advanceTimersByTime(PreviewContentHost.TIMEOUT);
            await expect(status).resolves.toBe(false);
        });
    });

    describe('messages from the host page', () => {
        it('passes unsolicited messages to the listener', async () => {
            const connected = host.connect();
            const port = hostReady();
            await connected;

            port.onmessage({ data: { type: 'CONTENT_NEEDED' } });
            expect(onMessage).toHaveBeenCalledWith({ type: 'CONTENT_NEEDED' });
        });

        it('drops replies to unknown requests and malformed messages', async () => {
            const connected = host.connect();
            const port = hostReady();
            await connected;

            port.onmessage({ data: { id: 999, reply: { type: 'CONTENT_READY' } } });
            port.onmessage({ data: null });
            port.onmessage({ data: {} });
            expect(onMessage).not.toHaveBeenCalled();
        });
    });

    describe('destroy', () => {
        it('stops listening and rejects a connection in progress', async () => {
            const connected = host.connect();
            const rejection = expect(connected).rejects.toThrow('The preview was closed');
            host.destroy();
            await rejection;
            expect(win.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
        });
    });
});
