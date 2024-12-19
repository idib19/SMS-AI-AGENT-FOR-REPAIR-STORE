const logger = require('../../utils/logger');
const EventEmitter = require('events');

class ConsoleSMSService extends EventEmitter {
    constructor() {
        super();
        this.phoneNumber = 'DEV-NUMBER';
    }

    validateRequest(req) {
        return true;
    }

    async sendMessage(toNumber, messageBody) {
        logger.info('📱 [DEV SMS] To:', toNumber);
        logger.info('📝 Message:', messageBody);

        // Emit an event when a message is sent
        this.emit('messageSent', {
            to: toNumber,
            body: messageBody
        });

        return {
            sid: 'dev-message-id-' + Date.now(),
            status: 'delivered'
        };
    }

    createTwiMLResponse(message) {
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
    }
}

module.exports = ConsoleSMSService; 