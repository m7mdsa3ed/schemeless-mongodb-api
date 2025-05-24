// app.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const crudRoutes = require('./routes/crud');

// Load environment variables first
require('dotenv').config();

// Validate required Firebase environment variables
if (!process.env.FIREBASE_CREDENTIALS) {
  console.error('Missing required Firebase configuration. Please check your .env file');
  process.exit(1);
}

const app = express();

// Enable CORS for all origins
app.use(cors());

// Connect Database
connectDB();

// Init Middleware (Body Parser)
app.use(express.json({ extended: false })); // Allows us to get data in req.body

// Define Routes
app.use('/api', crudRoutes); // All CRUD operations will be under /api/:collectionName

// Global error handler for auth errors
app.use((err, req, res, next) => {
  if (err.name === 'FirebaseAuthError') {
    console.error('Firebase Auth Error:', err);
    return res.status(401).json({ error: 'Authentication failed', message: err.message });
  }
  next(err);
});

// Basic root route
app.get('/', (req, res) => res.send('API is running...'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
