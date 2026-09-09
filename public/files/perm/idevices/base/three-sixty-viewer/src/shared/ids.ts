/**
 * Stable ID generation for scenes and hotspots.
 *
 * The legacy format is preserved (`scene-<time36>-<rand36>` /
 * `hs-<time36>-<rand36>`) but the entropy sources are injectable so tests can
 * generate deterministic IDs.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface IdGenerator {
    scene(): string;
    hotspot(): string;
}

export interface EntropySources {
    readonly now: () => number;
    readonly random: () => number;
}

const defaultEntropy: EntropySources = {
    now: () => Date.now(),
    random: () => Math.random(),
};

function randomSuffix(entropy: EntropySources): string {
    return `${entropy.now().toString(36)}-${Math.floor(entropy.random() * 1e6).toString(36)}`;
}

/** Build an {@link IdGenerator}; pass fake entropy for deterministic tests. */
export function createIdGenerator(entropy: EntropySources = defaultEntropy): IdGenerator {
    return {
        scene: () => `scene-${randomSuffix(entropy)}`,
        hotspot: () => `hs-${randomSuffix(entropy)}`,
    };
}

/** A deterministic generator producing scene-1, scene-2… / hs-1, hs-2… */
export function createSequentialIdGenerator(prefixSeparator = '-'): IdGenerator {
    let sceneCount = 0;
    let hotspotCount = 0;
    return {
        scene: () => `scene${prefixSeparator}${++sceneCount}`,
        hotspot: () => `hs${prefixSeparator}${++hotspotCount}`,
    };
}
