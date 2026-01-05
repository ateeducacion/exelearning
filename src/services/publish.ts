/**
 * Publishing Services Configuration and Types
 *
 * This module provides types, configuration, and authentication helpers
 * for deploying exported content to various static hosting platforms.
 *
 * Note: The actual publishing is done via CLI tools in cli-publish.ts.
 * This file contains:
 * - Type definitions
 * - PublishConfig for enabling/disabling providers
 * - GitHubDeviceFlow for desktop authentication
 */

// ============================================================================
// Types
// ============================================================================

export interface PublishConfig {
    // GitHub configuration
    githubEnabled: boolean;
    githubClientId?: string;
    githubClientSecret?: string;
    githubDeviceClientId?: string;

    // Netlify configuration
    netlifyEnabled: boolean;

    // Cloudflare Pages configuration
    cloudflareEnabled: boolean;

    // Surge.sh configuration
    surgeEnabled: boolean;
}

export interface PublishResult {
    success: boolean;
    url?: string;
    error?: string;
    details?: Record<string, unknown>;
}

export interface DeviceFlowResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
}

export interface DeviceFlowTokenResponse {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
}

// ============================================================================
// GitHub Device Flow (for desktop/CLI apps)
// ============================================================================

/**
 * GitHub Device Flow authentication for desktop applications.
 *
 * This is used when the app cannot receive OAuth redirects (e.g., desktop apps).
 * The user visits a URL and enters a code to authorize the application.
 *
 * Flow:
 * 1. App calls startFlow() to get device_code and user_code
 * 2. User visits verification_uri and enters user_code
 * 3. App polls pollForToken() until user completes authorization
 */
export class GitHubDeviceFlow {
    private clientId: string;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    /**
     * Start the device flow authentication
     */
    async startFlow(): Promise<DeviceFlowResponse> {
        const response = await fetch('https://github.com/login/device/code', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                scope: 'repo',
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to start device flow: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Poll for the access token
     */
    async pollForToken(deviceCode: string): Promise<DeviceFlowTokenResponse> {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to poll for token: ${response.statusText}`);
        }

        return response.json();
    }
}

// ============================================================================
// Configuration Helper
// ============================================================================

/**
 * Get publishing configuration from environment variables
 */
export function getPublishConfig(): PublishConfig {
    return {
        githubEnabled: process.env.ENABLE_GITHUB_PUBLISHING === 'true',
        githubClientId: process.env.GITHUB_OAUTH_CLIENT_ID,
        githubClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        githubDeviceClientId: process.env.GITHUB_DEVICE_CLIENT_ID,
        netlifyEnabled: process.env.ENABLE_NETLIFY_PUBLISHING === 'true',
        cloudflareEnabled: process.env.ENABLE_CLOUDFLARE_PUBLISHING === 'true',
        surgeEnabled: process.env.ENABLE_SURGE_PUBLISHING === 'true',
    };
}
