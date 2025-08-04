const jwt = require('jsonwebtoken');
const { getDynamicModel } = require('../lib/getDynamicModel');
const config = require('../config');

const localAuth = async (token) => {
  try {
    if (!config.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required for local authentication');
    }
    
    // Verify the token
    const decodedToken = jwt.verify(token, config.jwtSecret);
    
    // Get user from our database
    const ourUser = await getDynamicModel('users').findOne({ id: decodedToken.uid });
    
    if (!ourUser) {
      throw new Error('User not found');
    }
    
    return {
      uid: ourUser.id,
      email: ourUser.email,
      email_verified: ourUser.email_verified || false,
      plan: ourUser.plan || 'free'
    };
  } catch (error) {
    console.error('Local Auth Error:', error);
    throw error;
  }
};

module.exports = localAuth;