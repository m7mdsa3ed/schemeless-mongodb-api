const mongoose = require('mongoose');
const { ulid } = require('ulid');

// Helper function to get or create a dynamic Mongoose model
const getDynamicModel = (collectionName) => {
    const modelName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

    if (mongoose.models[modelName]) {
        return mongoose.models[modelName];
    }

    // Define a schemaless schema
    const dynamicSchema = new mongoose.Schema({
        id: {
            type: String,
            unique: true,
            default: () => ulid()
        },
    }, { strict: false, timestamps: true });

    return mongoose.model(modelName, dynamicSchema);
};

module.exports = { getDynamicModel };