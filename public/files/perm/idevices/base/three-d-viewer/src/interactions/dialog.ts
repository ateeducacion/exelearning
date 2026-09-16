/**
 * The accessible marker dialog: a modal with a focus trap, Escape handling and
 * focus return. One dialog is open at a time per controller.
 */

const FOCUSABLE_SELECTOR =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Focusable descendants that are actually reachable right now. */
export function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        element => element.offsetParent !== null || element === document.activeElement,
    );
}

export interface DialogHandle {
    readonly overlay: HTMLElement;
    readonly dialog: HTMLElement;
    readonly body: HTMLElement;
    close(): void;
}

export interface DialogOptions {
    title: string;
    closeLabel: string;
    /** Where the overlay is appended; defaults to `document.body`. */
    host?: HTMLElement | null;
    onClose?: () => void;
}

/**
 * Open a modal dialog and fill its body through `buildBody`.
 *
 * Returns a handle whose `close()` removes the dialog and restores focus to
 * whatever had it before. The caller owns the handle and must close it on
 * teardown; nothing here registers a global listener.
 */
export function openDialog(options: DialogOptions, buildBody: (body: HTMLElement) => void): DialogHandle {
    const previouslyFocused = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'tdv-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'tdv-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', options.title);

    const header = document.createElement('div');
    header.className = 'tdv-dialog-header';
    const heading = document.createElement('h2');
    heading.className = 'tdv-dialog-title';
    heading.textContent = options.title;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'tdv-dialog-close';
    closeButton.setAttribute('aria-label', options.closeLabel);
    closeButton.textContent = '✕';
    header.append(heading, closeButton);

    const body = document.createElement('div');
    body.className = 'tdv-dialog-body';

    dialog.append(header, body);
    overlay.appendChild(dialog);
    (options.host ?? document.body).appendChild(overlay);

    buildBody(body);

    let closed = false;
    const close = (): void => {
        if (closed) {
            return;
        }
        closed = true;
        try {
            overlay.remove();
        } catch {
            // Already detached, e.g. the wrapper was replaced.
        }
        if (previouslyFocused instanceof HTMLElement) {
            try {
                previouslyFocused.focus();
            } catch {
                // The previously focused node may have gone away.
            }
        }
        options.onClose?.();
    };

    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            close();
        }
    });
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }
        const focusable = getFocusable(dialog);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) {
            return;
        }
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    try {
        closeButton.focus();
    } catch {
        // happy-dom and detached hosts can refuse focus; not fatal.
    }

    return { overlay, dialog, body, close };
}
