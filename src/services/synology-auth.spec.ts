import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import {
    authenticateSynologySession,
    configure,
    resetDependencies,
    createSynologyState,
    resetSynologyAssertionReplayCache,
    signSynologyAssertion,
    synologyPlaceholderEmail,
    verifySynologyAssertion,
    verifySynologyState,
} from './synology-auth';

describe('Synology authentication assertions', () => {
    beforeEach(() => {
        process.env.SYNOLOGY_SSO_SECRET = 'test-secret-that-is-longer-than-thirty-two-bytes';
        resetSynologyAssertionReplayCache();
    });
    afterEach(() => {
        delete process.env.SYNOLOGY_SSO_SECRET;
        resetDependencies();
    });

    it('signs and verifies a short-lived assertion exactly once', () => {
        const token = signSynologyAssertion('dsm-user', 'state', 1_000);
        expect(verifySynologyAssertion(token, 'state', 2_000)?.username).toBe('dsm-user');
        expect(verifySynologyAssertion(token, 'state', 2_000)).toBeNull();
    });

    it('rejects expired, altered, and incorrectly signed assertions', () => {
        const token = signSynologyAssertion('alice', 'state', 1_000);
        expect(verifySynologyAssertion(token, 'state', 62_000)).toBeNull();
        const [payload, signature] = token.split('.');
        const changed = Buffer.from(
            JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), username: 'bob' }),
        ).toString('base64url');
        expect(verifySynologyAssertion(`${changed}.${signature}`, 'state', 2_000)).toBeNull();
        expect(verifySynologyAssertion(`${payload}.${'x'.repeat(43)}`, 'state', 2_000)).toBeNull();
    });

    it('validates state and produces deterministic non-routable emails', () => {
        const state = createSynologyState();
        expect(verifySynologyState(state, state)).toBe(true);
        expect(verifySynologyState(state, `${state}x`)).toBe(false);
        expect(verifySynologyState(undefined, state)).toBe(false);
        expect(synologyPlaceholderEmail('alice')).toMatch(/^[a-f0-9]{32}@synology\.invalid$/);
    });

    it('binds each assertion to its original login state', () => {
        const token = signSynologyAssertion('alice', 'original', 1000);
        expect(verifySynologyAssertion(token, 'different', 2000)).toBeNull();
        expect(verifySynologyAssertion(token, 'original', 2000)?.username).toBe('alice');
    });

    it('rejects malformed signed claims and token formats', () => {
        const valid = JSON.parse(
            Buffer.from(signSynologyAssertion('alice', 'state', 1000).split('.')[0], 'base64url').toString(),
        );
        for (const patch of [
            { issuedAt: '1000' },
            { expiresAt: null },
            { expiresAt: 1000 },
            { expiresAt: 1000000 },
            { issuedAt: 9000 },
            { nonce: 1 },
            { nonce: '' },
            { username: '\n' },
            { username: '' },
            { username: 'x'.repeat(129) },
        ]) {
            const payload = Buffer.from(JSON.stringify({ ...valid, ...patch })).toString('base64url');
            const signature = createHmac('sha256', process.env.SYNOLOGY_SSO_SECRET!)
                .update(payload)
                .digest('base64url');
            expect(verifySynologyAssertion(`${payload}.${signature}`, 'state', 2000)).toBeNull();
        }
        for (const token of ['', '.', 'a.b.c', 'a.x', 'x'.repeat(4097)])
            expect(verifySynologyAssertion(token, 'state')).toBeNull();
        const payload = Buffer.from('invalid json').toString('base64url');
        const signature = createHmac('sha256', process.env.SYNOLOGY_SSO_SECRET!).update(payload).digest('base64url');
        expect(verifySynologyAssertion(`${payload}.${signature}`, 'state')).toBeNull();
        expect(() => signSynologyAssertion('', 'state')).toThrow();
        expect(() => signSynologyAssertion('alice', '')).toThrow();
        delete process.env.SYNOLOGY_SSO_SECRET;
        expect(() => signSynologyAssertion('alice', 'state')).toThrow();
    });

    it('expires assertions at the deadline and prunes old replay entries', () => {
        const expired = signSynologyAssertion('alice', 'state', 1000);
        expect(verifySynologyAssertion(expired, 'state', 61000)).toBeNull();
        expect(verifySynologyAssertion(expired, 'state', 2000)).not.toBeNull();
        const fresh = signSynologyAssertion('alice', 'state', 100000);
        expect(verifySynologyAssertion(fresh, 'state', 100001)).not.toBeNull();
    });

    it('gets identities only from the DSM executable and bounds its execution', () => {
        let calls = 0;
        configure({
            spawnSync: ((command: string[], options: any) => {
                calls++;
                expect(command).toEqual(['/usr/syno/synoman/webman/modules/authenticate.cgi']);
                expect(options.env.HTTP_COOKIE).toBe('id=existing-session');
                expect(options.env.REMOTE_ADDR).toBe('192.0.2.1');
                expect(options.env.SYNOLOGY_SSO_SECRET).toBeUndefined();
                expect(options.timeout).toBe(5000);
                expect(options.maxBuffer).toBe(1024);
                return { exitCode: 0, stdout: Buffer.from('alice\n') };
            }) as typeof Bun.spawnSync,
        });
        expect(
            authenticateSynologySession({
                HTTP_COOKIE: 'id=existing-session',
                REMOTE_ADDR: '192.0.2.1',
                HTTP_X_DSM_USER: 'admin',
            }),
        ).toBe('alice');
        expect(authenticateSynologySession({ QUERY_STRING: 'username=admin' })).toBeNull();
        expect(authenticateSynologySession({ HTTP_COOKIE: 'x'.repeat(16385) })).toBeNull();
        expect(calls).toBe(1);
    });

    it('fails closed for missing DSM binaries, failed sessions and invalid output', () => {
        const request = { HTTP_COOKIE: 'id=session' };
        for (const result of [
            { exitCode: 1, stdout: Buffer.from('admin') },
            { exitCode: 0, stdout: Buffer.from('') },
            { exitCode: 0, stdout: Buffer.from('alice\nbob') },
        ]) {
            configure({ spawnSync: (() => result) as typeof Bun.spawnSync });
            expect(authenticateSynologySession(request)).toBeNull();
        }
        configure({
            spawnSync: (() => {
                throw new Error('not available');
            }) as typeof Bun.spawnSync,
        });
        expect(authenticateSynologySession(request)).toBeNull();
    });
});
