/**
 * Publish Routes for Elysia
 *
 * Experimental feature: Publish projects directly to GitHub Pages, Netlify,
 * or Cloudflare Pages.
 *
 * These routes handle:
 * - Authentication flows (OAuth, Device Flow)
 * - Repository/site management
 * - Direct publishing of exported content
 */

import { Elysia, t } from 'elysia';
import {
    GitHubDeviceFlow,
    getPublishConfig,
    type PublishConfig,
} from '../services/publish';
import {
    publishToGitHub,
    publishToNetlify,
    publishToSurge,
    publishToCloudflare,
    listNetlifySites,
    listSurgeProjects,
    listCloudflareProjects,
    requestSurgeToken,
    getGitHubUser,
    listGitHubRepos,
    createGitHubRepo,
} from '../services/cli-publish';
import { getSession as getSessionDefault } from '../services/session-manager';
import {
    getOdeSessionDistDir as getOdeSessionDistDirDefault,
    fileExists as fileExistsDefault,
    readFile as readFileDefault,
} from '../services/file-helper';
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';
import { unzipSync } from 'fflate';

// ============================================================================
// Types for Dependency Injection
// ============================================================================

export interface PublishSessionManagerDeps {
    getSession: typeof getSessionDefault;
}

export interface PublishFileHelperDeps {
    getOdeSessionDistDir: typeof getOdeSessionDistDirDefault;
    fileExists: typeof fileExistsDefault;
    readFile: typeof readFileDefault;
}

export interface PublishDependencies {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    sessionManager?: PublishSessionManagerDeps;
    fileHelper?: PublishFileHelperDeps;
    config?: PublishConfig;
}

// Default dependencies
const defaultSessionManager: PublishSessionManagerDeps = {
    getSession: getSessionDefault,
};

const defaultFileHelper: PublishFileHelperDeps = {
    getOdeSessionDistDir: getOdeSessionDistDirDefault,
    fileExists: fileExistsDefault,
    readFile: readFileDefault,
};

// ============================================================================
// Factory Function
// ============================================================================

export function createPublishRoutes(deps: PublishDependencies = {}): Elysia {
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const { getSession } = deps.sessionManager ?? defaultSessionManager;
    const { getOdeSessionDistDir, fileExists, readFile } = deps.fileHelper ?? defaultFileHelper;
    const config = deps.config ?? getPublishConfig();

    return new Elysia({ prefix: '/api/publish' })

        // =====================================================
        // Get Publishing Configuration
        // =====================================================

        .get('/config', () => {
            return {
                success: true,
                providers: {
                    github: {
                        enabled: config.githubEnabled,
                        hasClientId: !!config.githubClientId,
                        hasDeviceClientId: !!config.githubDeviceClientId,
                    },
                    netlify: {
                        enabled: config.netlifyEnabled,
                    },
                    cloudflare: {
                        enabled: config.cloudflareEnabled,
                    },
                    surge: {
                        enabled: config.surgeEnabled,
                    },
                },
            };
        })

        // =====================================================
        // GitHub Routes
        // =====================================================

        // Start GitHub Device Flow (for desktop apps)
        .post(
            '/github/device/start',
            async ({ set }) => {
                if (!config.githubEnabled || !config.githubDeviceClientId) {
                    set.status = 400;
                    return { success: false, error: 'GitHub publishing not configured' };
                }

                try {
                    const deviceFlow = new GitHubDeviceFlow(config.githubDeviceClientId);
                    const response = await deviceFlow.startFlow();
                    return {
                        success: true,
                        ...response,
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                }
            },
        )

        // Poll for GitHub Device Flow token
        .post(
            '/github/device/poll',
            async ({ body, set }) => {
                if (!config.githubEnabled || !config.githubDeviceClientId) {
                    set.status = 400;
                    return { success: false, error: 'GitHub publishing not configured' };
                }

                const { device_code } = body as { device_code: string };

                try {
                    const deviceFlow = new GitHubDeviceFlow(config.githubDeviceClientId);
                    const response = await deviceFlow.pollForToken(device_code);

                    if (response.error) {
                        return {
                            success: false,
                            error: response.error,
                            error_description: response.error_description,
                        };
                    }

                    return {
                        success: true,
                        access_token: response.access_token,
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                }
            },
            {
                body: t.Object({
                    device_code: t.String(),
                }),
            },
        )

        // Get GitHub user info
        .post(
            '/github/user',
            async ({ body, set }) => {
                const { access_token } = body as { access_token: string };

                const result = await getGitHubUser(access_token);
                if (!result.success) {
                    set.status = 500;
                    return { success: false, error: result.error };
                }
                return {
                    success: true,
                    user: result.user,
                };
            },
            {
                body: t.Object({
                    access_token: t.String(),
                }),
            },
        )

        // List GitHub repositories
        .post(
            '/github/repos',
            async ({ body, set }) => {
                const { access_token } = body as { access_token: string };

                const result = await listGitHubRepos(access_token);
                if (!result.success) {
                    set.status = 500;
                    return { success: false, error: result.error };
                }
                return {
                    success: true,
                    repos: result.repos,
                };
            },
            {
                body: t.Object({
                    access_token: t.String(),
                }),
            },
        )

        // Create GitHub repository
        .post(
            '/github/repos/create',
            async ({ body, set }) => {
                const { access_token, name, description, is_private } = body as {
                    access_token: string;
                    name: string;
                    description?: string;
                    is_private?: boolean;
                };

                const result = await createGitHubRepo(access_token, name, description, is_private);
                if (!result.success) {
                    set.status = 500;
                    return { success: false, error: result.error };
                }
                return {
                    success: true,
                    repo: result.repo,
                };
            },
            {
                body: t.Object({
                    access_token: t.String(),
                    name: t.String(),
                    description: t.Optional(t.String()),
                    is_private: t.Optional(t.Boolean()),
                }),
            },
        )

        // Publish to GitHub Pages
        .post(
            '/github/publish',
            async ({ body, set }) => {
                const {
                    access_token,
                    session_id,
                    repo_owner,
                    repo_name,
                    branch = 'gh-pages',
                    commit_message,
                    export_type = 'html5',
                } = body as {
                    access_token: string;
                    session_id: string;
                    repo_owner: string;
                    repo_name: string;
                    branch?: string;
                    commit_message?: string;
                    export_type?: string;
                };

                // Get the exported ZIP file
                const distDir = getOdeSessionDistDir(session_id);
                const zipPath = path.join(distDir, `${export_type}.zip`);

                if (!(await fileExists(zipPath))) {
                    set.status = 400;
                    return {
                        success: false,
                        error: `Export not found. Please export your project as ${export_type} first.`,
                    };
                }

                // Extract ZIP to temp directory for gh-pages
                const extractDir = path.join(distDir, 'publish-temp-github');
                try {
                    // Clean up any previous temp directory
                    await fs.remove(extractDir);
                    await fs.ensureDir(extractDir);

                    // Read and extract the ZIP file to disk
                    const zipBuffer = await readFile(zipPath);
                    const zipData = unzipSync(new Uint8Array(zipBuffer));

                    // Write files to temp directory
                    for (const [filePath, content] of Object.entries(zipData)) {
                        // Skip directories
                        if (!filePath.endsWith('/')) {
                            const fullPath = path.join(extractDir, filePath);
                            await fs.ensureDir(path.dirname(fullPath));
                            await fs.writeFile(fullPath, Buffer.from(content));
                        }
                    }

                    // Publish using gh-pages package
                    const result = await publishToGitHub(extractDir, {
                        accessToken: access_token,
                        repoOwner: repo_owner,
                        repoName: repo_name,
                        branch,
                        message: commit_message || 'Published from eXeLearning',
                    });

                    if (result.success) {
                        return {
                            success: true,
                            url: result.url,
                            details: result.details,
                        };
                    } else {
                        set.status = 500;
                        return {
                            success: false,
                            error: result.error,
                        };
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                } finally {
                    // Always clean up temp directory
                    await fs.remove(extractDir).catch(() => {});
                }
            },
            {
                body: t.Object({
                    access_token: t.String(),
                    session_id: t.String(),
                    repo_owner: t.String(),
                    repo_name: t.String(),
                    branch: t.Optional(t.String()),
                    commit_message: t.Optional(t.String()),
                    export_type: t.Optional(t.String()),
                }),
            },
        )

        // =====================================================
        // Netlify Routes
        // =====================================================

        // List Netlify sites
        .post(
            '/netlify/sites',
            async ({ body, set }) => {
                if (!config.netlifyEnabled) {
                    set.status = 400;
                    return { success: false, error: 'Netlify publishing not enabled' };
                }

                const { access_token } = body as { access_token: string };

                const result = await listNetlifySites(access_token);
                if (!result.success) {
                    set.status = 500;
                    return { success: false, error: result.error };
                }
                return {
                    success: true,
                    sites: result.sites,
                };
            },
            {
                body: t.Object({
                    access_token: t.String(),
                }),
            },
        )

        // Publish to Netlify
        .post(
            '/netlify/publish',
            async ({ body, set }) => {
                if (!config.netlifyEnabled) {
                    set.status = 400;
                    return { success: false, error: 'Netlify publishing not enabled' };
                }

                const {
                    access_token,
                    session_id,
                    site_id,
                    site_name,
                    export_type = 'html5',
                } = body as {
                    access_token: string;
                    session_id: string;
                    site_id?: string;
                    site_name?: string;
                    export_type?: string;
                };

                // Get the exported ZIP file
                const distDir = getOdeSessionDistDir(session_id);
                const zipPath = path.join(distDir, `${export_type}.zip`);

                if (!(await fileExists(zipPath))) {
                    set.status = 400;
                    return {
                        success: false,
                        error: `Export not found. Please export your project as ${export_type} first.`,
                    };
                }

                // Extract ZIP to temp directory for Netlify CLI
                const extractDir = path.join(distDir, 'publish-temp-netlify');
                try {
                    // Clean up any previous temp directory
                    await fs.remove(extractDir);
                    await fs.ensureDir(extractDir);

                    // Read and extract the ZIP file to disk
                    const zipBuffer = await readFile(zipPath);
                    const zipData = unzipSync(new Uint8Array(zipBuffer));

                    // Write files to temp directory
                    for (const [filePath, content] of Object.entries(zipData)) {
                        if (!filePath.endsWith('/')) {
                            const fullPath = path.join(extractDir, filePath);
                            await fs.ensureDir(path.dirname(fullPath));
                            await fs.writeFile(fullPath, Buffer.from(content));
                        }
                    }

                    // Publish using Netlify CLI
                    const result = await publishToNetlify(extractDir, {
                        accessToken: access_token,
                        siteId: site_id,
                        siteName: site_name,
                    });

                    if (result.success) {
                        return {
                            success: true,
                            url: result.url,
                            details: result.details,
                        };
                    } else {
                        set.status = 500;
                        return {
                            success: false,
                            error: result.error,
                        };
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                } finally {
                    // Always clean up temp directory
                    await fs.remove(extractDir).catch(() => {});
                }
            },
            {
                body: t.Object({
                    access_token: t.String(),
                    session_id: t.String(),
                    site_id: t.Optional(t.String()),
                    site_name: t.Optional(t.String()),
                    export_type: t.Optional(t.String()),
                }),
            },
        )

        // =====================================================
        // Cloudflare Pages Routes
        // =====================================================

        // List Cloudflare Pages projects
        .post(
            '/cloudflare/projects',
            async ({ body, set }) => {
                if (!config.cloudflareEnabled) {
                    set.status = 400;
                    return { success: false, error: 'Cloudflare publishing not enabled' };
                }

                const { api_token, account_id } = body as { api_token: string; account_id: string };

                const result = await listCloudflareProjects(api_token, account_id);
                if (!result.success) {
                    set.status = 500;
                    return { success: false, error: result.error };
                }
                return {
                    success: true,
                    projects: result.projects,
                };
            },
            {
                body: t.Object({
                    api_token: t.String(),
                    account_id: t.String(),
                }),
            },
        )

        // Publish to Cloudflare Pages
        .post(
            '/cloudflare/publish',
            async ({ body, set }) => {
                if (!config.cloudflareEnabled) {
                    set.status = 400;
                    return { success: false, error: 'Cloudflare publishing not enabled' };
                }

                const {
                    api_token,
                    account_id,
                    session_id,
                    project_name,
                    export_type = 'html5',
                } = body as {
                    api_token: string;
                    account_id: string;
                    session_id: string;
                    project_name: string;
                    export_type?: string;
                };

                // Get the exported ZIP file
                const distDir = getOdeSessionDistDir(session_id);
                const zipPath = path.join(distDir, `${export_type}.zip`);

                if (!(await fileExists(zipPath))) {
                    set.status = 400;
                    return {
                        success: false,
                        error: `Export not found. Please export your project as ${export_type} first.`,
                    };
                }

                // Extract ZIP to temp directory for wrangler CLI
                const extractDir = path.join(distDir, 'publish-temp-cloudflare');
                try {
                    // Clean up any previous temp directory
                    await fs.remove(extractDir);
                    await fs.ensureDir(extractDir);

                    // Read and extract the ZIP file to disk
                    const zipBuffer = await readFile(zipPath);
                    const zipData = unzipSync(new Uint8Array(zipBuffer));

                    // Write files to temp directory
                    for (const [filePath, content] of Object.entries(zipData)) {
                        if (!filePath.endsWith('/')) {
                            const fullPath = path.join(extractDir, filePath);
                            await fs.ensureDir(path.dirname(fullPath));
                            await fs.writeFile(fullPath, Buffer.from(content));
                        }
                    }

                    // Publish using wrangler CLI
                    const result = await publishToCloudflare(extractDir, {
                        apiToken: api_token,
                        accountId: account_id,
                        projectName: project_name,
                    });

                    if (result.success) {
                        return {
                            success: true,
                            url: result.url,
                            details: result.details,
                        };
                    } else {
                        set.status = 500;
                        return {
                            success: false,
                            error: result.error,
                        };
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                } finally {
                    // Always clean up temp directory
                    await fs.remove(extractDir).catch(() => {});
                }
            },
            {
                body: t.Object({
                    api_token: t.String(),
                    account_id: t.String(),
                    session_id: t.String(),
                    project_name: t.String(),
                    export_type: t.Optional(t.String()),
                }),
            },
        )

        // =====================================================
        // Surge.sh Routes
        // =====================================================

        // Request Surge login token via email
        .post(
            '/surge/request-token',
            async ({ body, set }) => {
                if (!config.surgeEnabled) {
                    set.status = 400;
                    return { success: false, error: 'Surge publishing not enabled' };
                }

                const { email } = body as { email: string };

                const result = await requestSurgeToken(email);
                if (!result.success) {
                    set.status = 500;
                    return { success: false, error: result.error };
                }
                return result;
            },
            {
                body: t.Object({
                    email: t.String(),
                }),
            },
        )

        // List Surge projects
        .post(
            '/surge/projects',
            async ({ body, set }) => {
                if (!config.surgeEnabled) {
                    set.status = 400;
                    return { success: false, error: 'Surge publishing not enabled' };
                }

                const { email, token } = body as { email: string; token: string };

                const result = await listSurgeProjects(email, token);
                if (!result.success) {
                    set.status = 500;
                    return { success: false, error: result.error };
                }
                return {
                    success: true,
                    projects: result.projects,
                };
            },
            {
                body: t.Object({
                    email: t.String(),
                    token: t.String(),
                }),
            },
        )

        // Publish to Surge
        .post(
            '/surge/publish',
            async ({ body, set }) => {
                if (!config.surgeEnabled) {
                    set.status = 400;
                    return { success: false, error: 'Surge publishing not enabled' };
                }

                const {
                    email,
                    token,
                    session_id,
                    domain,
                    export_type = 'html5',
                } = body as {
                    email: string;
                    token: string;
                    session_id: string;
                    domain: string;
                    export_type?: string;
                };

                // Get the exported ZIP file
                const distDir = getOdeSessionDistDir(session_id);
                const zipPath = path.join(distDir, `${export_type}.zip`);

                if (!(await fileExists(zipPath))) {
                    set.status = 400;
                    return {
                        success: false,
                        error: `Export not found. Please export your project as ${export_type} first.`,
                    };
                }

                // Extract ZIP to temp directory for surge CLI
                const extractDir = path.join(distDir, 'publish-temp-surge');
                try {
                    // Clean up any previous temp directory
                    await fs.remove(extractDir);
                    await fs.ensureDir(extractDir);

                    // Read and extract the ZIP file to disk
                    const zipBuffer = await readFile(zipPath);
                    const zipData = unzipSync(new Uint8Array(zipBuffer));

                    // Write files to temp directory
                    for (const [filePath, content] of Object.entries(zipData)) {
                        if (!filePath.endsWith('/')) {
                            const fullPath = path.join(extractDir, filePath);
                            await fs.ensureDir(path.dirname(fullPath));
                            await fs.writeFile(fullPath, Buffer.from(content));
                        }
                    }

                    // Publish using surge CLI
                    const result = await publishToSurge(extractDir, {
                        email,
                        token,
                        domain,
                    });

                    if (result.success) {
                        return {
                            success: true,
                            url: result.url,
                            details: result.details,
                        };
                    } else {
                        set.status = 500;
                        return {
                            success: false,
                            error: result.error,
                        };
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                } finally {
                    // Always clean up temp directory
                    await fs.remove(extractDir).catch(() => {});
                }
            },
            {
                body: t.Object({
                    email: t.String(),
                    token: t.String(),
                    session_id: t.String(),
                    domain: t.String(),
                    export_type: t.Optional(t.String()),
                }),
            },
        );
}

// ============================================================================
// Default Instance
// ============================================================================

export const publishRoutes = createPublishRoutes();
