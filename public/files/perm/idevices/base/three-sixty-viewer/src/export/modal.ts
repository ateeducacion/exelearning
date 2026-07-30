/**
 * Accessible content modal for text/image/video hotspots: role=dialog,
 * focus trap, Escape to close and focus restoration to the trigger.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { Hotspot } from '../shared/types';
import { videoEmbedUrl } from '../shared/urls';

export interface ModalDeps {
    readonly resolveSrc: (src: string) => string;
    readonly fallbackLabel: (hotspot: Hotspot) => string;
    readonly onClose?: () => void;
}

export interface ContentModal {
    readonly dialog: HTMLElement;
    close: () => void;
}

function trapFocus(dialog: HTMLElement, event: KeyboardEvent): void {
    const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
    }
}

function populateBody(body: HTMLElement, hotspot: Hotspot, deps: ModalDeps): void {
    const action = hotspot.action;
    switch (action.type) {
        case 'text':
            body.innerHTML = action.payload.html;
            break;
        case 'image': {
            if (!action.payload.src) break;
            const image = document.createElement('img');
            image.src = deps.resolveSrc(action.payload.src);
            image.alt = action.payload.alt || hotspot.label || '';
            image.style.maxWidth = '100%';
            image.style.height = 'auto';
            body.appendChild(image);
            if (action.payload.caption) {
                const caption = document.createElement('p');
                caption.className = 'three-sixty-viewer-modal-caption';
                caption.textContent = action.payload.caption;
                body.appendChild(caption);
            }
            break;
        }
        case 'video': {
            if (!action.payload.src) break;
            const resolved = deps.resolveSrc(action.payload.src);
            const embedUrl = videoEmbedUrl(resolved);
            if (embedUrl) {
                const iframe = document.createElement('iframe');
                iframe.src = embedUrl;
                iframe.setAttribute('allowfullscreen', '');
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('title', hotspot.label || 'video');
                iframe.style.width = '100%';
                iframe.style.aspectRatio = '16/9';
                body.appendChild(iframe);
            } else {
                const video = document.createElement('video');
                video.src = resolved;
                video.controls = true;
                video.style.maxWidth = '100%';
                if (action.payload.poster) video.setAttribute('poster', deps.resolveSrc(action.payload.poster));
                body.appendChild(video);
            }
            break;
        }
        case 'goToScene':
        case 'link':
            // Handled by navigation, never by a modal.
            break;
        case 'unsupported': {
            // A future action we cannot render: explain instead of breaking.
            const note = document.createElement('p');
            note.className = 'three-sixty-viewer-modal-unsupported';
            note.textContent = 'This content was created with a newer version of eXeLearning and cannot be shown here.';
            body.appendChild(note);
            break;
        }
    }
}

/**
 * Open the modal inside `wrapper`; the trigger button regains focus when it
 * closes. Only one modal per wrapper — callers close the previous one first.
 */
export function openContentModal(
    wrapper: HTMLElement,
    hotspot: Hotspot,
    trigger: HTMLElement | null,
    deps: ModalDeps,
): ContentModal {
    const dialog = document.createElement('div');
    dialog.className = 'three-sixty-viewer-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const label = hotspot.label || deps.fallbackLabel(hotspot);
    dialog.setAttribute('aria-label', label);

    const inner = document.createElement('div');
    inner.className = 'three-sixty-viewer-modal-inner';

    const header = document.createElement('div');
    header.className = 'three-sixty-viewer-modal-header';
    const title = document.createElement('h3');
    title.className = 'three-sixty-viewer-modal-title';
    title.textContent = label;
    header.appendChild(title);
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'three-sixty-viewer-modal-close';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.textContent = '✕';
    header.appendChild(closeButton);
    inner.appendChild(header);

    const body = document.createElement('div');
    body.className = 'three-sixty-viewer-modal-body';
    populateBody(body, hotspot, deps);
    inner.appendChild(body);

    dialog.appendChild(inner);
    wrapper.appendChild(dialog);

    let closed = false;
    const close = (): void => {
        if (closed) return;
        closed = true;
        dialog.removeEventListener('keydown', onKeyDown);
        dialog.parentNode?.removeChild(dialog);
        try {
            trigger?.focus();
        } catch {
            // Focus restoration is best-effort (trigger may be gone).
        }
        deps.onClose?.();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
        } else if (event.key === 'Tab') {
            trapFocus(dialog, event);
        }
    };

    closeButton.addEventListener('click', close);
    dialog.addEventListener('keydown', onKeyDown);
    try {
        closeButton.focus();
    } catch {
        // Focus is best-effort in detached-DOM tests.
    }

    return { dialog, close };
}
