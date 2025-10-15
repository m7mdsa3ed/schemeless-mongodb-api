const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDynamicModel } = require('../lib/getDynamicModel');
const config = require('../config');
const router = express.Router();

// Only expose local auth endpoints if AUTH_TYPE is set to local
if (config.authType === 'local') {
  // POST /api/auth/register
  // Register a new user
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name, ...args } = req.body;

      // Validate input
      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Email, password, and name are required'
        });
      }

      // Check if user already exists
      const existingUser = await getDynamicModel('users').findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = new (getDynamicModel('users'))({
        id: require('crypto').randomUUID(), // Generate a unique ID
        email,
        password: hashedPassword,
        name,
        email_verified: false,
        plan: 'free',
        createdAt: new Date(),
        ...args
      });

      await newUser.save();

      // Generate JWT token
      const token = jwt.sign(
        { uid: newUser.id, email: newUser.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          uid: newUser.id,
          ...newUser.toObject()
        }
      });
    } catch (error) {
      console.error('Registration Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to register user'
      });
    }
  });

  // POST /api/auth/login
  // Login a user
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await getDynamicModel('users').findOne({ email });
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials'
        });
      }

      // Update last login timestamp
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { uid: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          uid: user.id,
          ...user.toObject()
        }
      });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to login'
      });
    }
  });
}

// GET /api/auth/me
// Get current user info (works for both Firebase and local auth)
router.get('/me', require('../middlewares/authMiddleware'), async (req, res) => {
  try {
    // User info is already attached to req.user by the authMiddleware
    const user = await getDynamicModel('users').findOne({ id: req.user.uid });
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    res.json({
      uid: user.id,
      ...user.toObject()
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user info'
    });
  }
});

// Only expose local auth endpoints if AUTH_TYPE is set to local
if (config.authType === 'local') {
  // PUT /api/auth/password
  // Update user password
  router.put('/password', require('../middlewares/authMiddleware'), async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.uid;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Current password and new password are required'
        });
      }

      // Find user
      const user = await getDynamicModel('users').findOne({ id: userId });
      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Check if user has a password (some users might be from Firebase auth)
      if (!user.password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Password update not available for this account type'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: 'Unauthorized',
          message: 'Current password is incorrect'
        });
      }

      // Check if new password is different from current password
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'New password must be different from current password'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedNewPassword = await bcrypt.hash(newPassword, salt);

      // Update user password using updateOne to ensure it saves to database
      await getDynamicModel('users').updateOne(
        { id: userId },
        {
          $set: {
            password: hashedNewPassword,
            updatedAt: new Date()
          }
        }
      );

      res.json({
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Password Update Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update password'
      });
    }
  });
}

module.exports = router;