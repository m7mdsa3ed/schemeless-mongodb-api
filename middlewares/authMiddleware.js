const config = require('../config');
const { getDynamicModel } = require('../lib/getDynamicModel');

// Import authentication handlers
const firebaseAuth = config.authType === 'firebase' ? require('./firebaseAuth') : null;
const localAuth = config.authType === 'local' ? require('./localAuth') : null;

const authMiddleware = async (req, res, next) => {
  if (config.authType === 'none') {
    const firstUser = await getDynamicModel('users').findOne();
    req.user = { uid: firstUser.id, email: firstUser.email };
    return next();
  }

  try {
    // Check if authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    // Extract the token
    const token = authHeader.split('Bearer ')[1];

    // Verify the token based on authentication type
    let userInfo;
    if (config.authType === 'firebase' && firebaseAuth) {
      userInfo = await firebaseAuth(token);
    } else if (config.authType === 'local' && localAuth) {
      userInfo = await localAuth(token);
    } else {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Invalid authentication type configured'
      });
    }

    // Add user info to request object
    req.user = userInfo;

    next();
  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token'
    });
  }
};

module.exports = authMiddleware;