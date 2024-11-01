const twilio = require('twilio');
const config = require('../config/environment');
const logger = require('../utils/logger');

class TwilioService {
    constructor() {
        this.client = twilio(
            config.twilio.accountSid,
            config.twilio.authToken
        );
        this.phoneNumber = config.twilio.phoneNumber;
        this.messagingResponse = twilio.twiml.MessagingResponse;
    }

    // Validate Twilio request
    validateRequest(req) {
        const twilioSignature = req.headers['x-twilio-signature'];
        const url = req.protocol + '://' + req.get('host') + req.originalUrl;
        
        return twilio.validateRequest(
            config.twilio.authToken,
            twilioSignature,
            url,
            req.body
        );
    }

    // Send a message to a number
    async sendMessage(toNumber, messageBody) {
        try {
            const message = await this.client.messages.create({
                body: messageBody,
                from: this.phoneNumber,
                to: toNumber
            });
            
            logger.info(`Message sent successfully: ${message.sid}`);
            return message;
        } catch (error) {
            logger.error('Error sending message:', error);
            throw error;
        }
    }

    createTwiMLResponse(message) {
        const response = new this.messagingResponse();
        response.message(message);
        return response.toString();
    }
}

// Export as singleton
module.exports = new TwilioService();