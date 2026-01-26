/**
 * PathResolver tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PathResolver } from './PathResolver.js';

describe('PathResolver', () => {
    // Store original window values
    let originalEXeLearning;
    let originalStaticMode;
    let originalElectronAPI;

    beforeEach(() => {
        // Save originals
        originalEXeLearning = window.eXeLearning;
        originalStaticMode = window.__EXE_STATIC_MODE__;
        originalElectronAPI = window.electronAPI;

        // Reset to clean state
        delete window.eXeLearning;
        delete window.__EXE_STATIC_MODE__;
        delete window.electronAPI;
    });

    afterEach(() => {
        // Restore originals
        if (originalEXeLearning !== undefined) {
            window.eXeLearning = originalEXeLearning;
        } else {
            delete window.eXeLearning;
        }

        if (originalStaticMode !== undefined) {
            window.__EXE_STATIC_MODE__ = originalStaticMode;
        } else {
            delete window.__EXE_STATIC_MODE__;
        }

        if (originalElectronAPI !== undefined) {
            window.electronAPI = originalElectronAPI;
        } else {
            delete window.electronAPI;
        }
    });

    describe('basePath', () => {
        it('returns empty string when eXeLearning not defined', () => {
            expect(PathResolver.basePath).toBe('');
        });

        it('returns empty string when config.basePath not defined', () => {
            window.eXeLearning = { config: {} };
            expect(PathResolver.basePath).toBe('');
        });

        it('returns basePath from config', () => {
            window.eXeLearning = { config: { basePath: '/web/exelearning' } };
            expect(PathResolver.basePath).toBe('/web/exelearning');
        });
    });

    describe('version', () => {
        it('returns empty string when eXeLearning not defined', () => {
            expect(PathResolver.version).toBe('');
        });

        it('returns version from eXeLearning', () => {
            window.eXeLearning = { version: 'v1.0.0' };
            expect(PathResolver.version).toBe('v1.0.0');
        });
    });

    describe('isStaticMode', () => {
        it('returns false when flag not set', () => {
            expect(PathResolver.isStaticMode).toBe(false);
        });

        it('returns true when flag is true', () => {
            window.__EXE_STATIC_MODE__ = true;
            expect(PathResolver.isStaticMode).toBe(true);
        });

        it('returns false for other truthy values', () => {
            window.__EXE_STATIC_MODE__ = 'true';
            expect(PathResolver.isStaticMode).toBe(false);
        });
    });

    describe('isElectron', () => {
        it('returns false when electronAPI not defined', () => {
            expect(PathResolver.isElectron).toBe(false);
        });

        it('returns true when electronAPI is defined', () => {
            window.electronAPI = {};
            expect(PathResolver.isElectron).toBe(true);
        });
    });

    describe('resolve', () => {
        describe('server mode', () => {
            beforeEach(() => {
                window.eXeLearning = {
                    version: 'v1.0.0',
                    config: { basePath: '/web/exe' },
                };
            });

            it('resolves path with basePath and version', () => {
                expect(PathResolver.resolve('app/common/common.js'))
                    .toBe('/web/exe/v1.0.0/app/common/common.js');
            });

            it('normalizes leading slash', () => {
                expect(PathResolver.resolve('/app/common/common.js'))
                    .toBe('/web/exe/v1.0.0/app/common/common.js');
            });

            it('handles empty basePath', () => {
                window.eXeLearning.config.basePath = '';
                expect(PathResolver.resolve('app/common/common.js'))
                    .toBe('/v1.0.0/app/common/common.js');
            });

            it('handles missing version', () => {
                delete window.eXeLearning.version;
                expect(PathResolver.resolve('app/common/common.js'))
                    .toBe('/web/exe/app/common/common.js');
            });
        });

        describe('static mode (non-Electron)', () => {
            beforeEach(() => {
                window.__EXE_STATIC_MODE__ = true;
            });

            it('resolves to relative path', () => {
                expect(PathResolver.resolve('app/common/common.js'))
                    .toBe('./app/common/common.js');
            });

            it('normalizes leading slash', () => {
                expect(PathResolver.resolve('/libs/yjs/yjs.min.js'))
                    .toBe('./libs/yjs/yjs.min.js');
            });

            it('ignores version and basePath in static mode', () => {
                window.eXeLearning = {
                    version: 'v1.0.0',
                    config: { basePath: '/web/exe' },
                };
                expect(PathResolver.resolve('app/common/common.js'))
                    .toBe('./app/common/common.js');
            });
        });

        describe('Electron mode', () => {
            beforeEach(() => {
                window.__EXE_STATIC_MODE__ = true;
                window.electronAPI = {}; // Electron is detected
                window.eXeLearning = {
                    version: 'v1.0.0',
                    config: { basePath: '' },
                };
            });

            it('uses versioned path (not relative)', () => {
                expect(PathResolver.resolve('app/common/common.js'))
                    .toBe('/v1.0.0/app/common/common.js');
            });
        });
    });

    describe('resolveLib', () => {
        it('resolves library paths', () => {
            window.eXeLearning = { version: 'v1.0.0', config: { basePath: '' } };
            expect(PathResolver.resolveLib('yjs', 'yjs.min.js'))
                .toBe('/v1.0.0/libs/yjs/yjs.min.js');
        });
    });

    describe('resolveApp', () => {
        it('resolves app module paths', () => {
            window.eXeLearning = { version: 'v1.0.0', config: { basePath: '' } };
            expect(PathResolver.resolveApp('common/common.js'))
                .toBe('/v1.0.0/app/common/common.js');
        });
    });

    describe('getApiBaseUrl', () => {
        it('returns basePath + /api in server mode', () => {
            window.eXeLearning = { config: { basePath: '/web/exe' } };
            expect(PathResolver.getApiBaseUrl()).toBe('/web/exe/api');
        });

        it('returns empty string in static mode', () => {
            window.__EXE_STATIC_MODE__ = true;
            expect(PathResolver.getApiBaseUrl()).toBe('');
        });

        it('returns basePath + /api in Electron mode', () => {
            window.__EXE_STATIC_MODE__ = true;
            window.electronAPI = {};
            window.eXeLearning = { config: { basePath: '' } };
            expect(PathResolver.getApiBaseUrl()).toBe('/api');
        });
    });

    describe('getWebSocketUrl', () => {
        it('returns null in static mode', () => {
            window.__EXE_STATIC_MODE__ = true;
            expect(PathResolver.getWebSocketUrl()).toBe(null);
        });

        it('returns null in Electron mode', () => {
            window.__EXE_STATIC_MODE__ = true;
            window.electronAPI = {};
            expect(PathResolver.getWebSocketUrl()).toBe(null);
        });
    });

    describe('fromAlias', () => {
        beforeEach(() => {
            window.eXeLearning = { version: 'v1.0.0', config: { basePath: '' } };
        });

        it('resolves @exe/ alias', () => {
            expect(PathResolver.fromAlias('@exe/', 'core/PathResolver.js'))
                .toBe('/v1.0.0/app/core/PathResolver.js');
        });

        it('resolves library aliases', () => {
            expect(PathResolver.fromAlias('yjs'))
                .toBe('/v1.0.0/libs/yjs/yjs.min.js');
        });

        it('handles unknown aliases', () => {
            expect(PathResolver.fromAlias('unknown', '/path'))
                .toBe('unknown/path');
        });
    });
});
