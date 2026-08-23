/**
 * Authorization Guards
 * Role-based access control utilities for Elysia routes
 */

import type { JwtPayload } from '../routes/auth';

/**
 * Result type for authorization checks
 */
export interface AuthorizationError {
    status: 401 | 403;
    error: 'UNAUTHORIZED' | 'FORBIDDEN';
    message: string;
}

/**
 * Parse JWT `sub` (RFC 7519 string) to the numeric user id.
 * Accepts a number as well so tokens signed before the string-sub change still work.
 * Returns null when the payload is missing or `sub` is not a finite number.
 */
export function userIdFromJwt(payload: { sub?: string | number } | null | undefined): number | null {
    if (payload?.sub == null || payload.sub === '') {
        return null;
    }
    const id = typeof payload.sub === 'number' ? payload.sub : Number(payload.sub);
    return Number.isFinite(id) ? id : null;
}

/**
 * Check if a user has a specific role
 * @param roles - Array of role strings from JWT payload
 * @param role - Role to check for
 * @returns true if user has the role
 */
export function hasRole(roles: string[] | undefined | null, role: string): boolean {
    return Array.isArray(roles) && roles.includes(role);
}

/**
 * Check if a user has any of the specified roles
 * @param roles - Array of role strings from JWT payload
 * @param requiredRoles - Array of roles to check for
 * @returns true if user has at least one of the roles
 */
export function hasAnyRole(roles: string[] | undefined | null, requiredRoles: string[]): boolean {
    if (!Array.isArray(roles)) {
        return false;
    }
    return requiredRoles.some(role => roles.includes(role));
}

/**
 * Check if a user has all of the specified roles
 * @param roles - Array of role strings from JWT payload
 * @param requiredRoles - Array of roles to check for
 * @returns true if user has all of the roles
 */
export function hasAllRoles(roles: string[] | undefined | null, requiredRoles: string[]): boolean {
    if (!Array.isArray(roles)) {
        return false;
    }
    return requiredRoles.every(role => roles.includes(role));
}

/**
 * Require authentication - returns error if not authenticated
 * @param jwtPayload - JWT payload from route context
 * @returns null if OK, AuthorizationError if unauthorized
 */
export function requireAuth(jwtPayload: { sub?: string | number } | null | undefined): AuthorizationError | null {
    if (userIdFromJwt(jwtPayload) == null) {
        return {
            status: 401,
            error: 'UNAUTHORIZED',
            message: 'Authentication required',
        };
    }
    return null;
}

/**
 * Require admin role - returns error if not authenticated or not admin
 * @param jwtPayload - JWT payload from route context
 * @returns null if OK, AuthorizationError if unauthorized or forbidden
 */
export function requireAdmin(jwtPayload: JwtPayload | null | undefined): AuthorizationError | null {
    // Check authentication first
    const authError = requireAuth(jwtPayload);
    if (authError) {
        return authError;
    }

    // Check admin role
    if (!hasRole(jwtPayload!.roles, 'ROLE_ADMIN')) {
        return {
            status: 403,
            error: 'FORBIDDEN',
            message: 'Admin role required',
        };
    }

    return null;
}

/**
 * Require any of the specified roles
 * @param jwtPayload - JWT payload from route context
 * @param requiredRoles - Array of roles (user must have at least one)
 * @returns null if OK, AuthorizationError if unauthorized or forbidden
 */
export function requireAnyRole(
    jwtPayload: JwtPayload | null | undefined,
    requiredRoles: string[],
): AuthorizationError | null {
    // Check authentication first
    const authError = requireAuth(jwtPayload);
    if (authError) {
        return authError;
    }

    // Check roles
    if (!hasAnyRole(jwtPayload!.roles, requiredRoles)) {
        return {
            status: 403,
            error: 'FORBIDDEN',
            message: `One of these roles required: ${requiredRoles.join(', ')}`,
        };
    }

    return null;
}

/**
 * Check if user is the admin being operated on (for self-modification checks)
 * @param jwtPayload - JWT payload from route context
 * @param targetUserId - ID of the user being modified
 * @returns true if the current user is modifying themselves
 */
export function isSelfModification(jwtPayload: JwtPayload | null | undefined, targetUserId: number): boolean {
    const userId = userIdFromJwt(jwtPayload);
    return userId != null && userId === targetUserId;
}

/**
 * Known role constants
 */
export const ROLES = {
    USER: 'ROLE_USER',
    ADMIN: 'ROLE_ADMIN',
    GUEST: 'ROLE_GUEST',
    EDITOR: 'ROLE_EDITOR',
} as const;

/**
 * Protected role that cannot be removed from any user
 */
export const PROTECTED_ROLE = ROLES.USER;
