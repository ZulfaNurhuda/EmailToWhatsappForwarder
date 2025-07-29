/**
 * Helper utility functions
 * @module utils/helpers
 */

/**
 * Delay function for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    delay,
};
