import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThreeStub } from '../test/three-stub';
import { ensureThreeJsLoaded, isThreeJsReady } from './three-loader';

beforeEach(() => {
    globalThis.THREE = undefined;
    globalThis.$exeLibs = undefined;
});

afterEach(() => {
    globalThis.THREE = undefined;
    globalThis.$exeLibs = undefined;
    vi.restoreAllMocks();
});

describe('isThreeJsReady', () => {
    it('needs the core plus both add-ons', () => {
        expect(isThreeJsReady()).toBe(false);
        const three = createThreeStub();
        globalThis.THREE = three;
        // The stub namespace ships neither add-on by default.
        expect(isThreeJsReady()).toBe(false);
        three.STLLoader = class {} as unknown as ThreeNamespace['STLLoader'];
        three.OrbitControls = class {} as unknown as ThreeNamespace['OrbitControls'];
        expect(isThreeJsReady()).toBe(true);
    });
});

describe('ensureThreeJsLoaded', () => {
    it('returns immediately when Three.js is already published', async () => {
        const three = createThreeStub();
        three.STLLoader = class {} as unknown as ThreeNamespace['STLLoader'];
        three.OrbitControls = class {} as unknown as ThreeNamespace['OrbitControls'];
        globalThis.THREE = three;
        await expect(ensureThreeJsLoaded('http://host/libs/')).resolves.toBeUndefined();
    });

    it('waits for an in-flight load started by the other bundle', async () => {
        let resolveShared: () => void = () => {};
        globalThis.$exeLibs = {
            threeJsPromise: new Promise<void>(resolve => {
                resolveShared = resolve;
            }),
        };
        let settled = false;
        const promise = ensureThreeJsLoaded('http://host/libs/').then(() => {
            settled = true;
        });
        expect(settled).toBe(false);
        resolveShared();
        await promise;
        expect(settled).toBe(true);
    });

    it('surfaces an import failure rather than resolving silently', async () => {
        // The vendored modules are not importable from the test environment, so
        // a real call must reject; callers wrap it in their own error handling.
        await expect(ensureThreeJsLoaded('http://127.0.0.1:0/missing/')).rejects.toThrow();
    });
});
