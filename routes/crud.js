// routes/crud.js
const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const publicCollectionMiddleware = require('../middlewares/publicCollectionMiddleware');
const limitsMiddleware = require('../middlewares/limitsMiddleware');
const { rbacMiddleware, filterDocumentFields, filterRequestBodyFields } = require('../middlewares/rbacMiddleware');
const { getDynamicModel } = require('../lib/getDynamicModel');
const config = require('../config');
const router = express.Router();

// Apply public collection middleware before auth middleware
router.use(publicCollectionMiddleware);
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
        parsedQuery = typeof jsonQueryString === 'string' ? JSON.parse(jsonQueryString) : jsonQueryString;
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
        sortObject = null,
        populate = null,
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

    if (populate !== null) {
        options.populate = populate;
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
router.get('/:collectionName', rbacMiddleware('read'), async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        let filter = {};
        let options = {};

        // Check if the 'query' parameter exists and is a string
        if (req.query.query && typeof req.query.query === 'string' || req.body?.query) {
            try {
                const parsed = parseStructuredQuery(req.query.query || req.body?.query, req.user.uid);

                filter = parsed.filter;
                options = parsed.options;
            } catch (error) {
                return res.status(400).json({ msg: error.message });
            }
        }

        // Apply ownership filtering for "own" permissions
        if (req.requiresOwnershipCheck) {
            if (collectionName !== 'users') {
                // For non-users collections, filter by the configured ownership field
                filter[req.ownershipField] = req.user.uid;
            } else {
                // For users collection, only allow user to see their own document
                filter.id = req.user.uid;
            }
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
        
        // Handle populate option using $lookup in the aggregation pipeline
        if (options.populate) {
            const populatePaths = Array.isArray(options.populate) ? options.populate : [options.populate];
            for (const { key: localField, collection: collectionName, as: localFieldAs, first: firstOnly } of populatePaths) {
                // Assuming 'path' is the localField and the foreign collection name is derived from it
                // This is a basic assumption and might need adjustment based on actual schema relationships
                const foreignField = 'id'; // Assuming _id in the foreign collection

                pipeline.push({
                    $lookup: {
                        from: collectionName,
                        localField: localField,
                        foreignField: foreignField,
                        as: localFieldAs || localField
                    }
                });

                if (firstOnly) {
                    pipeline.push({
                        $addFields: {
                            [localFieldAs || localField]: {
                                $arrayElemAt: [`$${localFieldAs || localField}`, 0]
                            }
                        }
                    });
                }
            }
        }

        const query = Model.aggregate(pipeline);
        let documents = await query.exec();
        const total = await Model.countDocuments(filter); // Count total matching documents based on the final filter

        // Apply field-level filtering if permissions are set
        if (req.allowedFields) {
            documents = documents.map(doc => filterDocumentFields(doc, req.allowedFields));
        }

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

// GET count of documents in a collection with filtering
// Example: GET /data/users/count?query={"conditions":[{"field":"age","operator":">","value":25},{"field":"isActive","operator":"==","value":true}]}
router.get('/:collectionName/count', rbacMiddleware('read'), async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        let filter = {};

        // Check if the 'query' parameter exists and is a string
        if (req.query.query && typeof req.query.query === 'string' || req.body?.query) {
            try {
                const parsed = parseStructuredQuery(req.query.query || req.body?.query, req.user.uid);
                filter = parsed.filter;
            } catch (error) {
                return res.status(400).json({ msg: error.message });
            }
        }

        let count;

        if (collectionName === 'transactions') {
            // For transactions collection, we need to use the aggregation pipeline
            // to properly handle the balance calculation stages
            const pipeline = buildTransactionsPipeline(req.user.uid, filter, req.query);
            
            // Add a count stage to the pipeline
            pipeline.push({
                $count: 'total'
            });

            const result = await Model.aggregate(pipeline).exec();
            count = result.length > 0 ? result[0].total : 0;
        } else {
            // For other collections, use countDocuments with the filter
            count = await Model.countDocuments(filter);
        }

        res.json({
            count,
            metadata: {
                collection: collectionName,
                filter: filter
            },
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET a single document by ID
router.get('/:collectionName/:id', rbacMiddleware('read'), async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);
        let queryFilter = { id: req.params.id };

        // Apply ownership filtering for "own" permissions
        if (req.requiresOwnershipCheck) {
            if (collectionName !== 'users') {
                // For non-users collections, ensure user owns the document
                queryFilter[req.ownershipField] = req.user.uid;
            } else {
                // For users collection, only allow user to see their own document
                queryFilter.id = req.user.uid;
            }
        }

        let pipeline = [{ $match: queryFilter }];

        if (req.query.populate) {
            const populatePaths = Array.isArray(req.query.populate) ? req.query.populate : [req.query.populate];
            for (const path of populatePaths) {
                const localField = path;
                const fromCollection = localField + 's'; // Simple pluralization
                const foreignField = '_id';

                pipeline.push({
                    $lookup: {
                        from: fromCollection,
                        localField: localField,
                        foreignField: foreignField,
                        as: localField
                    }
                });
                pipeline.push({
                    $unwind: {
                        path: `$${localField}`,
                        preserveNullAndEmptyArrays: true
                    }
                });
            }
        }

        const documents = await Model.aggregate(pipeline).exec();

        if (!documents.length) {
            return res.status(404).json({ msg: 'Document not found or you are not authorized to access it' });
        }

        let document = documents[0];

        // Apply field-level filtering if permissions are set
        if (req.allowedFields) {
            document = filterDocumentFields(document, req.allowedFields);
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
router.post('/:collectionName', rbacMiddleware('create'), limitsMiddleware, async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        // Apply field-level filtering for create operations
        let documentData = req.body;
        if (req.allowedWriteFields) {
            documentData = filterRequestBodyFields(req.body, req.allowedWriteFields);
        }

        // Apply ownership logic for "own" permissions
        if (req.requiresOwnershipCheck) {
            // Auto-assign ownership field if not provided
            if (!documentData[req.ownershipField]) {
                documentData[req.ownershipField] = req.user.uid;
            }
            // Ensure user is setting themselves as owner
            else if (documentData[req.ownershipField] !== req.user.uid) {
                return res.status(403).json({
                    msg: 'Forbidden: You can only create documents for yourself'
                });
            }
        }

        const newDocument = new Model(documentData);
        await newDocument.save();
        res.status(201).json(newDocument);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST create multiple new documents (batch write)
router.post('/:collectionName/batch', rbacMiddleware('create'), limitsMiddleware, async (req, res) => {
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
            let documentData = doc;

            // Apply field-level filtering for create operations
            if (req.allowedWriteFields) {
                documentData = filterRequestBodyFields(doc, req.allowedWriteFields);
            }

            // Apply ownership logic for "own" permissions
            if (req.requiresOwnershipCheck) {
                // Auto-assign ownership field if not provided
                if (!documentData[req.ownershipField]) {
                    documentData[req.ownershipField] = req.user.uid;
                }
                // Ensure user is setting themselves as owner
                else if (documentData[req.ownershipField] !== req.user.uid) {
                    throw new Error(`Forbidden: You can only create documents for yourself`);
                }
            }

            return documentData;
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
router.put('/:collectionName/:id', rbacMiddleware('write'), async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);
        let queryFilter = { id: req.params.id };

        // Apply ownership filtering for "own" permissions
        if (req.requiresOwnershipCheck) {
            if (collectionName !== 'users') {
                // For non-users collections, ensure user owns the document
                queryFilter[req.ownershipField] = req.user.uid;
            } else {
                // For users collection, only allow user to update their own document
                if (req.params.id !== req.user.uid) {
                    return res.status(403).json({ msg: 'Forbidden: You can only update your own user document.' });
                }
            }
        }

        // Apply field-level filtering for write operations
        let updateData = req.body;
        if (req.allowedWriteFields) {
            updateData = filterRequestBodyFields(req.body, req.allowedWriteFields);
        }

        const updatedDocument = await Model.findOneAndUpdate(
            queryFilter,
            updateData,
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
router.delete('/:collectionName/batch', rbacMiddleware('delete'), async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);

        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: 'Request body must contain a non-empty array "ids".' });
        }

        let deleteFilter = {};
        let idsToConsiderForDeletion = [...ids]; // IDs that we might attempt to delete

        if (req.requiresOwnershipCheck) {
            if (collectionName !== 'users') {
                // For non-users collections, only delete user's own documents
                deleteFilter.id = { $in: ids };
                deleteFilter[req.ownershipField] = req.user.uid;
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
        } else {
            // No ownership restriction - admin can delete any
            deleteFilter.id = { $in: ids };
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
router.patch('/:collectionName/:id/path', rbacMiddleware('write'), async (req, res) => {
    try {
        const { collectionName, id } = req.params;
        const { path, data, operation = 'push' } = req.body;

        // --- 1. Authorization (Query Filtering) ---

        // It's standard practice to use MongoDB's `_id`. If you use a custom `id`, replace `_id` below.
        const queryFilter = { id };

        // Apply ownership filtering for "own" permissions
        if (req.requiresOwnershipCheck) {
            if (collectionName !== 'users') {
                // User can only update documents they own in other collections.
                queryFilter[req.ownershipField] = req.user.uid; // Uses configured ownership field
            } else {
                // For 'users' collection, user can only update their own document.
                if (id !== req.user.uid) {
                    return res.status(403).json({ msg: 'Forbidden: You can only update your own user document.' });
                }
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
router.delete('/:collectionName/:id', rbacMiddleware('delete'), async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const Model = getDynamicModel(collectionName);
        let queryFilter = { id: req.params.id };

        // Apply ownership filtering for "own" permissions
        if (req.requiresOwnershipCheck) {
            if (collectionName !== 'users') {
                // For non-users collections, ensure user owns the document
                queryFilter[req.ownershipField] = req.user.uid;
            } else {
                // For users collection, only allow user to delete their own document
                if (req.params.id !== req.user.uid) {
                    return res.status(403).json({ msg: 'Forbidden: You can only delete your own user document.' });
                }
            }
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

// POST execute a custom aggregation pipeline on a collection
// Example: POST /api/orders/pipe
// Body: { "pipeline": [ { $match: { status: "completed" } }, { $group: { _id: null, total: { $sum: "$amount" } } } ] }
router.post('/:collectionName/pipe', rbacMiddleware('read'), async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const { pipeline, options = {} } = req.body;

        if (!Array.isArray(pipeline)) {
            return res.status(400).json({ msg: 'Pipeline must be an array of aggregation stages.' });
        }

        const Model = getDynamicModel(collectionName);

        // Apply ownership filtering for "own" permissions
        let finalPipeline = [...pipeline];
        if (req.requiresOwnershipCheck) {
            // Add ownership filter as the first stage in the pipeline
            const ownershipMatch = {
                $match: collectionName !== 'users'
                    ? { [req.ownershipField]: req.user.uid }
                    : { id: req.user.uid }
            };

            // Insert ownership filter at the beginning or after the first $match stage
            if (finalPipeline.length > 0 && finalPipeline[0].$match) {
                // Merge with existing $match stage
                finalPipeline[0].$match = {
                    ...finalPipeline[0].$match,
                    ...ownershipMatch.$match
                };
            } else {
                // Add as first stage
                finalPipeline.unshift(ownershipMatch);
            }
        }

        // Execute the aggregation pipeline
        const query = Model.aggregate(finalPipeline);
        
        // Apply options like sort, skip, limit if provided
        if (options.sort) {
            query.sort(options.sort);
        }
        if (options.skip) {
            query.skip(options.skip);
        }
        if (options.limit) {
            query.limit(options.limit);
        }

        const result = await query.exec();

        res.json({
            result,
        });
    } catch (err) {
        console.error('Pipeline execution error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

module.exports = router;
