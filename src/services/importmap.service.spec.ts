/**
 * Import Map Service tests
 */
import { describe, it, expect } from 'bun:test';
import { generateImportMap, generateStaticImportMap, serializeImportMap } from './importmap.service';

describe('importmap.service', () => {
    describe('generateImportMap', () => {
        it('generates import map with basePath and version', () => {
            const result = generateImportMap({
                basePath: '/web/exe',
                version: 'v1.0.0',
            });

            expect(result.imports['yjs']).toBe('/web/exe/v1.0.0/libs/yjs/yjs.min.js');
            expect(result.imports['@exe/']).toBe('/web/exe/v1.0.0/app/');
            expect(result.imports['@exe/core/']).toBe('/web/exe/v1.0.0/app/core/');
        });

        it('handles empty basePath', () => {
            const result = generateImportMap({
                basePath: '',
                version: 'v1.0.0',
            });

            expect(result.imports['yjs']).toBe('/v1.0.0/libs/yjs/yjs.min.js');
            expect(result.imports['@exe/']).toBe('/v1.0.0/app/');
        });

        it('handles empty version', () => {
            const result = generateImportMap({
                basePath: '/web/exe',
                version: '',
            });

            expect(result.imports['yjs']).toBe('/web/exe/libs/yjs/yjs.min.js');
            expect(result.imports['@exe/']).toBe('/web/exe/app/');
        });

        it('handles both empty basePath and version', () => {
            const result = generateImportMap({
                basePath: '',
                version: '',
            });

            expect(result.imports['yjs']).toBe('/libs/yjs/yjs.min.js');
            expect(result.imports['@exe/']).toBe('/app/');
        });

        it('includes all required library imports', () => {
            const result = generateImportMap({
                basePath: '',
                version: 'v1.0.0',
            });

            expect(result.imports['yjs']).toBeDefined();
            expect(result.imports['y-indexeddb']).toBeDefined();
            expect(result.imports['y-websocket']).toBeDefined();
            expect(result.imports['fflate']).toBeDefined();
            expect(result.imports['showdown']).toBeDefined();
            expect(result.imports['interactjs']).toBeDefined();
        });

        it('includes all app module aliases', () => {
            const result = generateImportMap({
                basePath: '',
                version: 'v1.0.0',
            });

            expect(result.imports['@exe/']).toBeDefined();
            expect(result.imports['@exe/core/']).toBeDefined();
            expect(result.imports['@exe/yjs/']).toBeDefined();
            expect(result.imports['@exe/common/']).toBeDefined();
            expect(result.imports['@exe/workarea/']).toBeDefined();
            expect(result.imports['@exe/rest/']).toBeDefined();
            expect(result.imports['@exe/locate/']).toBeDefined();
            expect(result.imports['@exe/editor/']).toBeDefined();
        });
    });

    describe('generateStaticImportMap', () => {
        it('generates import map with relative paths', () => {
            const result = generateStaticImportMap();

            expect(result.imports['yjs']).toBe('./libs/yjs/yjs.min.js');
            expect(result.imports['@exe/']).toBe('./app/');
            expect(result.imports['@exe/core/']).toBe('./app/core/');
        });

        it('all paths start with ./', () => {
            const result = generateStaticImportMap();

            for (const [_key, value] of Object.entries(result.imports)) {
                expect(value.startsWith('./')).toBe(true);
            }
        });
    });

    describe('serializeImportMap', () => {
        it('serializes to JSON with pretty formatting by default', () => {
            const importMap = {
                imports: {
                    'test': '/path/to/test.js',
                },
            };

            const result = serializeImportMap(importMap);

            expect(result).toContain('\n');
            expect(result).toContain('    ');
        });

        it('serializes to compact JSON when pretty is false', () => {
            const importMap = {
                imports: {
                    'test': '/path/to/test.js',
                },
            };

            const result = serializeImportMap(importMap, false);

            expect(result).not.toContain('\n');
            expect(result).not.toContain('    ');
        });

        it('produces valid JSON', () => {
            const importMap = generateImportMap({
                basePath: '/web/exe',
                version: 'v1.0.0',
            });

            const serialized = serializeImportMap(importMap);
            const parsed = JSON.parse(serialized);

            expect(parsed.imports).toBeDefined();
            expect(parsed.imports['yjs']).toBe('/web/exe/v1.0.0/libs/yjs/yjs.min.js');
        });
    });
});
