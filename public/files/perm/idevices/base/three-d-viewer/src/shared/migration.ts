/**
 * Turning untrusted persisted data into a canonical schema-v2 document.
 *
 * Only three transitions exist:
 *
 *   original unversioned 3D Viewer state  →  schema v2
 *   schema v2                             →  normalized schema v2
 *   schema version > 2                    →  rejected, original preserved
 *
 * The unversioned shape is everything the iDevice wrote before interactions
 * existed: model source, alt text, colours, camera/auto-rotate flags and the
 * animation block. Those documents have no `interaction` and no `scorm`, so
 * hydration gives them a disabled, empty interaction layer and they reopen and
 * re-export exactly as before.
 *
 * There is deliberately NO migration for intermediate development shapes: the
 * interaction feature has never been released, so schema v2 is the only version
 * that has ever been published.
 */

import { createDefaultDocument, defaultIdFactory, normalizeDocument } from './schema';
import type { HydrationResult, IdFactory, ThreeDViewerDocumentV2 } from './types';
import { SCHEMA_VERSION } from './types';

function readSchemaVersion(raw: Record<string, unknown>): number {
    const value = raw.schemaVersion;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    // No usable version marker: original, pre-interaction content.
    return 0;
}

/**
 * Parse, version-gate and normalize persisted data.
 *
 * Never cast persisted JSON to the document type — everything arrives as
 * `unknown` and leaves as a typed result the caller has to branch on.
 */
export function hydrateDocument(value: unknown, createId: IdFactory = defaultIdFactory): HydrationResult {
    if (value === null || value === undefined || value === '') {
        return { status: 'ok', document: createDefaultDocument() };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        return { status: 'invalid', reason: 'expected an object', original: value };
    }
    const raw = value as Record<string, unknown>;
    const version = readSchemaVersion(raw);
    if (version > SCHEMA_VERSION) {
        return { status: 'unsupported-version', version, original: value };
    }
    return { status: 'ok', document: normalizeDocument(raw, createId) };
}

/**
 * Hydrate a JSON string (or an already-parsed value). Malformed JSON is an
 * `invalid` result, never a thrown error, because it reaches us from storage.
 */
export function hydrateFromJson(value: unknown, createId: IdFactory = defaultIdFactory): HydrationResult {
    if (typeof value !== 'string') {
        return hydrateDocument(value, createId);
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return { status: 'ok', document: createDefaultDocument() };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return { status: 'invalid', reason: 'malformed JSON', original: value };
    }
    return hydrateDocument(parsed, createId);
}

/**
 * Produce the object to persist. Re-normalizing on the way out re-strips any
 * ephemeral URL that slipped in during preview and guarantees a stable,
 * idempotent serialized shape.
 */
export function serializeDocument(
    document: ThreeDViewerDocumentV2,
    createId: IdFactory = defaultIdFactory,
): ThreeDViewerDocumentV2 {
    return normalizeDocument(document, createId);
}
