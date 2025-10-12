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

/**
 * @route   POST /api/functions/:name/execute-stream
 * @desc    Execute a function by name with streaming support (SSE)
 * @access  Private
 */
router.post('/:name/execute-stream', async (req, res) => {
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

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
    res.flushHeaders();

    // Flag to track if stream has been closed
    let streamClosed = false;

    // Create stream utilities for the function
    const stream = {
      write: (data) => {
        if (streamClosed) {
          console.warn('Attempted to write to closed stream');
          return false;
        }
        try {
          const message = `data: ${JSON.stringify({ type: 'data', payload: data })}\n\n`;
          return res.write(message);
        } catch (error) {
          console.error('Error writing to stream:', error);
          return false;
        }
      },
      end: (data) => {
        if (streamClosed) {
          console.warn('Attempted to end already closed stream');
          return;
        }
        try {
          if (data !== undefined) {
            res.write(`data: ${JSON.stringify({ type: 'end', payload: data })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
          }
          streamClosed = true;
          res.end();
        } catch (error) {
          console.error('Error ending stream:', error);
          if (!streamClosed) {
            streamClosed = true;
            res.end();
          }
        }
      },
      error: (error) => {
        if (streamClosed) {
          console.warn('Attempted to send error to closed stream');
          return;
        }
        try {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`);
          streamClosed = true;
          res.end();
        } catch (err) {
          console.error('Error sending error to stream:', err);
          if (!streamClosed) {
            streamClosed = true;
            res.end();
          }
        }
      }
    };

    // Handle client disconnect
    req.on('close', () => {
      if (!streamClosed) {
        console.log('Client disconnected from stream');
        streamClosed = true;
      }
    });

    // Execute the function with streaming support
    try {
      // Create an async function from the code string with stream support
      const userFunction = new Function('console', 'db', 'args', 'getDynamicModel', 'notificationService', 'stream', `
        return (async () => {
          try {
            // Create a function from the user's code and apply it with the provided args
            const userCode = ${functionToExecute.code};
            return userCode.apply(null, args);
          } catch (error) {
            console.error('Error executing streaming function:', error);
            throw error;
          }
        })();
      `);

      // Execute the async function with the provided arguments and stream utilities
      const result = await userFunction(console, dbConnection, args, getDynamicModel, notificationService, stream);

      // If the function returned a result and didn't explicitly close the stream, send it and close
      if (!streamClosed) {
        if (result !== undefined) {
          stream.write(result);
        }
        stream.end();
      }
    } catch (error) {
      console.error('Error executing streaming function:', error);
      if (!streamClosed) {
        stream.error(error);
      }
    }
  } catch (err) {
    console.error(err.message);
    // If headers haven't been sent yet, send JSON error
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Error executing streaming function.', error: err.message });
    } else {
      // If headers were already sent (SSE started), end the response
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
});

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

module.exports = router;
