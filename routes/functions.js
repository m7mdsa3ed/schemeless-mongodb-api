const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getDynamicModel } = require('../lib/getDynamicModel');
const notificationService = require('../services/notificationService');

// Apply authentication middleware to all routes in this file
router.use(authMiddleware);

// Define the collection name for storing functions
const FUNCTION_COLLECTION = 'cloud_functions';

/**
 * @route   POST /api/functions
 * @desc    Register a new function
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const FunctionModel = getDynamicModel(FUNCTION_COLLECTION);
    const { name, code, description, parameters } = req.body;

    // Basic validation
    if (!name || !code) {
      return res.status(400).json({ msg: 'Please provide a function name and code.' });
    }

    // Check if a function with the same name already exists
    const existingFunction = await FunctionModel.findOne({ name });
    if (existingFunction) {
      // Update existing function
      existingFunction.set({
        code,
        description,
        parameters,
        updatedAt: new Date()
      });
      
      const updatedFunction = await existingFunction.save();
      console.log('Function updated:', updatedFunction);
      return res.status(200).json(updatedFunction);
    }

    const newFunction = new FunctionModel({
      name,
      code,
      description,
      parameters,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newFunction.save();
    res.status(201).json(newFunction);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   POST /api/functions/:name/execute
 * @desc    Execute a function by name
 * @access  Private
 */
router.post('/:name/execute', async (req, res) => {
  try {
    const FunctionModel = getDynamicModel(FUNCTION_COLLECTION);
    const functionName = req.params.name;
    const args = req.body.args || []; // Arguments to pass to the function

    // Find the function in the database
    const functionToExecute = await FunctionModel.findOne({ name: functionName });
    if (!functionToExecute) {
      return res.status(404).json({ msg: 'Function not found.' });
    }

    // Get the database connection
    const dbConnection = req.app.get('dbConnection');
    if (!dbConnection) {
      return res.status(500).json({ msg: 'Database connection not available.' });
    }

    // Execute the function directly (without isolation for now)
    try {
      // Create an async function from the code string to support await and args
      const userFunction = new Function('console', 'db', 'args', 'getDynamicModel', 'notificationService', `
        return (async () => {
          try {
            // Create a function from the user's code and apply it with the provided args
            const userCode = ${functionToExecute.code};
            return userCode.apply(null, args);
          } catch (error) {
            console.error('Error executing function:', error);
            throw error;
          }
        })();
      `);

      // Execute the async function with the provided arguments
      const result = await userFunction(console, dbConnection, args, getDynamicModel, notificationService);
      
      res.json({ result });
    } catch (error) {
      console.error('Error executing function:', error);
      res.status(500).json({ msg: 'Error executing function.', error: error.message });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Error executing function.', error: err.message });
  }
});

module.exports = router;

/**
 * @route   DELETE /api/functions/:name
 * @desc    Delete a function by name
 * @access  Private
 */
router.delete('/:name', async (req, res) => {
  try {
    const FunctionModel = getDynamicModel(FUNCTION_COLLECTION);
    const functionName = req.params.name;

    // Find and delete the function
    const deletedFunction = await FunctionModel.findOneAndDelete({ name: functionName });
    
    if (!deletedFunction) {
      return res.status(404).json({ msg: 'Function not found.' });
    }

    res.json({ msg: 'Function deleted successfully.', deletedFunction });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});