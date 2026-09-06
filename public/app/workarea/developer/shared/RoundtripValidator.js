/**
 * RoundtripValidator
 *
 * Verifies that an iDevice survives a save → reload → save cycle without
 * losing or mutating data. The flow is:
 *
 *   initial → loadData(initial) → save() → snapshot A
 *   snapshot A → loadData(snapshot A) → save() → snapshot B
 *   compare A vs B
 *
 * The validator does NOT know anything about specific iDevices. It accepts a
 * sandbox object that knows how to create a fresh instance, load data, and
 * serialize state. This is the same dependency-injection shape used elsewhere
 * in the codebase to keep iDevice-specific knowledge out of the lab kernel.
 */

const STATUS = Object.freeze({
    IDLE: 'idle',
    RUNNING: 'running',
    PASSED: 'passed',
    FAILED: 'failed',
    ERROR: 'error',
});

export const ROUNDTRIP_STATUS = STATUS;

/**
 * @typedef {Object} IdeviceSandbox
 * @property {(data: any) => any|Promise<any>} loadAndSave
 *   Creates a fresh iDevice instance, calls `loadData(data)`, then returns the
 *   serialized result of `save()`. Async is allowed.
 */

export class RoundtripValidator {
    constructor({ sandbox }) {
        if (!sandbox || typeof sandbox.loadAndSave !== 'function') {
            throw new Error('RoundtripValidator: sandbox.loadAndSave must be a function');
        }
        this.sandbox = sandbox;
    }

    /**
     * Run a save/load roundtrip against `initialData`.
     * @returns {Promise<{ status: string, lostFields?: string[], addedFields?: string[],
     *                     mutatedFields?: {path:string, before:any, after:any}[],
     *                     error?: string }>}
     */
    async run(initialData) {
        try {
            const first = await this.sandbox.loadAndSave(deepClone(initialData));
            const second = await this.sandbox.loadAndSave(deepClone(first));
            const diff = diffStates(first, second);
            const totalChanges = diff.lostFields.length + diff.addedFields.length + diff.mutatedFields.length;
            return {
                status: totalChanges === 0 ? STATUS.PASSED : STATUS.FAILED,
                lostFields: diff.lostFields,
                addedFields: diff.addedFields,
                mutatedFields: diff.mutatedFields,
                warnings: [],
                snapshots: { first, second },
            };
        } catch (err) {
            return {
                status: STATUS.ERROR,
                error: err instanceof Error ? err.message : String(err),
                lostFields: [],
                addedFields: [],
                mutatedFields: [],
                warnings: [],
            };
        }
    }
}

/**
 * Compute a structured diff between two save snapshots.
 * Exposed for unit tests and for callers that want diffing without the
 * full validator lifecycle.
 */
export function diffStates(before, after) {
    const beforePaths = flattenPaths(before);
    const afterPaths = flattenPaths(after);
    const lostFields = [];
    const addedFields = [];
    const mutatedFields = [];

    for (const [path, beforeValue] of beforePaths) {
        if (!afterPaths.has(path)) {
            lostFields.push(path);
            continue;
        }
        const afterValue = afterPaths.get(path);
        if (!sameValue(beforeValue, afterValue)) {
            mutatedFields.push({ path, before: beforeValue, after: afterValue });
        }
    }
    for (const path of afterPaths.keys()) {
        if (!beforePaths.has(path)) {
            addedFields.push(path);
        }
    }
    return { lostFields, addedFields, mutatedFields };
}

function sameValue(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
    return false;
}

function flattenPaths(value, prefix = '', acc = new Map()) {
    if (value === null || typeof value !== 'object') {
        acc.set(prefix || '$', value);
        return acc;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            acc.set(prefix || '$', '[]');
            return acc;
        }
        for (let i = 0; i < value.length; i++) {
            flattenPaths(value[i], `${prefix}[${i}]`, acc);
        }
        return acc;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) {
        acc.set(prefix || '$', '{}');
        return acc;
    }
    for (const key of keys) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        flattenPaths(value[key], nextPrefix, acc);
    }
    return acc;
}

function deepClone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            // fall through to JSON clone
        }
    }
    return JSON.parse(JSON.stringify(value));
}

export default RoundtripValidator;
