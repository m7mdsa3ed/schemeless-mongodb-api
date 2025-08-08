// config/db.js
const mongoose = require('mongoose');
const config = require('./index');

let isConnected = false; // Track connection state

const connectDB = async () => {
    if (isConnected) {
        console.log('Using existing MongoDB connection...');
        return mongoose.connection;
    }

    try {
        const options = {
            maxPoolSize: 5, // ✅ Safe for free-tier MongoDB
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            retryWrites: true,
            retryReads: true,
        };

        await mongoose.connect(config.mongoUri, options);
        
        isConnected = true;
        console.log('MongoDB Connected...');
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnected = false;
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            isConnected = false;
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
            isConnected = true;
        });
        
        return mongoose.connection;
    } catch (err) {
        console.error(err.message);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;
