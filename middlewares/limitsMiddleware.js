const { getDynamicModel } = require('../lib/getDynamicModel');

// Define limits for collections
const collectionLimits = {
    users: 1,
    transactions: 50,
    accounts: 3,
    budgets: 3,
    categories: 3,
    goals: 3,
    subscriptions: 3,
};

const limitsMiddleware = async (req, res, next) => {
    // This middleware should only apply to POST requests (creations)
    if (req.method !== 'POST') {
        return next();
    }

    const collectionName = req.params.collectionName;
    const userId = req.user?.uid; // Assuming userId is available in req.user.uid from authMiddleware

    const userPlan = req.user?.plan;

    if (userPlan === 'pro') {
        return next();
    }

    if (!userId) {
        // If no userId, perhaps it's an unauthenticated route or an issue with authMiddleware
        // Depending on your app's logic, you might want to allow or deny this
        console.warn('limitsMiddleware: No userId found. Bypassing limit check.');
        return next();
    }

    // Check if the current collection has a defined limit
    if (collectionLimits.hasOwnProperty(collectionName)) {
        const limit = collectionLimits[collectionName];
        const Model = getDynamicModel(collectionName);

        try {
            // Count existing documents for this user in this collection
            // We assume documents have a 'userId' field.
            // If your documents link to users differently (e.g., 'ownerId', 'createdBy'), adjust the query field.
            const userDocumentCount = await Model.countDocuments({ userId: userId });

            if (userDocumentCount >= limit) {
                return res.status(403).json({
                    msg: `You have reached the maximum limit of ${limit} records for the '${collectionName}' collection on the free tier.`,
                });
            }
        } catch (error) {
            console.error('Error checking collection limits:', error);
            return res.status(500).send('Server Error while checking record limits.');
        }
    }

    next(); // Proceed to the next middleware or route handler
};

module.exports = limitsMiddleware; 