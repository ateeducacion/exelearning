import { describe, expect, it } from 'bun:test';
import {
    contentDomainBootError,
    contentOrigin,
    decodeAppOrigin,
    encodeAppOrigin,
    getContentDomain,
    getContentProxy,
    parseContentDomain,
    relateHostToContentDomain,
} from './content-domain';

describe('parseContentDomain', () => {
    it('accepts a host and an optional port, normalizing case and whitespace', () => {
        expect(parseContentDomain('exelearningusercontent.com')).toEqual({
            host: 'exelearningusercontent.com',
            port: null,
        });
        expect(parseContentDomain('  Content.LOCALHOST:3003 ')).toEqual({ host: 'content.localhost', port: '3003' });
    });

    it.each([
        ['https://content.example', 'scheme'],
        ['content.example/path', 'path'],
        ['*.content.example', 'wildcard'],
        ['.content.example', 'leading dot'],
        ['content.example.', 'trailing dot'],
        ['content..example', 'empty label'],
        ['-content.example', 'label starting with a hyphen'],
        ['content_domain.example', 'underscore'],
        ['content.example:port', 'non-numeric port'],
        ['content.example:0', 'port 0'],
        ['content.example:65536', 'port above 65535'],
        ['192.168.1.10', 'IPv4 address'],
        ['[::1]:8080', 'IPv6 address'],
        [`${'a'.repeat(64)}.example`, 'label longer than 63 characters'],
        [`${Array(40).fill('abcde').join('.')}.example`, 'name too long to prefix a label'],
        ['two hosts.example', 'whitespace'],
    ])('rejects %p (%s)', value => {
        expect(() => parseContentDomain(value)).toThrow();
    });
});

describe('getContentDomain', () => {
    it('is null when the setting is unset or blank (mode off)', () => {
        expect(getContentDomain({})).toBeNull();
        expect(getContentDomain({ EXE_CONTENT_DOMAIN: '   ' })).toBeNull();
    });

    it('returns the parsed value', () => {
        expect(getContentDomain({ EXE_CONTENT_DOMAIN: 'content.example:8443' })).toEqual({
            host: 'content.example',
            port: '8443',
        });
    });
});

describe('contentDomainBootError', () => {
    it('is null when the setting is unset or valid', () => {
        expect(contentDomainBootError({})).toBeNull();
        expect(contentDomainBootError({ EXE_CONTENT_DOMAIN: 'content.example' })).toBeNull();
    });

    it('explains an invalid value and refuses to start', () => {
        const error = contentDomainBootError({ EXE_CONTENT_DOMAIN: 'https://content.example' });
        expect(error).toContain('Invalid EXE_CONTENT_DOMAIN');
        expect(error).toContain('host[:port]');
        expect(error).toContain('Refusing to start');
    });
});

describe('getContentProxy', () => {
    it('is null when EXE_CONTENT_PROXY is unset or blank', () => {
        expect(getContentProxy({})).toBeNull();
        expect(getContentProxy({ EXE_CONTENT_PROXY: '  ' })).toBeNull();
    });

    it('parses the proxy domain like a content domain', () => {
        expect(getContentProxy({ EXE_CONTENT_PROXY: 'Proxy.Example:8443' })).toEqual({
            host: 'proxy.example',
            port: '8443',
        });
        expect(() => getContentProxy({ EXE_CONTENT_PROXY: 'https://proxy.example' })).toThrow('host[:port]');
    });

    it('refuses to start on an invalid value, or when a content domain is set too', () => {
        expect(contentDomainBootError({ EXE_CONTENT_PROXY: 'proxy.example' })).toBeNull();

        const invalid = contentDomainBootError({ EXE_CONTENT_PROXY: '*.proxy.example' });
        expect(invalid).toContain('Invalid EXE_CONTENT_PROXY');
        expect(invalid).toContain('Refusing to start');

        const both = contentDomainBootError({
            EXE_CONTENT_DOMAIN: 'content.example',
            EXE_CONTENT_PROXY: 'proxy.example',
        });
        expect(both).toContain('EXE_CONTENT_DOMAIN and EXE_CONTENT_PROXY are both set');
        expect(both).toContain('Refusing to start');
    });
});

describe('relateHostToContentDomain', () => {
    const contentDomain = { host: 'content.example.org', port: null };

    it('tells an unrelated application host from one that shares the content domain', () => {
        expect(relateHostToContentDomain('app.example.net', contentDomain)).toBe('unrelated');
        expect(relateHostToContentDomain('xcontent.example.org', contentDomain)).toBe('unrelated');
        expect(relateHostToContentDomain('Content.Example.org', contentDomain)).toBe('same');
        expect(relateHostToContentDomain('label.content.example.org', contentDomain)).toBe('app-under-content');
        expect(relateHostToContentDomain('example.org', contentDomain)).toBe('content-under-app');
    });
});

describe('application origin path segment', () => {
    it('round-trips an origin through one URL-safe segment', () => {
        const token = encodeAppOrigin('https://online.exelearning.net');
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(decodeAppOrigin(token)).toBe('https://online.exelearning.net');
        expect(decodeAppOrigin(encodeAppOrigin('http://app.localhost:3003'))).toBe('http://app.localhost:3003');
    });

    it.each([
        ['https://app.example/', 'trailing slash'],
        ['https://app.example/path', 'path'],
        ['https://app.example:443', 'non-canonical default port'],
        ['HTTPS://APP.EXAMPLE', 'non-canonical case'],
        ['javascript:alert(1)', 'non-http scheme'],
        ["https://app.example; script-src 'unsafe-inline'", 'header injection attempt'],
        ['not a url', 'garbage'],
    ])('rejects %p (%s)', value => {
        expect(decodeAppOrigin(encodeAppOrigin(value))).toBeNull();
    });

    it('rejects a segment that is not base64url', () => {
        expect(decodeAppOrigin('aHR0cHM6Ly9h+/==')).toBeNull();
        expect(decodeAppOrigin('')).toBeNull();
    });
});

describe('contentOrigin', () => {
    it('puts the label under the content domain with the scheme of the application', () => {
        expect(contentOrigin({ host: 'content.example', port: null }, 'vabc', 'https://app.example')).toBe(
            'https://vabc.content.example',
        );
        expect(contentOrigin({ host: 'content.localhost', port: '3003' }, 'vabc', 'http://app.localhost:3003')).toBe(
            'http://vabc.content.localhost:3003',
        );
    });

    it('drops a default port so the value equals window.origin', () => {
        expect(contentOrigin({ host: 'content.example', port: '443' }, 'vabc', 'https://app.example')).toBe(
            'https://vabc.content.example',
        );
    });
});
