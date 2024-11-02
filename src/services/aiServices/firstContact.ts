const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../../utils/logger');


class FirstContact {
    client: any; // Declare the type of client
    CONVERSATION_STATES: { [key: string]: string }; // Declare the type for CONVERSATION_STATES
    STATE_TRANSITIONS: { [key: string]: string[] }; // Declare the type for STATE_TRANSITIONS

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
    _cleanResponse(response: { text: string }[]) {
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
     * Calculate price based on phone model and issue
     * @private
     */
    async _calculatePrice(phoneModel: string, issue: string) {
        const prompt = `You are a phone repair pricing specialist. Determine the repair price based on the following information:

Phone Model: ${phoneModel}
Issue Description: ${issue}

Our standard pricing structure:
- Screen repairs: $259-299 depending on model
- Battery replacements: $69-89 depending on model  
- Charging port repairs: $79-99 depending on model
- Water damage treatment: $129-149 depending on model
- Back glass replacement: $179-199 depending on model

Return ONLY the numeric price value, no other text.

Example response: 299`;

        try {
            const response = await this.client.messages.create({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 10,
                messages: [{ role: 'user', content: prompt }]
            });

            const price = parseInt(response.content);
            if (isNaN(price)) {
                throw new Error('Invalid price response');
            }

            return `$${price}`;
        } catch (error) {
            logger.error('Error calculating price:', error);
            return 'Price calculation unavailable';
        }
    }


    /**
     * Generate first message to new lead
     * @private
     */
    _generateFirstContactMessage(formattedHistory: string, message: string, customerInfo: any, state: string) {
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


}

module.exports = new FirstContact();