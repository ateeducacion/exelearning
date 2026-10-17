/**
 * Schema v2 normalization.
 *
 * Every function here takes `unknown` and returns a fully-formed, canonical
 * value: parsing persisted JSON, reading a DOM dataset and building a document
 * in the editor all funnel through the same code, so there is exactly one
 * definition of "what a valid 3D Viewer document looks like".
 *
 * All normalizers are idempotent — `normalize(normalize(x))` equals
 * `normalize(x)` — which is what makes save/reopen round trips stable.
 */

import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR, normalizeColor } from './colors';
import { normalizeModelSource } from './model-source';
import type {
    AnimationSettings,
    IdFactory,
    ImagePayload,
    InformationPayload,
    InteractionSettings,
    LinkPayload,
    Marker,
    MarkerAction,
    MarkerActionType,
    MarkerAnchor,
    MarkerCamera,
    MarkerIcon,
    QuestionOption,
    ScormSettings,
    SingleChoiceQuestion,
    ThreeDViewerDocumentV2,
    Vector3,
    VideoPayload,
} from './types';
import { MARKER_ACTION_TYPES, MARKER_ICONS } from './types';
import { stripUnsafeUrl } from './urls';

/** Upper bound on authored answers; the editor stops at 8, storage tolerates 10. */
const MAX_QUESTION_OPTIONS = 10;
const MAX_ATTEMPTS_ALLOWED = 20;

/** The default, non-deterministic id factory used outside tests. */
export const defaultIdFactory: IdFactory = prefix =>
    `${prefix}-${Math.floor(Math.random() * 1e9).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function keepOrCreateId(value: unknown, prefix: string, createId: IdFactory): string {
    return typeof value === 'string' && value ? value : createId(prefix);
}

export function normalizeVector3(value: unknown, fallback: Vector3): Vector3 {
    const raw = asRecord(value);
    return {
        x: toNumber(raw.x, fallback.x),
        y: toNumber(raw.y, fallback.y),
        z: toNumber(raw.z, fallback.z),
    };
}

export function normalizeAnchor(value: unknown): MarkerAnchor {
    const raw = asRecord(value);
    return {
        position: normalizeVector3(raw.position, { x: 0, y: 0, z: 0 }),
        normal: normalizeVector3(raw.normal, { x: 0, y: 1, z: 0 }),
        surface: toText(raw.surface),
    };
}

export function normalizeCamera(value: unknown): MarkerCamera {
    const raw = asRecord(value);
    return {
        orbit: toText(raw.orbit),
        target: toText(raw.target),
        fieldOfView: toText(raw.fieldOfView),
    };
}

export function normalizeQuestion(value: unknown, createId: IdFactory = defaultIdFactory): SingleChoiceQuestion {
    const raw = asRecord(value);
    const rawOptions = Array.isArray(raw.options) ? raw.options : [];
    let seenCorrect = false;
    const options: QuestionOption[] = rawOptions.slice(0, MAX_QUESTION_OPTIONS).map(option => {
        const item = asRecord(option);
        // Exactly one correct answer: the first one flagged wins.
        const correct = Boolean(item.correct) && !seenCorrect;
        if (correct) {
            seenCorrect = true;
        }
        return { id: keepOrCreateId(item.id, 'option', createId), text: toText(item.text), correct };
    });
    if (options.length === 0) {
        options.push(
            { id: createId('option'), text: '', correct: true },
            { id: createId('option'), text: '', correct: false },
        );
    } else if (!seenCorrect) {
        const first = options[0];
        if (first) {
            first.correct = true;
        }
    }
    return {
        prompt: toText(raw.prompt),
        type: 'single-choice',
        options,
        feedbackCorrect: toText(raw.feedbackCorrect),
        feedbackIncorrect: toText(raw.feedbackIncorrect),
        attemptsAllowed: clamp(Math.round(toNumber(raw.attemptsAllowed, 0)), 0, MAX_ATTEMPTS_ALLOWED),
    };
}

function normalizeInformationPayload(raw: Record<string, unknown>): InformationPayload {
    return { html: toText(raw.html) };
}

function normalizeImagePayload(raw: Record<string, unknown>): ImagePayload {
    return { src: stripUnsafeUrl(raw.src), alt: toText(raw.alt), caption: toText(raw.caption) };
}

function normalizeVideoPayload(raw: Record<string, unknown>): VideoPayload {
    return { src: stripUnsafeUrl(raw.src), poster: stripUnsafeUrl(raw.poster) };
}

function normalizeLinkPayload(raw: Record<string, unknown>): LinkPayload {
    return { url: stripUnsafeUrl(raw.url), newTab: raw.newTab !== false };
}

function toActionType(value: unknown): MarkerActionType {
    return (MARKER_ACTION_TYPES as readonly string[]).includes(String(value))
        ? (value as MarkerActionType)
        : 'information';
}

export function normalizeAction(value: unknown, createId: IdFactory = defaultIdFactory): MarkerAction {
    const raw = asRecord(value);
    const type = toActionType(raw.type);
    const payload = asRecord(raw.payload);
    switch (type) {
        case 'image':
            return { type, payload: normalizeImagePayload(payload) };
        case 'video':
            return { type, payload: normalizeVideoPayload(payload) };
        case 'link':
            return { type, payload: normalizeLinkPayload(payload) };
        case 'question':
            return { type, payload: normalizeQuestion(payload, createId) };
        case 'information':
            return { type, payload: normalizeInformationPayload(payload) };
    }
    // Exhaustiveness guard: adding a MarkerActionType without a branch above is
    // a compile error here, not a silent fallthrough.
    const unreachable: never = type;
    void unreachable;
    return { type: 'information', payload: { html: '' } };
}

function toIcon(value: unknown): MarkerIcon {
    return (MARKER_ICONS as readonly string[]).includes(String(value)) ? (value as MarkerIcon) : 'circle';
}

export function normalizeMarker(value: unknown, index: number, createId: IdFactory = defaultIdFactory): Marker {
    const raw = asRecord(value);
    const order = toNumber(raw.order, Number.NaN);
    return {
        id: keepOrCreateId(raw.id, 'marker', createId),
        label: toText(raw.label),
        description: toText(raw.description),
        icon: toIcon(raw.icon),
        order: Number.isFinite(order) ? order : index,
        anchor: normalizeAnchor(raw.anchor),
        camera: normalizeCamera(raw.camera),
        action: normalizeAction(raw.action, createId),
    };
}

export function normalizeInteraction(value: unknown, createId: IdFactory = defaultIdFactory): InteractionSettings {
    const raw = asRecord(value);
    const markers = (Array.isArray(raw.markers) ? raw.markers : []).map((marker, index) =>
        normalizeMarker(marker, index, createId),
    );
    markers.sort((a, b) => a.order - b.order);
    markers.forEach((marker, index) => {
        marker.order = index;
    });
    const ids = markers.map(marker => marker.id);
    const activeMarkerId = toText(raw.activeMarkerId);
    return {
        enabled: Boolean(raw.enabled),
        guidedMode: Boolean(raw.guidedMode),
        wrapNavigation: Boolean(raw.wrapNavigation),
        showMarkerLabels: raw.showMarkerLabels !== false,
        activeMarkerId: ids.includes(activeMarkerId) ? activeMarkerId : '',
        markers,
    };
}

export function normalizeAnimation(value: unknown): AnimationSettings {
    const raw = asRecord(value);
    return {
        enabled: Boolean(raw.enabled),
        name: toText(raw.name),
        speed: clamp(toNumber(raw.speed, 1), 0.1, 3),
    };
}

/**
 * Normalize the SCORM block.
 *
 * Accepts both the canonical nested shape (`{ mode, weighted, saveButtonText }`)
 * and the shared gamification framework's flat naming (`isScorm`, `weighted`,
 * `textButtonScorm`), because that framework is the only other producer of
 * these values. This is the single place the two vocabularies meet.
 */
export function normalizeScorm(value: unknown): ScormSettings {
    const raw = asRecord(value);
    const mode = clamp(toInteger(raw.mode ?? raw.isScorm, 0), 0, 2) as ScormSettings['mode'];
    return {
        mode,
        weighted: clamp(toNumber(raw.weighted, 100), 1, 100),
        saveButtonText: toText(raw.saveButtonText ?? raw.textButtonScorm),
    };
}

/** The document a brand-new 3D Viewer iDevice starts from. */
export function createDefaultDocument(): ThreeDViewerDocumentV2 {
    return {
        schemaVersion: 2,
        src: '',
        alt: '',
        modelColor: DEFAULT_MODEL_COLOR,
        backgroundColor: DEFAULT_BACKGROUND_COLOR,
        cameraControls: true,
        autoRotate: true,
        autoRotateSpeed: 30,
        showNavControls: false,
        animation: { enabled: false, name: '', speed: 1 },
        interaction: {
            enabled: false,
            guidedMode: false,
            wrapNavigation: false,
            showMarkerLabels: true,
            activeMarkerId: '',
            markers: [],
        },
        scorm: { mode: 0, weighted: 100, saveButtonText: '' },
    };
}

/**
 * Normalize an already-parsed record into a canonical schema-v2 document.
 * Callers that start from untrusted input should use `hydrateDocument` instead,
 * which handles version gating first.
 */
export function normalizeDocument(value: unknown, createId: IdFactory = defaultIdFactory): ThreeDViewerDocumentV2 {
    const raw = asRecord(value);
    const defaults = createDefaultDocument();
    const showNavControls = typeof raw.showNavControls === 'boolean' ? raw.showNavControls : defaults.showNavControls;
    const autoRotate = typeof raw.autoRotate === 'boolean' ? raw.autoRotate : defaults.autoRotate;
    return {
        schemaVersion: 2,
        src: normalizeModelSource(raw.src),
        alt: toText(raw.alt),
        modelColor: normalizeColor(raw.modelColor, DEFAULT_MODEL_COLOR),
        backgroundColor: normalizeColor(raw.backgroundColor, DEFAULT_BACKGROUND_COLOR),
        cameraControls: typeof raw.cameraControls === 'boolean' ? raw.cameraControls : defaults.cameraControls,
        // Mutually exclusive: manual nav controls win over auto-rotation.
        autoRotate: showNavControls ? false : autoRotate,
        autoRotateSpeed: clamp(toNumber(raw.autoRotateSpeed, 30), 1, 90),
        showNavControls,
        animation: normalizeAnimation(raw.animation),
        interaction: normalizeInteraction(raw.interaction, createId),
        scorm: normalizeScorm(raw.scorm ?? raw),
    };
}
