// Environment configuration

require('dotenv').config();

const environment = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sms-ai-agent'
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY
    }
};

// Validate required environment variables
const validateEnv = () => {
    const required = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_PHONE_NUMBER',
        'ANTHROPIC_API_KEY'
    ];

    for (const variable of required) {
        if (!process.env[variable]) {
            throw new Error(`Missing required environment variable: ${variable}`);
        }
    }
};

// Call validation on import
validateEnv();

module.exports = environment;