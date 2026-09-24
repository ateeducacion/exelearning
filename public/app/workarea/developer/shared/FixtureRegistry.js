/**
 * FixtureRegistry
 *
 * Manifest-backed registry of test fixtures available to the Style Lab and
 * iDevice Lab. Fixture IDs are sanitized against a strict allowlist so URL
 * state cannot be coerced into reading arbitrary files from the filesystem.
 *
 * The registry is intentionally manifest-driven (rather than glob-based)
 * so adding a new fixture is an explicit act recorded in the manifest.
 */

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export class FixtureRegistry {
    constructor(manifest = []) {
        const safe = [];
        const seen = new Set();
        for (const entry of manifest) {
            if (!entry || typeof entry !== 'object') continue;
            const id = typeof entry.id === 'string' && SAFE_ID_RE.test(entry.id) ? entry.id : null;
            if (!id || seen.has(id)) continue;
            seen.add(id);
            safe.push({
                id,
                label: typeof entry.label === 'string' ? entry.label : id,
                path: typeof entry.path === 'string' ? entry.path : null,
                source: typeof entry.source === 'string' ? entry.source : null,
                tags: Array.isArray(entry.tags) ? entry.tags.filter(t => typeof t === 'string') : [],
            });
        }
        this.entries = safe;
        this.byId = new Map(safe.map(e => [e.id, e]));
    }

    list() {
        return [...this.entries];
    }

    get(id) {
        return this.byId.get(id) ?? null;
    }

    has(id) {
        return this.byId.has(id);
    }

    /**
     * Returns the entry whose id matches `id`, or the first entry as a
     * default — useful when an invalid URL parameter is supplied.
     */
    resolveOrDefault(id) {
        if (id && this.byId.has(id)) return this.byId.get(id);
        return this.entries[0] ?? null;
    }
}

export default FixtureRegistry;
