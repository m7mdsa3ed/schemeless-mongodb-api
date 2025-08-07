/**
 * Base Storage Provider Interface
 * This defines the contract that all storage providers must implement
 */
class BaseStorageProvider {
  /**
   * Upload a file to the storage provider
   * @param {Object} file - The file object from multer
   * @param {Object} options - Additional options for upload
   * @returns {Promise<Object>} - Promise that resolves to upload result with URL and metadata
   */
  async uploadFile(file, options = {}) {
    throw new Error('uploadFile method must be implemented by subclass');
  }

  /**
   * Delete a file from the storage provider
   * @param {string} fileIdentifier - The identifier of the file to delete
   * @returns {Promise<boolean>} - Promise that resolves to true if deletion was successful
   */
  async deleteFile(fileIdentifier) {
    throw new Error('deleteFile method must be implemented by subclass');
  }

  /**
   * Get file information from the storage provider
   * @param {string} fileIdentifier - The identifier of the file
   * @returns {Promise<Object>} - Promise that resolves to file information
   */
  async getFileInfo(fileIdentifier) {
    throw new Error('getFileInfo method must be implemented by subclass');
  }
}

module.exports = BaseStorageProvider;