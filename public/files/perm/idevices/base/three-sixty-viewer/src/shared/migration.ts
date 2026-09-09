/**
 * v1 → v2 migration.
 *
 * v1 is the original single-image document (top-level `src`, `alt`,
 * `initialView`, `autorotate`, `zoomEnabled`, `fullscreenEnabled`,
 * `showNavControls`). It is lifted into a one-scene v2 tour; nothing is lost.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { normalizeInitialView } from './normalization';

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * True when the input carries any of the v1 top-level fields. Mirrors the
 * legacy detection exactly, so previously-migratable content stays
 * migratable.
 */
export function isV1Document(input: unknown): boolean {
    const record = asRecord(input);
    if (Object.keys(record).length === 0) return false;
    return (
        typeof record.src === 'string' ||
        typeof record.alt === 'string' ||
        Boolean(record.initialView) ||
        Boolean(record.autorotate) ||
        'zoomEnabled' in record ||
        'fullscreenEnabled' in record
    );
}

export interface V2Parts {
    readonly scenes: unknown[];
    readonly startSceneId: string;
    readonly behaviour: Record<string, unknown>;
}

/** Lift a v1 document into loosely-shaped v2 parts (normalized afterwards). */
export function migrateV1ToV2(input: unknown): V2Parts {
    const record = asRecord(input);
    const scene = {
        id: 'scene-1',
        title: '',
        src: typeof record.src === 'string' ? record.src : '',
        alt: typeof record.alt === 'string' ? record.alt : '',
        description: '',
        projection: 'equirectangular',
        initialView: normalizeInitialView(record.initialView),
        hotspots: [],
    };
    return {
        scenes: [scene],
        startSceneId: 'scene-1',
        behaviour: {
            autorotate: record.autorotate ?? {},
            zoomEnabled: record.zoomEnabled,
            fullscreenEnabled: record.fullscreenEnabled,
            showNavControls: record.showNavControls,
        },
    };
}
