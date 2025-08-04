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
      const { email, password, name } = req.body;

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
        createdAt: new Date()
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
          email: newUser.email,
          name: newUser.name,
          email_verified: newUser.email_verified,
          plan: newUser.plan
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
          email: user.email,
          name: user.name,
          email_verified: user.email_verified,
          plan: user.plan,
          lastLogin: user.lastLogin
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
      email: user.email,
      name: user.name,
      email_verified: user.email_verified,
      plan: user.plan,
      lastLogin: user.lastLogin || null
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user info'
    });
  }
});

module.exports = router;