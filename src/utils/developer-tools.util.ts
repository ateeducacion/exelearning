/**
 * Developer Tools availability helper.
 *
 * Developer tools (Style Lab, iDevice Lab, REST API browser) are intentionally
 * gated to development environments to avoid leaking ad-hoc debugging surfaces
 * into production deployments.
 *
 * The gate is `APP_ENV=dev`. A future `DEV_TOOLS_ENABLED=1` override is
 * supported for cases where developer tools need to be exposed in a
 * non-dev environment (e.g. staging), but production deployments should
 * always leave both unset.
 */

/**
 * Returns true if Developer tools should be exposed in the current
 * runtime environment.
 *
 * Visibility rules:
 * - `APP_ENV=dev` enables developer tools.
 * - `DEV_TOOLS_ENABLED` set to a truthy value enables developer tools
 *   regardless of APP_ENV. Accepted truthy values are: `1`, `true`, `yes`, `on`
 *   (case-insensitive, trimmed).
 * - In all other cases developer tools are disabled.
 */
export function isDeveloperToolsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.APP_ENV === 'dev') {
        return true;
    }
    const override = env.DEV_TOOLS_ENABLED;
    if (typeof override === 'string') {
        const normalized = override.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) {
            return true;
        }
    }
    return false;
}

/**
 * Build a stable list of developer tool entries used by templates and
 * Playwright assertions.
 *
 * Returning a deterministic shape keeps the menu order predictable for
 * automation and means we can introduce new entries without touching the
 * Nunjucks template.
 */
export interface DeveloperToolEntry {
    id: string;
    href: string;
    labelKey: string;
    testId: string;
}

export function getDeveloperToolEntries(basePath: string = ''): DeveloperToolEntry[] {
    const prefix = basePath ? basePath.replace(/\/+$/, '') : '';
    return [
        {
            id: 'style-lab',
            href: `${prefix}/developer/style-lab`,
            labelKey: 'Style Lab',
            testId: 'developer-menu-style-lab',
        },
        {
            id: 'idevice-lab',
            href: `${prefix}/developer/idevice-lab`,
            labelKey: 'iDevice Lab',
            testId: 'developer-menu-idevice-lab',
        },
        {
            id: 'rest-api',
            href: `${prefix}/api/v1/docs`,
            labelKey: 'REST API',
            testId: 'developer-menu-rest-api',
        },
    ];
}
