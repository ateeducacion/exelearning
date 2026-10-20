/**
 * Learner answer state, keyed by marker id.
 *
 * This lives on the controller, not on the dialog, because a dialog is created
 * and destroyed every time a marker is opened. Keeping attempts here is what
 * makes the configured attempt limit apply to the marker for the whole activity
 * session instead of resetting each time the learner reopens it.
 */

export interface QuestionAttemptState {
    /** How many times the learner has pressed Check for this marker. */
    attempts: number;
    /** True once answered correctly; the question stays resolved afterwards. */
    resolved: boolean;
    /** The option the learner last chose, restored on reopen. */
    selectedOptionId: string;
}

export interface AnswerStore {
    get(markerId: string): QuestionAttemptState;
    recordAttempt(markerId: string, selectedOptionId: string, correct: boolean): QuestionAttemptState;
    /** True when the marker has used up a non-zero attempt allowance. */
    isExhausted(markerId: string, attemptsAllowed: number): boolean;
    /** Marker ids answered correctly, for scoring. */
    correctMarkerIds(): Set<string>;
    /** Forget markers that no longer exist (the author deleted them). */
    retain(markerIds: readonly string[]): void;
    clear(): void;
}

function emptyState(): QuestionAttemptState {
    return { attempts: 0, resolved: false, selectedOptionId: '' };
}

export function createAnswerStore(): AnswerStore {
    const states = new Map<string, QuestionAttemptState>();

    const get = (markerId: string): QuestionAttemptState => states.get(markerId) ?? emptyState();

    return {
        get,
        recordAttempt(markerId, selectedOptionId, correct) {
            const previous = get(markerId);
            const next: QuestionAttemptState = {
                attempts: previous.attempts + 1,
                // Once correct, always correct — a later reopen cannot undo it.
                resolved: previous.resolved || correct,
                selectedOptionId,
            };
            states.set(markerId, next);
            return next;
        },
        isExhausted(markerId, attemptsAllowed) {
            if (attemptsAllowed <= 0) {
                return false;
            }
            return get(markerId).attempts >= attemptsAllowed;
        },
        correctMarkerIds() {
            const ids = new Set<string>();
            for (const [markerId, state] of states) {
                if (state.resolved) {
                    ids.add(markerId);
                }
            }
            return ids;
        },
        retain(markerIds) {
            const keep = new Set(markerIds);
            for (const markerId of [...states.keys()]) {
                if (!keep.has(markerId)) {
                    states.delete(markerId);
                }
            }
        },
        clear() {
            states.clear();
        },
    };
}
