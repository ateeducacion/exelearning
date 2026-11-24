import { startPreviewHost } from './previewHostPage.js';

const APP_ORIGIN = 'https://app.test';
const CONTENT_ORIGIN = 'https://pabc.content.test';
const HOST_HREF = `${CONTENT_ORIGIN}/exe/content/token/preview/uuid-1/host.html`;

describe('preview host page', () => {
    let win;
    let embedder;
    let frame;
    let serviceWorker;
    let controller;
    let registration;
    let originalMessageChannel;
    let channels;

    /** Deliver a window message to the host page. */
    const windowMessage = (data, { source = embedder, origin = APP_ORIGIN, ports = [] } = {}) =>
        win.listeners.message({ data, source, origin, ports });

    /** A MessagePort as the application would transfer it. */
    const appPort = () => ({ sent: [], onmessage: null, close: vi.fn(), postMessage(message) { this.sent.push(message); } });

    /** Connect the application and return its port. */
    const connect = () => {
        const port = appPort();
        windowMessage({ type: 'exe-preview-connect' }, { ports: [port] });
        return port;
    };

    beforeEach(() => {
        channels = [];
        originalMessageChannel = globalThis.MessageChannel;
        globalThis.MessageChannel = function () {
            this.port1 = { onmessage: null, close: vi.fn() };
            this.port2 = {};
            channels.push(this);
        };

        controller = { postMessage: vi.fn() };
        registration = { active: { postMessage: vi.fn() } };
        serviceWorker = {
            listeners: {},
            controller,
            register: vi.fn().mockResolvedValue(registration),
            ready: Promise.resolve(registration),
            addEventListener: vi.fn((type, listener) => {
                serviceWorker.listeners[type] = listener;
            }),
        };
        embedder = { postMessage: vi.fn() };
        frame = { contentWindow: { name: 'content' }, src: '' };
        win = {
            listeners: {},
            parent: embedder,
            location: { href: HOST_HREF, origin: CONTENT_ORIGIN },
            navigator: { serviceWorker },
            document: {
                documentElement: { dataset: { appOrigin: APP_ORIGIN, version: 'v4.0.6' } },
                getElementById: vi.fn(() => frame),
            },
            addEventListener: vi.fn((type, listener) => {
                win.listeners[type] = listener;
            }),
        };
    });

    afterEach(() => {
        globalThis.MessageChannel = originalMessageChannel;
    });

    describe('start', () => {
        it('does nothing when the page is not embedded', () => {
            win.parent = win;
            expect(startPreviewHost(win)).toBeNull();
            expect(serviceWorker.register).not.toHaveBeenCalled();
        });

        it('does nothing without an application origin or without its frame', () => {
            win.document.documentElement.dataset = {};
            expect(startPreviewHost(win)).toBeNull();

            win.document.documentElement.dataset = { appOrigin: APP_ORIGIN };
            win.document.getElementById = () => null;
            expect(startPreviewHost(win)).toBeNull();
        });

        it('registers the worker for its own directory and tells the application it is ready', async () => {
            const host = startPreviewHost(win);
            await host.worker;
            await Promise.resolve();

            expect(serviceWorker.register).toHaveBeenCalledWith('preview-sw.js?v=v4.0.6', { scope: './' });
            expect(embedder.postMessage).toHaveBeenCalledWith({ type: 'exe-preview-host-ready' }, APP_ORIGIN);
        });

        it('registers without a version when the page carries none', async () => {
            win.document.documentElement.dataset = { appOrigin: APP_ORIGIN };
            await startPreviewHost(win).worker;
            expect(serviceWorker.register).toHaveBeenCalledWith('preview-sw.js?v=', { scope: './' });
        });

        it('asks an active worker to claim the page when the page starts uncontrolled', async () => {
            serviceWorker.controller = null;
            const host = startPreviewHost(win);
            await vi.waitFor(() => expect(registration.active.postMessage).toHaveBeenCalledWith({ type: 'CLAIM_CLIENTS' }));
            expect(embedder.postMessage).not.toHaveBeenCalled();

            serviceWorker.controller = controller;
            serviceWorker.listeners.controllerchange();

            await expect(host.worker).resolves.toBe(controller);
            await Promise.resolve();
            expect(embedder.postMessage).toHaveBeenCalledWith({ type: 'exe-preview-host-ready' }, APP_ORIGIN);
        });

        it('reports an error when Service Workers are not available', async () => {
            win.navigator = {};
            const host = startPreviewHost(win);
            await expect(host.worker).rejects.toThrow('Service Workers are not available');
            await Promise.resolve();

            expect(embedder.postMessage).toHaveBeenCalledWith(
                { type: 'exe-preview-host-error', message: 'Service Workers are not available in this browser context' },
                APP_ORIGIN,
            );
        });

        it('reports an error when registration fails', async () => {
            serviceWorker.register = vi.fn().mockRejectedValue('blocked');
            const host = startPreviewHost(win);
            await expect(host.worker).rejects.toBe('blocked');
            await Promise.resolve();

            expect(embedder.postMessage).toHaveBeenCalledWith(
                { type: 'exe-preview-host-error', message: 'blocked' },
                APP_ORIGIN,
            );
        });

        it('lets exported content recognise its parent as the editor', () => {
            startPreviewHost(win);
            expect(win.eXeLearning).toEqual({ app: {} });
        });
    });

    describe('connection', () => {
        beforeEach(async () => {
            await startPreviewHost(win).worker;
        });

        it('accepts a port only from the embedding window on the application origin', async () => {
            const stranger = appPort();
            windowMessage({ type: 'exe-preview-connect' }, { source: { other: true }, ports: [stranger] });
            windowMessage({ type: 'exe-preview-connect' }, { origin: 'https://evil.test', ports: [stranger] });
            windowMessage({ type: 'exe-preview-connect' }, { origin: CONTENT_ORIGIN, ports: [stranger] });
            windowMessage({ type: 'exe-preview-connect' }, { ports: [] });
            windowMessage({ type: 'something-else' }, { ports: [stranger] });
            expect(stranger.onmessage).toBeNull();

            const port = connect();
            expect(port.onmessage).toEqual(expect.any(Function));
        });

        it('replaces an earlier port when the application reconnects', () => {
            const first = connect();
            const second = connect();
            expect(first.close).toHaveBeenCalled();
            expect(second.onmessage).toEqual(expect.any(Function));
        });
    });

    describe('requests from the application', () => {
        let port;

        beforeEach(async () => {
            await startPreviewHost(win).worker;
            port = connect();
        });

        it('forwards content to the worker, transferring its buffers, and relays the answer', async () => {
            const buffer = new ArrayBuffer(4);
            const data = { files: { 'index.html': buffer, 'a.txt': 'text' }, options: {} };

            await port.onmessage({ data: { id: 7, type: 'SET_CONTENT', data } });

            expect(controller.postMessage).toHaveBeenCalledWith({ type: 'SET_CONTENT', data }, [
                channels[0].port2,
                buffer,
            ]);
            channels[0].port1.onmessage({ data: { type: 'CONTENT_READY', fileCount: 2 } });
            expect(port.sent).toEqual([{ id: 7, reply: { type: 'CONTENT_READY', fileCount: 2 } }]);
            expect(channels[0].port1.close).toHaveBeenCalled();
        });

        it('forwards status requests that carry no data', async () => {
            await port.onmessage({ data: { id: 8, type: 'GET_STATUS' } });
            expect(controller.postMessage).toHaveBeenCalledWith({ type: 'GET_STATUS', data: undefined }, [
                channels[0].port2,
            ]);
        });

        it('navigates the content frame inside the viewer directory', async () => {
            await port.onmessage({ data: { id: 1, type: 'NAVIGATE', data: { path: 'index.html?exe-teacher=1' } } });
            expect(frame.src).toBe(`${CONTENT_ORIGIN}/exe/content/token/preview/uuid-1/viewer/index.html?exe-teacher=1`);
            expect(port.sent).toEqual([{ id: 1, reply: { type: 'NAVIGATED' } }]);

            await port.onmessage({ data: { id: 2, type: 'NAVIGATE' } });
            expect(frame.src).toBe(`${CONTENT_ORIGIN}/exe/content/token/preview/uuid-1/viewer/index.html`);
        });

        it.each(['../host.html', '/login', 'https://evil.test/', '//evil.test/x'])(
            'refuses to navigate the content frame to %s',
            async (path) => {
                await port.onmessage({ data: { id: 3, type: 'NAVIGATE', data: { path } } });
                expect(frame.src).toBe('');
                expect(port.sent).toEqual([{ id: 3, reply: { type: 'ERROR', message: 'Path outside the preview' } }]);
            },
        );

        it('rejects requests it does not know, such as worker control messages', async () => {
            await port.onmessage({ data: { id: 4, type: 'SKIP_WAITING' } });
            await port.onmessage({ data: null });
            expect(controller.postMessage).not.toHaveBeenCalled();
            expect(port.sent[0]).toEqual({ id: 4, reply: { type: 'ERROR', message: 'Unknown request: SKIP_WAITING' } });
            expect(port.sent[1].reply.type).toBe('ERROR');
        });

        it('answers with an error when the worker cannot be reached', async () => {
            controller.postMessage.mockImplementation(() => {
                throw 'worker terminated';
            });
            await port.onmessage({ data: { id: 5, type: 'VERIFY_READY' } });
            expect(port.sent).toEqual([{ id: 5, reply: { type: 'ERROR', message: 'worker terminated' } }]);
        });
    });

    describe('messages towards the application', () => {
        it('relays the type, and only the type, of allowed requests from the content frame', async () => {
            await startPreviewHost(win).worker;
            const port = connect();

            windowMessage(
                { type: 'exe-download-elpx', payload: 'ignored' },
                { source: frame.contentWindow, origin: CONTENT_ORIGIN },
            );
            windowMessage({ type: 'anything-else' }, { source: frame.contentWindow, origin: CONTENT_ORIGIN });
            windowMessage({ type: 'exe-download-elpx' }, { source: { nested: true }, origin: CONTENT_ORIGIN });
            windowMessage({ type: 'exe-download-elpx' }, { source: frame.contentWindow, origin: 'https://evil.test' });

            expect(port.sent).toEqual([{ type: 'exe-download-elpx' }]);
        });

        it('asks for the content again when the worker lost it', async () => {
            await startPreviewHost(win).worker;
            const port = connect();

            serviceWorker.listeners.message({ data: { type: 'CONTENT_NEEDED', reason: 'restarted' } });
            serviceWorker.listeners.message({ data: { type: 'CONTENT_UPDATED' } });
            serviceWorker.listeners.message({ data: null });

            expect(port.sent).toEqual([{ type: 'CONTENT_NEEDED' }]);
        });

        it('drops messages while no application is connected', async () => {
            await startPreviewHost(win).worker;
            expect(() => serviceWorker.listeners.message({ data: { type: 'CONTENT_NEEDED' } })).not.toThrow();
        });
    });
});
