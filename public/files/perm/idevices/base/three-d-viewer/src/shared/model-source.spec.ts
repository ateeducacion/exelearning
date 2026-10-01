import { describe, expect, it } from 'vitest';
import { detectModelType, isStlSource, isSupportedModelFile, normalizeModelSource } from './model-source';

describe('detectModelType', () => {
    it('recognises every known extension', () => {
        expect(detectModelType('asset://uuid.stl')).toBe('stl');
        expect(detectModelType('a.glb')).toBe('glb');
        expect(detectModelType('a.gltf')).toBe('gltf');
        expect(detectModelType('a.obj')).toBe('obj');
        expect(detectModelType('a.fbx')).toBe('fbx');
    });

    it('is case-insensitive and tolerates surrounding whitespace', () => {
        expect(detectModelType('  A.STL ')).toBe('stl');
    });

    it('strips the query string and the fragment before looking at the extension', () => {
        expect(detectModelType('a.glb?v=2')).toBe('glb');
        expect(detectModelType('a.stl#frag')).toBe('stl');
        expect(detectModelType('a.gltf?v=2#frag')).toBe('gltf');
    });

    it('returns "unknown" for missing, unsupported and non-string input', () => {
        for (const input of ['', 'a.txt', 'no-extension', undefined, null, 42]) {
            expect(detectModelType(input)).toBe('unknown');
        }
    });
});

describe('isStlSource', () => {
    it('is true only for STL', () => {
        expect(isStlSource('a.stl')).toBe(true);
        expect(isStlSource('a.STL')).toBe(true);
        expect(isStlSource('a.glb')).toBe(false);
        expect(isStlSource('')).toBe(false);
    });
});

describe('normalizeModelSource', () => {
    it('passes durable references through unchanged', () => {
        expect(normalizeModelSource('asset://uuid.glb')).toBe('asset://uuid.glb');
        expect(normalizeModelSource('https://example.org/a.glb')).toBe('https://example.org/a.glb');
        expect(normalizeModelSource('content/resources/a.stl')).toBe('content/resources/a.stl');
    });

    it('strips ephemeral URLs', () => {
        expect(normalizeModelSource('blob:http://localhost/x')).toBe('');
        expect(normalizeModelSource('data:model/gltf+json,{}')).toBe('');
    });

    it('trims and returns an empty string for invalid input', () => {
        expect(normalizeModelSource('  a.glb  ')).toBe('a.glb');
        expect(normalizeModelSource('   ')).toBe('');
        expect(normalizeModelSource(null)).toBe('');
    });
});

describe('isSupportedModelFile', () => {
    it('accepts the three supported formats through every reference style', () => {
        for (const path of [
            'model.glb',
            'model.gltf',
            'model.stl',
            'asset://uuid.glb',
            'asset://uuid.stl',
            'file_manager/dir/model.GLTF',
            'https://example.org/a/model.glb?v=1',
        ]) {
            expect(isSupportedModelFile(path)).toBe(true);
        }
    });

    it('accepts blob: URLs, which carry no extension', () => {
        expect(isSupportedModelFile('blob:http://localhost/abc')).toBe(true);
    });

    it('rejects unsupported extensions and empty input', () => {
        for (const path of ['model.obj', 'model.txt', '', null, undefined, 'asset://uuid']) {
            expect(isSupportedModelFile(path)).toBe(false);
        }
    });
});
