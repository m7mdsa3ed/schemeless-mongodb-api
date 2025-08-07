const BaseStorageProvider = require('./baseStorageProvider');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class LocalStorageProvider extends BaseStorageProvider {
  constructor(config = {}) {
    super();
    this.uploadPath = config.uploadPath || './uploads';
    this.baseUrl = config.baseUrl || 'http://localhost:5000';
    this.ensureUploadDirectory();
  }

  /**
   * Ensure the upload directory exists
   */
  async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.uploadPath, { recursive: true });
      console.log(`Created upload directory: ${this.uploadPath}`);
    }
  }

  /**
   * Upload a file to local storage
   * @param {Object} file - The file object from multer
   * @param {Object} options - Additional options for upload
   * @returns {Promise<Object>} - Promise that resolves to upload result
   */
  async uploadFile(file, options = {}) {
    try {
      // Ensure upload directory exists
      await this.ensureUploadDirectory();

      // Generate unique filename to avoid conflicts
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const relativePath = path.join(this.uploadPath, uniqueFilename);
      const fullPath = path.resolve(relativePath);

      // Write the buffer to the upload directory (multer.memoryStorage provides file.buffer)
      await fs.writeFile(fullPath, file.buffer);

      // Construct the file URL
      const fileUrl = `${this.baseUrl}/uploads/${uniqueFilename}`;

      const result = {
        success: true,
        url: fileUrl,
        filename: uniqueFilename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: relativePath,
        provider: 'local',
        uploadedAt: new Date().toISOString()
      };

      console.log(`File uploaded successfully: ${file.originalname} -> ${fileUrl}`);
      return result;
    } catch (error) {
      console.error('Error uploading file to local storage:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete a file from local storage
   * @param {string} fileIdentifier - The filename or path of the file to delete
   * @returns {Promise<boolean>} - Promise that resolves to true if deletion was successful
   */
  async deleteFile(fileIdentifier) {
    try {
      // If fileIdentifier is a URL, extract the filename
      let filename = fileIdentifier;
      if (fileIdentifier.startsWith('http')) {
        const urlParts = fileIdentifier.split('/');
        filename = urlParts[urlParts.length - 1];
      }

      const filePath = path.join(this.uploadPath, filename);
      await fs.unlink(filePath);

      console.log(`File deleted successfully: ${filename}`);
      return true;
    } catch (error) {
      console.error('Error deleting file from local storage:', error);
      return false;
    }
  }

  /**
   * Get file information from local storage
   * @param {string} fileIdentifier - The filename or path of the file
   * @returns {Promise<Object>} - Promise that resolves to file information
   */
  async getFileInfo(fileIdentifier) {
    try {
      // If fileIdentifier is a URL, extract the filename
      let filename = fileIdentifier;
      if (fileIdentifier.startsWith('http')) {
        const urlParts = fileIdentifier.split('/');
        filename = urlParts[urlParts.length - 1];
      }

      const filePath = path.join(this.uploadPath, filename);
      const stats = await fs.stat(filePath);

      return {
        exists: true,
        filename: filename,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        path: filePath,
        url: `${this.baseUrl}/uploads/${filename}`,
        provider: 'local'
      };
    } catch (error) {
      console.error('Error getting file info from local storage:', error);
      return {
        exists: false,
        filename: fileIdentifier,
        provider: 'local',
        error: error.message
      };
    }
  }
}

module.exports = LocalStorageProvider;