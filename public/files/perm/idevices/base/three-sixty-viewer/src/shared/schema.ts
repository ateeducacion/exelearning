/**
 * Version detection, hydration and serialization for the persisted document.
 *
 * `hydrateDocument()` is the ONLY entry point for turning unknown persisted
 * input (previousData, data attributes, JSON blocks) into a working document.
 * It never throws and never mutates its input:
 *
 *   empty / v1 / v2 input  → { status: 'ok', document, migrated }
 *   version > 2            → { status: 'unsupported-version', version, original }
 *   garbage                → { status: 'invalid', reason, original }
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { isV1Document, migrateV1ToV2 } from './migration';
import { normalizeDocument } from './normalization';
import type { IdGenerator } from './ids';
import { createIdGenerator } from './ids';
import { serializeAction } from './hotspot-actions';
import type { HydrationResult, ThreeSixtyDocumentV2 } from './types';
import { SCHEMA_VERSION } from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** A fresh, valid, empty one-scene document. */
export function createDefaultDocument(ids: IdGenerator = createIdGenerator()): ThreeSixtyDocumentV2 {
    return normalizeDocument({}, ids);
}

/**
 * Accepts the persisted value as an object or as a JSON string (data
 * attributes / `<script type="application/json">` blocks store strings).
 */
export function parseDocumentSource(input: unknown): { value: unknown } | { error: string } {
    if (typeof input !== 'string') return { value: input };
    const trimmed = input.trim();
    if (trimmed === '') return { value: null };
    try {
        return { value: JSON.parse(trimmed) };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'invalid JSON' };
    }
}

/** The numeric `version` field of the input, or null when absent/invalid. */
export function detectDocumentVersion(input: unknown): number | null {
    const record = asRecord(input);
    if (!record) return null;
    return typeof record.version === 'number' && Number.isFinite(record.version) ? record.version : null;
}

/** See module doc. */
export function hydrateDocument(input: unknown, ids: IdGenerator = createIdGenerator()): HydrationResult {
    const parsed = parseDocumentSource(input);
    if ('error' in parsed) {
        return { status: 'invalid', reason: `unparseable JSON: ${parsed.error}`, original: input };
    }
    const value = parsed.value;
    if (value === null || value === undefined) {
        return { status: 'ok', document: createDefaultDocument(ids), migrated: false };
    }
    const record = asRecord(value);
    if (!record) {
        return { status: 'invalid', reason: `expected an object, got ${Array.isArray(value) ? 'array' : typeof value}`, original: input };
    }
    const version = detectDocumentVersion(record);
    if (version !== null && version > SCHEMA_VERSION) {
        return { status: 'unsupported-version', version, original: input };
    }
    if (version !== null && version >= SCHEMA_VERSION && Array.isArray(record.scenes)) {
        return {
            status: 'ok',
            document: normalizeDocument(
                {
                    ideviceId: record.ideviceId,
                    startSceneId: record.startSceneId,
                    scenes: record.scenes,
                    behaviour: record.behaviour,
                },
                ids,
            ),
            migrated: false,
        };
    }
    if (isV1Document(record)) {
        const parts = migrateV1ToV2(record);
        return {
            status: 'ok',
            document: normalizeDocument({ ideviceId: record.ideviceId, ...parts }, ids),
            migrated: true,
        };
    }
    // Unknown-but-object input (e.g. `{}` or `{version: 2}` without scenes):
    // start from an empty document, preserving the ideviceId when present.
    return {
        status: 'ok',
        document: normalizeDocument({ ideviceId: record.ideviceId }, ids),
        migrated: false,
    };
}

/**
 * Persisted wire form of a document. Identical to the in-memory shape except
 * that unsupported hotspot actions are written back in their ORIGINAL wire
 * form, so a future version's data survives being opened and saved here.
 */
export function serializeDocument(document: ThreeSixtyDocumentV2): Record<string, unknown> {
    return {
        version: document.version,
        ideviceId: document.ideviceId,
        startSceneId: document.startSceneId,
        scenes: document.scenes.map(scene => ({
            id: scene.id,
            title: scene.title,
            src: scene.src,
            alt: scene.alt,
            description: scene.description,
            projection: scene.projection,
            initialView: { ...scene.initialView },
            hotspots: scene.hotspots.map(hotspot => ({
                id: hotspot.id,
                label: hotspot.label,
                icon: hotspot.icon,
                yaw: hotspot.yaw,
                pitch: hotspot.pitch,
                x: hotspot.x,
                y: hotspot.y,
                action: serializeAction(hotspot.action),
            })),
        })),
        behaviour: {
            autorotate: { ...document.behaviour.autorotate },
            zoomEnabled: document.behaviour.zoomEnabled,
            fullscreenEnabled: document.behaviour.fullscreenEnabled,
            showNavControls: document.behaviour.showNavControls,
            renderQuality: document.behaviour.renderQuality,
            showLabels: document.behaviour.showLabels,
            labelPosition: document.behaviour.labelPosition,
            imageAdjustments: { ...document.behaviour.imageAdjustments },
        },
    };
}
