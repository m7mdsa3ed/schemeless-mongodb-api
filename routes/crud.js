// routes/crud.js
const express = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Helper function to get or create a dynamic Mongoose model
const getDynamicModel = (collectionName) => {
    const modelName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

    if (mongoose.models[modelName]) {
        return mongoose.models[modelName];
    }

    // Define a schemaless schema
    const dynamicSchema = new mongoose.Schema({
        id: { type: String, unique: true },
    }, { strict: false, timestamps: true });

    return mongoose.model(modelName, dynamicSchema);
};

// Helper to parse a structured JSON query parameter into Mongoose filter and options
// This function now expects a JSON string like:
// {
//   "conditions": [
//     { "field": "age", "operator": ">", "value": 25 },
//     { "field": "isActive", "operator": "==", "value": true },
//     { "field": "tags", "operator": "array-contains", "value": "nodejs" },
//     { "field": "status", "operator": "in", "value": ["active", "pending"] }
//   ],
//   "orderByField": "age",
//   "orderDirection": "asc",
//   "limitCount": 10,
//   "offsetCount": 0, // Added offset for full pagination control
//   "startAfter": 0   // Alternative for offset, typically used as a skip count for pagination
// }
const parseStructuredQuery = (jsonQueryString, userId) => {
    const filter = {};
    const options = {};
    let parsedQuery;

    try {
        parsedQuery = JSON.parse(jsonQueryString);
    } catch (e) {
        console.error("Failed to parse query JSON:", e);
        throw new Error("Invalid query JSON format.");
    }

    const {
        conditions = [],
        orderByField = '_id',
        orderDirection = 'desc',
        limitCount = null,
        offsetCount = null, // Handle offset
        startAfter = null, // New: for pagination cursor as skip count,
        sortObject = null
    } = parsedQuery;

    const opMap = {
        '==': '$eq',
        '!=': '$ne',
        '>': '$gt',
        '>=': '$gte',
        '<': '$lt',
        '<=': '$lte',
        'in': '$in',
        'nin': '$nin',
        'array-contains': '$eq', // Special handling for array elements
        'array-contains-any': '$in', // Special handling for multiple array elements
        'exists': '$exists', // field exists (value true/false)
        'regex': '$regex', // regex match (value is pattern, can add options)
    };

    // Initialize field conditions map to track multiple conditions per field
    const fieldConditions = {};

    for (const condition of conditions) {
        let { field, operator, value } = condition;

        if (field == 'userId') {
            // Special case for userId, use req.user.uid
            value = userId; // Use authenticated user's UID
        }

        const mongooseOp = opMap[operator];

        if (!field || !operator || value === undefined) {
            console.warn('Skipping malformed condition:', condition);
            continue;
        }

        // Attempt to parse value to number or boolean if string
        let processedValue = value;
        if (typeof value === 'string') {
            if (!isNaN(Number(value)) && !isNaN(parseFloat(value))) {
                processedValue = Number(value);
            } else if (value === 'true') {
                processedValue = true;
            } else if (value === 'false') {
                processedValue = false;
            }
        }

        // Initialize field conditions if not exists
        if (!fieldConditions[field]) {
            fieldConditions[field] = {};
        }

        if (mongooseOp) {
            if (operator === 'array-contains') {
                fieldConditions[field] = processedValue; // Direct value for array contains
            } else if (operator === 'array-contains-any' || operator === 'in' || operator === 'nin') {
                if (!Array.isArray(processedValue)) {
                    processedValue = [processedValue];
                }
                fieldConditions[field][mongooseOp] = processedValue;
            } else if (operator === 'exists') {
                fieldConditions[field][mongooseOp] = processedValue;
            } else if (operator === 'regex') {
                fieldConditions[field] = {
                    [mongooseOp]: processedValue,
                    $options: 'i'
                };
            } else if (operator === '==') {
                // For equality, only override if no other conditions exist
                if (Object.keys(fieldConditions[field]).length === 0) {
                    fieldConditions[field] = processedValue;
                } else {
                    // If other conditions exist, use $eq operator
                    fieldConditions[field]['$eq'] = processedValue;
                }
            } else {
                // For other operators, merge into existing conditions
                fieldConditions[field][mongooseOp] = processedValue;
            }
        } else {
            // Default to equality if operator not recognized
            fieldConditions[field] = processedValue;
        }
    }

    // Convert fieldConditions to final filter
    for (const [field, conditions] of Object.entries(fieldConditions)) {
        if (typeof conditions === 'object' && !Array.isArray(conditions)) {
            filter[field] = conditions;
        } else {
            // Direct value assignment for simple conditions
            filter[field] = conditions;
        }
    }

    options.sort = sortObject ??{ [orderByField]: orderDirection === 'asc' ? 1 : -1 };
    if (limitCount !== null) {
        options.limit = parseInt(limitCount);
    }
    if (startAfter !== null && !isNaN(parseInt(startAfter))) {
        options.skip = parseInt(startAfter);
    } else if (offsetCount !== null) {
        options.skip = parseInt(offsetCount);
    }

    return { filter, options };
};

const getCollectionPipeline = (collectionName, queryParams, basePipeline) => {
    if (collectionName === 'transactions') {
        return [
            {
                $addFields: {
                    amountCents: { $round: [{ $multiply: ["$amount", 100] }, 0] }
                }
            },
            {
                $setWindowFields: {
                    partitionBy: "$accountId",
                    sortBy: { date: 1, id: 1 },
                    output: {
                        balanceCents: {
                            $sum: "$amountCents",
                            window: { documents: ["unbounded", "current"] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    balance: { $divide: ["$balanceCents", 100] }
                }
            },
            {
                $project: {
                    amountCents: 0,
                    balanceCents: 0
                }
            },
        ]
    }
}

// GET all documents in a collection with filtering, sorting, and pagination
// Example: GET /data/users?query={"conditions":[{"field":"age","operator":">","value":25},{"field":"isActive","operator":"==","value":true}],"orderByField":"age","orderDirection":"asc","limitCount":10,"offsetCount":0}
router.get('/:collectionName', async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        let filter = {};
        let options = {};

        // Check if the 'query' parameter exists and is a string
        if (req.query.query && typeof req.query.query === 'string') {
            try {
                const parsed = parseStructuredQuery(req.query.query, req.user?.uid ?? '');
                filter = parsed.filter;
                options = parsed.options;
            } catch (error) {
                return res.status(400).json({ msg: error.message });
            }
        }

        const pipeline = [
            {
                $match: filter,
            },
        ];

        // I need a dynamic way to add new pipeline stages based on query parameters
        // it should be based on the collectionName
        const collectionPipeline = getCollectionPipeline(collectionName, req.query, pipeline);

        if (collectionPipeline) {
            pipeline.push(...collectionPipeline);
        }

        if (options.sort) {
            pipeline.push({
                $sort: options.sort,
            });
        }

        if (options.skip) {
            pipeline.push({
                $skip: options.skip,
            });
        }

        if (options.limit) {
            pipeline.push({
                $limit: options.limit,
            });
        }

        const query = Model.aggregate(pipeline);
        const documents = await query.exec();
        const total = await Model.countDocuments(filter); // Count total matching documents

        res.json({
            data: documents,
            metadata: {
                total,
                limit: options.limit || total, // If no limit, assume all
                offset: options.skip || 0,
            },
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET a single document by ID
router.get('/:collectionName/:id', async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);
        const document = await Model.findOne({ id: req.params.id });

        if (!document) {
            return res.status(404).json({ msg: 'Document not found' });
        }

        res.json(document);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'Invalid Document ID' });
        }
        res.status(500).send('Server Error');
    }
});

// POST create a new document
router.post('/:collectionName', async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);
        const newDocument = new Model(req.body);
        await newDocument.save();
        res.status(201).json(newDocument);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST create multiple new documents (batch write)
router.post('/:collectionName/batch', async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        // Ensure req.body is an array
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ msg: 'Request body must be an array of documents.' });
        }

        // Ensure the array is not empty
        if (req.body.length === 0) {
            return res.status(400).json({ msg: 'Request body array cannot be empty.' });
        }

        const newDocuments = await Model.insertMany(req.body, { ordered: false }); // ordered: false allows other valid operations to continue if one fails
        res.status(201).json(newDocuments);
    } catch (err) {
        console.error("Batch write error:", err.message);
        // Check if it's a bulk write error which might contain more details
        if (err.name === 'MongoBulkWriteError' && err.writeErrors) {
            return res.status(500).json({
                msg: 'Server Error during batch write. Some documents may have failed.',
                errors: err.writeErrors.map(e => ({ index: e.index, code: e.code, errmsg: e.errmsg })),
                insertedCount: err.result ? err.result.nInserted : 0
            });
        }
        res.status(500).send('Server Error');
    }
});

// PUT update a document by ID
router.put('/:collectionName/:id', async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        const updatedDocument = await Model.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedDocument) {
            return res.status(404).json({ msg: 'Document not found' });
        }
        res.json(updatedDocument);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'Invalid Document ID' });
        }
        res.status(500).send('Server Error');
    }
});

// DELETE multiple documents by IDs (bulk delete)
router.delete('/:collectionName/batch', async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        // Validate body: should be an array of IDs
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: 'Request body must contain a non-empty array "ids".' });
        }

        // Perform bulk delete using deleteMany
        const result = await Model.deleteMany({ id: { $in: ids } });

        // result.deletedCount tells how many were actually deleted
        const successCount = result.deletedCount || 0;
        // If you want to know which IDs were not found, you can optionally fetch missing ones:
        let errors = [];
        if (successCount !== ids.length) {
            // Optional: Find which IDs were not deleted (i.e., not found)
            const foundDocs = await Model.find({ id: { $in: ids } }).select('id');
            const foundIds = foundDocs.map(doc => doc.id);
            const notFoundIds = ids.filter(id => !foundIds.includes(id));
            errors = notFoundIds.map(id => ({ id, error: 'Not found' }));
        }

        return res.json({ successCount, errors });
    } catch (err) {
        console.error('Batch delete error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// DELETE a document by ID
router.delete('/:collectionName/:id', async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);
        const deletedDocument = await Model.findOneAndDelete({
            id: req.params.id,
        });

        if (!deletedDocument) {
            return res.status(404).json({ msg: 'Document not found' });
        }
        res.status(204).send();
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'Invalid Document ID' });
        }
        res.status(500).send('Server Error');
    }
});


module.exports = router;
