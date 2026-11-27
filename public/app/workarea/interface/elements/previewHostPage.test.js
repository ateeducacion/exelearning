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

    /**
     * Start the page and return its end of the channel it hands to the application:
     * `onmessage` receives the application's requests and `sent` holds what it answered.
     */
    const connect = async () => {
        await startPreviewHost(win).worker;
        await Promise.resolve();
        return channels[0].port1;
    };

    beforeEach(() => {
        channels = [];
        originalMessageChannel = globalThis.MessageChannel;
        globalThis.MessageChannel = function () {
            this.port1 = {
                sent: [],
                onmessage: null,
                close: vi.fn(),
                postMessage(message) {
                    this.sent.push(message);
                },
            };
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
        frame = { contentWindow: { name: 'content', location: { href: 'about:blank', reload: vi.fn() } }, src: '' };
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

        it('registers the worker for its own directory and hands the application a channel', async () => {
            const host = startPreviewHost(win);
            await host.worker;
            await Promise.resolve();

            expect(serviceWorker.register).toHaveBeenCalledWith('preview-sw.js?v=v4.0.6', { scope: './' });
            // Only to the window that embeds the page, and only if it is the application origin.
            expect(embedder.postMessage).toHaveBeenCalledTimes(1);
            expect(embedder.postMessage).toHaveBeenCalledWith({ type: 'exe-preview-host-ready' }, APP_ORIGIN, [
                channels[0].port2,
            ]);
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
            expect(embedder.postMessage).toHaveBeenCalledWith({ type: 'exe-preview-host-ready' }, APP_ORIGIN, [
                channels[0].port2,
            ]);
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
        it('takes no port from a window message, whoever sends it', async () => {
            const port = await connect();
            const stranger = { onmessage: null };
            const ports = [stranger];
            windowMessage({ type: 'exe-preview-connect' }, { ports });
            windowMessage({ type: 'exe-preview-connect' }, { source: { other: true }, ports });
            windowMessage({ type: 'exe-preview-host-ready' }, { origin: CONTENT_ORIGIN, ports });

            expect(stranger.onmessage).toBeNull();
            expect(port.close).not.toHaveBeenCalled();
            expect(channels).toHaveLength(1);
        });
    });

    describe('requests from the application', () => {
        let port;

        beforeEach(async () => {
            port = await connect();
        });

        it('forwards content to the worker, transferring its buffers, and relays the answer', async () => {
            const buffer = new ArrayBuffer(4);
            const data = { files: { 'index.html': buffer, 'a.txt': 'text' }, options: {} };

            await port.onmessage({ data: { id: 7, type: 'SET_CONTENT', data } });

            expect(controller.postMessage).toHaveBeenCalledWith({ type: 'SET_CONTENT', data }, [
                channels[1].port2,
                buffer,
            ]);
            channels[1].port1.onmessage({ data: { type: 'CONTENT_READY', fileCount: 2 } });
            expect(port.sent).toEqual([{ id: 7, reply: { type: 'CONTENT_READY', fileCount: 2 } }]);
            expect(channels[1].port1.close).toHaveBeenCalled();
        });

        it('forwards status requests that carry no data', async () => {
            await port.onmessage({ data: { id: 8, type: 'GET_STATUS' } });
            expect(controller.postMessage).toHaveBeenCalledWith({ type: 'GET_STATUS', data: undefined }, [
                channels[1].port2,
            ]);
        });

        it('navigates the content frame inside the viewer directory', async () => {
            await port.onmessage({ data: { id: 1, type: 'NAVIGATE', data: { path: 'index.html?exe-teacher=1' } } });
            expect(frame.src).toBe(`${CONTENT_ORIGIN}/exe/content/token/preview/uuid-1/viewer/index.html?exe-teacher=1`);
            expect(port.sent).toEqual([{ id: 1, reply: { type: 'NAVIGATED' } }]);

            await port.onmessage({ data: { id: 2, type: 'NAVIGATE' } });
            expect(frame.src).toBe(`${CONTENT_ORIGIN}/exe/content/token/preview/uuid-1/viewer/index.html`);
        });

        it('reloads the page on screen instead, when asked to keep it', async () => {
            const viewer = `${CONTENT_ORIGIN}/exe/content/token/preview/uuid-1/viewer/`;
            const request = { id: 1, type: 'NAVIGATE', data: { path: 'index.html', keepPage: true } };

            // Nothing of the preview on screen yet: go to the page.
            await port.onmessage({ data: request });
            expect(frame.src).toBe(`${viewer}index.html`);
            expect(frame.contentWindow.location.reload).not.toHaveBeenCalled();

            frame.src = '';
            frame.contentWindow.location.href = `${viewer}html/second-page.html`;
            await port.onmessage({ data: request });
            expect(frame.contentWindow.location.reload).toHaveBeenCalledTimes(1);
            expect(frame.src).toBe('');

            // The frame followed a link to another site and cannot be read.
            frame.contentWindow = {
                get location() {
                    throw new DOMException('Blocked a frame', 'SecurityError');
                },
            };
            await port.onmessage({ data: request });
            expect(frame.src).toBe(`${viewer}index.html`);
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
            const port = await connect();

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
            const port = await connect();

            serviceWorker.listeners.message({ data: { type: 'CONTENT_NEEDED', reason: 'restarted' } });
            serviceWorker.listeners.message({ data: { type: 'CONTENT_UPDATED' } });
            serviceWorker.listeners.message({ data: null });

            expect(port.sent).toEqual([{ type: 'CONTENT_NEEDED' }]);
        });

        it('drops messages until the channel exists', () => {
            serviceWorker.ready = new Promise(() => {});
            startPreviewHost(win);
            expect(() => serviceWorker.listeners.message({ data: { type: 'CONTENT_NEEDED' } })).not.toThrow();
            expect(channels).toHaveLength(0);
        });
    });
});
