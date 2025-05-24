// app.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const crudRoutes = require('./routes/crud');

require('dotenv').config();

const app = express();

// Enable CORS for all origins
app.use(cors());

// Connect Database
connectDB();

// Init Middleware (Body Parser)
app.use(express.json({ extended: false })); // Allows us to get data in req.body

// Define Routes
app.use('/api', crudRoutes); // All CRUD operations will be under /api/:collectionName

// Basic root route
app.get('/', (req, res) => res.send('API is running...'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
