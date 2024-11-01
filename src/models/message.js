const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        index: true // Add index for faster queries
    },
    customerName: {
        type: String,
        default: null
    },
    customerEmail: {
        type: String,
        default: null
    },
    content: {
        type: String,
        required: true
    },
    direction: {
        type: String,
        enum: ['inbound', 'outbound'],
        required: true
    },
    phoneModel: {
        type: String,
        default: null
    },
    issueDescription: {
        type: String,
        default: null
    },
    appointmentDetails: {
        date: Date,
        time: String,
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled'],
            default: 'pending'
        }
    },
    metadata: {
        type: Map,
        of: String,
        default: new Map()
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for common queries
messageSchema.index({ createdAt: -1 });
messageSchema.index({ 'appointmentDetails.date': 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;