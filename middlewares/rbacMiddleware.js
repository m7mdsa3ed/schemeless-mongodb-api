const rbacConfig = require('../config/rbac');

/**
 * Role-Based Access Control (RBAC) Middleware for CRUD Operations
 *
 * This middleware checks if the authenticated user has permission
 * to perform the requested CRUD operation on the collection.
 */
const rbacMiddleware = (operation) => {
  return async (req, res, next) => {
    try {
      const collectionName = req.params.collectionName;
      const user = req.user;

      if (!user || !user.uid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Get collection rules or use default
      const collectionRules = rbacConfig[collectionName] || rbacConfig.default;

      // Determine user role
      const userRole = await getUserRole(user, collectionName);

      if (!userRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No role assigned for this collection'
        });
      }

      // Check if role exists in collection rules
      const rolePermissions = collectionRules.roles[userRole];
      if (!rolePermissions) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Role '${userRole}' not authorized for collection '${collectionName}'`
        });
      }

      // Check operation permission
      const hasPermission = checkOperationPermission(
        rolePermissions,
        operation,
        req,
        user
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions for ${operation} operation on ${collectionName}`
        });
      }

      // Apply field-level filtering for read operations
      if (operation === 'read' && rolePermissions.fieldPermissions?.[userRole]) {
        req.allowedFields = rolePermissions.fieldPermissions[userRole].read;
      }

      // Apply field-level filtering for write operations
      if ((operation === 'write' || operation === 'create') &&
          rolePermissions.fieldPermissions?.[userRole]) {
        req.allowedWriteFields = rolePermissions.fieldPermissions[userRole].write;
      }

      next();
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authorization check failed'
      });
    }
  };
};

/**
 * Determine the user's role for a specific collection
 */
const getUserRole = async (user, collectionName) => {
  // Check if user has a role defined in their profile
  if (user.role && ['admin', 'user', 'viewer'].includes(user.role)) {
    return user.role;
  }

  // Default role assignment logic
  if (user.email && user.email.endsWith('@admin.com')) {
    return 'admin';
  }

  // Check for public collections
  const collectionRules = rbacConfig[collectionName];
  if (collectionRules?.roles?.anonymous) {
    return 'anonymous';
  }

  return 'user'; // Default role
};

/**
 * Check if user has permission for the specific operation
 */
const checkOperationPermission = (permissions, operation, req, user) => {
  const operationMap = {
    'read': permissions.read,
    'write': permissions.write,
    'create': permissions.create,
    'delete': permissions.delete
  };

  const permission = operationMap[operation];

  // Handle boolean permissions (true/false)
  if (typeof permission === 'boolean') {
    return permission;
  }

  // Handle array permissions (["all", "own"])
  if (Array.isArray(permission)) {
    // Check for "all" access
    if (permission.includes('all')) {
      return true;
    }

    // Check for "own" access - defer to route-level ownership check
    if (permission.includes('own')) {
      req.requiresOwnershipCheck = true;
      return true;
    }
  }

  return false;
};


/**
 * Filter document fields based on user's field-level permissions
 */
const filterDocumentFields = (document, allowedFields) => {
  if (!allowedFields || allowedFields.includes('all')) {
    return document;
  }

  const filtered = {};
  allowedFields.forEach(field => {
    if (document.hasOwnProperty(field)) {
      filtered[field] = document[field];
    }
  });

  return filtered;
};

/**
 * Filter request body fields based on user's field-level write permissions
 */
const filterRequestBodyFields = (body, allowedFields) => {
  if (!allowedFields || allowedFields.includes('all')) {
    return body;
  }

  const filtered = {};
  allowedFields.forEach(field => {
    if (body.hasOwnProperty(field)) {
      filtered[field] = body[field];
    }
  });

  return filtered;
};

module.exports = {
  rbacMiddleware,
  filterDocumentFields,
  filterRequestBodyFields
};