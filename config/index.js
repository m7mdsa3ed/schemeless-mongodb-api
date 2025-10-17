// config/index.js
require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database Configuration
  mongoUri: process.env.MONGO_URI,

  // Authentication Configuration
  authType: process.env.AUTH_TYPE || 'firebase',

  // Firebase Authentication Configuration
  firebase: {
    credentials: process.env.FIREBASE_CREDENTIALS ? JSON.parse(process.env.FIREBASE_CREDENTIALS) : null,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
  },

  // Local Authentication Configuration
  jwtSecret: process.env.JWT_SECRET,

  // Collection Protection Configuration
  protectedCollections: process.env.PROTECTED_COLLECTIONS ?
    process.env.PROTECTED_COLLECTIONS.split(',').map(name => name.trim()) :
    [],

  // File Upload Configuration
  fileUpload: {
    // Storage provider: 'local', 'cloudinary', 's3'
    provider: process.env.FILE_UPLOAD_PROVIDER || 'local',

    // Local Storage Configuration
    local: {
      uploadPath: process.env.LOCAL_UPLOAD_PATH || './uploads',
      baseUrl: process.env.LOCAL_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
    },

    // Cloudinary Configuration
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      folder: process.env.CLOUDINARY_FOLDER || 'uploads',
      resourceType: process.env.CLOUDINARY_RESOURCE_TYPE || 'auto',
      secure: process.env.CLOUDINARY_SECURE !== 'false',
    },

    // AWS S3 Configuration (for future implementation)
    s3: {
      region: process.env.AWS_S3_REGION,
      bucket: process.env.AWS_S3_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },

    // General Upload Settings
    maxFileSize: process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 10 * 1024 * 1024, // 10MB default
  },

  // Analytics Configuration
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    collectionName: process.env.ANALYTICS_COLLECTION_NAME || 'analytics_logs',
    retentionDays: process.env.ANALYTICS_RETENTION_DAYS ? parseInt(process.env.ANALYTICS_RETENTION_DAYS) : 30,
    sampleRate: process.env.ANALYTICS_SAMPLE_RATE ? parseFloat(process.env.ANALYTICS_SAMPLE_RATE) : 1.0,
  },

  // Email Configuration
  email: {
    // Email provider: 'smtp' or 'api'
    provider: process.env.EMAIL_PROVIDER || 'smtp',

    // SMTP Configuration
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
    },

    // API Configuration (for services like Mailgun, SendGrid, etc.)
    api: {
      type: process.env.EMAIL_API_TYPE, // 'mailgun', 'sendgrid', etc.
      apiKey: process.env.EMAIL_API_KEY,
      domain: process.env.EMAIL_API_DOMAIN, // for Mailgun
      from: process.env.EMAIL_API_FROM,
    },
  },
};

// Validate required configuration
const validateConfig = () => {
  const errors = [];

  // Validate database configuration
  if (!config.mongoUri) {
    errors.push('MONGO_URI is required');
  }

  // Validate authentication configuration based on auth type
  if (config.authType === 'firebase') {
    if (!config.firebase.credentials && (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey)) {
      errors.push('Firebase configuration is required when AUTH_TYPE=firebase. Provide either FIREBASE_CREDENTIALS or individual Firebase credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
    }
  } else if (config.authType === 'local') {
    if (!config.jwtSecret) {
      errors.push('JWT_SECRET is required when AUTH_TYPE=local');
    }
  } else if (config.authType === 'none') {
    // No additional configuration required
  } else {
    errors.push('AUTH_TYPE must be either "firebase" or "local"');
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
};

// Validate configuration on module load
validateConfig();

module.exports = config;