import { describe, it, expect } from 'vitest';
import {
    parseStyleLabState,
    serializeStyleLabState,
    parseIdeviceLabState,
    serializeIdeviceLabState,
    VIEWPORTS,
    EXPORT_TARGETS,
    THEME_SOURCES,
} from './DeveloperUrlState.js';

describe('DeveloperUrlState - Style Lab', () => {
    it('returns safe defaults when the URL is empty', () => {
        const state = parseStyleLabState('');
        expect(state.fixture).toBeNull();
        expect(state.themeSource).toBe('base');
        expect(state.export).toBe('website');
        expect(state.viewport).toBe('desktop');
        expect(state.options.navigation).toBe(true);
        expect(state.options.icons).toBe(true);
        expect(state.options.search).toBe(false);
    });

    it('parses a full URL', () => {
        const state = parseStyleLabState(
            'fixture=leer-para-aprender&themeSource=base&theme=modern&export=scorm12&viewport=mobile&preset=all&search=1&pageCounter=1&navigation=0',
        );
        expect(state.fixture).toBe('leer-para-aprender');
        expect(state.themeSource).toBe('base');
        expect(state.theme).toBe('modern');
        expect(state.export).toBe('scorm12');
        expect(state.viewport).toBe('mobile');
        expect(state.preset).toBe('all');
        expect(state.options.search).toBe(true);
        expect(state.options.pageCounter).toBe(true);
        expect(state.options.navigation).toBe(false);
    });

    it('accepts URLSearchParams as input', () => {
        const params = new URLSearchParams({ viewport: 'tablet', export: 'single-page' });
        const state = parseStyleLabState(params);
        expect(state.viewport).toBe('tablet');
        expect(state.export).toBe('single-page');
    });

    it('accepts a plain object as input', () => {
        const state = parseStyleLabState({ viewport: 'mobile' });
        expect(state.viewport).toBe('mobile');
    });

    it('falls back when viewport is invalid', () => {
        const state = parseStyleLabState('viewport=cinema');
        expect(state.viewport).toBe('desktop');
    });

    it('falls back when export target is invalid', () => {
        const state = parseStyleLabState('export=mobile');
        // 'mobile' is a viewport, not an export target — must reject
        expect(state.export).toBe('website');
    });

    it('falls back when theme source is invalid', () => {
        const state = parseStyleLabState('themeSource=hacker');
        expect(state.themeSource).toBe('base');
    });

    it('rejects path-traversal in fixture id', () => {
        const state = parseStyleLabState('fixture=../../etc/passwd');
        expect(state.fixture).toBeNull();
    });

    it('rejects fixture ids containing slashes or dots', () => {
        expect(parseStyleLabState('fixture=foo/bar').fixture).toBeNull();
        expect(parseStyleLabState('fixture=foo.bar').fixture).toBeNull();
        expect(parseStyleLabState('fixture=foo bar').fixture).toBeNull();
    });

    it('accepts fixture ids using safe characters', () => {
        expect(parseStyleLabState('fixture=leer-para-aprender').fixture).toBe('leer-para-aprender');
        expect(parseStyleLabState('fixture=basic_content').fixture).toBe('basic_content');
        expect(parseStyleLabState('fixture=Style123').fixture).toBe('Style123');
    });

    it('caps fixture id length at 64 characters', () => {
        const longId = 'a'.repeat(65);
        expect(parseStyleLabState('fixture=' + longId).fixture).toBeNull();
    });

    it('roundtrips through serialize/parse', () => {
        const original = {
            fixture: 'demo',
            themeSource: 'base',
            theme: 'modern',
            export: 'scorm12',
            viewport: 'mobile',
            preset: 'all',
            options: { search: true, pageCounter: true, navigation: false, icons: true, collapsible: true },
        };
        const params = serializeStyleLabState(original);
        const parsed = parseStyleLabState(params);
        expect(parsed.fixture).toBe('demo');
        expect(parsed.export).toBe('scorm12');
        expect(parsed.viewport).toBe('mobile');
        expect(parsed.options.search).toBe(true);
        expect(parsed.options.navigation).toBe(false);
    });

    it('omits defaults from serialized output', () => {
        const params = serializeStyleLabState({
            fixture: null,
            themeSource: 'base',
            theme: null,
            export: 'website',
            viewport: 'desktop',
            options: { navigation: true, icons: true, search: false, pageCounter: false, collapsible: false },
        });
        expect(params.toString()).toBe('');
    });

    it('omits null/missing ids from serialized output', () => {
        const params = serializeStyleLabState({ fixture: null, theme: null, viewport: 'desktop' });
        expect(params.toString()).toBe('');
    });

    it('accepts dotted boolean values', () => {
        expect(parseStyleLabState('search=true').options.search).toBe(true);
        expect(parseStyleLabState('search=yes').options.search).toBe(true);
        expect(parseStyleLabState('search=no').options.search).toBe(false);
    });
});

describe('DeveloperUrlState - iDevice Lab', () => {
    it('returns safe defaults', () => {
        const state = parseIdeviceLabState('');
        expect(state.idevice).toBeNull();
        expect(state.sample).toBeNull();
        expect(state.themeSource).toBe('base');
        expect(state.export).toBe('website');
        expect(state.viewport).toBe('desktop');
    });

    it('parses a full URL', () => {
        const state = parseIdeviceLabState(
            'idevice=rubric&sample=basic-score&themeSource=base&theme=modern&export=scorm12&viewport=desktop',
        );
        expect(state.idevice).toBe('rubric');
        expect(state.sample).toBe('basic-score');
        expect(state.theme).toBe('modern');
        expect(state.export).toBe('scorm12');
    });

    it('rejects unsafe idevice id', () => {
        expect(parseIdeviceLabState('idevice=../bad').idevice).toBeNull();
    });

    it('roundtrips through serialize/parse', () => {
        const original = {
            idevice: 'checklist',
            sample: 'completion',
            themeSource: 'base',
            theme: 'modern',
            export: 'website',
            viewport: 'tablet',
        };
        const params = serializeIdeviceLabState(original);
        const parsed = parseIdeviceLabState(params);
        expect(parsed.idevice).toBe('checklist');
        expect(parsed.sample).toBe('completion');
        expect(parsed.viewport).toBe('tablet');
    });

    it('emits only non-default fields', () => {
        const params = serializeIdeviceLabState({
            idevice: null,
            sample: null,
            themeSource: 'base',
            theme: null,
            export: 'website',
            viewport: 'desktop',
        });
        expect(params.toString()).toBe('');
    });
});

describe('DeveloperUrlState - exports', () => {
    it('exposes viewport, export, and theme-source constants', () => {
        expect(VIEWPORTS).toContain('desktop');
        expect(VIEWPORTS).toContain('tablet');
        expect(VIEWPORTS).toContain('mobile');
        expect(EXPORT_TARGETS).toContain('website');
        expect(EXPORT_TARGETS).toContain('scorm12');
        expect(THEME_SOURCES).toEqual(['base', 'site', 'user']);
    });
});
