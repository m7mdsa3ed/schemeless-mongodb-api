const BaseStorageProvider = require('./baseStorageProvider');
const { v2: cloudinary } = require('cloudinary');

class CloudinaryStorageProvider extends BaseStorageProvider {
  constructor(config = {}) {
    super();
    
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: config.cloudName || process.env.CLOUDINARY_CLOUD_NAME,
      api_key: config.apiKey || process.env.CLOUDINARY_API_KEY,
      api_secret: config.apiSecret || process.env.CLOUDINARY_API_SECRET,
      secure: config.secure !== false // Default to true
    });

    this.folder = config.folder || 'uploads';
    this.resourceType = config.resourceType || 'auto';
    this.allowedFormats = config.allowedFormats || null;
    this.transformation = config.transformation || null;
  }

  /**
   * Upload a file to Cloudinary
   * @param {Object} file - The file object from multer
   * @param {Object} options - Additional options for upload
   * @returns {Promise<Object>} - Promise that resolves to upload result
   */
  async uploadFile(file, options = {}) {
    try {
      const uploadOptions = {
        folder: options.folder || this.folder,
        resource_type: options.resourceType || this.resourceType,
        public_id: options.publicId || undefined,
        overwrite: options.overwrite !== false, // Default to true
        invalidate: options.invalidate !== false, // Default to true
        transformation: options.transformation || this.transformation
      };

      // Add allowed formats if specified
      if (this.allowedFormats) {
        uploadOptions.format = this.allowedFormats;
      }

      // Add custom tags if provided
      if (options.tags && Array.isArray(options.tags)) {
        uploadOptions.tags = options.tags;
      }

      // Upload the file buffer directly
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        // Write the file buffer to the upload stream
        uploadStream.end(file.buffer);
      });

      const uploadResult = {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        filename: result.original_filename || file.originalname,
        originalName: file.originalname,
        size: result.bytes || file.size,
        mimetype: result.resource_type || file.mimetype,
        format: result.format,
        width: result.width,
        height: result.height,
        provider: 'cloudinary',
        uploadedAt: new Date().toISOString(),
        metadata: {
          resourceType: result.resource_type,
          version: result.version,
          signature: result.signature,
          tags: result.tags || [],
          etag: result.etag
        }
      };

      console.log(`File uploaded successfully to Cloudinary: ${file.originalname} -> ${result.secure_url}`);
      return uploadResult;
    } catch (error) {
      console.error('Error uploading file to Cloudinary:', error);
      throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
    }
  }

  /**
   * Delete a file from Cloudinary
   * @param {string} fileIdentifier - The public_id or URL of the file to delete
   * @returns {Promise<boolean>} - Promise that resolves to true if deletion was successful
   */
  async deleteFile(fileIdentifier) {
    try {
      let publicId = fileIdentifier;

      // If fileIdentifier is a URL, extract the public_id
      if (fileIdentifier.startsWith('http')) {
        const urlParts = fileIdentifier.split('/');
        const filenameWithExtension = urlParts[urlParts.length - 1];
        publicId = filenameWithExtension.split('.')[0]; // Remove file extension
        
        // Also remove folder path if present
        if (publicId.includes('/')) {
          publicId = publicId.split('/').slice(1).join('/');
        }
      }

      const result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: this.resourceType
      });

      if (result.result === 'ok' || result.result === 'not found') {
        console.log(`File deleted successfully from Cloudinary: ${publicId}`);
        return true;
      } else {
        console.error(`Failed to delete file from Cloudinary: ${publicId}`, result);
        return false;
      }
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
      return false;
    }
  }

  /**
   * Get file information from Cloudinary
   * @param {string} fileIdentifier - The public_id or URL of the file
   * @returns {Promise<Object>} - Promise that resolves to file information
   */
  async getFileInfo(fileIdentifier) {
    try {
      let publicId = fileIdentifier;

      // If fileIdentifier is a URL, extract the public_id
      if (fileIdentifier.startsWith('http')) {
        const urlParts = fileIdentifier.split('/');
        const filenameWithExtension = urlParts[urlParts.length - 1];
        publicId = filenameWithExtension.split('.')[0]; // Remove file extension
        
        // Also remove folder path if present
        if (publicId.includes('/')) {
          publicId = publicId.split('/').slice(1).join('/');
        }
      }

      const result = await cloudinary.api.resource(publicId, {
        resource_type: this.resourceType
      });

      return {
        exists: true,
        publicId: result.public_id,
        filename: result.public_id.split('/').pop(),
        size: result.bytes,
        format: result.format,
        width: result.width,
        height: result.height,
        createdAt: new Date(result.created_at * 1000).toISOString(),
        url: result.secure_url,
        provider: 'cloudinary',
        metadata: {
          resourceType: result.resource_type,
          version: result.version,
          signature: result.signature,
          tags: result.tags || [],
          etag: result.etag,
          type: result.type
        }
      };
    } catch (error) {
      console.error('Error getting file info from Cloudinary:', error);
      return {
        exists: false,
        filename: fileIdentifier,
        provider: 'cloudinary',
        error: error.message
      };
    }
  }

  /**
   * Get Cloudinary instance for advanced operations
   * @returns {Object} - Cloudinary instance
   */
  getCloudinaryInstance() {
    return cloudinary;
  }
}

module.exports = CloudinaryStorageProvider;