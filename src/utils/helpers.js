/**
 * @file Provides generic helper functions for use across the application.
 * @module utils/helpers
 */

/**
 * Creates a delay for a specified number of milliseconds.
 * This is an async function that can be awaited, useful for implementing rate limiting
 * or waiting for operations to complete.
 *
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 * @example
 * // Wait for 2 seconds before proceeding
 * await delay(2000);
 */
function delay(ms) {
    // Returns a new Promise that automatically resolves after the given timeout.
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export the helper functions for use in other modules.
module.exports = {
    delay,
};