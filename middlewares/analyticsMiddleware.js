const UAParser = require('ua-parser-js');
const { getDynamicModel } = require('../lib/dynamicModel');
const config = require('../config');

/**
 * Analytics Middleware
 * Logs request metadata and parses user agent information
 */
const analyticsMiddleware = (req, res, next) => {
  // Sample rate logic - only track percentage of requests if sampleRate < 1
  if (config.analytics.sampleRate < 1 && Math.random() > config.analytics.sampleRate) {
    return next();
  }
  const startTime = Date.now();

  // Get client IP address
  const getClientIP = () => {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
  };

  // Parse user agent
  const parser = new UAParser();
  const ua = parser.setUA(req.headers['user-agent'] || '').getResult();

  // Override res.end to log when response is sent
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Prepare analytics data
    const analyticsData = {
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      ip: getClientIP(),
      statusCode: res.statusCode,
      responseTime: responseTime,
      userAgent: {
        browser: `${ua.browser.name || 'Unknown'} ${ua.browser.version || ''}`.trim(),
        os: `${ua.os.name || 'Unknown'} ${ua.os.version || ''}`.trim(),
        device: ua.device.type || 'desktop',
        isBot: !!(ua.ua.includes('bot') || ua.ua.includes('crawler') || ua.ua.includes('spider'))
      }
    };

    // Store analytics data asynchronously (non-blocking)
    storeAnalyticsData(analyticsData);

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Store analytics data in MongoDB
 * Uses existing dynamic model pattern
 */
async function storeAnalyticsData(data) {
  try {
    // Get analytics model using existing pattern
    const AnalyticsModel = getDynamicModel(config.analytics.collectionName);

    // Create analytics document
    const analyticsLog = new AnalyticsModel(data);

    // Save asynchronously without blocking response
    analyticsLog.save().catch(err => {
      // Silent fail for analytics to not impact main application
      if (process.env.NODE_ENV === 'development') {
        console.error('Analytics logging error:', err);
      }
    });
  } catch (error) {
    // Silent fail for analytics to not impact main application
    if (process.env.NODE_ENV === 'development') {
      console.error('Analytics model error:', error);
    }
  }
}

module.exports = analyticsMiddleware;