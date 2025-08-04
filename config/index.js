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