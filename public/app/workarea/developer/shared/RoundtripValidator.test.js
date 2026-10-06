import { describe, it, expect } from 'vitest';
import { RoundtripValidator, diffStates, ROUNDTRIP_STATUS } from './RoundtripValidator.js';

function makeSandbox(impl) {
    return { loadAndSave: impl };
}

describe('diffStates', () => {
    it('reports no changes when before and after are equal', () => {
        const diff = diffStates({ a: 1, b: 'x' }, { a: 1, b: 'x' });
        expect(diff.lostFields).toEqual([]);
        expect(diff.addedFields).toEqual([]);
        expect(diff.mutatedFields).toEqual([]);
    });

    it('detects lost fields', () => {
        const diff = diffStates({ a: 1, b: 2 }, { a: 1 });
        expect(diff.lostFields).toEqual(['b']);
    });

    it('detects added fields', () => {
        const diff = diffStates({ a: 1 }, { a: 1, b: 2 });
        expect(diff.addedFields).toEqual(['b']);
    });

    it('detects mutated fields', () => {
        const diff = diffStates({ a: 1 }, { a: 2 });
        expect(diff.mutatedFields).toEqual([{ path: 'a', before: 1, after: 2 }]);
    });

    it('handles nested objects', () => {
        const diff = diffStates(
            { feedback: { correct: 'a', wrong: 'b' } },
            { feedback: { correct: 'a' } },
        );
        expect(diff.lostFields).toEqual(['feedback.wrong']);
    });

    it('handles arrays', () => {
        const diff = diffStates({ items: [1, 2, 3] }, { items: [1, 2] });
        expect(diff.lostFields).toEqual(['items[2]']);
    });

    it('handles primitives only', () => {
        const diff = diffStates('hello', 'world');
        expect(diff.mutatedFields).toEqual([{ path: '$', before: 'hello', after: 'world' }]);
    });

    it('detects HTML wrapper accumulation', () => {
        const before = { content: '<p>Hello</p>' };
        const after = { content: '<div class="exe-text"><p>Hello</p></div>' };
        const diff = diffStates(before, after);
        expect(diff.mutatedFields).toHaveLength(1);
        expect(diff.mutatedFields[0].path).toBe('content');
    });
});

describe('RoundtripValidator', () => {
    it('throws when sandbox lacks loadAndSave', () => {
        expect(() => new RoundtripValidator({ sandbox: {} })).toThrow();
        expect(() => new RoundtripValidator({})).toThrow();
    });

    it('reports passed when data is stable', async () => {
        const v = new RoundtripValidator({
            sandbox: makeSandbox(data => ({ ...data })),
        });
        const result = await v.run({ title: 'Hello', score: 5 });
        expect(result.status).toBe(ROUNDTRIP_STATUS.PASSED);
        expect(result.lostFields).toEqual([]);
        expect(result.addedFields).toEqual([]);
        expect(result.mutatedFields).toEqual([]);
    });

    it('reports failed and lists lost fields', async () => {
        let call = 0;
        const v = new RoundtripValidator({
            sandbox: makeSandbox(data => {
                call += 1;
                if (call === 1) return { ...data };
                // second call drops a field — simulating data loss on reload
                const clone = { ...data };
                delete clone.score;
                return clone;
            }),
        });
        const result = await v.run({ title: 'Hello', score: 5 });
        expect(result.status).toBe(ROUNDTRIP_STATUS.FAILED);
        expect(result.lostFields).toContain('score');
    });

    it('reports failed and lists mutated fields', async () => {
        let call = 0;
        const v = new RoundtripValidator({
            sandbox: makeSandbox(data => {
                call += 1;
                if (call === 1) return { ...data };
                return { ...data, content: `<wrapper>${data.content}</wrapper>` };
            }),
        });
        const result = await v.run({ content: '<p>Hi</p>' });
        expect(result.status).toBe(ROUNDTRIP_STATUS.FAILED);
        expect(result.mutatedFields).toHaveLength(1);
        expect(result.mutatedFields[0].path).toBe('content');
    });

    it('reports added fields when the iDevice grows extra data on reload', async () => {
        let call = 0;
        const v = new RoundtripValidator({
            sandbox: makeSandbox(data => {
                call += 1;
                if (call === 1) return { ...data };
                return { ...data, _migrationVersion: 2 };
            }),
        });
        const result = await v.run({ title: 'x' });
        expect(result.status).toBe(ROUNDTRIP_STATUS.FAILED);
        expect(result.addedFields).toContain('_migrationVersion');
    });

    it('reports error when sandbox throws', async () => {
        const v = new RoundtripValidator({
            sandbox: makeSandbox(() => {
                throw new Error('boom');
            }),
        });
        const result = await v.run({ a: 1 });
        expect(result.status).toBe(ROUNDTRIP_STATUS.ERROR);
        expect(result.error).toBe('boom');
    });

    it('supports async sandboxes', async () => {
        const v = new RoundtripValidator({
            sandbox: makeSandbox(async data => ({ ...data })),
        });
        const result = await v.run({ title: 'async' });
        expect(result.status).toBe(ROUNDTRIP_STATUS.PASSED);
    });

    it('exposes both snapshots on success', async () => {
        const v = new RoundtripValidator({
            sandbox: makeSandbox(data => ({ ...data })),
        });
        const result = await v.run({ title: 'snap' });
        expect(result.snapshots.first).toEqual({ title: 'snap' });
        expect(result.snapshots.second).toEqual({ title: 'snap' });
    });

    it('clones initial data so the caller is not mutated', async () => {
        const v = new RoundtripValidator({
            sandbox: makeSandbox(data => {
                data.tampered = true;
                return data;
            }),
        });
        const initial = { title: 't' };
        await v.run(initial);
        expect(initial).not.toHaveProperty('tampered');
    });
});
