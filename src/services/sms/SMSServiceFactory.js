const TwilioService = require('./TwilioService');
const ConsoleSMSService = require('./ConsoleSMSService');
const config = require('../../config/environment');

// Factory class to create the appropriate SMS service based on the environment
class SMSServiceFactory {
    static getService() {
        if (config.environment === 'production') {
            return new TwilioService();
        }
        return new ConsoleSMSService();
    }
}

module.exports = SMSServiceFactory; 