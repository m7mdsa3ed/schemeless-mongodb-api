# Role-Based Access Control (RBAC) System

This document explains the RBAC system implemented for protecting MongoDB collections based on user roles and permissions.

## Overview

The RBAC system provides fine-grained access control for CRUD operations on MongoDB collections. It supports:

- **Role-based permissions**: Different access levels for different user roles
- **Operation-based control**: Separate permissions for read, write, create, delete
- **Ownership-based access**: "Own" vs "All" access control
- **Field-level security**: Control which fields users can read/write
- **Collection-specific rules**: Different permission sets per collection

## Configuration Structure

### Basic Configuration

The RBAC configuration is defined in `config/rbac.js`. Here's the basic structure:

```javascript
{
  "collectionName": {
    "roles": {
      "roleName": {
        "read": ["all", "own"] | boolean,
        "write": ["all", "own"] | boolean,
        "create": boolean,
        "delete": ["all", "own"] | boolean
      }
    },
    "fieldPermissions": {
      "roleName": {
        "read": ["field1", "field2", ...],
        "write": ["field1", "field2", ...]
      }
    }
  }
}
```

### Permission Types

- **`"all"`**: Can access any document in the collection
- **`"own"`**: Can only access documents where `userId` matches their own ID
- **`true`**: Permission granted (for create operations)
- **`false`**: Permission denied
- **`array`**: Multiple access types (e.g., `["all", "own"]`)

### Role Hierarchy

1. **`admin`**: Full access to all operations
2. **`user`**: Standard user with limited access
3. **`viewer`**: Read-only access
4. **`anonymous`**: Public access (usually for read-only public collections)

## Usage Examples

### Example 1: Orders Collection

```javascript
orders: {
  roles: {
    admin: {
      read: ["all", "own"],
      write: ["all", "own"],
      create: true,
      delete: ["all", "own"]
    },
    user: {
      read: ["own"],
      write: ["own"],
      create: true,
      delete: ["own"]
    }
  },
  fieldPermissions: {
    user: {
      read: ["id", "userId", "status", "total", "items", "createdAt"],
      write: ["status"]  // Users can only update order status
    }
  }
}
```

**What this means:**
- Admins can read, write, create, and delete any order
- Users can only access their own orders
- Users can only update the `status` field of their orders
- Both roles can create new orders

### Example 2: Public Products Collection

```javascript
products: {
  roles: {
    admin: {
      read: ["all", "own"],
      write: ["all", "own"],
      create: true,
      delete: ["all", "own"]
    },
    user: {
      read: ["all"],      // Can read all products
      write: ["own"],     // Can only edit their own products
      create: true,
      delete: ["own"]
    },
    anonymous: {
      read: ["all"],      // Public read access
      write: false,
      create: false,
      delete: false
    }
  }
}
```

## API Integration

The RBAC middleware is automatically applied to all CRUD routes:

```javascript
// GET /api/orders - Requires 'read' permission
router.get('/:collectionName', rbacMiddleware('read'), async (req, res) => {
  // Route logic here
});

// POST /api/orders - Requires 'create' permission
router.post('/:collectionName', rbacMiddleware('create'), async (req, res) => {
  // Route logic here
});

// PUT /api/orders/123 - Requires 'write' permission
router.put('/:collectionName/:id', rbacMiddleware('write'), async (req, res) => {
  // Route logic here
});

// DELETE /api/orders/123 - Requires 'delete' permission
router.delete('/:collectionName/:id', rbacMiddleware('delete'), async (req, res) => {
  // Route logic here
});
```

## User Role Assignment

User roles are determined by:

1. **User profile role**: If `user.role` is set in the user document
2. **Email-based assignment**: Users with `@admin.com` emails get admin role
3. **Default role**: All other users get the `user` role

```javascript
// In your user document
{
  "id": "user123",
  "email": "john@example.com",
  "role": "user",  // This determines the user's role
  "name": "John Doe"
}
```

## Ownership Logic

The system uses the following fields to determine ownership:

- `userId`: User ID of the document owner
- `ownerId`: Alternative field for ownership

For create operations, if `userId` is not provided, it's automatically set to the authenticated user's ID.

## Error Responses

When permissions are denied, the API returns appropriate HTTP status codes:

- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Document not found or no access

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions for read operation on orders"
}
```

## Field-Level Security

When field permissions are configured, the system automatically:

1. **Filters response data**: Only includes readable fields
2. **Filters request data**: Only allows writable fields to be updated

```javascript
// If user can only read ["id", "status", "total"]
// GET /api/orders/123 returns:
{
  "id": "123",
  "status": "completed",
  "total": 99.99
  // Other fields like "internalNotes" are excluded
}
```

## Implementation Details

### Middleware Flow

1. **Authentication**: User is authenticated first
2. **RBAC Check**: Permission is verified for the operation
3. **Field Filtering**: Request/response data is filtered based on field permissions
4. **Ownership Check**: Database queries are filtered to respect ownership rules

### Performance Considerations

- RBAC checks are performed before database operations
- Field filtering happens at the application level
- Ownership filtering is applied to database queries for efficiency

## Customization

### Adding New Roles

1. Define the role in `config/rbac.js`
2. Update the `getUserRole` function in `middlewares/rbacMiddleware.js` if needed
3. Configure permissions for your collections

### Custom Role Logic

You can customize role assignment by modifying the `getUserRole` function:

```javascript
const getUserRole = async (user, collectionName) => {
  // Custom logic here
  if (user.customField === 'special') {
    return 'special_role';
  }

  // Default logic
  return user.role || 'user';
};
```

## Best Practices

1. **Principle of Least Privilege**: Give users only the permissions they need
2. **Regular Audits**: Review permissions regularly
3. **Test Thoroughly**: Test with different user roles
4. **Document Permissions**: Keep clear documentation of permission rules
5. **Monitor Access**: Log permission denials for security monitoring

## Migration from Simple Protection

If you're migrating from the simple `protectedCollections` system:

1. Define your collections in `config/rbac.js`
2. Remove collections from `PROTECTED_COLLECTIONS` environment variable
3. Test thoroughly with different user roles
4. Update your documentation

## Troubleshooting

### Common Issues

1. **403 Errors**: Check if the user has the correct role and permissions
2. **Missing Fields**: Verify field permissions are configured correctly
3. **Ownership Issues**: Ensure documents have the correct `userId` field

### Debug Mode

Add logging to `rbacMiddleware.js` to debug permission issues:

```javascript
console.log(`User: ${user.uid}, Role: ${userRole}, Collection: ${collectionName}, Operation: ${operation}`);
```

This RBAC system provides a robust foundation for securing your MongoDB collections while maintaining flexibility for different use cases.