const config = require('../config');

/**
 * Middleware to check if a collection is public (not in protectedCollections)
 * For GET requests, if the collection is public, skip authentication
 */
const publicCollectionMiddleware = (req, res, next) => {
  // Check if we have collection name in params or in the path
  const collectionName = req.params.collectionName ||
                        (req.path.split('/').filter(Boolean).pop());
  
  console.log({
    collectionName,
    params: req.params,
    path: req.path,
    method: req.method
  });
  
  // Only apply this logic for GET requests and if we have a collection name
  if (req.method !== 'GET' || !collectionName) {
    return next();
  }
  
  // Check if the collection is in the protected collections list
  const isProtected = config.protectedCollections.includes('*') || config.protectedCollections.includes(collectionName);
  
  // If the collection is not protected, it's considered public
  if (!isProtected) {
    // If no token is present, we create a dummy user to bypass auth
    // If a token IS present, we do nothing, and let the authMiddleware handle it
    if (!req.headers.authorization) {
      // For public collections, we'll skip authentication by creating a dummy user object
      // This allows the request to continue without auth middleware
      req.user = { uid: 'public-user' };
    }
  }
  
  next();
};

module.exports = publicCollectionMiddleware;