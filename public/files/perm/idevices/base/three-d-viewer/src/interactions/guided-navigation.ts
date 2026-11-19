/**
 * Guided navigation: previous/next controls plus the live position status.
 *
 * The index arithmetic is a pure function so wrapping, clamping and the
 * "nothing selected yet" case are testable without any DOM.
 */

export interface GuidedNavigationDeps {
    t: (key: string) => string;
    onGo: (delta: number) => void;
}

export interface GuidedNavigationView {
    /** Show/hide the controls and refresh their disabled state and status text. */
    update(options: { enabled: boolean; index: number; total: number; wrap: boolean }): void;
    destroy(): void;
}

/**
 * Resolve the marker index a previous/next step lands on.
 *
 * Returns `null` when the step is not possible (empty list, or an edge without
 * wrapping). With nothing selected, "next" starts at the first marker and
 * "previous" starts at the last.
 */
export function resolveStepIndex(current: number, delta: number, total: number, wrap: boolean): number | null {
    if (total <= 0) {
        return null;
    }
    const start = current < 0 ? (delta > 0 ? -1 : total) : current;
    const next = start + delta;
    if (wrap) {
        return ((next % total) + total) % total;
    }
    return next < 0 || next >= total ? null : next;
}

function buildControls(t: (key: string) => string): HTMLElement {
    const nav = document.createElement('div');
    nav.className = 'tdv-guided-nav';
    nav.setAttribute('data-guided', '');
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'tdv-nav-prev';
    previous.textContent = t('Previous');
    const status = document.createElement('span');
    status.className = 'tdv-guided-status';
    status.setAttribute('aria-live', 'polite');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'tdv-nav-next';
    next.textContent = t('Next');
    nav.append(previous, status, next);
    return nav;
}

/**
 * Attach to the guided-nav controls of a wrapper, creating them when the export
 * markup did not bake them in (the editor preview).
 *
 * Click handlers are bound exactly once, even though `update()` runs on every
 * render — re-binding would make one click advance several markers.
 */
export function createGuidedNavigation(wrapper: HTMLElement | null, deps: GuidedNavigationDeps): GuidedNavigationView {
    let nav: HTMLElement | null = wrapper?.querySelector<HTMLElement>('.tdv-guided-nav') ?? null;
    let created = false;
    const listeners: Array<() => void> = [];

    const ensureNav = (): HTMLElement | null => {
        if (nav || !wrapper) {
            return nav;
        }
        nav = buildControls(deps.t);
        created = true;
        wrapper.appendChild(nav);
        return nav;
    };

    const bindOnce = (element: HTMLElement): void => {
        if (element.dataset.tdvBound === '1') {
            return;
        }
        element.dataset.tdvBound = '1';
        const previousButton = element.querySelector<HTMLButtonElement>('.tdv-nav-prev');
        const nextButton = element.querySelector<HTMLButtonElement>('.tdv-nav-next');
        if (previousButton) {
            const handler = (): void => deps.onGo(-1);
            previousButton.addEventListener('click', handler);
            listeners.push(() => previousButton.removeEventListener('click', handler));
        }
        if (nextButton) {
            const handler = (): void => deps.onGo(1);
            nextButton.addEventListener('click', handler);
            listeners.push(() => nextButton.removeEventListener('click', handler));
        }
    };

    return {
        update({ enabled, index, total, wrap }) {
            if (!enabled) {
                if (nav) {
                    nav.hidden = true;
                }
                return;
            }
            const element = ensureNav();
            if (!element) {
                return;
            }
            element.hidden = false;
            const previousButton = element.querySelector<HTMLButtonElement>('.tdv-nav-prev');
            const nextButton = element.querySelector<HTMLButtonElement>('.tdv-nav-next');
            if (previousButton && !previousButton.textContent) {
                previousButton.textContent = deps.t('Previous');
            }
            if (nextButton && !nextButton.textContent) {
                nextButton.textContent = deps.t('Next');
            }
            bindOnce(element);
            const empty = total === 0;
            if (previousButton) {
                previousButton.disabled = empty || (!wrap && index <= 0);
            }
            if (nextButton) {
                nextButton.disabled = empty || (!wrap && index >= total - 1);
            }
            const status = element.querySelector<HTMLElement>('.tdv-guided-status');
            if (status) {
                status.textContent = `${deps.t('Marker')} ${index < 0 ? 0 : index + 1} / ${total}`;
            }
        },
        destroy() {
            for (const off of listeners) {
                off();
            }
            listeners.length = 0;
            if (created && nav) {
                try {
                    nav.remove();
                } catch {
                    // Wrapper already gone.
                }
            }
            nav = null;
        },
    };
}
