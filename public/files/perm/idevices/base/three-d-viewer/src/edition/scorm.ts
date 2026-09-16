/**
 * The SCORM section of the editor.
 *
 * The shared gamification framework owns the markup; this module only mounts
 * it, converts between its flat vocabulary and the document's nested
 * `ScormSettings`, and degrades to the stored values when the framework is
 * missing (which it is in the unit-test environment).
 */

import { normalizeScorm } from '../shared/schema';
import type { Marker, ScormSettings } from '../shared/types';

/** The shared SCORM edition helper, or null when the framework is absent. */
export function getScormEdition(): ExeScormEdition | null {
    return globalThis.$exeDevicesEdition?.iDevice?.gamification?.scorm ?? null;
}

/** Scoring is only meaningful once there is a question marker to score. */
export function shouldShowScormSection(interactionEnabled: boolean, markers: readonly Marker[]): boolean {
    return interactionEnabled && markers.some(marker => marker.action.type === 'question');
}

export interface ScormSection {
    /** Mount the framework's tab, reflecting the stored configuration. */
    render(scorm: ScormSettings, defaultButtonText: string): void;
    /** Read the tab back, falling back to the stored values. */
    read(current: ScormSettings): ScormSettings;
    /** Whether the tab has been mounted. */
    isRendered(): boolean;
    reset(): void;
}

export function createScormSection(host: HTMLElement): ScormSection {
    let rendered = false;
    return {
        render(scorm, defaultButtonText) {
            const framework = getScormEdition();
            if (!framework?.getTab) {
                return;
            }
            try {
                host.innerHTML = framework.getTab(false, false);
                framework.init?.();
                framework.setValues?.(scorm.mode, scorm.saveButtonText || defaultButtonText, true, scorm.weighted);
                rendered = true;
            } catch (error) {
                console.warn('[3D Viewer] SCORM tab unavailable:', error);
            }
        },
        read(current) {
            const framework = getScormEdition();
            if (rendered && framework?.getValues) {
                try {
                    const values = framework.getValues();
                    if (values) {
                        return normalizeScorm(values);
                    }
                } catch {
                    // Fall through and preserve what is already stored.
                }
            }
            return normalizeScorm(current);
        },
        isRendered: () => rendered,
        reset() {
            rendered = false;
            host.innerHTML = '';
        },
    };
}
