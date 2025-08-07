const multer = require('multer');
const path = require('path');
const config = require('../config');

// Configure multer storage
const storage = multer.memoryStorage(); // Use memory storage for Cloudinary and S3
// For local storage, we could use disk storage, but memory storage gives us more flexibility

// File filter function to validate file types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = config.fileUpload.allowedMimeTypes;
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false); // Reject the file
  }
};

// Configure multer upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.fileUpload.maxFileSize,
    files: 10 // Maximum number of files allowed in a single request
  }
});

/**
 * Middleware to handle single file upload
 * @param {string} fieldName - The name of the form field containing the file
 * @returns {Function} - Express middleware function
 */
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: `File size exceeds the maximum limit of ${config.fileUpload.maxFileSize / (1024 * 1024)}MB`
          });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'Too many files',
            message: 'Only one file is allowed for this endpoint'
          });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error: 'Unexpected file field',
            message: `Expected file field name '${fieldName}'`
          });
        } else {
          return res.status(400).json({
            error: 'File upload error',
            message: err.message
          });
        }
      } else if (err) {
        // An unknown error occurred
        return res.status(400).json({
          error: 'File upload error',
          message: err.message
        });
      }
      
      // If no file was uploaded
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select a file to upload'
        });
      }
      
      next();
    });
  };
};

/**
 * Middleware to handle multiple file upload
 * @param {string} fieldName - The name of the form field containing the files
 * @param {number} maxCount - Maximum number of files allowed
 * @returns {Function} - Express middleware function
 */
const uploadMultiple = (fieldName = 'files', maxCount = 5) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, maxCount);
    
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: `One or more files exceed the maximum limit of ${config.fileUpload.maxFileSize / (1024 * 1024)}MB`
          });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'Too many files',
            message: `Maximum ${maxCount} files are allowed for this endpoint`
          });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error: 'Unexpected file field',
            message: `Expected file field name '${fieldName}'`
          });
        } else {
          return res.status(400).json({
            error: 'File upload error',
            message: err.message
          });
        }
      } else if (err) {
        // An unknown error occurred
        return res.status(400).json({
          error: 'File upload error',
          message: err.message
        });
      }
      
      // If no files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded',
          message: 'Please select one or more files to upload'
        });
      }
      
      next();
    });
  };
};

/**
 * Middleware to handle file upload with dynamic field name
 * @returns {Function} - Express middleware function
 */
const uploadAny = () => {
  return (req, res, next) => {
    const uploadMiddleware = upload.any();
    
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: `One or more files exceed the maximum limit of ${config.fileUpload.maxFileSize / (1024 * 1024)}MB`
          });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'Too many files',
            message: 'Too many files uploaded'
          });
        } else {
          return res.status(400).json({
            error: 'File upload error',
            message: err.message
          });
        }
      } else if (err) {
        // An unknown error occurred
        return res.status(400).json({
          error: 'File upload error',
          message: err.message
        });
      }
      
      // If no files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded',
          message: 'Please select one or more files to upload'
        });
      }
      
      next();
    });
  };
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadAny
};