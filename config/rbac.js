// Enhanced RBAC configuration for CRUD operations
// Helper function to parse environment variables safely
function parseEnvVar(varName, defaultValue = null) {
  const value = process.env[varName];
  if (!value) return defaultValue;

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn(`Failed to parse environment variable ${varName}:`, error.message);
    return defaultValue;
  }
}

// Helper function to merge default config with environment overrides
function mergeWithEnvDefaults(defaultConfig, envPrefix) {
  const envConfig = parseEnvVar(envPrefix);
  if (!envConfig) return defaultConfig;

  // Deep merge function
  function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  return deepMerge(defaultConfig, envConfig);
}

// Default permissions for collections without explicit rules
const defaultPermissions = {
  ownershipField: "userId", // Default ownership field
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
  }
};

// Collection-specific rules
const collectionsConfig = {
  orders: {
    ownershipField: "userId", // Can be customized per collection
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
    // Field-level permissions for additional security
    fieldPermissions: {
      user: {
        read: ["id", "userId", "status", "total", "items", "createdAt", "updatedAt"],
        write: ["status"]
      }
    }
  },

  users: {
    roles: {
      admin: {
        read: ["all"],
        write: ["all"],
        create: true,
        delete: ["all"]
      },
      user: {
        read: ["own"],
        write: ["own"],
        create: false, // Users can't create other users
        delete: ["own"]
      }
    }
  },

  products: {
    ownershipField: "ownerId", // Example: products use ownerId instead of userId
    roles: {
      admin: {
        read: ["all", "own"],
        write: ["all", "own"],
        create: true,
        delete: ["all", "own"]
      },
      user: {
        read: ["all"], // Users can read all products
        write: ["own"],
        create: true,
        delete: ["own"]
      }
    }
  },

  categories: {
    roles: {
      admin: {
        read: ["all", "own"],
        write: ["all", "own"],
        create: true,
        delete: ["all", "own"]
      },
      user: {
        read: ["all"], // Users can read all products
        write: ["own"],
        create: true,
        delete: ["own"]
      }
    }
  },

  brands: {
    roles: {
      admin: {
        read: ["all", "own"],
        write: ["all", "own"],
        create: true,
        delete: ["all", "own"]
      },
      user: {
        read: ["all"], // Users can read all products
        write: ["own"],
        create: true,
        delete: ["own"]
      }
    }
  },

  comments: {
    ownershipField: "authorId", // Example: comments use authorId
    roles: {
      admin: {
        read: ["all", "own"],
        write: ["all", "own"],
        create: true,
        delete: ["all", "own"]
      },
      user: {
        read: ["all"], // Users can read all comments
        write: ["own"],
        create: true,
        delete: ["own"]
      }
    }
  },
  
  uploads: {
    roles: {
      admin: {
        read: ["all", "own"],
        write: ["all", "own"],
        create: true,
        delete: ["all", "own"]
      },
      user: {
        read: ["all"], // Users can read all products
        write: ["own"],
        create: true,
        delete: ["own"]
      }
    }
  },

  'ai-providers': {
    roles: {
      admin: {
        read: ["all", "own"],
        write: ["all", "own"],
        create: true,
        delete: ["all", "own"]
      },
      user: {
        read: ["all"], // Users can read all products
        write: ["own"],
        create: true,
        delete: ["own"]
      }
    }
  },
};

// Helper function to apply granular operation overrides
function applyOperationOverrides(config, collectionName) {
  // Define the structure of operations we want to support for granular override
  const operations = ['read', 'write', 'create', 'delete'];
  const roles = ['admin', 'user', 'anonymous'];

  // Create a copy to avoid mutating the original
  const result = JSON.parse(JSON.stringify(config));

  // Apply operation-level overrides for each role
  roles.forEach(role => {
    operations.forEach(operation => {
      const envVarName = `RBAC_${collectionName.toUpperCase().replace(/-/g, '_')}_${role.toUpperCase()}_${operation.toUpperCase()}`;
      const overrideValue = parseEnvVar(envVarName);

      if (overrideValue !== null) {
        // Ensure the role and operation structure exists
        if (!result.roles) result.roles = {};
        if (!result.roles[role]) result.roles[role] = {};

        // Apply the override
        result.roles[role][operation] = overrideValue;
      }
    });
  });

  return result;
}

// Helper function to apply field-level permission overrides
function applyFieldPermissionOverrides(config, collectionName) {
  const roles = ['admin', 'user', 'anonymous'];
  const fieldTypes = ['read', 'write'];

  // Create a copy to avoid mutating the original
  const result = JSON.parse(JSON.stringify(config));

  // Apply field permission overrides for each role
  roles.forEach(role => {
    fieldTypes.forEach(fieldType => {
      const envVarName = `RBAC_${collectionName.toUpperCase().replace(/-/g, '_')}_${role.toUpperCase()}_FIELDS_${fieldType.toUpperCase()}`;
      const overrideValue = parseEnvVar(envVarName);

      if (overrideValue !== null && Array.isArray(overrideValue)) {
        // Ensure the fieldPermissions structure exists
        if (!result.fieldPermissions) result.fieldPermissions = {};
        if (!result.fieldPermissions[role]) result.fieldPermissions[role] = {};

        // Apply the override
        result.fieldPermissions[role][fieldType] = overrideValue;
      }
    });
  });

  return result;
}

// Build final RBAC configuration with environment overrides
const rbacConfig = {
  // Default permissions with environment override
  default: applyFieldPermissionOverrides(
    applyOperationOverrides(
      mergeWithEnvDefaults(defaultPermissions, 'RBAC_DEFAULT_CONFIG'),
      'DEFAULT'
    ),
    'DEFAULT'
  ),

  // Collection-specific rules with environment overrides
  ...Object.keys(collectionsConfig).reduce((acc, collectionName) => {
    const envPrefix = `RBAC_${collectionName.toUpperCase().replace(/-/g, '_')}_CONFIG`;

    let collectionConfig = mergeWithEnvDefaults(collectionsConfig[collectionName], envPrefix);

    // Apply granular operation overrides
    collectionConfig = applyOperationOverrides(collectionConfig, collectionName);

    // Apply field permission overrides
    collectionConfig = applyFieldPermissionOverrides(collectionConfig, collectionName);

    acc[collectionName] = collectionConfig;
    return acc;
  }, {})
};

// Allow complete RBAC override via single environment variable
const completeRbacOverride = parseEnvVar('RBAC_COMPLETE_CONFIG');
if (completeRbacOverride) {
  module.exports = completeRbacOverride;
} else {
  module.exports = rbacConfig;
}