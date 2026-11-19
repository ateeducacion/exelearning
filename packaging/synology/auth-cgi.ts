import { readFileSync } from 'node:fs';
import { authenticateSynologySession, signSynologyAssertion } from '../../src/services/synology-auth';

// Called only by DSM's package CGI runner, using its original session environment.
export function synologyCgiResponse(
    env: NodeJS.ProcessEnv,
    readConfiguration = () => readFileSync('/var/packages/exelearning/var/config/runtime.env', 'utf8'),
): string {
    const headers = 'Cache-Control: no-store\r\nContent-Type: text/plain; charset=utf-8\r\n';
    const state = new URLSearchParams(env.QUERY_STRING).get('state');
    if (env.REQUEST_METHOD !== 'GET' || !state || !/^[\w-]{43}$/.test(state)) {
        return `Status: 400 Bad Request\r\n${headers}\r\nInvalid login state.\n`;
    }
    if (env.HTTP_ACCEPT !== 'application/json') {
        return (
            "Cache-Control: no-store\r\nContent-Type: text/html; charset=utf-8\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'\r\n\r\n" +
            '<!doctype html><html lang="en"><meta charset="utf-8"><title>eXeLearning DSM login</title>' +
            '<body><p role="status">Validating DSM session...</p><noscript>JavaScript is required for DSM login.</noscript>' +
            '<script src="/webman/3rdparty/exelearning/auth.js"></script></body></html>'
        );
    }
    try {
        const username = authenticateSynologySession(env);
        if (!username) return `Status: 401 Unauthorized\r\n${headers}\r\nA valid DSM session is required.\n`;
        const secret = readConfiguration().match(/^SYNOLOGY_SSO_SECRET=([a-f0-9]{96})$/m)?.[1];
        if (!secret) throw new Error('Missing installation secret');
        process.env.SYNOLOGY_SSO_SECRET = secret;
        const assertion = signSynologyAssertion(username, state);
        return `Status: 204 No Content\r\nCache-Control: no-store\r\nSet-Cookie: synology_assertion=${assertion}; Path=/exelearning; HttpOnly; Secure; SameSite=Lax; Max-Age=60\r\n\r\n`;
    } catch {
        return `Status: 503 Service Unavailable\r\n${headers}\r\nDSM authentication is unavailable.\n`;
    }
}
