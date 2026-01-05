/**
 * CLI-Based Publishing Services
 *
 * This module provides local CLI-based publishing to various static hosting platforms.
 * Uses `gh-pages` npm package for GitHub, and Bun.spawn for Netlify, Surge, and Cloudflare CLIs.
 *
 * Benefits over API-based publishing:
 * - Runs entirely locally (no external API dependencies)
 * - Uses standard CLI tools users can debug independently
 * - Simpler authentication (CLI tools handle their own auth)
 */

import ghpages from 'gh-pages';
import type { PublishResult } from './publish';

// ============================================================================
// Types
// ============================================================================

export interface CLIResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface GitHubCLIOptions {
    accessToken: string;
    repoOwner: string;
    repoName: string;
    branch?: string;
    message?: string;
}

export interface NetlifyCLIOptions {
    accessToken: string;
    siteId?: string;
    siteName?: string;
}

export interface SurgeCLIOptions {
    email: string;
    token: string;
    domain: string;
}

export interface CloudflareCLIOptions {
    apiToken: string;
    accountId: string;
    projectName: string;
}

// ============================================================================
// CLI Runner Utility
// ============================================================================

/**
 * Run a CLI command using Bun.spawn
 * @param command - The command to run (e.g., 'netlify', 'surge')
 * @param args - Command arguments
 * @param options - Spawn options (cwd, env)
 * @returns Promise with stdout, stderr, and exitCode
 */
async function runCLI(
    command: string,
    args: string[],
    options: { cwd?: string; env?: Record<string, string>; timeout?: number } = {},
): Promise<CLIResult> {
    const proc = Bun.spawn([command, ...args], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdout: 'pipe',
        stderr: 'pipe',
    });

    // Set up timeout if specified
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (options.timeout) {
        timeoutId = setTimeout(() => {
            proc.kill();
        }, options.timeout);
    }

    try {
        const [stdout, stderr] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
        ]);

        const exitCode = await proc.exited;

        return { stdout, stderr, exitCode };
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

/**
 * Check if a CLI tool is available in PATH
 * @param command - Command name to check
 * @returns true if command is available
 */
export async function checkCLIAvailable(command: string): Promise<boolean> {
    try {
        const proc = Bun.spawn(['which', command], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const exitCode = await proc.exited;
        return exitCode === 0;
    } catch {
        return false;
    }
}

/**
 * Get CLI tool version
 * @param command - Command name
 * @returns Version string or null
 */
export async function getCLIVersion(command: string): Promise<string | null> {
    try {
        const result = await runCLI(command, ['--version']);
        if (result.exitCode === 0) {
            return result.stdout.trim().split('\n')[0];
        }
        return null;
    } catch {
        return null;
    }
}

// ============================================================================
// GitHub Pages Publisher (using gh-pages npm package)
// ============================================================================

/**
 * Publish to GitHub Pages using the gh-pages npm package
 *
 * This uses the gh-pages library programmatically, not as a CLI.
 * The library handles git operations internally.
 *
 * @param sourceDir - Directory containing files to publish
 * @param options - GitHub options (token, repo, branch, etc.)
 * @returns PublishResult
 */
export async function publishToGitHub(
    sourceDir: string,
    options: GitHubCLIOptions,
): Promise<PublishResult> {
    const { accessToken, repoOwner, repoName, branch = 'gh-pages', message } = options;

    return new Promise((resolve) => {
        ghpages.publish(
            sourceDir,
            {
                branch,
                repo: `https://${accessToken}@github.com/${repoOwner}/${repoName}.git`,
                message: message || 'Deploy via eXeLearning',
                user: {
                    name: 'eXeLearning',
                    email: 'noreply@exelearning.net',
                },
                silent: true, // Don't log to console
            },
            (err) => {
                if (err) {
                    console.error('[CLI-Publish] GitHub publish error:', err);
                    resolve({
                        success: false,
                        error: parseGitError(err.message),
                    });
                } else {
                    resolve({
                        success: true,
                        url: `https://${repoOwner}.github.io/${repoName}/`,
                    });
                }
            },
        );
    });
}

/**
 * Parse git errors into user-friendly messages
 */
function parseGitError(errorMessage: string): string {
    if (errorMessage.includes('Permission denied') || errorMessage.includes('403')) {
        return 'Authentication failed. Please check your access token has repo permissions.';
    }
    if (errorMessage.includes('Repository not found') || errorMessage.includes('404')) {
        return 'Repository not found. Please check the owner and repository name.';
    }
    if (errorMessage.includes('could not read Username')) {
        return 'Authentication required. Please provide a valid access token.';
    }
    return errorMessage;
}

// ============================================================================
// Netlify Publisher (using netlify CLI)
// ============================================================================

/**
 * Publish to Netlify using the netlify CLI
 *
 * Requires: netlify CLI installed globally (npm install -g netlify-cli)
 *
 * @param sourceDir - Directory containing files to publish
 * @param options - Netlify options (token, siteId, etc.)
 * @returns PublishResult
 */
export async function publishToNetlify(
    sourceDir: string,
    options: NetlifyCLIOptions,
): Promise<PublishResult> {
    const { accessToken, siteId, siteName } = options;

    // Check if CLI is available
    if (!(await checkCLIAvailable('netlify'))) {
        return {
            success: false,
            error: 'Netlify CLI is not installed. Please run: npm install -g netlify-cli',
        };
    }

    const args = ['deploy', '--dir', sourceDir, '--prod', '--json'];

    if (siteId) {
        args.push('--site', siteId);
    }

    console.log('[CLI-Publish] Running netlify deploy...');
    const result = await runCLI('netlify', args, {
        env: { NETLIFY_AUTH_TOKEN: accessToken },
        timeout: 300000, // 5 minute timeout
    });

    if (result.exitCode === 0) {
        // Parse JSON output for URL
        try {
            const output = JSON.parse(result.stdout);
            return {
                success: true,
                url: output.deploy_url || output.url,
                details: {
                    siteId: output.site_id,
                    siteName: output.site_name,
                    deployId: output.deploy_id,
                },
            };
        } catch {
            // Fallback: parse URL from text output
            const urlMatch = result.stdout.match(/Website URL:\s+(https:\/\/[^\s]+)/);
            return {
                success: true,
                url: urlMatch?.[1],
            };
        }
    }

    return {
        success: false,
        error: parseNetlifyError(result.stderr || result.stdout),
    };
}

/**
 * List Netlify sites using CLI
 */
export async function listNetlifySites(accessToken: string): Promise<{ success: boolean; sites?: Array<{ id: string; name: string; url: string }>; error?: string }> {
    if (!(await checkCLIAvailable('netlify'))) {
        return {
            success: false,
            error: 'Netlify CLI is not installed.',
        };
    }

    const result = await runCLI('netlify', ['sites:list', '--json'], {
        env: { NETLIFY_AUTH_TOKEN: accessToken },
    });

    if (result.exitCode === 0) {
        try {
            const sites = JSON.parse(result.stdout);
            return {
                success: true,
                sites: sites.map((site: { id: string; name: string; ssl_url: string }) => ({
                    id: site.id,
                    name: site.name,
                    url: site.ssl_url,
                })),
            };
        } catch {
            return { success: false, error: 'Failed to parse sites list' };
        }
    }

    return { success: false, error: result.stderr };
}

function parseNetlifyError(errorMessage: string): string {
    if (errorMessage.includes('Not logged in') || errorMessage.includes('401')) {
        return 'Authentication failed. Please check your Netlify access token.';
    }
    if (errorMessage.includes('Site not found')) {
        return 'Site not found. Please check the site ID.';
    }
    return errorMessage || 'Netlify deployment failed';
}

// ============================================================================
// Surge Publisher (using surge CLI)
// ============================================================================

/**
 * Publish to Surge.sh using the surge CLI
 *
 * Requires: surge CLI installed globally (npm install -g surge)
 *
 * @param sourceDir - Directory containing files to publish
 * @param options - Surge options (email, token, domain)
 * @returns PublishResult
 */
export async function publishToSurge(
    sourceDir: string,
    options: SurgeCLIOptions,
): Promise<PublishResult> {
    const { email, token, domain } = options;

    // Check if CLI is available
    if (!(await checkCLIAvailable('surge'))) {
        return {
            success: false,
            error: 'Surge CLI is not installed. Please run: npm install -g surge',
        };
    }

    // Ensure domain has .surge.sh suffix if not a custom domain
    const fullDomain = domain.includes('.') ? domain : `${domain}.surge.sh`;

    console.log(`[CLI-Publish] Running surge deploy to ${fullDomain}...`);
    const result = await runCLI('surge', [sourceDir, fullDomain], {
        env: {
            SURGE_LOGIN: email,
            SURGE_TOKEN: token,
        },
        timeout: 300000, // 5 minute timeout
    });

    if (result.exitCode === 0) {
        return {
            success: true,
            url: `https://${fullDomain}`,
        };
    }

    return {
        success: false,
        error: parseSurgeError(result.stderr || result.stdout),
    };
}

/**
 * List Surge projects using CLI
 */
export async function listSurgeProjects(email: string, token: string): Promise<{ success: boolean; projects?: Array<{ domain: string }>; error?: string }> {
    if (!(await checkCLIAvailable('surge'))) {
        return {
            success: false,
            error: 'Surge CLI is not installed.',
        };
    }

    const result = await runCLI('surge', ['list'], {
        env: {
            SURGE_LOGIN: email,
            SURGE_TOKEN: token,
        },
    });

    if (result.exitCode === 0) {
        // Parse domains from output (one per line)
        const lines = result.stdout.trim().split('\n').filter((line) => line.includes('.surge.sh') || line.includes('.'));
        const projects = lines.map((line) => ({ domain: line.trim() }));
        return { success: true, projects };
    }

    return { success: false, error: result.stderr };
}

function parseSurgeError(errorMessage: string): string {
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        return 'Authentication failed. Please check your Surge credentials.';
    }
    if (errorMessage.includes('already taken')) {
        return 'Domain is already taken by another user.';
    }
    return errorMessage || 'Surge deployment failed';
}

/**
 * Request a Surge login token via email
 * This makes an API call to Surge's authentication endpoint
 */
export async function requestSurgeToken(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const response = await fetch('https://surge.surge.sh/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        if (response.ok) {
            return {
                success: true,
                message: `A login token has been sent to ${email}. Please check your email and enter the token.`,
            };
        }

        const errorText = await response.text();
        return {
            success: false,
            error: errorText || 'Failed to request token from Surge',
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================================
// Cloudflare Pages Publisher (using wrangler CLI)
// ============================================================================

/**
 * Publish to Cloudflare Pages using the wrangler CLI
 *
 * Requires: wrangler CLI installed globally (npm install -g wrangler)
 *
 * @param sourceDir - Directory containing files to publish
 * @param options - Cloudflare options (token, accountId, projectName)
 * @returns PublishResult
 */
export async function publishToCloudflare(
    sourceDir: string,
    options: CloudflareCLIOptions,
): Promise<PublishResult> {
    const { apiToken, accountId, projectName } = options;

    // Check if CLI is available
    if (!(await checkCLIAvailable('wrangler'))) {
        return {
            success: false,
            error: 'Wrangler CLI is not installed. Please run: npm install -g wrangler',
        };
    }

    console.log(`[CLI-Publish] Running wrangler pages deploy to ${projectName}...`);
    const result = await runCLI(
        'wrangler',
        ['pages', 'deploy', sourceDir, '--project-name', projectName],
        {
            env: {
                CLOUDFLARE_API_TOKEN: apiToken,
                CLOUDFLARE_ACCOUNT_ID: accountId,
            },
            timeout: 300000, // 5 minute timeout
        },
    );

    if (result.exitCode === 0) {
        // Parse URL from stdout
        const urlMatch = result.stdout.match(/https:\/\/[^\s]+\.pages\.dev/);
        return {
            success: true,
            url: urlMatch?.[0] || `https://${projectName}.pages.dev`,
        };
    }

    return {
        success: false,
        error: parseCloudflareError(result.stderr || result.stdout),
    };
}

/**
 * List Cloudflare Pages projects using CLI
 */
export async function listCloudflareProjects(apiToken: string, accountId: string): Promise<{ success: boolean; projects?: Array<{ name: string; subdomain: string }>; error?: string }> {
    if (!(await checkCLIAvailable('wrangler'))) {
        return {
            success: false,
            error: 'Wrangler CLI is not installed.',
        };
    }

    const result = await runCLI('wrangler', ['pages', 'project', 'list'], {
        env: {
            CLOUDFLARE_API_TOKEN: apiToken,
            CLOUDFLARE_ACCOUNT_ID: accountId,
        },
    });

    if (result.exitCode === 0) {
        // Parse projects from output
        // Format: "name │ subdomain │ ..."
        const lines = result.stdout.trim().split('\n').slice(2); // Skip header lines
        const projects = lines
            .filter((line) => line.includes('│'))
            .map((line) => {
                const parts = line.split('│').map((p) => p.trim());
                return {
                    name: parts[0] || '',
                    subdomain: parts[1] || '',
                };
            })
            .filter((p) => p.name);

        return { success: true, projects };
    }

    return { success: false, error: result.stderr };
}

function parseCloudflareError(errorMessage: string): string {
    if (errorMessage.includes('Authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
        return 'Authentication failed. Please check your Cloudflare API token and account ID.';
    }
    if (errorMessage.includes('not found')) {
        return 'Project not found. Please check the project name.';
    }
    return errorMessage || 'Cloudflare Pages deployment failed';
}

// ============================================================================
// GitHub API Helpers (using fetch)
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    name: string | null;
    email: string | null;
}

export interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    description: string | null;
    owner: {
        login: string;
    };
}

/**
 * Get authenticated GitHub user info
 */
export async function getGitHubUser(accessToken: string): Promise<{ success: boolean; user?: GitHubUser; error?: string }> {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'eXeLearning',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: (errorData as { message?: string }).message || `GitHub API error: ${response.status}`,
            };
        }

        const user = await response.json() as GitHubUser;
        return { success: true, user };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * List GitHub repositories for the authenticated user
 */
export async function listGitHubRepos(accessToken: string): Promise<{ success: boolean; repos?: GitHubRepo[]; error?: string }> {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'eXeLearning',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: (errorData as { message?: string }).message || `GitHub API error: ${response.status}`,
            };
        }

        const repos = await response.json() as GitHubRepo[];
        return { success: true, repos };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Create a new GitHub repository
 */
export async function createGitHubRepo(
    accessToken: string,
    name: string,
    description?: string,
    isPrivate?: boolean,
): Promise<{ success: boolean; repo?: GitHubRepo; error?: string }> {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'eXeLearning',
            },
            body: JSON.stringify({
                name,
                description: description || '',
                private: isPrivate ?? false,
                auto_init: true, // Initialize with a README to enable gh-pages deployment
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: (errorData as { message?: string }).message || `GitHub API error: ${response.status}`,
            };
        }

        const repo = await response.json() as GitHubRepo;
        return { success: true, repo };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================================
// CLI Status Check
// ============================================================================

/**
 * Check status of all publishing CLI tools
 */
export async function getPublishingCLIStatus(): Promise<{
    git: { available: boolean; version: string | null };
    netlify: { available: boolean; version: string | null };
    surge: { available: boolean; version: string | null };
    wrangler: { available: boolean; version: string | null };
}> {
    const [gitAvailable, netlifyAvailable, surgeAvailable, wranglerAvailable] = await Promise.all([
        checkCLIAvailable('git'),
        checkCLIAvailable('netlify'),
        checkCLIAvailable('surge'),
        checkCLIAvailable('wrangler'),
    ]);

    const [gitVersion, netlifyVersion, surgeVersion, wranglerVersion] = await Promise.all([
        gitAvailable ? getCLIVersion('git') : null,
        netlifyAvailable ? getCLIVersion('netlify') : null,
        surgeAvailable ? getCLIVersion('surge') : null,
        wranglerAvailable ? getCLIVersion('wrangler') : null,
    ]);

    return {
        git: { available: gitAvailable, version: gitVersion },
        netlify: { available: netlifyAvailable, version: netlifyVersion },
        surge: { available: surgeAvailable, version: surgeVersion },
        wrangler: { available: wranglerAvailable, version: wranglerVersion },
    };
}
