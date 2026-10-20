/** Model-source classification: what kind of file is this, and may we keep it? */

import type { ModelType } from './types';
import { stripQueryAndHash } from './urls';

/** Extensions the file picker accepts and the two render paths cover. */
export const SUPPORTED_MODEL_EXTENSIONS = ['glb', 'gltf', 'stl'] as const;

/** Extensions `detectModelType` recognises (a superset of the supported ones). */
const KNOWN_EXTENSIONS: readonly ModelType[] = ['stl', 'glb', 'gltf', 'obj', 'fbx'];

/**
 * Detect the model type from a path or `asset://` URL by file extension.
 * Tolerates query strings, hash fragments, mixed case and surrounding space.
 */
export function detectModelType(src: unknown): ModelType {
    if (typeof src !== 'string') {
        return 'unknown';
    }
    const clean = stripQueryAndHash(src.trim());
    const dot = clean.lastIndexOf('.');
    if (dot === -1) {
        return 'unknown';
    }
    const ext = clean.substring(dot + 1).toLowerCase();
    return (KNOWN_EXTENSIONS as readonly string[]).includes(ext) ? (ext as ModelType) : 'unknown';
}

/** True when the source resolves to an STL file (the Three.js render path). */
export function isStlSource(src: unknown): boolean {
    return detectModelType(src) === 'stl';
}

/**
 * Normalize an inbound model source for persistence.
 *
 * `asset://`, `http(s)://` and relative paths pass through unchanged;
 * `blob:` and `data:` are dropped because they are ephemeral runtime URLs
 * that must never reach the saved document.
 */
export function normalizeModelSource(src: unknown): string {
    if (typeof src !== 'string') {
        return '';
    }
    const clean = src.trim();
    if (!clean || clean.startsWith('blob:') || clean.startsWith('data:')) {
        return '';
    }
    return clean;
}

/**
 * Whether a picked file is one the viewer can render. `blob:` URLs are accepted
 * because they carry no extension — the file was validated at upload time.
 */
export function isSupportedModelFile(path: unknown): boolean {
    if (!path) {
        return false;
    }
    let filename = String(path).toLowerCase();
    if (filename.startsWith('asset://')) {
        filename = filename.substring('asset://'.length);
    } else if (filename.startsWith('blob:')) {
        return true;
    } else {
        filename = filename.split('/').pop() ?? '';
    }
    filename = stripQueryAndHash(filename);
    if (!filename) {
        return false;
    }
    return SUPPORTED_MODEL_EXTENSIONS.some(ext => filename.endsWith(`.${ext}`));
}
