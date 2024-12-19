const readline = require('readline');
const axios = require('axios');

class SMSSimulator {
    constructor(webhookUrl = 'http://localhost:3000/sms/webhook') {
        this.webhookUrl = webhookUrl;
        this.phoneNumber = '+1234567890'; // Simulated phone number
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log('\n🤖 SMS Simulator Started');
        console.log(`📱 Your simulated phone number is: ${this.phoneNumber}`);
        console.log('Type your messages and press Enter to send. (Type "exit" to quit)\n');

        this.promptUser();
    }

    promptUser() {
        this.rl.question('SMS > ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                this.rl.close();
                process.exit(0);
            }

            try {
                // Simulate an incoming webhook from Twilio
                const response = await axios.post(this.webhookUrl, {
                    Body: input,
                    From: this.phoneNumber,
                    To: 'BUSINESS_NUMBER'
                });

                // Log the AI's response
                console.log('\n📱 Received response:', response.data.content);
                
            } catch (error) {
                console.error('\n❌ Error sending message:', error.message);
            }

            // Continue the conversation
            this.promptUser();
        });
    }
}

// If this file is run directly (not required as a module)
if (require.main === module) {
    const simulator = new SMSSimulator();
    simulator.start();
}

module.exports = SMSSimulator; 