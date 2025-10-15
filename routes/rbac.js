// routes/adminRbac.js
const express = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middlewares/authMiddleware');
const { rbacMiddleware } = require('../middlewares/rbacMiddleware');
const rbacConfig = require('../config/rbac');
const router = express.Router();

/**
 * GET /api/admin/rbac/config
 * Returns complete RBAC configuration for all database collections
 * formatted for use in .env file
 */
router.get('/config', async (req, res) => {
  try {
    // Get all collections from the database
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    // Filter out system collections and extract collection names
    const collectionNames = collections
      .map(col => col.name)
      .filter(name =>
        !name.startsWith('system.') &&
        !name.startsWith('index.') &&
        name !== 'fs.files' &&
        name !== 'fs.chunks'
      );

    // Get the default permissions from current RBAC config
    const defaultPermissions = rbacConfig.default;

    // Build complete RBAC configuration
    const completeRbacConfig = {
      // Start with default permissions
      default: defaultPermissions,
    };

    // Add configuration for each discovered collection
    collectionNames.forEach(collectionName => {
      // Check if collection already has custom configuration
      if (rbacConfig[collectionName]) {
        completeRbacConfig[collectionName] = rbacConfig[collectionName];
      } else {
        // Apply default permissions to new collections
        completeRbacConfig[collectionName] = defaultPermissions;
      }
    });

    // Generate environment-ready JSON
    const configJson = JSON.stringify(completeRbacConfig);
    const prettyPrintedJson = JSON.stringify(completeRbacConfig, null, 2);

    // Return the response
    res.json({
      collections: collectionNames.sort(),
      rbacConfig: completeRbacConfig,
      envVariable: {
        name: 'RBAC_COMPLETE_CONFIG',
        value: configJson,
        prettyPrinted: prettyPrintedJson
      },
      usage: {
        instruction: 'Copy the value below and add it to your .env file:',
        example: `RBAC_COMPLETE_CONFIG=${configJson}`
      }
    });

  } catch (error) {
    console.error('Error generating RBAC config:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate RBAC configuration'
    });
  }
});

/**
 * GET /api/admin/rbac/collections
 * Returns list of all collections in the database
 */
router.get('/rbac/collections', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const collectionNames = collections
      .map(col => col.name)
      .filter(name =>
        !name.startsWith('system.') &&
        !name.startsWith('index.') &&
        name !== 'fs.files' &&
        name !== 'fs.chunks'
      )
      .sort();

    res.json({
      collections: collectionNames,
      total: collectionNames.length,
      metadata: {
        filteredOut: collections.length - collectionNames.length,
        systemCollections: collections.filter(col =>
          col.name.startsWith('system.') ||
          col.name.startsWith('index.') ||
          col.name === 'fs.files' ||
          col.name === 'fs.chunks'
        ).map(col => col.name)
      }
    });

  } catch (error) {
    console.error('Error listing collections:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve collections'
    });
  }
});

/**
 * GET /api/admin/rbac/current
 * Returns current RBAC configuration being used by the system
 */
router.get('/rbac/current', async (req, res) => {
  try {
    res.json({
      currentConfig: rbacConfig,
      environmentOverrides: {
        completeConfig: process.env.RBAC_COMPLETE_CONFIG,
        defaultConfig: process.env.RBAC_DEFAULT_CONFIG,
        collectionConfigs: Object.keys(process.env)
          .filter(key => key.startsWith('RBAC_') && key.endsWith('_CONFIG'))
          .reduce((acc, key) => {
            acc[key] = process.env[key];
            return acc;
          }, {})
      }
    });

  } catch (error) {
    console.error('Error retrieving current RBAC config:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve current RBAC configuration'
    });
  }
});

module.exports = router;