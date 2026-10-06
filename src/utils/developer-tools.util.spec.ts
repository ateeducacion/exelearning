/**
 * Tests for Developer Tools availability helper.
 */
import { describe, it, expect } from 'bun:test';
import { isDeveloperToolsEnabled, getDeveloperToolEntries } from './developer-tools.util';

describe('isDeveloperToolsEnabled', () => {
    it('returns true when APP_ENV is dev', () => {
        expect(isDeveloperToolsEnabled({ APP_ENV: 'dev' })).toBe(true);
    });

    it('returns false when APP_ENV is prod', () => {
        expect(isDeveloperToolsEnabled({ APP_ENV: 'prod' })).toBe(false);
    });

    it('returns false when APP_ENV is missing', () => {
        expect(isDeveloperToolsEnabled({})).toBe(false);
    });

    it('returns false when APP_ENV is unknown value', () => {
        expect(isDeveloperToolsEnabled({ APP_ENV: 'staging' })).toBe(false);
    });

    it('respects DEV_TOOLS_ENABLED=1 even when APP_ENV is prod', () => {
        expect(isDeveloperToolsEnabled({ APP_ENV: 'prod', DEV_TOOLS_ENABLED: '1' })).toBe(true);
    });

    it('respects DEV_TOOLS_ENABLED=true (case-insensitive)', () => {
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: 'TRUE' })).toBe(true);
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: 'true' })).toBe(true);
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: 'yes' })).toBe(true);
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: 'on' })).toBe(true);
    });

    it('treats DEV_TOOLS_ENABLED=0 as disabled', () => {
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: '0' })).toBe(false);
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: 'false' })).toBe(false);
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: 'no' })).toBe(false);
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: '' })).toBe(false);
    });

    it('trims DEV_TOOLS_ENABLED whitespace', () => {
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: '  1  ' })).toBe(true);
        expect(isDeveloperToolsEnabled({ DEV_TOOLS_ENABLED: '  ' })).toBe(false);
    });
});

describe('getDeveloperToolEntries', () => {
    it('returns deterministic ordering: style-lab, idevice-lab, rest-api', () => {
        const entries = getDeveloperToolEntries();
        expect(entries.map(e => e.id)).toEqual(['style-lab', 'idevice-lab', 'rest-api']);
    });

    it('uses no base path by default', () => {
        const entries = getDeveloperToolEntries();
        expect(entries[0].href).toBe('/developer/style-lab');
        expect(entries[1].href).toBe('/developer/idevice-lab');
        expect(entries[2].href).toBe('/api/v1/docs');
    });

    it('prefixes the configured base path', () => {
        const entries = getDeveloperToolEntries('/exelearning');
        expect(entries[0].href).toBe('/exelearning/developer/style-lab');
        expect(entries[1].href).toBe('/exelearning/developer/idevice-lab');
        expect(entries[2].href).toBe('/exelearning/api/v1/docs');
    });

    it('trims a trailing slash from the base path', () => {
        const entries = getDeveloperToolEntries('/exelearning/');
        expect(entries[0].href).toBe('/exelearning/developer/style-lab');
    });

    it('exposes a stable test id for every entry', () => {
        const entries = getDeveloperToolEntries();
        expect(entries.map(e => e.testId)).toEqual([
            'developer-menu-style-lab',
            'developer-menu-idevice-lab',
            'developer-menu-rest-api',
        ]);
    });

    it('exposes a translation label key for every entry', () => {
        const entries = getDeveloperToolEntries();
        for (const entry of entries) {
            expect(entry.labelKey.length).toBeGreaterThan(0);
        }
    });
});
