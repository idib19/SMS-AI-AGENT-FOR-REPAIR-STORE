// Environment configuration

require('dotenv').config();

const environment = {
    environment: process.env.NODE_ENV || 'development',
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

// Modify validation to not require Twilio credentials in development
const validateEnv = () => {
    const required = ['ANTHROPIC_API_KEY'];
    
    // Only require Twilio credentials in production
    if (environment.environment === 'production') {
        required.push(
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN',
            'TWILIO_PHONE_NUMBER'
        );
    }

    for (const variable of required) {
        if (!process.env[variable]) {
            throw new Error(`Missing required environment variable: ${variable}`);
        }
    }
};

// Call validation on import
validateEnv();

module.exports = environment;