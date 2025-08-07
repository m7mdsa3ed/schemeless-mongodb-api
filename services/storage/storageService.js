const BaseStorageProvider = require('./baseStorageProvider');
const LocalStorageProvider = require('./localStorageProvider');
const CloudinaryStorageProvider = require('./cloudinaryStorageProvider');

class StorageService {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
  }

  /**
   * Initialize the storage service with a specific provider
   * @param {string} providerType - The type of provider ('local', 'cloudinary', 's3')
   * @param {Object} config - Configuration object for the provider
   */
  initializeProvider(providerType, config) {
    let provider;

    switch (providerType.toLowerCase()) {
      case 'local':
        provider = new LocalStorageProvider(config);
        break;
      case 'cloudinary':
        provider = new CloudinaryStorageProvider(config);
        break;
      case 's3':
        // S3 provider would be implemented here
        throw new Error('S3 provider not yet implemented');
      default:
        throw new Error(`Unknown storage provider: ${providerType}`);
    }

    this.providers.set(providerType, provider);
    this.currentProvider = provider;
    
    console.log(`Storage provider initialized: ${providerType}`);
  }

  /**
   * Get the current storage provider
   * @returns {BaseStorageProvider} - The current storage provider instance
   */
  getCurrentProvider() {
    if (!this.currentProvider) {
      throw new Error('No storage provider has been initialized');
    }
    return this.currentProvider;
  }

  /**
   * Switch to a different storage provider
   * @param {string} providerType - The type of provider to switch to
   * @returns {BaseStorageProvider} - The new storage provider instance
   */
  switchProvider(providerType) {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} has not been initialized`);
    }
    this.currentProvider = provider;
    console.log(`Switched to storage provider: ${providerType}`);
    return provider;
  }

  /**
   * Upload a file using the current provider
   * @param {Object} file - The file object from multer
   * @param {Object} options - Additional options for upload
   * @returns {Promise<Object>} - Promise that resolves to upload result
   */
  async uploadFile(file, options = {}) {
    const provider = this.getCurrentProvider();
    return await provider.uploadFile(file, options);
  }

  /**
   * Delete a file using the current provider
   * @param {string} fileIdentifier - The identifier of the file to delete
   * @returns {Promise<boolean>} - Promise that resolves to true if deletion was successful
   */
  async deleteFile(fileIdentifier) {
    const provider = this.getCurrentProvider();
    return await provider.deleteFile(fileIdentifier);
  }

  /**
   * Get file information using the current provider
   * @param {string} fileIdentifier - The identifier of the file
   * @returns {Promise<Object>} - Promise that resolves to file information
   */
  async getFileInfo(fileIdentifier) {
    const provider = this.getCurrentProvider();
    return await provider.getFileInfo(fileIdentifier);
  }
}

// Create a singleton instance
const storageService = new StorageService();

module.exports = storageService;