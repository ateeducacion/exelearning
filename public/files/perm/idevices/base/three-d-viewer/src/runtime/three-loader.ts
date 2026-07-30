/**
 * Lazy loading of the vendored Three.js ES modules (core + STLLoader +
 * OrbitControls) used by the STL render path.
 *
 * The modules are only fetched when an STL model is actually shown, and the
 * in-flight promise is parked on `window.$exeLibs` so the editor and the export
 * runtime on the same page share one download.
 */

function libs(): Record<string, unknown> {
    globalThis.$exeLibs = globalThis.$exeLibs ?? {};
    return globalThis.$exeLibs;
}

/** True once THREE, STLLoader and OrbitControls are all on `window.THREE`. */
export function isThreeJsReady(): boolean {
    const three = globalThis.THREE;
    return Boolean(three?.STLLoader && three?.OrbitControls);
}

/**
 * Import the Three.js modules from `baseUrl` and publish them on `window.THREE`.
 *
 * `baseUrl` must be absolute: a dynamic `import()` resolves relative specifiers
 * against the importing module, which would duplicate the bundle's own path.
 */
export async function ensureThreeJsLoaded(baseUrl: string): Promise<void> {
    if (isThreeJsReady()) {
        return;
    }
    const shared = libs();
    const pending = shared.threeJsPromise;
    if (pending instanceof Promise) {
        await pending;
        return;
    }
    const loading = (async () => {
        const core = (await import(/* @vite-ignore */ `${baseUrl}three.module.min.js`)) as Record<string, unknown>;
        const { STLLoader } = (await import(/* @vite-ignore */ `${baseUrl}STLLoader.js`)) as {
            STLLoader: ThreeNamespace['STLLoader'];
        };
        const { OrbitControls } = (await import(/* @vite-ignore */ `${baseUrl}OrbitControls.js`)) as {
            OrbitControls: ThreeNamespace['OrbitControls'];
        };
        const three = (globalThis.THREE ?? {}) as ThreeNamespace;
        Object.assign(three, core);
        three.STLLoader = STLLoader;
        three.OrbitControls = OrbitControls;
        globalThis.THREE = three;
    })();
    shared.threeJsPromise = loading;
    await loading;
}
