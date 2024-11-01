/**
 * Standardizes phone number format by removing '+' and any other non-digit characters
 * @param {string} phoneNumber - The phone number to standardize
 * @returns {string} - Standardized phone number
 */
const standardizePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    // Remove '+' and any other non-digit characters
    return phoneNumber.replace(/\D/g, '');
};

module.exports = { standardizePhoneNumber };