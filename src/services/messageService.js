//# Message handling logic
// here we will handle the message data and save it to the database
// it also will handle the conversation history and update the customer info


const Message = require('../models/message');
const logger = require('../utils/logger');
const { standardizePhoneNumber } = require('../utils/phoneUtils');


class MessageService {

    // Save a new message to the database
    async saveMessage(messageData) {
        try {
            const standardizedPhone = standardizePhoneNumber(messageData.phoneNumber);
            logger.info('Attempting to save message for:', standardizedPhone);

            const message = new Message({
                ...messageData,
                phoneNumber: standardizedPhone
            });

            await message.save();
            logger.info(`Message saved successfully with ID: ${message._id}`);
            return message;
        } catch (error) {
            logger.error('Error saving message:', error);
            throw error;
        }
    }

    async getConversationHistory(phoneNumber, limit = 10) {
        try {
            const standardizedPhone = standardizePhoneNumber(phoneNumber);
            logger.info(`Fetching conversation history for ${standardizedPhone}`);

            const messages = await Message.find({ phoneNumber: standardizedPhone })
                .sort({ createdAt: -1 })
                .limit(limit);

            logger.info(`Found ${messages.length} messages for ${standardizedPhone}`);
            return messages;
        } catch (error) {
            logger.error('Error fetching conversation history:', error);
            throw error;
        }
    }

    // get customer name , email , phone model , issue description
    async getCustomerInfo(phoneNumber) {
        const customerInfo = await Message.findOne({ phoneNumber })
            .select('customerName phoneModel issueDescription');
        return customerInfo;
    }


    // Update customer info in the database
    async updateCustomerInfo(phoneNumber, customerInfo) {
        try {
            const result = await Message.updateMany(
                { phoneNumber },
                {
                    $set: {
                        customerName: customerInfo.name,
                        customerEmail: customerInfo.email,
                        phoneModel: customerInfo.phoneModel,
                        issueDescription: customerInfo.issueDescription
                    }
                }
            );
            logger.info(`Updated ${result.modifiedCount} messages for ${phoneNumber}`);
            return result;
        } catch (error) {
            logger.error('Error updating customer info:', error);
            throw error;
        }
    }
}

module.exports = new MessageService();