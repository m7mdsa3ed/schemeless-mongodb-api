// cachingMiddleware.js

// In-memory cache using a Map
// Structure for each entry: { data: any, expiresAt: number, contentType: string }
const cacheMap = new Map();

const DEFAULT_CACHE_TTL_SECONDS = 60; // Default TTL: 60 seconds
const CACHE_CLEANUP_INTERVAL_MS = 60 * 1000; // Check every minute for expired items

/**
 * Global Caching Middleware for GET requests.
 *
 * To use: app.use(cachingMiddleware);
 *
 * Route handlers can customize TTL by setting `res.locals.cacheTTL = <seconds>;`
 * before sending the response.
 *
 * Route handlers can prevent caching for a specific response by setting
 * `res.locals.cacheTTL = 0;` or `res.locals.doNotCache = true;`
 */
function cachingMiddleware(req, res, next) {
    // Only cache GET requests
    if (req.method !== 'GET') {
        return next();
    }

    // Allow routes to signal not to cache this specific request
    if (res.locals.doNotCache) {
        return next();
    }

    const cacheKey = req.originalUrl; // Use the full URL (path + query) as the key
    const cachedEntry = cacheMap.get(cacheKey);

    if (cachedEntry && Date.now() < cachedEntry.expiresAt) {
        res.type(cachedEntry.contentType); // Set the correct content type
        res.send(cachedEntry.data); // Send the cached data
        return; // End the request-response cycle
    }

    // Monkey-patch res.send to capture the response and cache it
    const originalSend = res.send;
    res.send = function (body) {
        // Only cache successful responses (2xx status codes)
        // and if the body is not empty (can be configured)
        // and if caching hasn't been explicitly disabled for this response
        if (res.statusCode >= 200 && res.statusCode < 300 && body && !res.locals.doNotCache) {
            // Allow routes to specify a custom TTL via res.locals
            // A TTL of 0 or less means don't cache (or expires immediately)
            const ttlSeconds = typeof res.locals.cacheTTL === 'number' ? res.locals.cacheTTL : DEFAULT_CACHE_TTL_SECONDS;

            if (ttlSeconds > 0) {
                const expiresAt = Date.now() + ttlSeconds * 1000;
                const contentType = this.get('Content-Type') || 'application/octet-stream';

                cacheMap.set(cacheKey, {
                    data: body,
                    expiresAt: expiresAt,
                    contentType: contentType
                });
            }
        }
        // Call the original res.send with the original arguments
        originalSend.apply(res, arguments);
    };

    next(); // Proceed to the actual route handler
}

// --- Cache Management Functions (can be exported if needed by the main app) ---

function getCacheMap() {
    return cacheMap;
}

function clearCacheKey(key) {
    if (cacheMap.has(key)) {
        return cacheMap.delete(key);
    }
    return false;
}

function flushAllCache() {
    cacheMap.clear();
}

// --- Periodic Cleanup for expired items ---
// This interval will start when the module is loaded.
// Consider if this should be started by the main application instead.
let cleanupIntervalId = null;

function startCacheCleanup(intervalMs = CACHE_CLEANUP_INTERVAL_MS) {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
    }
    cleanupIntervalId = setInterval(() => {
        const now = Date.now();
        let clearedCount = 0;
        for (const [key, value] of cacheMap.entries()) {
            if (now >= value.expiresAt) {
                cacheMap.delete(key);
                clearedCount++;
            }
        }
        
    }, intervalMs);
}

function stopCacheCleanup() {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        console.log('[CACHE CLEANUP] Stopped.');
    }
}

// Automatically start cleanup when this module is loaded.
// If you prefer to control this from your main app, comment this out
// and export startCacheCleanup/stopCacheCleanup.
startCacheCleanup();

module.exports = {
    cachingMiddleware,
    // Optional: export management functions if you want to control them from app.js
    getCacheMap,
    clearCacheKey,
    flushAllCache,
    startCacheCleanup,
    stopCacheCleanup,
    DEFAULT_CACHE_TTL_SECONDS
};