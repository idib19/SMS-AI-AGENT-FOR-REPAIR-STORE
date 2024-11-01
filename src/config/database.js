const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('./environment');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.mongodb.uri, {
            // Mongoose 6+ doesn't need useNewUrlParser and useUnifiedTopology
        });

        logger.info(`MongoDB Connected: ${conn.connection.host}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });

    } catch (error) {
        logger.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

module.exports = connectDB;