import { buildAbsoluteUrl, buildBaseUrl, decodeJwtPayload, parseAuthMethods } from '../../../src/modules/auth/auth.utils';

describe('auth.utils', () => {
  const mockRequest = (options: { protocol?: string; host?: string; forwardedProto?: string; path?: string }) =>
    ({
      protocol: options.protocol || 'http',
      headers: {
        host: options.host || 'localhost:3001',
        'x-forwarded-proto': options.forwardedProto,
      },
    } as any);

  it('parses authentication methods safely', () => {
    expect(parseAuthMethods('password, cas ,OPENID')).toEqual(['password', 'cas', 'openid']);
    expect(parseAuthMethods(undefined, ['guest'])).toEqual(['guest']);
  });

  it('builds base and absolute URLs using forwarded headers when present', () => {
    const req = mockRequest({ protocol: 'http', forwardedProto: 'https', host: 'example.com' });
    expect(buildBaseUrl(req)).toBe('https://example.com');
    expect(buildAbsoluteUrl(req, '/login/callback')).toBe('https://example.com/login/callback');
    expect(buildAbsoluteUrl(req, 'login/callback')).toBe('https://example.com/login/callback');
  });

  it('decodes JWT payloads without verification', () => {
    const payload = Buffer.from(JSON.stringify({ sub: '123', email: 'user@example.com' })).toString('base64url');
    const token = `ignored.${payload}.ignored`;
    expect(decodeJwtPayload(token)).toMatchObject({ sub: '123', email: 'user@example.com' });
    expect(decodeJwtPayload('invalid-token')).toBeNull();
  });
});
