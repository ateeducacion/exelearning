/**
 * Static Bundle Configuration
 *
 * Centralized configuration constants for the static bundle build script.
 * This is the single source of truth for locales and license options.
 */

import { LICENSE_REGISTRY } from '../../src/shared/export/constants';

// =============================================================================
// Supported Locales
// =============================================================================

/**
 * Supported GUI locales (for translation files).
 * These correspond to translation files in translations/messages.{locale}.xlf
 */
export const LOCALES = ['ca', 'en', 'eo', 'es', 'eu', 'gl', 'pt', 'ro', 'va'] as const;

/**
 * Locale display names for UI dropdowns
 */
export const LOCALE_NAMES: Record<string, string> = {
    ca: 'Català',
    en: 'English',
    eo: 'Esperanto',
    es: 'Español',
    eu: 'Euskara',
    gl: 'Galego',
    pt: 'Português',
    ro: 'Română',
    va: 'Valencià',
};

/**
 * Package locales for project language selection.
 * Currently matches LOCALE_NAMES but can be extended independently.
 */
export const PACKAGE_LOCALES: Record<string, string> = LOCALE_NAMES;

// =============================================================================
// Licenses (derived from LICENSE_REGISTRY)
// =============================================================================

/**
 * Available licenses for project properties dropdown.
 * Derived from LICENSE_REGISTRY, filtering out legacy licenses.
 *
 * Format: { 'license-key': 'display name' }
 */
export const LICENSES: Record<string, string> = Object.fromEntries(
    Object.entries(LICENSE_REGISTRY)
        .filter(([, entry]) => !entry.legacy)
        .map(([key, entry]) => [key, entry.displayName])
);

// =============================================================================
// Type exports
// =============================================================================

export type LocaleCode = (typeof LOCALES)[number];
