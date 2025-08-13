// routes/crud.js
const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const limitsMiddleware = require('../middlewares/limitsMiddleware');
const { getDynamicModel } = require('../lib/getDynamicModel');
const config = require('../config');
const router = express.Router();

router.use(authMiddleware);

// Helper to parse a structured JSON query parameter into Mongoose filter and options
// This function now expects a JSON string like:
// {
//   "conditions": [
//     { "field": "age", "operator": ">", "value": 25 },
//     { "field": "isActive", "operator": "==", "value": true },
//     { "field": "tags", "operator": "array-contains", "value": "nodejs" },
//     { "field": "status", "operator": "in", "value": ["active", "pending"] },
//     { "field": "name", "operator": "like", "value": "john" } // Like search for partial matches
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
        orderByField = 'id',
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
        'like': '$regex', // like search (value is pattern, automatically adds wildcards and case-insensitive)
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
            } else if (operator === 'like') {
                // For like operator, convert to regex with wildcards and case-insensitive
                const regexPattern = processedValue.replace(/([.?*+^$[\]\\(){}|])/g, '\\$1');
                fieldConditions[field] = {
                    [mongooseOp]: `.*${regexPattern}.*`,
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

    options.sort = sortObject ?? { [orderByField]: orderDirection === 'asc' ? 1 : -1 };
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

// Helper function to build the pipeline specifically for transactions
const buildTransactionsPipeline = (userId, userFilter, queryParams) => {
    const pipeline = [];

    // 1. Initial match for balance scope (user, and accountId if specified by userFilter)
    const initialMatchForBalance = { userId };

    if (userFilter.accountId) { // If userFilter (derived from query) contains accountId
        initialMatchForBalance.accountId = userFilter.accountId;
    }

    pipeline.push({ $match: initialMatchForBalance });

    // 2. Balance calculation stages (formerly in getCollectionPipeline)
    const balanceCalculationStages = [
        {
            $addFields: {
                amountCents: { $round: [{ $multiply: ["$amount", 100] }, 0] }
            }
        },
        {
            $setWindowFields: {
                partitionBy: "$accountId", // Assumes 'accountId' field exists for partitioning
                sortBy: { date: 1, id: 1 },    // Ensure 'id' is unique for tie-breaking if dates are same
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
    ];

    pipeline.push(...balanceCalculationStages);

    // 3. Full user filter application
    pipeline.push({ $match: userFilter });

    return pipeline;
};

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
                const parsed = parseStructuredQuery(req.query.query, req.user.uid);
                filter = parsed.filter;
                options = parsed.options;
            } catch (error) {
                return res.status(400).json({ msg: error.message });
            }
        }

        if (collectionName !== 'users') {
            filter.userId ??= req.user.uid; // Ensures userId is set if not provided in query for other collections
        } else {
            // For the 'users' collection, always restrict to the current user's document.
            // This overrides any 'id' potentially set in the query by parseStructuredQuery if it was for another user.
            filter.id = req.user.uid;
        }

        let pipeline = [];

        if (collectionName === 'transactions') {
            pipeline = buildTransactionsPipeline(req.user.uid, filter, req.query);
        } else {
            // For other collections, match first with the complete filter
            pipeline.push({ $match: filter });
        }

        // Common stages: sort, skip, limit
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
        const total = await Model.countDocuments(filter); // Count total matching documents based on the final filter

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
        let queryFilter = { id: req.params.id };

        if (collectionName !== 'users') {
            queryFilter.userId = req.user.uid;
        } else {
            // For 'users' collection, user can only get their own document.
            if (req.params.id !== req.user.uid) {
                return res.status(403).json({ msg: 'Forbidden: You can only access your own user document.' });
            }
        }

        const document = await Model.findOne(queryFilter);

        if (!document) {
            return res.status(404).json({ msg: 'Document not found or you are not authorized to access it' });
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
router.post('/:collectionName', limitsMiddleware, async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        if (!req.body.userId) {
            req.body.userId = req.user.uid;
        }

        const newDocument = new Model(req.body);
        await newDocument.save();
        res.status(201).json(newDocument);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST create multiple new documents (batch write)
router.post('/:collectionName/batch', limitsMiddleware, async (req, res) => {
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

        const documents = req.body.map(doc => {
            if (!doc.userId) {
                doc.userId = req.user.uid;
            }

            return doc;
        });

        const newDocuments = await Model.insertMany(documents, { ordered: false }); // ordered: false allows other valid operations to continue if one fails
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
        let queryFilter = { id: req.params.id };

        if (collectionName !== 'users') {
            queryFilter.userId = req.user.uid;
        } else {
            // For 'users' collection, user can only update their own document.
            if (req.params.id !== req.user.uid) {
                return res.status(403).json({ msg: 'Forbidden: You can only update your own user document.' });
            }
            // queryFilter is already { id: req.params.id }, which is validated to be req.user.uid
        }

        const updatedDocument = await Model.findOneAndUpdate(
            queryFilter,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedDocument) {
            return res.status(404).json({ msg: 'Document not found or you are not authorized to update it' });
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

        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: 'Request body must contain a non-empty array "ids".' });
        }

        let deleteFilter = {};
        let idsToConsiderForDeletion = [...ids]; // IDs that we might attempt to delete

        if (collectionName !== 'users') {
            deleteFilter.id = { $in: ids };
            deleteFilter.userId = req.user.uid;
        } else {
            // For 'users' collection, only allow deleting the user's own ID if present in the batch.
            const currentUserIdsInBatch = ids.filter(id => id === req.user.uid);
            if (currentUserIdsInBatch.length === 0) {
                // No IDs in the batch match the current user, or none were provided that match.
                return res.json({
                    successCount: 0,
                    errors: ids.map(id => ({ id, error: 'Not authorized or not your own user ID' }))
                });
            }
            deleteFilter.id = { $in: currentUserIdsInBatch };
            idsToConsiderForDeletion = currentUserIdsInBatch; // We only care about these for success/error reporting
        }

        const result = await Model.deleteMany(deleteFilter);
        const successCount = result.deletedCount || 0;
        let errors = [];

        if (successCount !== idsToConsiderForDeletion.length) {
            // To find which IDs were not deleted (among those we attempted to delete):
            // We need to query with the same filter criteria used for deletion attempt.
            const findFilterForMissing = { ...deleteFilter };
            const foundDocs = await Model.find(findFilterForMissing).select('id');
            const foundIds = foundDocs.map(doc => doc.id);
            const notFoundOrAuthorizedIds = idsToConsiderForDeletion.filter(id => !foundIds.includes(id));
            errors = notFoundOrAuthorizedIds.map(id => ({ id, error: 'Not found or not authorized' }));
        }

        return res.json({ successCount, errors });
    } catch (err) {
        console.error('Batch delete error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// PATCH update a specific path in a document (e.g., add to array)
router.patch('/:collectionName/:id/path', async (req, res) => {
    try {
        const { collectionName, id } = req.params;
        const { path, data, operation = 'push' } = req.body;

        // --- 1. Authorization (Query Filtering) ---

        // It's standard practice to use MongoDB's `_id`. If you use a custom `id`, replace `_id` below.
        const queryFilter = { id };

        if (collectionName !== 'users') {
            // User can only update documents they own in other collections.
            queryFilter.userId = req.user.uid; // Assumes user ID is on the doc
        } else {
            // For 'users' collection, user can only update their own document.
            if (id !== req.user.uid) {
                return res.status(403).json({ msg: 'Forbidden: You can only update your own user document.' });
            }
        }

        // --- 2. Build Update Operation (Generic and DRY) ---
        // The special `commentIndex` logic is removed. The client should provide the full path.
        // For example: "comments.3.replies"
        const updateOperation = {
            [`$${operation}`]: { [path]: data }
        };

        // --- 3. Execute Database Query ---

        const Model = getDynamicModel(collectionName);
        const updatedDocument = await Model.findOneAndUpdate(
            queryFilter,
            updateOperation,
            { new: true } // `new: true` returns the updated doc, `runValidators` ensures schema rules are met
        );

        if (!updatedDocument) {
            return res.status(404).json({ msg: 'Document not found or you are not authorized to modify it.' });
        }

        res.json(updatedDocument);

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
        let queryFilter = { id: req.params.id };

        if (collectionName !== 'users') {
            queryFilter.userId = req.user.uid;
        } else {
            // For 'users' collection, user can only delete their own document.
            if (req.params.id !== req.user.uid) {
                return res.status(403).json({ msg: 'Forbidden: You can only delete your own user document.' });
            }
            // queryFilter is already { id: req.params.id }, which is validated to be req.user.uid
        }

        const deletedDocument = await Model.findOneAndDelete(queryFilter);

        if (!deletedDocument) {
            return res.status(404).json({ msg: 'Document not found or you are not authorized to delete it' });
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
