const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getDynamicModel } = require('../lib/getDynamicModel');
const notificationService = require('../services/notificationService');

// Apply authentication middleware to all routes in this file
router.use(authMiddleware);

// Define the collection name for storing queries
const QUERY_COLLECTION = 'database_queries';

/**
 * @route   POST /api/queries
 * @desc    Register a new database query
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const QueryModel = getDynamicModel(QUERY_COLLECTION);
    const { name, pipeline, description, collectionName } = req.body;

    // Basic validation
    if (!name || !pipeline || !collectionName) {
      return res.status(400).json({ msg: 'Please provide a query name, pipeline, and collection name.' });
    }

    // Check if a query with the same name already exists
    const existingQuery = await QueryModel.findOne({ name });
    if (existingQuery) {
      // Update existing query
      existingQuery.set({
        pipeline,
        description,
        collectionName,
        updatedAt: new Date()
      });
      
      const updatedQuery = await existingQuery.save();
      console.log('Query updated:', updatedQuery);
      return res.status(200).json(updatedQuery);
    }

    const newQuery = new QueryModel({
      name,
      pipeline,
      description,
      collectionName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newQuery.save();
    res.status(201).json(newQuery);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   POST /api/queries/:name/execute
 * @desc    Execute a database query by name
 * @access  Private
 */
router.post('/:name/execute', async (req, res) => {
  try {
    const QueryModel = getDynamicModel(QUERY_COLLECTION);
    const queryName = req.params.name;
    const { params = {}, options = {} } = req.body; // Parameters for the query and options

    // Find the query in the database
    const queryToExecute = await QueryModel.findOne({ name: queryName });
    if (!queryToExecute) {
      return res.status(404).json({ msg: 'Query not found.' });
    }

    // Get the database connection
    const dbConnection = req.app.get('dbConnection');
    if (!dbConnection) {
      return res.status(500).json({ msg: 'Database connection not available.' });
    }

    try {
      // Get the dynamic model for the specified collection
      const Model = getDynamicModel(queryToExecute.collectionName);
      
      // Clone the pipeline to avoid modifying the original
      let executionPipeline = JSON.parse(JSON.stringify(queryToExecute.pipeline));
      
      // Replace parameters in the pipeline if provided
      if (params && Object.keys(params).length > 0) {
        executionPipeline = replaceParametersInPipeline(executionPipeline, params);
      }
      
      // Apply options if provided
      if (options.sort) {
        executionPipeline.push({ $sort: options.sort });
      }
      if (options.skip) {
        executionPipeline.push({ $skip: options.skip });
      }
      if (options.limit) {
        executionPipeline.push({ $limit: options.limit });
      }

      // Execute the aggregation pipeline
      const query = Model.aggregate(executionPipeline);
      const result = await query.exec();

      res.json({ 
        result,
      });
    } catch (error) {
      console.error('Error executing query:', error);
      res.status(500).json({ msg: 'Error executing query.', error: error.message });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Error executing query.', error: err.message });
  }
});

/**
 * @route   DELETE /api/queries/:name
 * @desc    Delete a query by name
 * @access  Private
 */
router.delete('/:name', async (req, res) => {
  try {
    const QueryModel = getDynamicModel(QUERY_COLLECTION);
    const queryName = req.params.name;

    // Find and delete the query
    const deletedQuery = await QueryModel.findOneAndDelete({ name: queryName });
    
    if (!deletedQuery) {
      return res.status(404).json({ msg: 'Query not found.' });
    }

    res.json({ msg: 'Query deleted successfully.', deletedQuery });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/queries
 * @desc    Get all registered queries
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const QueryModel = getDynamicModel(QUERY_COLLECTION);
    const queries = await QueryModel.find({}, { pipeline: 0 }); // Exclude pipeline field for security
    
    res.json(queries);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/queries/:name
 * @desc    Get a specific query by name
 * @access  Private
 */
router.get('/:name', async (req, res) => {
  try {
    const QueryModel = getDynamicModel(QUERY_COLLECTION);
    const queryName = req.params.name;

    const query = await QueryModel.findOne({ name: queryName });
    
    if (!query) {
      return res.status(404).json({ msg: 'Query not found.' });
    }

    res.json(query);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Helper function to replace parameters in the pipeline
function replaceParametersInPipeline(pipeline, params) {
  const replaceInObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].startsWith('{{') && obj[key].endsWith('}}')) {
        const paramKey = obj[key].slice(2, -2);
        if (params[paramKey] !== undefined) {
          obj[key] = params[paramKey];
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        replaceInObject(obj[key]);
      }
    }
  };
  
  const newPipeline = JSON.parse(JSON.stringify(pipeline));
  newPipeline.forEach(stage => replaceInObject(stage));
  return newPipeline;
}

module.exports = router;