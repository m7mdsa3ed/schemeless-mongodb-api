const express = require('express');
const emailService = require('../services/email/emailService');
const router = express.Router();

// Send email
router.post('/send', async (req, res) => {
  try {
    const { to, subject, text, html, options = {} } = req.body;

    console.log({
      message: 'Received email send request',
      to, subject, text, html, options
    });
    

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and either text or html content',
      });
    }

    const result = await emailService.send(to, subject, text, html, options);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Email endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Send bulk emails
router.post('/bulk', async (req, res) => {
  try {
    const { recipients, subject, text, html, options = {} } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid recipients array',
      });
    }

    if (!subject || (!text && !html)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: subject, and either text or html content',
      });
    }

    const results = await emailService.sendBulk(recipients, subject, text, html, options);

    return res.status(200).json({
      success: true,
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
    });
  } catch (error) {
    console.error('Bulk email endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Validate email connection
router.get('/validate', async (req, res) => {
  try {
    const result = await emailService.validateConnection();

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Email validation endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;