/**
 * Preview host page (content domain mode, EXE_CONTENT_DOMAIN).
 *
 * This script is NOT part of the application bundle. The server serves it as
 * `preview-host.js` on the per-project content origin, next to `preview-sw.js`,
 * for the page loaded in the workarea's preview iframe (see
 * src/routes/content-host.ts). The page has nothing of its own: it registers
 * that origin's Service Worker, receives the generated preview from the
 * workarea over a MessageChannel, hands it to the worker and shows the result
 * in the frame below it.
 *
 * Trust: the page hands its channel to the window that embeds it, and only if
 * that window is on the configured application origin. It takes no window
 * message from anyone else. Everything else on this origin is author content
 * and is treated as untrusted: from the content frame only the message types in
 * RELAYED_TO_APP are forwarded, without their payload.
 */

/** Requests the application may make to the Service Worker through this page. */
const RELAYED_TO_WORKER = new Set(['SET_CONTENT', 'VERIFY_READY', 'GET_STATUS']);

/** Requests the content frame may make to the application. */
const RELAYED_TO_APP = new Set(['exe-download-elpx']);

/** ArrayBuffers of a SET_CONTENT payload, to transfer instead of copying. */
function transferablesOf(data) {
    return Object.values(data?.files || {}).filter((value) => value instanceof ArrayBuffer);
}

/**
 * Start the host page in `win`. Returns null when the page is not embedded or
 * was served without an application origin.
 * @param {Window} win
 */
export function startPreviewHost(win) {
    const doc = win.document;
    const { appOrigin, version = '' } = doc.documentElement.dataset;
    const embedder = win.parent !== win ? win.parent : null;
    const frame = doc.getElementById('preview-content');
    const serviceWorker = win.navigator.serviceWorker;
    if (!appOrigin || !embedder || !frame) return null;

    const viewerBase = new URL('viewer/', win.location.href);
    let port = null;

    // Exported content delegates "download the .elpx" to its parent when the parent looks
    // like the editor (ELPX_DOWNLOAD_ONCLICK). The request is relayed to the real one below.
    win.eXeLearning = { app: {} };

    const toApp = (message) => port?.postMessage(message);

    /** Whether the frame shows a page of the preview: it may be empty or have followed a link elsewhere. */
    const showsPreview = () => {
        try {
            return frame.contentWindow.location.href.startsWith(viewerBase.href);
        } catch {
            return false;
        }
    };

    // Firefox starts a framed document uncontrolled even when the worker is already active,
    // so ask the worker to claim this page instead of waiting for a claim that already ran.
    const worker = (async () => {
        if (!serviceWorker) throw new Error('Service Workers are not available in this browser context');
        await serviceWorker.register(`preview-sw.js?v=${version}`, { scope: './' });
        const registration = await serviceWorker.ready;
        if (!serviceWorker.controller) {
            const controlled = new Promise((resolve) => {
                serviceWorker.addEventListener('controllerchange', resolve, { once: true });
            });
            registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
            await controlled;
        }
        return serviceWorker.controller;
    })();

    async function onAppMessage(event) {
        const { id, type, data } = event.data || {};
        const reply = (message) => toApp({ id, reply: message });
        try {
            if (type === 'NAVIGATE') {
                const target = new URL(String(data?.path || 'index.html'), viewerBase);
                if (!target.href.startsWith(viewerBase.href)) throw new Error('Path outside the preview');
                if (data?.keepPage && showsPreview()) frame.contentWindow.location.reload();
                else frame.src = target.href;
                reply({ type: 'NAVIGATED' });
            } else if (RELAYED_TO_WORKER.has(type)) {
                const channel = new MessageChannel();
                channel.port1.onmessage = (answer) => {
                    channel.port1.close();
                    reply(answer.data);
                };
                (await worker).postMessage({ type, data }, [channel.port2, ...transferablesOf(data)]);
            } else {
                throw new Error(`Unknown request: ${type}`);
            }
        } catch (error) {
            reply({ type: 'ERROR', message: String(error?.message || error) });
        }
    }

    win.addEventListener('message', (event) => {
        if (
            event.source === frame.contentWindow &&
            event.origin === win.location.origin &&
            RELAYED_TO_APP.has(event.data?.type)
        ) {
            toApp({ type: event.data.type });
        }
    });

    // The worker lost its in-memory content (the browser stopped it): ask for it again.
    serviceWorker?.addEventListener('message', (event) => {
        if (event.data?.type === 'CONTENT_NEEDED') toApp({ type: 'CONTENT_NEEDED' });
    });

    worker.then(
        () => {
            // The target origin makes the browser deliver the port only to the application.
            const channel = new MessageChannel();
            port = channel.port1;
            port.onmessage = onAppMessage;
            embedder.postMessage({ type: 'exe-preview-host-ready' }, appOrigin, [channel.port2]);
        },
        (error) =>
            embedder.postMessage({ type: 'exe-preview-host-error', message: String(error?.message || error) }, appOrigin),
    );

    return { worker };
}

/* v8 ignore next 3 -- runs only on the served host page, which is covered by the Playwright spec */
if (typeof document !== 'undefined' && document.documentElement.dataset.appOrigin) {
    startPreviewHost(window);
}
