const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        // Define conversation states
        this.CONVERSATION_STATES = {
            INITIAL_GREETING: 'INITIAL_GREETING',
            AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
            PROVIDING_QUOTE: 'PROVIDING_QUOTE',
            SCHEDULING_APPOINTMENT: 'SCHEDULING_APPOINTMENT',
            APPOINTMENT_CONFIRMATION: 'APPOINTMENT_CONFIRMATION',
            COMPLETED: 'COMPLETED',
            ERROR_CORRECTION: 'ERROR_CORRECTION'
        };

        // Define state transitions
        this.STATE_TRANSITIONS = {
            INITIAL_GREETING: ['AWAITING_CONFIRMATION'],
            AWAITING_CONFIRMATION: ['PROVIDING_QUOTE', 'ERROR_CORRECTION'],
            PROVIDING_QUOTE: ['SCHEDULING_APPOINTMENT', 'ERROR_CORRECTION'],
            SCHEDULING_APPOINTMENT: ['APPOINTMENT_CONFIRMATION', 'ERROR_CORRECTION'],
            APPOINTMENT_CONFIRMATION: ['COMPLETED', 'ERROR_CORRECTION'],
            ERROR_CORRECTION: ['AWAITING_CONFIRMATION', 'PROVIDING_QUOTE', 'SCHEDULING_APPOINTMENT']
        };
    }

    /**
     * Process and clean AI response for SMS
     * @private
     */
    _cleanResponse(response) {
        if (!response || !response[0] || !response[0].text) {
            return "I apologize, but I'm having trouble processing your request. Please try again.";
        }
        
        // Extract text from response object
        let text = response[0].text.trim();
        
        // Ensure response isn't too long for SMS
        if (text.length > 160) {
            text = text.substring(0, 157) + '...';
        }
        
        return text;
    }

    /**
     * Format conversation history for optimal context
     * @private
     */
    _formatHistory(conversationHistory) {
        return conversationHistory
            .slice(-3) // Keep only last 3 messages for context
            .map(msg => `${msg.direction === 'inbound' ? 'Customer' : 'Assistant'}: ${msg.content}`)
            .join('\n');
    }

    /**
     * Calculate price based on phone model and issue
     * @private
     */
    _calculatePrice(phoneModel, issue) {
        // Example pricing logic
        const pricing = {
            'screen repair': { min: 59, max: 299 },
            'battery': { min: 49, max: 89 },
            'charging port': { min: 69, max: 99 },
            'water damage': { min: 89, max: 149 },
            'back glass': { min: 79, max: 199 }
        };

        const issuePricing = pricing[issue.toLowerCase()];
        if (issuePricing) {
            return `$${issuePricing.min} - $${issuePricing.max}`;
        }
        return 'Price not available';
    }

    /**
     * Determine conversation state based on message content and history
     * @private
     */
    async _determineConversationState(message, history, currentState) {
        try {
            // Get the last message from history
            const lastMessage = history[0];
            const messageContent = message.toLowerCase();
            
            // If no history, must be initial greeting
            if (!history.length) {
                return this.CONVERSATION_STATES.INITIAL_GREETING;
            }

            // Pattern matching for different responses
            const patterns = {
                affirmative: /\b(yes|yeah|correct|right|yep|yup|sure|ok|okay)\b/i,
                negative: /\b(no|nope|wrong|incorrect|not right|different)\b/i,
                scheduling: /\b(schedule|appointment|book|available|when|time|date)\b/i,
                pricing: /\b(price|cost|how much|pricing|quote)\b/i,
                correction: /\b(wrong|mistake|different|actually|meant)\b/i
            };

            // State transition logic
            switch (currentState) {
                case this.CONVERSATION_STATES.INITIAL_GREETING:
                case this.CONVERSATION_STATES.AWAITING_CONFIRMATION:
                    if (patterns.affirmative.test(messageContent)) {
                        return this.CONVERSATION_STATES.PROVIDING_QUOTE;
                    }
                    if (patterns.negative.test(messageContent)) {
                        return this.CONVERSATION_STATES.ERROR_CORRECTION;
                    }
                    break;

                case this.CONVERSATION_STATES.PROVIDING_QUOTE:
                    if (patterns.scheduling.test(messageContent)) {
                        return this.CONVERSATION_STATES.SCHEDULING_APPOINTMENT;
                    }
                    if (patterns.negative.test(messageContent)) {
                        return this.CONVERSATION_STATES.COMPLETED;
                    }
                    break;

                case this.CONVERSATION_STATES.SCHEDULING_APPOINTMENT:
                    if (patterns.affirmative.test(messageContent)) {
                        return this.CONVERSATION_STATES.APPOINTMENT_CONFIRMATION;
                    }
                    break;

                case this.CONVERSATION_STATES.ERROR_CORRECTION:
                    if (patterns.affirmative.test(messageContent)) {
                        return this.CONVERSATION_STATES.AWAITING_CONFIRMATION;
                    }
                    break;
            }

            // If no state change is determined, return current state
            return currentState;

        } catch (error) {
            logger.error('Error determining conversation state:', error);
            return currentState || this.CONVERSATION_STATES.ERROR_CORRECTION;
        }
    }

    /**
     * Validate state transition
     * @private
     */
    _validateStateTransition(currentState, newState) {
        if (!currentState) return true; // Allow any initial state
        const allowedTransitions = this.STATE_TRANSITIONS[currentState] || [];
        return allowedTransitions.includes(newState);
    }

    /**
     * Get system prompt based on conversation state
     * @private
     */
    _getSystemPrompt(formattedHistory, message, customerInfo, state) {
        const { name, phoneModel, issue } = customerInfo;
        const basePrompt = `You are a phone repair store SMS assistant. Keep all responses under 160 characters and maintain a friendly, professional tone.`;

        const statePrompts = {
            [this.CONVERSATION_STATES.INITIAL_GREETING]: `${basePrompt}

You are initiating first contact with a potential customer.

Customer Information to Confirm:
- Name: ${name}
- Phone Model: ${phoneModel}
- Issue: ${issue}

KEY GUIDELINES:
- Start with a warm greeting using ${name}'s name
- Mention their ${phoneModel} and the reported ${issue}
- Ask them to confirm if these details are correct
- DO NOT mention price yet
- End with a clear yes/no question

EXAMPLE FORMAT (but be more natural):
"Hi [name]! We received your repair request for your [phone] regarding [issue]. Is this correct?"`,

            [this.CONVERSATION_STATES.AWAITING_CONFIRMATION]: `${basePrompt}

Customer needs to confirm or correct their information.

Current Information:
- Name: ${name}
- Phone Model: ${phoneModel}
- Issue: ${issue}

KEY GUIDELINES:
- If they say NO: Ask specifically what needs to be corrected
- If unclear: Ask for clarification about which detail is incorrect
- Keep focus on confirming details
- DO NOT mention pricing yet
- End with a question

EXAMPLE RESPONSES:
- For unclear response: "I want to make sure we have your details right. Can you confirm if your ${phoneModel} needs ${issue} repair?"
- For correction: "Please let me know which information needs to be corrected."`,

            [this.CONVERSATION_STATES.PROVIDING_QUOTE]: `${basePrompt}

Customer has confirmed their information. Time to provide pricing.

Confirmed Information:
- Phone Model: ${phoneModel}
- Issue: ${issue}
- Price Range: ${this._calculatePrice(phoneModel, issue)}

KEY GUIDELINES:
- Thank them for confirming
- Provide clear pricing information
- Ask if they'd like to schedule a repair
- Mention same-day service availability if relevant
- End with a question about scheduling

EXAMPLE FORMAT:
"Thanks for confirming! For ${phoneModel} ${issue}, our service cost is [price]. Would you like to schedule a repair?"`,

            [this.CONVERSATION_STATES.SCHEDULING_APPOINTMENT]: `${basePrompt}

Customer is interested in scheduling a repair.

Service Details:
- Service: ${issue} repair for ${phoneModel}
- Available Hours: Mon-Sat 9AM-7PM
- Same-day service available (+$30)

KEY GUIDELINES:
- Ask for preferred day and time
- Mention our available hours
- Offer same-day service option
- Keep scheduling options clear
- End with a specific question about timing

EXAMPLE FORMAT:
"We can repair your ${phoneModel} Mon-Sat, 9AM-7PM. Same-day service is also available. What day/time works best for you?"`,

            [this.CONVERSATION_STATES.ERROR_CORRECTION]: `${basePrompt}

Customer indicated information needs correction.

Current Information:
- Phone Model: ${phoneModel}
- Issue: ${issue}

KEY GUIDELINES:
- Show understanding of the need for correction
- Ask specifically what needs to be updated
- Keep questions simple and clear
- Focus on one correction at a time
- End with a specific question

EXAMPLE FORMAT:
"I apologize for the confusion. Please let me know which information needs to be corrected: the phone model (${phoneModel}) or the issue (${issue})?"`,

            [this.CONVERSATION_STATES.APPOINTMENT_CONFIRMATION]: `${basePrompt}

Customer has provided preferred appointment time.

Service Details:
- Service: ${issue} repair for ${phoneModel}
- Price: ${this._calculatePrice(phoneModel, issue)}

KEY GUIDELINES:
- Confirm the suggested appointment time
- Mention repair duration if known
- Ask for final confirmation
- Provide address if confirmed
- End with a clear yes/no question

EXAMPLE FORMAT:
"Would you like me to confirm your appointment for [suggested_time]? The repair should take about [duration]."`,

            [this.CONVERSATION_STATES.COMPLETED]: `${basePrompt}

Appointment has been confirmed.

Appointment Details:
- Service: ${issue} repair for ${phoneModel}
- Location: [store_address]

KEY GUIDELINES:
- Thank them for choosing your service
- Confirm all appointment details
- Provide store address
- Include any preparation instructions
- End with a positive closing

EXAMPLE FORMAT:
"Great! Your appointment is confirmed for [time]. We're located at [address]. Please bring your ${phoneModel} and any relevant passwords."`,
        };

        return `${statePrompts[state] || basePrompt}

Previous messages:
${formattedHistory}

Current message: ${message}`;
    }

    /**
     * Generate first message to new lead
     */
    async generateFirstContactMessage(customerInfo) {
        try {
            const { name, phoneModel, issue } = customerInfo;
            
            const systemPrompt = `You are a phone repair store SMS assistant initiating first contact.

Customer Information to Confirm:
- Name: ${name}
- Phone Model: ${phoneModel}
- Issue: ${issue}

KEY GUIDELINES:
- Start with a warm greeting using ${name}'s name
- Mention their ${phoneModel} and the reported ${issue}
- Ask them to confirm if these details are correct
- DO NOT mention price yet
- Keep response under 160 characters
- End with a clear yes/no question

EXAMPLE FORMAT (but be more natural):
"Hi [name]! We received your repair request for your [phone] regarding [issue]. Is this correct?"

Generate a friendly, professional first message:`;

            const response = await this.client.messages.create({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 150,
                messages: [{ role: 'user', content: systemPrompt }]
            });

            const cleanedResponse = this._cleanResponse(response.content);
            
            logger.info('First response generated successfully:', { 
                originalLength: response.content[0]?.text?.length,
                cleanedLength: cleanedResponse.length 
            });

            return cleanedResponse;

        } catch (error) {
            logger.error('Error generating first response:', error);
            return `Hi ${customerInfo.name}! We received your repair request for your ${customerInfo.phoneModel} regarding ${customerInfo.issue}. Is this correct?`;
        }
    }


    /**
     * Generate AI response based on conversation history
     */
    // needs improvement ! 
    async generateResponse(message, conversationHistory = [], customerInfo) {
        try {
            // Get current state from the last message in history
            const currentState = conversationHistory[0]?.metadata?.get('state') 
                || this.CONVERSATION_STATES.INITIAL_GREETING;

            // Determine new state
            const newState = await this._determineConversationState(
                message, 
                conversationHistory,
                currentState
            );

            // Validate state transition
            if (!this._validateStateTransition(currentState, newState)) {
                logger.warn(`Invalid state transition: ${currentState} -> ${newState}`);
                return "I'm sorry, I didn't understand. Could you please rephrase that?";
            }

            const formattedHistory = this._formatHistory(conversationHistory);
            const systemPrompt = this._getSystemPrompt(formattedHistory, message, customerInfo, newState);

            const response = await this.client.messages.create({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 150,
                messages: [{ role: 'user', content: systemPrompt }]
            });

            const cleanedResponse = this._cleanResponse(response.content);
            
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
            return {
                content: "Sorry, I'm having trouble right now. Please call us at (555) 123-4567 for immediate assistance.",
                state: this.CONVERSATION_STATES.ERROR_CORRECTION
            };
        }
    }
}

module.exports = new AIService();