/**
 * Runs the content proxy on Bun, for a deployment that hosts its own instead of
 * using a Cloudflare Worker, and for the end-to-end tests.
 *
 *     CONTENT_PROXY_DOMAIN=content.example ALLOWED_HOSTS=app.example PORT=8787 bun src/content-proxy/index.ts
 *
 * Put it behind a reverse proxy that terminates TLS for `*.<domain>` and passes
 * the `Host` header on. Set `ALLOWED_HOSTS`: without it this process fetches any
 * public address it is asked for, from inside your network.
 */
import { contentProxyOptions, handleContentProxyRequest } from './worker';

const options = contentProxyOptions(process.env);
const server = Bun.serve({
    port: Number(process.env.PORT ?? 8787),
    fetch: request => handleContentProxyRequest(request, options),
});
console.log(`Content proxy for *.${options.domain} listening on port ${server.port}`);
