import { describe, expect, it } from 'bun:test';
import { synologyVersion } from './version';

describe('DSM release versions', () => {
    it('preserves application components and independent package revisions', () => {
        expect(synologyVersion('v4.0.6')).toBe('4.0.6.3.0-1');
        expect(synologyVersion('4.0.6', '2')).toBe('4.0.6.3.0-2');
        expect(synologyVersion('4.1.0-alpha.0')).toBe('4.1.0.0.0-1');
        expect(synologyVersion('4.1.0-beta.1')).toBe('4.1.0.1.1-1');
        expect(synologyVersion('4.1.0-rc.2')).toBe('4.1.0.2.2-1');
    });
    it('rejects ambiguous versions and invalid revision components', () => {
        for (const version of [
            '',
            'latest',
            '4.0',
            '04.0.6',
            '4.0.6-beta.01',
            '4.0.6-preview.1',
            '4.0.6.1',
            '4.0.6+other',
            '2147483648.0.0',
        ]) {
            expect(() => synologyVersion(version)).toThrow();
        }
        for (const revision of ['0', '-1', '01', '1.1', '2147483648']) {
            expect(() => synologyVersion('4.0.6', revision)).toThrow();
        }
    });
});
