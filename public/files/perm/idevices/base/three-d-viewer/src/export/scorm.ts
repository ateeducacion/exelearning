/**
 * SCORM transport for question markers.
 *
 * All arithmetic lives in `shared/scoring.ts`; this module only talks to the
 * shared gamification framework. Scoring is wired only inside a real SCORM
 * export, only when the author enabled it, only when the framework is present
 * and only when there is at least one question to score.
 */

import { computeScore, isActivityComplete, questionMarkers } from '../shared/scoring';
import type { InteractionSettings, ScormSettings } from '../shared/types';
import type { InteractionHooks } from '../interactions/types';

/** The shared gamification SCORM helper, or null when it is not on the page. */
export function getScormRuntime(): ExeScormRuntime | null {
    return globalThis.$exeDevices?.iDevice?.gamification?.scorm ?? null;
}

/** True inside a SCORM export (the exporter marks the body). */
export function isScormExport(): boolean {
    return Boolean(typeof document !== 'undefined' && document.body?.classList?.contains('exe-scorm'));
}

export interface ScormWiring {
    /** The activity descriptor handed to the gamification framework. */
    game: Record<string, unknown>;
    /** Marker ids answered correctly so far. */
    correctMarkerIds: ReadonlySet<string>;
}

/**
 * Attach question scoring to the interaction hooks.
 *
 * Returns the wiring when scoring was set up, or `null` when it was skipped, so
 * callers (and tests) can tell the two apart without inspecting globals.
 */
export function setupScormScoring(
    wrapper: HTMLElement,
    interaction: InteractionSettings,
    scorm: ScormSettings,
    hooks: InteractionHooks,
): ScormWiring | null {
    if (scorm.mode <= 0 || !isScormExport()) {
        return null;
    }
    const runtime = getScormRuntime();
    if (!runtime || questionMarkers(interaction.markers).length === 0) {
        return null;
    }

    const correctMarkerIds = new Set<string>();
    const game: Record<string, unknown> = {
        main: wrapper.id,
        idevice: 'three-d-viewer',
        isScorm: scorm.mode,
        weighted: scorm.weighted,
        scorerp: 0,
        gameStarted: true,
        msgs: {},
    };
    try {
        runtime.registerActivity?.(game);
    } catch {
        // A partially loaded framework degrades to "no scoring", not a crash.
    }

    hooks.onQuestionAnswered = (markerId: string, correct: boolean): void => {
        if (correct) {
            correctMarkerIds.add(markerId);
        }
        game.scorerp = computeScore(interaction.markers, correctMarkerIds);
        game.gameOver = isActivityComplete(interaction.markers, correctMarkerIds);
        try {
            runtime.sendScoreNew?.(true, game);
        } catch {
            // Same as above: reporting failures never break the learner UI.
        }
    };

    return { game, correctMarkerIds };
}
