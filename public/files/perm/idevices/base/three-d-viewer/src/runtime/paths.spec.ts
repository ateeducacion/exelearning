import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    detectMode,
    getEditionLibBaseUrl,
    getEditionModelViewerUrl,
    getExportLibBaseUrl,
    getExportModelViewerUrl,
    getIdeviceResourcesBase,
    isStaticMode,
    LIB_RELATIVE_PATH,
    parseRuntimeConfig,
    resolveAppUrl,
} from './paths';

const ORIGIN = globalThis.location?.origin ?? 'http://localhost:3000';

beforeEach(() => {
    globalThis.eXeLearning = undefined;
    document.documentElement.id = '';
});

afterEach(() => {
    globalThis.eXeLearning = undefined;
    document.documentElement.id = '';
});

describe('parseRuntimeConfig / isStaticMode', () => {
    it('reads a plain object config', () => {
        globalThis.eXeLearning = { config: { isStaticMode: true } };
        expect(parseRuntimeConfig()).toEqual({ isStaticMode: true });
        expect(isStaticMode()).toBe(true);
    });

    it('parses a JSON string config', () => {
        globalThis.eXeLearning = { config: '{"isOfflineInstallation":true}' };
        expect(isStaticMode()).toBe(true);
    });

    it('degrades to null on invalid JSON', () => {
        globalThis.eXeLearning = { config: '{not json' };
        expect(parseRuntimeConfig()).toBeNull();
        expect(isStaticMode()).toBe(false);
    });

    it('is false when no config is present', () => {
        expect(isStaticMode()).toBe(false);
    });
});

describe('detectMode', () => {
    it('detects server mode from a defined baseURL', () => {
        globalThis.eXeLearning = { config: { baseURL: 'https://host' } };
        expect(detectMode().isServerMode).toBe(true);
    });

    it('detects export mode and the index page from the root element id', () => {
        document.documentElement.id = 'exe-index';
        expect(detectMode()).toMatchObject({ isExportMode: true, isOnIndexPage: true });
        document.documentElement.id = 'exe-page-3';
        expect(detectMode()).toMatchObject({ isExportMode: true, isOnIndexPage: false });
    });

    it('reports neither export nor static for a plain page', () => {
        expect(detectMode()).toMatchObject({ isExportMode: false, isStaticMode: false, isOnIndexPage: false });
    });
});

describe('resolveAppUrl', () => {
    it('joins the symfony base URL and base path', () => {
        globalThis.eXeLearning = { symfony: { baseURL: 'https://host/', basePath: '/app/' } };
        expect(resolveAppUrl('files/a.js')).toBe('https://host/app/files/a.js');
    });

    it('returns a rooted path when there is no symfony config', () => {
        expect(resolveAppUrl('files/a.js')).toBe('/files/a.js');
    });
});

describe('getIdeviceResourcesBase', () => {
    it('is relative to index.html on the index page and one level up elsewhere', () => {
        document.documentElement.id = 'exe-index';
        expect(getIdeviceResourcesBase('id1')).toBe('content/resources/id1/');
        document.documentElement.id = 'exe-page';
        expect(getIdeviceResourcesBase('id1')).toBe('../content/resources/id1/');
    });

    it('is empty without an iDevice id', () => {
        expect(getIdeviceResourcesBase('')).toBe('');
    });
});

describe('getEditionLibBaseUrl', () => {
    it('is always absolute, because dynamic import() resolves against the module', () => {
        expect(getEditionLibBaseUrl().startsWith('http')).toBe(true);
    });

    it('includes the base URL and base path', () => {
        globalThis.eXeLearning = { symfony: { baseURL: 'https://host', basePath: 'app' } };
        expect(getEditionLibBaseUrl()).toBe(`https://host/app/${LIB_RELATIVE_PATH}`);
    });

    it('prepends the origin for a relative base URL', () => {
        globalThis.eXeLearning = { symfony: { baseURL: '/sub' } };
        expect(getEditionLibBaseUrl()).toBe(`${ORIGIN}/sub/${LIB_RELATIVE_PATH}`);
    });

    it('drops the base path in static mode to avoid duplicating the deploy prefix', () => {
        globalThis.eXeLearning = { config: { isStaticMode: true }, symfony: { basePath: 'pr-preview/pr-1' } };
        expect(getEditionLibBaseUrl()).toBe(`${ORIGIN}/${LIB_RELATIVE_PATH}`);
    });
});

describe('getExportLibBaseUrl', () => {
    it('uses the origin in static mode', () => {
        globalThis.eXeLearning = { config: { isStaticMode: true } };
        expect(getExportLibBaseUrl()).toBe(`${ORIGIN}/${LIB_RELATIVE_PATH}`);
    });

    it('uses the runtime config in server mode', () => {
        globalThis.eXeLearning = { config: { baseURL: 'https://host', basePath: 'app' } };
        expect(getExportLibBaseUrl()).toBe(`https://host/app/${LIB_RELATIVE_PATH}`);
    });

    it('resolves relative to the page in export mode', () => {
        document.documentElement.id = 'exe-index';
        expect(getExportLibBaseUrl().endsWith('idevices/three-d-viewer/')).toBe(true);
        expect(getExportLibBaseUrl()).not.toContain('../');
        document.documentElement.id = 'exe-page';
        expect(getExportLibBaseUrl()).toContain('../idevices/three-d-viewer/');
    });

    it('falls back to the symfony config', () => {
        globalThis.eXeLearning = { symfony: { baseURL: 'https://host' } };
        expect(getExportLibBaseUrl()).toBe(`https://host/${LIB_RELATIVE_PATH}`);
    });
});

describe('model-viewer URLs', () => {
    it('uses a document-relative path in static mode', () => {
        globalThis.eXeLearning = { config: { isStaticMode: true } };
        expect(getEditionModelViewerUrl()).toBe(`./${LIB_RELATIVE_PATH}model-viewer.min.js`);
        expect(getExportModelViewerUrl()).toBe(`./${LIB_RELATIVE_PATH}model-viewer.min.js`);
    });

    it('uses the app URL in server mode and as the fallback', () => {
        globalThis.eXeLearning = { config: { baseURL: 'https://host' }, symfony: { baseURL: 'https://host' } };
        expect(getExportModelViewerUrl()).toBe(`https://host/${LIB_RELATIVE_PATH}model-viewer.min.js`);
        globalThis.eXeLearning = { symfony: { baseURL: 'https://host' } };
        expect(getEditionModelViewerUrl()).toBe(`https://host/${LIB_RELATIVE_PATH}model-viewer.min.js`);
        expect(getExportModelViewerUrl()).toBe(`https://host/${LIB_RELATIVE_PATH}model-viewer.min.js`);
    });

    it('uses the packaged path in export mode', () => {
        document.documentElement.id = 'exe-index';
        expect(getExportModelViewerUrl()).toBe('./idevices/three-d-viewer/model-viewer.min.js');
        document.documentElement.id = 'exe-page';
        expect(getExportModelViewerUrl()).toBe('../idevices/three-d-viewer/model-viewer.min.js');
    });
});
