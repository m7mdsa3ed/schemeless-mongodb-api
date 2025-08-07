const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadSingle, uploadMultiple, uploadAny } = require('../middlewares/uploadMiddleware');
const storageService = require('../services/storage/storageService');
const config = require('../config');
const { getDynamicModel } = require('../lib/getDynamicModel');

const router = express.Router();

// schemaless "uploads" collection
const Uploads = getDynamicModel('uploads');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Initialize the storage service based on configuration
const initializeStorageService = () => {
  const providerType = config.fileUpload.provider;
  let providerConfig;

  switch (providerType) {
    case 'local':
      providerConfig = config.fileUpload.local;
      break;
    case 'cloudinary':
      providerConfig = config.fileUpload.cloudinary;
      break;
    case 's3':
      providerConfig = config.fileUpload.s3;
      break;
    default:
      throw new Error(`Unsupported storage provider: ${providerType}`);
  }

  storageService.initializeProvider(providerType, providerConfig);
};

// Initialize storage service on module load
try {
  initializeStorageService();
} catch (error) {
  console.error('Failed to initialize storage service:', error);
}

/**
 * POST /api/upload/single
 * Upload a single file
 * Body: multipart/form-data with a 'file' field
 * Query options:
 * - folder: Destination folder (for Cloudinary)
 * - tags: Comma-separated tags (for Cloudinary)
 */
router.post('/single', uploadSingle('file'), async (req, res) => {
  try {
    const { folder, tags } = req.query;
    const options = {};

    if (folder) options.folder = folder;
    if (tags) options.tags = tags.split(',');

    const result = await storageService.uploadFile(req.file, options);

    // Persist the upload payload as-is, with minimal augmentation
    const doc = {
      ...result,
      provider: result.provider || (storageService.getCurrentProvider()?.constructor?.name?.replace('StorageProvider', '')?.toLowerCase()),
      requestMeta: {
        ip: req.ip,
        userAgent: req.get('user-agent')
      },
      userId: req.user?.id || req.user?._id || null,
      options
    };

    const saved = await Uploads.create(doc);

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: result,
      record: saved
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
});

/**
 * POST /api/upload/multiple
 * Upload multiple files
 * Body: multipart/form-data with a 'files' field
 * Query options:
 * - folder: Destination folder (for Cloudinary)
 * - tags: Comma-separated tags (for Cloudinary)
 */
router.post('/multiple', uploadMultiple('files', 10), async (req, res) => {
  try {
    const { folder, tags } = req.query;
    const options = {};

    if (folder) options.folder = folder;
    if (tags) options.tags = tags.split(',');

    const uploadPromises = req.files.map(file =>
      storageService.uploadFile(file, options)
    );

    const results = await Promise.all(uploadPromises);

    // Bulk persist each result
    const records = await Uploads.insertMany(results.map(r => ({
      ...r,
      provider: r.provider || (storageService.getCurrentProvider()?.constructor?.name?.replace('StorageProvider', '')?.toLowerCase()),
      requestMeta: {
        ip: req.ip,
        userAgent: req.get('user-agent')
      },
      userId: req.user?.id || req.user?._id || null,
      options
    })));

    res.status(201).json({
      success: true,
      message: `${results.length} files uploaded successfully`,
      data: results,
      records
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
});

/**
 * POST /api/upload/any
 * Upload files from any form field
 * Body: multipart/form-data with any file fields
 * Query options:
 * - folder: Destination folder (for Cloudinary)
 * - tags: Comma-separated tags (for Cloudinary)
 */
router.post('/any', uploadAny(), async (req, res) => {
  try {
    const { folder, tags } = req.query;
    const options = {};

    if (folder) options.folder = folder;
    if (tags) options.tags = tags.split(',');

    const uploadPromises = req.files.map(file =>
      storageService.uploadFile(file, options)
    );

    const results = await Promise.all(uploadPromises);

    // Persist all results
    const records = await Uploads.insertMany(results.map(r => ({
      ...r,
      provider: r.provider || (storageService.getCurrentProvider()?.constructor?.name?.replace('StorageProvider', '')?.toLowerCase()),
      requestMeta: {
        ip: req.ip,
        userAgent: req.get('user-agent')
      },
      userId: req.user?.id || req.user?._id || null,
      options
    })));

    res.status(201).json({
      success: true,
      message: `${results.length} files uploaded successfully`,
      data: results,
      records
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
});

/**
 * DELETE /api/upload/:fileIdentifier
 * Delete a file
 * Params:
 * - fileIdentifier: The file identifier (filename, public_id, or URL)
 */
router.delete('/:fileIdentifier', async (req, res) => {
  try {
    const { fileIdentifier } = req.params;
    
    const success = await storageService.deleteFile(fileIdentifier);
    
    if (success) {
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found or could not be deleted'
      });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

/**
 * GET /api/upload/:fileIdentifier/info
 * Get file information
 * Params:
 * - fileIdentifier: The file identifier (filename, public_id, or URL)
 */
router.get('/:fileIdentifier/info', async (req, res) => {
  try {
    const { fileIdentifier } = req.params;
    
    const fileInfo = await storageService.getFileInfo(fileIdentifier);
    
    res.json({
      success: true,
      data: fileInfo
    });
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file information',
      error: error.message
    });
  }
});

/**
 * POST /api/upload/switch-provider
 * Switch to a different storage provider (for testing purposes)
 * Body: { provider: 'local' | 'cloudinary' | 's3' }
 */
router.post('/switch-provider', async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider is required'
      });
    }

    let providerConfig;
    switch (provider) {
      case 'local':
        providerConfig = config.fileUpload.local;
        break;
      case 'cloudinary':
        providerConfig = config.fileUpload.cloudinary;
        break;
      case 's3':
        providerConfig = config.fileUpload.s3;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported provider: ${provider}`
        });
    }

    storageService.initializeProvider(provider, providerConfig);
    
    res.json({
      success: true,
      message: `Switched to ${provider} storage provider`
    });
  } catch (error) {
    console.error('Error switching provider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to switch provider',
      error: error.message
    });
  }
});

/**
 * GET /api/upload/config
 * Get current upload configuration
 */
router.get('/config', async (req, res) => {
  try {
    const currentProvider = storageService.getCurrentProvider();
    
    res.json({
      success: true,
      data: {
        provider: config.fileUpload.provider,
        maxFileSize: config.fileUpload.maxFileSize,
        allowedMimeTypes: config.fileUpload.allowedMimeTypes,
        currentProvider: currentProvider.constructor.name
      }
    });
  } catch (error) {
    console.error('Error getting upload config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upload configuration',
      error: error.message
    });
  }
});

module.exports = router;