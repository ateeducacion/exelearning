import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const script = readFileSync(join(import.meta.dir, 'ui/auth.js'), 'utf8');
const state = 's'.repeat(43);

async function run(session: unknown, status = 204, search = `?state=${state}`, available = true) {
    const requests: { url: string; options: any }[] = [];
    const statusElement = { textContent: '' };
    let destination = '';
    await runInNewContext(script, {
        URLSearchParams,
        location: {
            search,
            replace: (value: string) => {
                destination = value;
            },
        },
        document: { querySelector: () => statusElement },
        fetch: async (url: string, options: any) => {
            requests.push({ url, options });
            if (requests.length === 1) return { ok: available, json: async () => session };
            return { status };
        },
    });
    return { requests, destination, error: statusElement.textContent };
}

describe('DSM browser handshake', () => {
    it('sends the existing DSM CSRF token only to the fixed CGI and navigates without that header', async () => {
        const result = await run({ success: true, SynoToken: 'secret-token' });
        expect(result.destination).toBe(`/exelearning/login/synology/callback?state=${state}`);
        expect(result.error).toBe('');
        expect(result.requests.map(request => request.url)).toEqual([
            '/webman/login.cgi',
            `/webman/3rdparty/exelearning/auth.cgi?state=${state}`,
        ]);
        for (const request of result.requests) {
            expect(request.options.credentials).toBe('same-origin');
            expect(request.options.redirect).toBe('error');
            expect(request.options.cache).toBe('no-store');
            expect(request.url).not.toContain('secret-token');
        }
        expect(result.requests[0].options.headers).toBeUndefined();
        expect(result.requests[1].options.headers).toEqual({
            Accept: 'application/json',
            'X-Syno-Token': 'secret-token',
        });
    });

    it('lets DSM validate sessions when DSM does not require a CSRF token', async () => {
        const result = await run({ success: true });
        expect(result.requests[1].options.headers).toEqual({ Accept: 'application/json' });
        expect(result.destination).toContain('/exelearning/login/synology/callback?state=');
    });

    it('fails closed for invalid state, rejected sessions, unavailable DSM and failed assertions', async () => {
        for (const result of [
            await run({ success: true }, 204, '?state=bad'),
            await run({ success: false }),
            await run(null),
            await run({ success: true }, 204, `?state=${state}`, false),
            await run({ success: true }, 401),
            await run({ success: true }, 302),
        ]) {
            expect(result.destination).toBe('');
            expect(result.error).toContain('Unable to validate the DSM session');
        }
    });
});
