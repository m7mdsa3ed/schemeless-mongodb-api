const admin = require('firebase-admin');
const { getDynamicModel } = require('../lib/getDynamicModel');
const config = require('../config');

// Initialize Firebase Admin with service account from environment variables
const initializeFirebase = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(config.firebase.credentials || {
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey
      }),
    })
  }
};

// Initialize Firebase when the module is first loaded
initializeFirebase();

const firebaseAuth = async (token) => {
  try {
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get user from our database
    const ourUser = await getDynamicModel('users').findOne({ id: decodedToken.uid });
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      plan: ourUser.plan || 'free'
    };
  } catch (error) {
    console.error('Firebase Auth Error:', error);
    throw error;
  }
};

module.exports = firebaseAuth;