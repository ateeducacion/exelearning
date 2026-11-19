import { describe, it, expect } from 'vitest';
import { FixtureRegistry } from './FixtureRegistry.js';

const baseManifest = [
    { id: 'leer-para-aprender', label: 'Leer para aprender', path: 'test/fixtures/style-lab/leer-para-aprender.elpx', source: 'exelearning-style-designer', tags: ['style-showcase'] },
    { id: 'basic-content', label: 'Basic content', path: 'test/fixtures/style-lab/basic-content.elpx', tags: ['basic'] },
    { id: 'style-showcase', label: 'Style showcase', path: 'test/fixtures/style-lab/style-showcase.elpx', tags: [] },
];

describe('FixtureRegistry', () => {
    it('lists entries in manifest order', () => {
        const reg = new FixtureRegistry(baseManifest);
        expect(reg.list().map(e => e.id)).toEqual(['leer-para-aprender', 'basic-content', 'style-showcase']);
    });

    it('looks up an entry by id', () => {
        const reg = new FixtureRegistry(baseManifest);
        expect(reg.get('basic-content')?.label).toBe('Basic content');
        expect(reg.get('missing')).toBeNull();
    });

    it('reports membership via has()', () => {
        const reg = new FixtureRegistry(baseManifest);
        expect(reg.has('basic-content')).toBe(true);
        expect(reg.has('nope')).toBe(false);
    });

    it('resolveOrDefault returns the first entry when id is missing', () => {
        const reg = new FixtureRegistry(baseManifest);
        expect(reg.resolveOrDefault(null)?.id).toBe('leer-para-aprender');
        expect(reg.resolveOrDefault('nonexistent')?.id).toBe('leer-para-aprender');
    });

    it('resolveOrDefault returns the matching entry when id matches', () => {
        const reg = new FixtureRegistry(baseManifest);
        expect(reg.resolveOrDefault('basic-content')?.id).toBe('basic-content');
    });

    it('rejects entries with unsafe ids', () => {
        const reg = new FixtureRegistry([
            { id: '../escape', label: 'evil' },
            { id: 'good', label: 'ok' },
            { id: 'a'.repeat(65), label: 'too long' },
            { id: 'with/slash', label: 'bad' },
        ]);
        expect(reg.list().map(e => e.id)).toEqual(['good']);
    });

    it('drops duplicate ids', () => {
        const reg = new FixtureRegistry([
            { id: 'a', label: 'first' },
            { id: 'a', label: 'second' },
        ]);
        expect(reg.list()).toHaveLength(1);
        expect(reg.get('a').label).toBe('first');
    });

    it('handles invalid entries gracefully', () => {
        const reg = new FixtureRegistry([null, undefined, 'string', { label: 'noId' }, { id: 'valid' }]);
        expect(reg.list().map(e => e.id)).toEqual(['valid']);
    });

    it('returns an empty list when manifest is empty', () => {
        const reg = new FixtureRegistry([]);
        expect(reg.list()).toEqual([]);
        expect(reg.resolveOrDefault('anything')).toBeNull();
    });

    it('list() returns a defensive copy', () => {
        const reg = new FixtureRegistry(baseManifest);
        const list = reg.list();
        list.push({ id: 'injected', label: 'x' });
        expect(reg.list()).toHaveLength(3);
    });
});
