// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const crudRoutes = require('./routes/crud');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const functionRoutes = require('./routes/functions');
const config = require('./config');
const notificationService = require('./services/notificationService');

const app = express();

// Enable CORS for all origins
app.use(cors());

// Connect Database
connectDB().then(dbConnection => {
  // Make the database connection available to the app
  app.set('dbConnection', dbConnection);
});

// Init Middleware (Body Parser)
app.use(express.json({ extended: false, limit: "50mb" })); // Allows us to get data in req.body

// Serve static files from uploads directory (for local storage)
if (config.fileUpload.provider === 'local') {
  const uploadPath = path.resolve(config.fileUpload.local.uploadPath);
  app.use('/uploads', express.static(uploadPath));
  console.log(`Serving static files from: ${uploadPath}`);
}


app.use('/test', async (req, res) => {
  notificationService.sendNotification([
    "e-_X84UsfHV8HrVr_M-I9B:APA91bH1CtIHog8rRH5SdxmTzHhJ-REKnG0izlbdKM1-f7tXwkNBD0IfaJ1dgJ_NgkRVLa9N8TCjCGNc_KVLjKPBpVOAw53Xr3I_eps7eVsWBT0ojIPE8tc"
  ], 'te22st', 'tes22t', { test: 'test222' });

  res.json({ test: 'test' });
})
// Define Routes
app.use('/api/auth', authRoutes); // Authentication endpoints
app.use('/api/upload', uploadRoutes); // File upload endpoints
app.use('/api/functions', functionRoutes); // Function management and execution
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

app.listen(config.port, () => console.log(`Server started on port ${config.port}`));
