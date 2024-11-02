const express = require('express');
const bodyParser = require('body-parser');
const config = require('./src/config/environment');
const logger = require('./src/utils/logger');
const connectDB = require('./src/config/database');

// Import routes
const webhookRoutes = require('./src/routes/webhookRoutes');
const healthRoutes = require('./src/routes/healthRoutes');

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Routes
app.use('/sms', webhookRoutes);
app.use('/health', healthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Something went wrong!',
        message: config.nodeEnv === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
});

module.exports = app;