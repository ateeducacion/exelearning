import { afterEach, describe, expect, it } from 'bun:test';
import { configure, resetDependencies, verifySynologyAssertion } from '../../src/services/synology-auth';
import { synologyCgiResponse } from './auth-cgi';

const state = 's'.repeat(43);
const env = {
    REQUEST_METHOD: 'GET',
    QUERY_STRING: `state=${state}&username=admin`,
    HTTP_COOKIE: 'id=session',
    HTTP_ACCEPT: 'application/json',
    HTTP_X_SYNO_TOKEN: 'dsm-csrf-token',
};
const originalSecret = process.env.SYNOLOGY_SSO_SECRET;
afterEach(() => {
    resetDependencies();
    if (originalSecret === undefined) delete process.env.SYNOLOGY_SSO_SECRET;
    else process.env.SYNOLOGY_SSO_SECRET = originalSecret;
});

describe('DSM CGI bridge', () => {
    it('serves a same-origin token handshake without trusting any identity from the browser', () => {
        const response = synologyCgiResponse({ ...env, HTTP_ACCEPT: 'text/html' });
        expect(response).toContain('Content-Type: text/html');
        expect(response).toContain('Referrer-Policy: no-referrer');
        expect(response).toContain("script-src 'self'; connect-src 'self'");
        expect(response).toContain('/webman/3rdparty/exelearning/auth.js');
        expect(response).not.toContain('Set-Cookie:');
        expect(response).not.toContain('dsm-csrf-token');
    });
    it('uses DSM CGI context and transfers a bound assertion in a private cookie to a fixed callback', () => {
        configure({
            spawnSync: ((_command: unknown, options: any) => {
                expect(options.env).toBe(env);
                return { exitCode: 0, stdout: Buffer.from('alice') };
            }) as typeof Bun.spawnSync,
        });
        const response = synologyCgiResponse(env, () => `SYNOLOGY_SSO_SECRET=${'a'.repeat(96)}\n`);
        expect(response).toStartWith('Status: 204 No Content\r\n');
        expect(response).not.toContain('Location:');
        expect(response).toContain('HttpOnly; Secure; SameSite=Lax; Max-Age=60');
        const token = response.match(/synology_assertion=([^;]+);/)![1];
        expect(verifySynologyAssertion(token, state)?.username).toBe('alice');
        expect(response).not.toContain('username=admin');
    });

    it('fails closed for malformed requests, missing sessions and unavailable configuration', () => {
        for (const bad of [
            {},
            { ...env, REQUEST_METHOD: 'POST' },
            { ...env, QUERY_STRING: 'state=bad%0d%0aLocation:evil' },
        ]) {
            expect(synologyCgiResponse(bad)).toStartWith('Status: 400');
        }
        configure({ spawnSync: (() => ({ exitCode: 1, stdout: Buffer.from('admin') })) as typeof Bun.spawnSync });
        expect(synologyCgiResponse(env)).toStartWith('Status: 401');
        configure({ spawnSync: (() => ({ exitCode: 0, stdout: Buffer.from('alice') })) as typeof Bun.spawnSync });
        expect(synologyCgiResponse(env, () => '')).toStartWith('Status: 503');
        expect(
            synologyCgiResponse(env, () => {
                throw new Error('unreadable');
            }),
        ).toStartWith('Status: 503');
    });
});
