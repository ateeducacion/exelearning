import { describe, it, expect } from 'bun:test';
import {
    CONTENT_DOMAIN_REFERRER_POLICY,
    CONTENT_DOMAIN_SANDBOX,
    contentDomainHeaders,
    PUBLIC_VIEW_REFERRER_POLICY,
    PUBLIC_VIEW_SANDBOX,
    publicViewCspHeader,
    publicViewPermissionsPolicy,
    resolvePublicViewCspProfile,
} from './publicViewSandbox';

describe('PUBLIC_VIEW_SANDBOX', () => {
    it('grants scripts but never allow-same-origin (opaque origin)', () => {
        expect(PUBLIC_VIEW_SANDBOX).toContain('allow-scripts');
        expect(PUBLIC_VIEW_SANDBOX).not.toContain('allow-same-origin');
    });
});

describe('publicViewCspHeader', () => {
    const csp = publicViewCspHeader();

    it('emits the sandbox directive with the same tokens as the iframe attribute (R3)', () => {
        expect(csp).toContain(`sandbox ${PUBLIC_VIEW_SANDBOX}`);
        expect(csp).not.toContain('allow-same-origin');
    });

    it('locks down object-src, base-uri and frame-ancestors (R4)', () => {
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'none'");
        expect(csp).toContain("frame-ancestors 'self'");
    });

    it('keeps the compatible profile by default (external https resources allowed)', () => {
        expect(csp).toContain("default-src 'self' data: blob: https:");
        expect(csp).toContain("connect-src 'self' https:");
    });

    it('strict profile cuts external resources and exfiltration', () => {
        const strict = publicViewCspHeader('strict');
        expect(strict).toContain(`sandbox ${PUBLIC_VIEW_SANDBOX}`);
        expect(strict).toContain("connect-src 'none'");
        expect(strict).toContain("default-src 'self'");
        expect(strict).not.toContain('https:');
        expect(strict).not.toContain("'unsafe-eval'");
        expect(strict).toContain("object-src 'none'");
        expect(strict).toContain("frame-ancestors 'self'");
    });
});

describe('resolvePublicViewCspProfile', () => {
    it('defaults to compatible when unset or unknown', () => {
        expect(resolvePublicViewCspProfile({})).toBe('compatible');
        expect(resolvePublicViewCspProfile({ PUBLIC_VIEW_CSP_PROFILE: 'whatever' })).toBe('compatible');
    });

    it('selects strict (case-insensitive, trimmed)', () => {
        expect(resolvePublicViewCspProfile({ PUBLIC_VIEW_CSP_PROFILE: 'strict' })).toBe('strict');
        expect(resolvePublicViewCspProfile({ PUBLIC_VIEW_CSP_PROFILE: '  STRICT  ' })).toBe('strict');
    });
});

describe('publicViewPermissionsPolicy', () => {
    it('disables powerful features the content never needs (R4)', () => {
        const pp = publicViewPermissionsPolicy();
        expect(pp).toContain('camera=()');
        expect(pp).toContain('microphone=()');
        expect(pp).toContain('geolocation=()');
        expect(pp).toContain('payment=()');
    });
});

describe('content domain mode', () => {
    const APP = 'https://online.exelearning.net';

    it('keeps the content origin but still withholds top navigation and modals', () => {
        const tokens = CONTENT_DOMAIN_SANDBOX.split(' ');
        expect(tokens).toContain('allow-same-origin');
        expect(tokens).toContain('allow-scripts');
        expect(tokens.some(token => token.startsWith('allow-top-navigation'))).toBe(false);
        expect(tokens).not.toContain('allow-modals');
        // Only allow-same-origin is added to the opaque-origin tokens.
        expect(tokens.filter(token => token !== 'allow-same-origin').join(' ')).toBe(PUBLIC_VIEW_SANDBOX);
    });

    it('limits frame-ancestors to the application origin and keeps the resource directives', () => {
        const csp = publicViewCspHeader('compatible', APP);
        expect(csp).toContain(`sandbox ${CONTENT_DOMAIN_SANDBOX};`);
        expect(csp).toContain(`frame-ancestors ${APP}`);
        expect(csp).not.toContain("frame-ancestors 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'none'");
        // Everything but the sandbox and frame-ancestors is the opaque-origin policy.
        const resourceDirectives = (value: string) => value.split('; ').slice(1, -1);
        expect(resourceDirectives(csp)).toEqual(resourceDirectives(publicViewCspHeader('compatible')));
        expect(resourceDirectives(publicViewCspHeader('strict', APP))).toEqual(
            resourceDirectives(publicViewCspHeader('strict')),
        );
    });

    it('does not change the opaque-origin policy of the application host', () => {
        expect(publicViewCspHeader()).toContain(`sandbox ${PUBLIC_VIEW_SANDBOX};`);
        expect(publicViewCspHeader()).not.toContain('allow-same-origin');
        expect(PUBLIC_VIEW_REFERRER_POLICY).toBe('no-referrer');
    });

    it('builds the full set of content-host response headers', () => {
        expect(contentDomainHeaders(APP, 'strict')).toEqual({
            'Content-Security-Policy': publicViewCspHeader('strict', APP),
            'Permissions-Policy': publicViewPermissionsPolicy(),
            'Referrer-Policy': CONTENT_DOMAIN_REFERRER_POLICY,
            'X-Content-Type-Options': 'nosniff',
            'Access-Control-Allow-Origin': APP,
            'Cache-Control': 'no-store',
        });
        expect(contentDomainHeaders(APP)['Content-Security-Policy']).toBe(publicViewCspHeader('compatible', APP));
    });

    it('sends embedded players the origin of the embedder, never the path', () => {
        expect(CONTENT_DOMAIN_REFERRER_POLICY).toBe('strict-origin-when-cross-origin');
    });
});
