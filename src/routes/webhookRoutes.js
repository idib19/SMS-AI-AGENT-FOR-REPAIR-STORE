const express = require('express');
const router = express.Router();
const SMSServiceFactory = require('../services/sms/SMSServiceFactory');
const messageService = require('../services/messageService');
const logger = require('../utils/logger');
const AIService = require('../services/ai/AIService');
const conversationAnalyzer = require('../services/ai/analyzers/conversationAnalyzer');
const { standardizePhoneNumber } = require('../utils/phoneUtils');

// Initialize SMS service logs or TwilioService for production vs development 
const smsService = SMSServiceFactory.getService();

// First contact message endpoint
router.post('/trigger-message', async (req, res) => {
    try {
        const { phoneNumber, customerInfo } = req.body;
        const standardizedPhone = standardizePhoneNumber(phoneNumber);
        
        logger.info('📤 Triggering outbound message:', {
            to: standardizedPhone
        });

        // Generate AI message based on customer information
        const outboundMessage = await AIService.generateFirstContactMessage(customerInfo);

        logger.info('📤 Outbound message generated:', outboundMessage);

        // Send message via Twilio or log if not in production
        const messageResponse = await smsService.sendMessage(
            standardizedPhone,
            outboundMessage
        );

        // Save outbound message to database and customer info
        await messageService.saveMessage({
            phoneNumber: standardizedPhone,
            content: outboundMessage,
            direction: 'outbound',
            customerName: customerInfo?.name,
            phoneModel: customerInfo?.phoneModel,
            issueDescription: customerInfo?.issue
        });

        res.json({
            status: 'success',
            messageSid: messageResponse.sid,
            content: outboundMessage,
            to: standardizedPhone
        });

    } catch (error) {
        logger.error('🔴 Error in trigger-outbound:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error sending outbound message',
            error: error.message
        });
    }
});

// SMS webhook endpoint for handling all incoming messages
router.post('/webhook', async (req, res) => {
    try {
        const { Body: messageContent, From: phoneNumber } = req.body;
        const standardizedPhone = standardizePhoneNumber(phoneNumber);
        
        logger.info('📩 Incoming message:', {
            from: standardizedPhone,
            content: messageContent
        });

        // Save incoming message
        await messageService.saveMessage({
            phoneNumber: standardizedPhone,
            content: messageContent,
            direction: 'inbound'
        });

        // Get conversation history
        const conversationHistory = await messageService.getConversationHistory(standardizedPhone);
        
        // Get customer info
        const customerInfo = await messageService.getCustomerInfo(standardizedPhone);

        // Analyze conversation using the new conversationAnalyzer
        const { instructions } = await conversationAnalyzer.analyzeConversation(conversationHistory);

        // Generate AI response using new AIService
        const aiResponse = await AIService.generateResponse(messageContent, customerInfo, instructions);

        // Validate AI response before attempting to save
        if (!aiResponse || !aiResponse.content) {
            logger.error('Invalid AI response received:', aiResponse);
            throw new Error('Invalid AI response format');
        }

        // Save outbound message
        await messageService.saveMessage({
            phoneNumber: standardizedPhone,
            content: aiResponse.content,
            direction: 'outbound'
        });

        // Send message via Twilio or log if not in production
        const messageResponse = await smsService.sendMessage(
            standardizedPhone,
            aiResponse.content
        );

        res.json({
            status: 'success',
            messageSid: messageResponse.sid,
            content: aiResponse.content,
            to: standardizedPhone
        });

    } catch (error) {
        logger.error('🔴 Error in /webhook:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

//endpoint to retrieve conversation history
router.get('/history/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const history = await messageService.getConversationHistory(phoneNumber);
        res.json(history);
    } catch (error) {
        logger.error('Error fetching history:', error);
        res.status(500).json({ error: 'Error fetching conversation history' });
    }
});

// Fallback webhook endpoint
router.post('/webhook/fallback', async (req, res) => {
    try {
        logger.warn('⚠️ Fallback webhook triggered:', req.body);
        
        // Send a simple response to acknowledge the message
        const fallbackResponse = smsService.createTwiMLResponse(
            "We're experiencing technical difficulties. Please try again in a few minutes."
        );
        
        res.set('Content-Type', 'text/xml');
        res.send(fallbackResponse);
    } catch (error) {
        logger.error('🔴 Error in fallback webhook:', error);
        res.status(500).send('Error processing fallback message');
    }
});

// Status callback endpoint
router.post('/status', async (req, res) => {
    try {
        const { MessageStatus, MessageSid, From } = req.body;
        logger.info('📫 Message Status Update:', {
            status: MessageStatus,
            messageSid: MessageSid,
            from: From
        });
        
        res.sendStatus(200);
    } catch (error) {
        logger.error('Error handling status callback:', error);
        res.sendStatus(500);
    }
});

module.exports = router;