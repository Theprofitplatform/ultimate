/**
 * Role-Based Access Control (RBAC) System for Ultimate SEO Platform
 * Implements hierarchical roles, permissions, and resource-based access control
 */

/**
 * System Permissions
 * Granular permissions for different system operations
 */
const PERMISSIONS = {
  // User Management
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',
  USER_INVITE: 'user:invite',
  USER_ROLE_MANAGE: 'user:role:manage',

  // Organization Management
  ORG_READ: 'organization:read',
  ORG_WRITE: 'organization:write',
  ORG_DELETE: 'organization:delete',
  ORG_SETTINGS: 'organization:settings',
  ORG_BILLING: 'organization:billing',

  // Project Management
  PROJECT_READ: 'project:read',
  PROJECT_WRITE: 'project:write',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SHARE: 'project:share',
  PROJECT_EXPORT: 'project:export',

  // SEO Data & Analytics
  SEO_READ: 'seo:read',
  SEO_WRITE: 'seo:write',
  SEO_DELETE: 'seo:delete',
  SEO_ANALYZE: 'seo:analyze',
  SEO_EXPORT: 'seo:export',

  // Analytics & Reports
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_WRITE: 'analytics:write',
  ANALYTICS_DELETE: 'analytics:delete',
  ANALYTICS_EXPORT: 'analytics:export',

  // API & Integration
  API_KEY_READ: 'api_key:read',
  API_KEY_WRITE: 'api_key:write',
  API_KEY_DELETE: 'api_key:delete',
  INTEGRATION_READ: 'integration:read',
  INTEGRATION_WRITE: 'integration:write',

  // Content Management
  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',
  CONTENT_DELETE: 'content:delete',
  CONTENT_PUBLISH: 'content:publish',

  // Keywords & Rankings
  KEYWORD_READ: 'keyword:read',
  KEYWORD_WRITE: 'keyword:write',
  KEYWORD_DELETE: 'keyword:delete',
  KEYWORD_TRACK: 'keyword:track',

  // Backlinks
  BACKLINK_READ: 'backlink:read',
  BACKLINK_WRITE: 'backlink:write',
  BACKLINK_DELETE: 'backlink:delete',
  BACKLINK_ANALYZE: 'backlink:analyze',

  // Site Audit
  AUDIT_READ: 'audit:read',
  AUDIT_WRITE: 'audit:write',
  AUDIT_DELETE: 'audit:delete',
  AUDIT_RUN: 'audit:run',

  // System Administration
  ADMIN_USERS: 'admin:users',
  ADMIN_ORGANIZATIONS: 'admin:organizations',
  ADMIN_SYSTEM: 'admin:system',
  ADMIN_LOGS: 'admin:logs',
  ADMIN_BILLING: 'admin:billing',

  // Wildcard permissions
  ADMIN_ALL: 'admin:*',
  USER_ALL: 'user:*',
  PROJECT_ALL: 'project:*',
  SEO_ALL: 'seo:*'
};

/**
 * System Roles with hierarchical permissions
 */
const ROLES = {
  // Organization-level roles
  ADMIN: {
    name: 'admin',
    label: 'Administrator',
    description: 'Full access to organization and all projects',
    level: 100,
    permissions: [
      PERMISSIONS.ADMIN_ALL,
      PERMISSIONS.USER_ALL,
      PERMISSIONS.PROJECT_ALL,
      PERMISSIONS.SEO_ALL,
      PERMISSIONS.ORG_READ,
      PERMISSIONS.ORG_WRITE,
      PERMISSIONS.ORG_SETTINGS,
      PERMISSIONS.ORG_BILLING,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_WRITE,
      PERMISSIONS.ANALYTICS_DELETE,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.API_KEY_READ,
      PERMISSIONS.API_KEY_WRITE,
      PERMISSIONS.API_KEY_DELETE,
      PERMISSIONS.INTEGRATION_READ,
      PERMISSIONS.INTEGRATION_WRITE
    ]
  },

  MANAGER: {
    name: 'manager',
    label: 'Manager',
    description: 'Manage projects and team members',
    level: 75,
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_WRITE,
      PERMISSIONS.USER_INVITE,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_WRITE,
      PERMISSIONS.PROJECT_DELETE,
      PERMISSIONS.PROJECT_SHARE,
      PERMISSIONS.PROJECT_EXPORT,
      PERMISSIONS.SEO_READ,
      PERMISSIONS.SEO_WRITE,
      PERMISSIONS.SEO_DELETE,
      PERMISSIONS.SEO_ANALYZE,
      PERMISSIONS.SEO_EXPORT,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_WRITE,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_WRITE,
      PERMISSIONS.CONTENT_DELETE,
      PERMISSIONS.CONTENT_PUBLISH,
      PERMISSIONS.KEYWORD_READ,
      PERMISSIONS.KEYWORD_WRITE,
      PERMISSIONS.KEYWORD_DELETE,
      PERMISSIONS.KEYWORD_TRACK,
      PERMISSIONS.BACKLINK_READ,
      PERMISSIONS.BACKLINK_WRITE,
      PERMISSIONS.BACKLINK_DELETE,
      PERMISSIONS.BACKLINK_ANALYZE,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.AUDIT_WRITE,
      PERMISSIONS.AUDIT_DELETE,
      PERMISSIONS.AUDIT_RUN,
      PERMISSIONS.API_KEY_READ,
      PERMISSIONS.INTEGRATION_READ
    ]
  },

  MEMBER: {
    name: 'member',
    label: 'Member',
    description: 'Access and edit assigned projects',
    level: 50,
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_WRITE,
      PERMISSIONS.PROJECT_EXPORT,
      PERMISSIONS.SEO_READ,
      PERMISSIONS.SEO_WRITE,
      PERMISSIONS.SEO_ANALYZE,
      PERMISSIONS.SEO_EXPORT,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_WRITE,
      PERMISSIONS.CONTENT_PUBLISH,
      PERMISSIONS.KEYWORD_READ,
      PERMISSIONS.KEYWORD_WRITE,
      PERMISSIONS.KEYWORD_TRACK,
      PERMISSIONS.BACKLINK_READ,
      PERMISSIONS.BACKLINK_ANALYZE,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.AUDIT_RUN
    ]
  },

  VIEWER: {
    name: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to assigned projects',
    level: 25,
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_EXPORT,
      PERMISSIONS.SEO_READ,
      PERMISSIONS.SEO_EXPORT,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.KEYWORD_READ,
      PERMISSIONS.BACKLINK_READ,
      PERMISSIONS.AUDIT_READ
    ]
  },

  // Special roles
  API: {
    name: 'api',
    label: 'API Client',
    description: 'Programmatic access via API keys',
    level: 0,
    permissions: [] // Permissions assigned per API key
  },

  SYSTEM: {
    name: 'system',
    label: 'System',
    description: 'Internal system operations',
    level: 999,
    permissions: [PERMISSIONS.ADMIN_ALL]
  }
};

/**
 * Resource Types for fine-grained access control
 */
const RESOURCE_TYPES = {
  ORGANIZATION: 'organization',
  PROJECT: 'project',
  USER: 'user',
  SEO_DATA: 'seo_data',
  ANALYTICS: 'analytics',
  CONTENT: 'content',
  KEYWORD: 'keyword',
  BACKLINK: 'backlink',
  AUDIT: 'audit',
  API_KEY: 'api_key',
  INTEGRATION: 'integration'
};

/**
 * RBAC Service Class
 * Handles role and permission management
 */
class RBACService {
  constructor(dbPool, logger) {
    this.db = dbPool;
    this.logger = logger;
  }

  /**
   * Check if user has permission
   * @param {Object} user - User object with role and permissions
   * @param {string} permission - Permission to check
   * @param {Object} resource - Resource being accessed (optional)
   * @returns {boolean} Permission granted
   */
  hasPermission(user, permission, resource = null) {
    if (!user || !permission) {
      return false;
    }

    // System role has all permissions
    if (user.role === ROLES.SYSTEM.name) {
      return true;
    }

    // Check if user has the specific permission
    const userPermissions = user.permissions || [];

    // Direct permission match
    if (userPermissions.includes(permission)) {
      return true;
    }

    // Check wildcard permissions
    const permissionParts = permission.split(':');
    if (permissionParts.length >= 2) {
      const wildcardPermission = `${permissionParts[0]}:*`;
      if (userPermissions.includes(wildcardPermission)) {
        return true;
      }
    }

    // Check admin wildcard
    if (userPermissions.includes(PERMISSIONS.ADMIN_ALL)) {
      return true;
    }

    // Check role-based permissions
    const userRole = ROLES[user.role?.toUpperCase()];
    if (userRole && userRole.permissions.includes(permission)) {
      return true;
    }

    // Check role-based wildcard permissions
    if (userRole) {
      for (const rolePermission of userRole.permissions) {
        if (rolePermission.endsWith(':*')) {
          const roleBase = rolePermission.split(':')[0];
          const permissionBase = permission.split(':')[0];
          if (roleBase === permissionBase) {
            return true;
          }
        }
      }
    }

    // Resource-specific permission check
    if (resource) {
      return this.hasResourcePermission(user, permission, resource);
    }

    return false;
  }

  /**
   * Check resource-specific permissions
   * @param {Object} user - User object
   * @param {string} permission - Permission to check
   * @param {Object} resource - Resource object
   * @returns {boolean} Permission granted
   */
  hasResourcePermission(user, permission, resource) {
    // Check if user owns the resource
    if (resource.owner_id === user.id) {
      return true;
    }

    // Check if user is assigned to the resource
    if (resource.assigned_users && resource.assigned_users.includes(user.id)) {
      return true;
    }

    // Check organization-level access
    if (resource.organization_id === user.organizationId) {
      const userRole = ROLES[user.role?.toUpperCase()];
      if (userRole && userRole.level >= 50) { // Member level and above
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has role level access
   * @param {Object} user - User object
   * @param {number} requiredLevel - Required role level
   * @returns {boolean} Access granted
   */
  hasRoleLevel(user, requiredLevel) {
    if (!user || !user.role) {
      return false;
    }

    const userRole = ROLES[user.role.toUpperCase()];
    return userRole && userRole.level >= requiredLevel;
  }

  /**
   * Check if user can perform action on another user
   * @param {Object} actor - User performing the action
   * @param {Object} target - Target user
   * @param {string} action - Action being performed
   * @returns {boolean} Action allowed
   */
  canManageUser(actor, target, action) {
    if (!actor || !target) {
      return false;
    }

    // Users can always manage themselves (with restrictions)
    if (actor.id === target.id) {
      return ['read', 'update_profile'].includes(action);
    }

    // Must be in same organization
    if (actor.organizationId !== target.organizationId) {
      return false;
    }

    const actorRole = ROLES[actor.role?.toUpperCase()];
    const targetRole = ROLES[target.role?.toUpperCase()];

    if (!actorRole || !targetRole) {
      return false;
    }

    // Admin can manage everyone except other admins (unless they are the same level)
    if (actorRole.name === ROLES.ADMIN.name) {
      if (targetRole.name === ROLES.ADMIN.name && action === 'delete') {
        return false; // Admins cannot delete other admins
      }
      return true;
    }

    // Manager can manage members and viewers
    if (actorRole.name === ROLES.MANAGER.name) {
      return targetRole.level < actorRole.level;
    }

    return false;
  }

  /**
   * Get effective permissions for a user
   * @param {Object} user - User object
   * @returns {Array} List of effective permissions
   */
  getEffectivePermissions(user) {
    if (!user) {
      return [];
    }

    const permissions = new Set();

    // Add user-specific permissions
    if (user.permissions) {
      user.permissions.forEach(permission => permissions.add(permission));
    }

    // Add role-based permissions
    const userRole = ROLES[user.role?.toUpperCase()];
    if (userRole) {
      userRole.permissions.forEach(permission => permissions.add(permission));
    }

    return Array.from(permissions);
  }

  /**
   * Assign role to user
   * @param {string} userId - User ID
   * @param {string} role - Role name
   * @param {string} assignedBy - ID of user assigning the role
   * @returns {Promise<boolean>} Success status
   */
  async assignRole(userId, role, assignedBy) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Validate role exists
      if (!ROLES[role.toUpperCase()]) {
        throw new Error('Invalid role specified');
      }

      // Get user and assigner information
      const [userResult, assignerResult] = await Promise.all([
        client.query('SELECT * FROM auth.users WHERE id = $1', [userId]),
        client.query('SELECT * FROM auth.users WHERE id = $1', [assignedBy])
      ]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      if (assignerResult.rows.length === 0) {
        throw new Error('Assigner not found');
      }

      const user = userResult.rows[0];
      const assigner = assignerResult.rows[0];

      // Check if assigner can assign this role
      if (!this.canManageUser(assigner, user, 'manage_role')) {
        throw new Error('Insufficient permissions to assign role');
      }

      // Update user role
      await client.query(
        'UPDATE auth.users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [role.toLowerCase(), userId]
      );

      // Log role assignment
      await client.query(
        `INSERT INTO auth.role_assignments
         (user_id, role, assigned_by, assigned_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [userId, role.toLowerCase(), assignedBy]
      );

      await client.query('COMMIT');

      this.logger?.info('Role assigned successfully', {
        userId,
        newRole: role,
        assignedBy,
        organizationId: user.organization_id
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger?.error('Role assignment failed', {
        error: error.message,
        userId,
        role,
        assignedBy
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Grant permission to user
   * @param {string} userId - User ID
   * @param {string} permission - Permission to grant
   * @param {string} grantedBy - ID of user granting permission
   * @returns {Promise<boolean>} Success status
   */
  async grantPermission(userId, permission, grantedBy) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Validate permission exists
      if (!Object.values(PERMISSIONS).includes(permission)) {
        throw new Error('Invalid permission specified');
      }

      // Get current user permissions
      const userResult = await client.query(
        'SELECT permissions FROM auth.users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentPermissions = userResult.rows[0].permissions || [];

      // Check if permission already exists
      if (currentPermissions.includes(permission)) {
        return true; // Already has permission
      }

      // Add new permission
      const updatedPermissions = [...currentPermissions, permission];

      await client.query(
        'UPDATE auth.users SET permissions = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(updatedPermissions), userId]
      );

      // Log permission grant
      await client.query(
        `INSERT INTO auth.permission_grants
         (user_id, permission, granted_by, granted_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [userId, permission, grantedBy]
      );

      await client.query('COMMIT');

      this.logger?.info('Permission granted successfully', {
        userId,
        permission,
        grantedBy
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger?.error('Permission grant failed', {
        error: error.message,
        userId,
        permission,
        grantedBy
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke permission from user
   * @param {string} userId - User ID
   * @param {string} permission - Permission to revoke
   * @param {string} revokedBy - ID of user revoking permission
   * @returns {Promise<boolean>} Success status
   */
  async revokePermission(userId, permission, revokedBy) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get current user permissions
      const userResult = await client.query(
        'SELECT permissions FROM auth.users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentPermissions = userResult.rows[0].permissions || [];

      // Remove permission
      const updatedPermissions = currentPermissions.filter(p => p !== permission);

      await client.query(
        'UPDATE auth.users SET permissions = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(updatedPermissions), userId]
      );

      // Log permission revocation
      await client.query(
        `INSERT INTO auth.permission_revocations
         (user_id, permission, revoked_by, revoked_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [userId, permission, revokedBy]
      );

      await client.query('COMMIT');

      this.logger?.info('Permission revoked successfully', {
        userId,
        permission,
        revokedBy
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger?.error('Permission revocation failed', {
        error: error.message,
        userId,
        permission,
        revokedBy
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get role hierarchy for organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>} Role hierarchy
   */
  async getRoleHierarchy(organizationId) {
    try {
      const result = await this.db.query(
        `SELECT role, COUNT(*) as user_count
         FROM auth.users
         WHERE organization_id = $1 AND is_active = true
         GROUP BY role
         ORDER BY role`,
        [organizationId]
      );

      const hierarchy = Object.values(ROLES)
        .filter(role => role.name !== 'system')
        .map(role => ({
          ...role,
          userCount: result.rows.find(r => r.role === role.name)?.user_count || 0
        }))
        .sort((a, b) => b.level - a.level);

      return hierarchy;

    } catch (error) {
      this.logger?.error('Failed to get role hierarchy', {
        error: error.message,
        organizationId
      });
      throw error;
    }
  }

  /**
   * Get permission audit trail for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Audit trail
   */
  async getPermissionAuditTrail(userId, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;

      const [grants, revocations, roleAssignments] = await Promise.all([
        this.db.query(
          `SELECT 'grant' as action, permission, granted_by as actor, granted_at as timestamp
           FROM auth.permission_grants
           WHERE user_id = $1
           ORDER BY granted_at DESC
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        ),
        this.db.query(
          `SELECT 'revoke' as action, permission, revoked_by as actor, revoked_at as timestamp
           FROM auth.permission_revocations
           WHERE user_id = $1
           ORDER BY revoked_at DESC
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        ),
        this.db.query(
          `SELECT 'role_assignment' as action, role as permission, assigned_by as actor, assigned_at as timestamp
           FROM auth.role_assignments
           WHERE user_id = $1
           ORDER BY assigned_at DESC
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        )
      ]);

      // Combine and sort by timestamp
      const auditTrail = [
        ...grants.rows,
        ...revocations.rows,
        ...roleAssignments.rows
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return auditTrail;

    } catch (error) {
      this.logger?.error('Failed to get permission audit trail', {
        error: error.message,
        userId
      });
      throw error;
    }
  }
}

module.exports = {
  RBACService,
  PERMISSIONS,
  ROLES,
  RESOURCE_TYPES
};