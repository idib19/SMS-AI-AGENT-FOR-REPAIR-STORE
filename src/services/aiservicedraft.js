// src/services/conversation/states.js
class ConversationStateManager {
    constructor() {
        this.STATES = {
            INITIAL_GREETING: 'INITIAL_GREETING',
            AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
            PROVIDING_QUOTE: 'PROVIDING_QUOTE',
            SCHEDULING_APPOINTMENT: 'SCHEDULING_APPOINTMENT',
            APPOINTMENT_CONFIRMATION: 'APPOINTMENT_CONFIRMATION',
            COMPLETED: 'COMPLETED',
            ERROR_CORRECTION: 'ERROR_CORRECTION'
        };

        this.TRANSITIONS = {
            INITIAL_GREETING: ['AWAITING_CONFIRMATION'],
            AWAITING_CONFIRMATION: ['PROVIDING_QUOTE', 'ERROR_CORRECTION'],
            PROVIDING_QUOTE: ['SCHEDULING_APPOINTMENT', 'ERROR_CORRECTION'],
            SCHEDULING_APPOINTMENT: ['APPOINTMENT_CONFIRMATION', 'ERROR_CORRECTION'],
            APPOINTMENT_CONFIRMATION: ['COMPLETED', 'ERROR_CORRECTION'],
            ERROR_CORRECTION: ['AWAITING_CONFIRMATION', 'PROVIDING_QUOTE', 'SCHEDULING_APPOINTMENT']
        };
    }

    determineNextState(message, history, currentState) {
        // Move state determination logic here
    }

    validateTransition(currentState, newState) {
        if (!currentState) return true;
        const allowedTransitions = this.TRANSITIONS[currentState] || [];
        return allowedTransitions.includes(newState);
    }
}

// src/services/pricing/priceCalculator.js
class PriceCalculator {
    constructor() {
        this.PRICING = {
            'screen repair': { min: 59, max: 299 },
            'battery': { min: 49, max: 89 },
            'charging port': { min: 69, max: 99 },
            'water damage': { min: 89, max: 149 },
            'back glass': { min: 79, max: 199 }
        };
    }

    calculatePrice(phoneModel, issue) {
        const issuePricing = this.PRICING[issue.toLowerCase()];
        if (issuePricing) {
            return `$${issuePricing.min} - $${issuePricing.max}`;
        }
        return 'Price not available';
    }
}

// src/services/prompts/promptManager.js
class PromptManager {
    constructor(priceCalculator) {
        this.priceCalculator = priceCalculator;
    }

    getBasePrompt() {
        return `You are a phone repair store SMS assistant. Keep all responses under 160 characters and maintain a friendly, professional tone.`;
    }

    getStatePrompt(state, customerInfo) {
        // Move state-specific prompt logic here
        const prompts = {
            INITIAL_GREETING: this._getInitialGreetingPrompt(customerInfo),
            PROVIDING_QUOTE: this._getQuotePrompt(customerInfo),
            // ... other state prompts
        };
        return prompts[state] || this.getBasePrompt();
    }

    _getInitialGreetingPrompt(customerInfo) {
        // Implementation for initial greeting prompt
    }

    _getQuotePrompt(customerInfo) {
        // Implementation for quote prompt
    }
}

// src/services/response/responseHandler.js
class ResponseHandler {
    cleanResponse(response) {
        if (!response || !response[0] || !response[0].text) {
            return "I apologize, but I'm having trouble processing your request. Please try again.";
        }
        
        let text = response[0].text.trim();
        text = this._validateResponse(text);
        
        if (text.length > 160) {
            const sentences = text.match(/[^.!?]+[.!?]/g);
            text = '';
            for (const sentence of sentences) {
                if ((text + sentence).length <= 157) {
                    text += sentence;
                } else {
                    break;
                }
            }
        }
        
        return text;
    }

    _validateResponse(text) {
        // Ensure response ends with proper punctuation
        if (!text.match(/[.!?]$/)) {
            text += '.';
        }
        
        // Remove any ellipsis
        text = text.replace(/\.{3,}/g, '.');
        
        // Ensure no trailing spaces
        return text.trim();
    }

    formatHistory(conversationHistory) {
        return conversationHistory
            .slice(-3)
            .map(msg => `${msg.direction === 'inbound' ? 'Customer' : 'Assistant'}: ${msg.content}`)
            .join('\n');
    }
}

// src/services/aiService.js
const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        this.stateManager = new ConversationStateManager();
        this.priceCalculator = new PriceCalculator();
        this.promptManager = new PromptManager(this.priceCalculator);
        this.responseHandler = new ResponseHandler();
    }

    async generateFirstContactMessage(customerInfo) {
        try {
            const prompt = this.promptManager.getStatePrompt(
                this.stateManager.STATES.INITIAL_GREETING,
                customerInfo
            );

            const response = await this.client.messages.create({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 150,
                messages: [{ role: 'user', content: prompt }]
            });

            const cleanedResponse = this.responseHandler.cleanResponse(response.content);
            
            logger.info('First response generated successfully:', { 
                originalLength: response.content[0]?.text?.length,
                cleanedLength: cleanedResponse.length 
            });

            return cleanedResponse;

        } catch (error) {
            logger.error('Error generating first response:', error);
            return this._getDefaultFirstResponse(customerInfo);
        }
    }

    async generateResponse(message, conversationHistory = [], customerInfo) {
        try {
            const currentState = conversationHistory[0]?.metadata?.get('state') 
                || this.stateManager.STATES.INITIAL_GREETING;

            const newState = await this.stateManager.determineNextState(
                message, 
                conversationHistory,
                currentState
            );

            if (!this.stateManager.validateTransition(currentState, newState)) {
                logger.warn(`Invalid state transition: ${currentState} -> ${newState}`);
                return this._getErrorResponse();
            }

            const formattedHistory = this.responseHandler.formatHistory(conversationHistory);
            const prompt = this.promptManager.getStatePrompt(newState, customerInfo);

            const response = await this.client.messages.create({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 150,
                messages: [{ role: 'user', content: prompt }]
            });

            const cleanedResponse = this.responseHandler.cleanResponse(response.content);
            
            logger.info('AI response generated:', { 
                previousState: currentState,
                newState: newState,
                responseLength: cleanedResponse.length 
            });

            return {
                content: cleanedResponse,
                state: newState
            };

        } catch (error) {
            logger.error('Error generating AI response:', error);
            return this._getErrorResponse();
        }
    }

    _getErrorResponse() {
        return {
            content: "Sorry, I'm having trouble right now. Please call us at (555) 123-4567 for immediate assistance.",
            state: this.stateManager.STATES.ERROR_CORRECTION
        };
    }

    _getDefaultFirstResponse(customerInfo) {
        return `Hi ${customerInfo.name}! We received your repair request for your ${customerInfo.phoneModel} regarding ${customerInfo.issue}. Is this correct?`;
    }
}

module.exports = new AIService();