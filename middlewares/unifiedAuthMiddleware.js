const config = require('../config');

// Import authentication handlers
const firebaseAuth = config.authType === 'firebase' ? require('./firebaseAuth') : null;
const localAuth = config.authType === 'local' ? require('./localAuth') : null;

/**
 * Unified middleware that handles both authentication and public collection access
 * - For protected collections: requires valid authentication
 * - For public collections: tries authentication if header exists, falls back to public access if auth fails
 */
const unifiedAuthMiddleware = async (req, res, next) => {
  // Check if we have collection name in params or in the path
  const collectionName = req.params.collectionName ||
                        (req.path.split('/').filter(Boolean).pop());

  // Check if the collection is in the protected collections list
  const isProtected = config.protectedCollections.includes('*') ||
                     config.protectedCollections.includes(collectionName);

  // If no auth type is set, skip authentication entirely
  if (config.authType === 'none') {
    return next();
  }

  // Check if authorization header exists
  const authHeader = req.headers.authorization;
  const hasAuthHeader = authHeader && authHeader.startsWith('Bearer ');

  try {
    let userInfo = null;

    // If we have an auth header, try to authenticate regardless of collection type
    if (hasAuthHeader) {
      const token = authHeader.split('Bearer ')[1];

      // Verify the token based on authentication type
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
    }

    // If we have a valid user, use it
    if (userInfo) {
      req.user = userInfo;
      return next();
    }

    // If we get here, authentication failed or no auth header was provided
    // Check if this is a public collection that can be accessed without authentication
    if (!isProtected && (!hasAuthHeader || !userInfo)) {
      // For public collections, allow access as public user
      req.user = { uid: 'public-user' };
      return next();
    }

    // If we get here, this is a protected collection and authentication failed
    if (hasAuthHeader) {
      // Auth was attempted but failed
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token'
      });
    } else {
      // No auth provided for protected collection
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

  } catch (error) {
    console.error('Auth Error:', error);

    // For public collections, fall back to public access on auth errors
    if (!isProtected) {
      req.user = { uid: 'public-user' };
      return next();
    }

    // For protected collections, return the error
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token'
    });
  }
};

module.exports = unifiedAuthMiddleware;