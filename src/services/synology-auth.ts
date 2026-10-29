import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export interface SynologyAssertion {
    username: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
    state: string;
}

const usedNonces = new Map<string, number>();
const defaultDependencies = { spawnSync: Bun.spawnSync };
let dependencies = defaultDependencies;

export function configure(overrides: Partial<typeof defaultDependencies>): void {
    dependencies = { ...defaultDependencies, ...overrides };
}

export function resetDependencies(): void {
    dependencies = defaultDependencies;
}

function validUsername(username: unknown): username is string {
    if (typeof username !== 'string' || username.length < 1 || username.length > 128) return false;
    return [...username].every(character => {
        const code = character.codePointAt(0) ?? 0;
        return code > 31 && code !== 127;
    });
}

function secret(): string {
    const value = process.env.SYNOLOGY_SSO_SECRET;
    if (!value || value.length < 32) throw new Error('SYNOLOGY_SSO_SECRET must contain at least 32 characters');
    return value;
}

export function createSynologyState(): string {
    return randomBytes(32).toString('base64url');
}

export function verifySynologyState(expected: string | undefined, received: string | undefined): boolean {
    if (!expected || !received) return false;
    const left = Buffer.from(expected);
    const right = Buffer.from(received);
    return left.length === right.length && timingSafeEqual(left, right);
}

export function signSynologyAssertion(username: string, state: string, now = Date.now()): string {
    if (!validUsername(username)) throw new Error('Invalid DSM username');
    if (!state) throw new Error('Synology login state is required');
    const assertion: SynologyAssertion = {
        username,
        issuedAt: now,
        expiresAt: now + 60_000,
        nonce: randomBytes(24).toString('base64url'),
        state,
    };
    const payload = Buffer.from(JSON.stringify(assertion)).toString('base64url');
    const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

export function verifySynologyAssertion(token: string, state: string, now = Date.now()): SynologyAssertion | null {
    if (token.length > 4096) return null;
    const [payload, providedSignature, extra] = token.split('.');
    if (!payload || !providedSignature || extra) return null;
    const expectedSignature = createHmac('sha256', secret()).update(payload).digest();
    const actualSignature = Buffer.from(providedSignature, 'base64url');
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
        return null;
    }
    try {
        const assertion = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SynologyAssertion;
        if (!validUsername(assertion.username) || !verifySynologyState(state, assertion.state)) return null;
        if (
            !Number.isSafeInteger(assertion.issuedAt) ||
            !Number.isSafeInteger(assertion.expiresAt) ||
            assertion.issuedAt > now + 5_000 ||
            assertion.expiresAt <= now ||
            assertion.expiresAt <= assertion.issuedAt ||
            assertion.expiresAt - assertion.issuedAt > 60_000
        )
            return null;
        for (const [nonce, expiry] of usedNonces) if (expiry < now) usedNonces.delete(nonce);
        if (
            typeof assertion.nonce !== 'string' ||
            !/^[\w-]{32}$/.test(assertion.nonce) ||
            usedNonces.has(assertion.nonce)
        )
            return null;
        usedNonces.set(assertion.nonce, assertion.expiresAt);
        return assertion;
    } catch {
        return null;
    }
}

export function synologyPlaceholderEmail(username: string): string {
    const digest = createHmac('sha256', 'exelearning-synology-identity').update(username).digest('hex').slice(0, 32);
    return `${digest}@synology.invalid`;
}

export function authenticateSynologySession(cgiEnvironment: NodeJS.ProcessEnv): string | null {
    const cookie = cgiEnvironment.HTTP_COOKIE;
    if (!cookie || cookie.length > 16_384) return null;
    try {
        const result = dependencies.spawnSync(['/usr/syno/synoman/webman/modules/authenticate.cgi'], {
            env: cgiEnvironment,
            stderr: 'ignore',
            timeout: 5000,
            maxBuffer: 1024,
        });
        if (result.exitCode !== 0) return null;
        const username = result.stdout.toString().trim();
        return validUsername(username) ? username : null;
    } catch {
        return null;
    }
}

export function resetSynologyAssertionReplayCache(): void {
    usedNonces.clear();
}
