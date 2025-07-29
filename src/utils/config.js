/**
 * @file Manages and validates the application's configuration.
 * @module utils/config
 * @requires dotenv
 */

// Load environment variables from a .env.local file into process.env
// This allows for easy configuration management without hardcoding credentials.
require("dotenv").config({ path: `${process.cwd()}/.env.local` });

/**
 * A frozen object containing all application configurations, loaded from environment variables.
 * Freezing the object prevents accidental modifications during runtime.
 *
 * @typedef {object} AppConfig
 *
 * @property {object} gmail - Configuration for the Gmail IMAP connection.
 * @property {string} gmail.user - The Gmail account username (e.g., "example@gmail.com").
 * @property {string} gmail.password - The 16-character Gmail App Password.
 * @property {string} gmail.host - The IMAP server host for Gmail.
 * @property {number} gmail.port - The port for the IMAP connection (993 for TLS).
 * @property {boolean} gmail.tls - Whether to use a secure TLS connection.
 *
 * @property {object} filter - Configuration for filtering incoming emails.
 * @property {string} filter.senderEmail - A comma-separated list of sender emails to forward.
 *
 * @property {object} greenApi - Configuration for the Green API service.
 * @property {string} greenApi.idInstance - The ID of your Green API instance.
 * @property {string} greenApi.apiToken - The API token for your Green API instance.
 * @property {string} greenApi.baseUrl - The base URL for Green API's standard methods.
 * @property {string} greenApi.mediaUrl - The URL for Green API's media upload methods.
 *
 * @property {object} whatsapp - Configuration for WhatsApp messaging.
 * @property {string} whatsapp.targetNumber - The destination WhatsApp number to forward emails to.
 *
 * @property {object} app - General application settings.
 * @property {number} app.checkIntervalSeconds - The interval in seconds at which to check for new emails.
 * @property {string} app.logLevel - The logging level for the application (e.g., 'info', 'debug', 'error').
 * @property {number} app.maxAttachmentSizeMB - The maximum size in megabytes for an attachment to be downloaded and forwarded.
 */

/**
 * The main configuration object for the application.
 * It sources its values from environment variables, providing default fallbacks for non-critical settings.
 * @type {AppConfig}
 */
const config = Object.freeze({
    // Gmail IMAP connection settings
    gmail: {
        user: process.env.GMAIL_USER || "", // Your Gmail email address
        password: process.env.GMAIL_APP_PASSWORD || "", // Your Gmail App Password
        host: process.env.GMAIL_HOST || "imap.gmail.com", // Default Gmail IMAP host
        port: parseInt(process.env.GMAIL_PORT || "993", 10), // Default IMAP port with TLS
        tls: process.env.GMAIL_TLS ? process.env.GMAIL_TLS === "true" : true, // Enable TLS by default
    },
    // Email filtering settings
    filter: {
        // A comma-separated string of email addresses to monitor.
        // Example: "sender1@example.com,sender2@example.com"
        senderEmail: process.env.SENDER_EMAIL_FILTER || "",
    },
    // Green API credentials and endpoints
    greenApi: {
        idInstance: process.env.GREEN_API_ID_INSTANCE || "", // Your Green API instance ID
        apiToken: process.env.GREEN_API_TOKEN || "", // Your Green API instance token
        baseUrl: process.env.GREEN_API_BASE_URL || "https://api.green-api.com", // Base URL for most API calls
        mediaUrl: process.env.GREEN_API_MEDIA_URL || "https://media.green-api.com", // URL for file uploads
    },
    // WhatsApp settings
    whatsapp: {
        // The phone number that will receive the forwarded emails.
        // Should be in a format recognized by the WhatsApp API (e.g., "6281234567890").
        targetNumber: process.env.WHATSAPP_TARGET_NUMBER || "",
    },
    // General application settings
    app: {
        // Frequency (in seconds) to check for new emails.
        checkIntervalSeconds: parseInt(
            process.env.CHECK_INTERVAL_SECONDS || "30",
            10,
        ),
        // Determines the verbosity of logs. Can be 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'.
        logLevel: process.env.LOG_LEVEL || "info",
        // Sets the upper limit for attachment sizes to prevent excessive memory and disk usage.
        maxAttachmentSizeMB: parseInt(
            process.env.MAX_ATTACHMENT_SIZE_MB || "25",
            10,
        ),
    },
});

/**
 * Validates that all essential configuration variables have been provided in the environment.
 * If any required configuration is missing, it throws an error to prevent the application
 * from starting in an invalid state.
 *
 * @throws {Error} If one or more required environment variables are not set.
 */
const validateConfig = () => {
    // Define a list of essential configuration paths and their corresponding values.
    const requiredFields = [
        { path: "gmail.user", value: config.gmail.user },
        { path: "gmail.password", value: config.gmail.password },
        { path: "filter.senderEmail", value: config.filter.senderEmail },
        { path: "greenApi.idInstance", value: config.greenApi.idInstance },
        { path: "greenApi.apiToken", value: config.greenApi.apiToken },
        { path: "whatsapp.targetNumber", value: config.whatsapp.targetNumber },
    ];

    // Filter the list to find any fields that are missing a value.
    const missingFields = requiredFields
        .filter((field) => !field.value)
        .map((field) => field.path);

    // If there are any missing fields, throw a comprehensive error.
    if (missingFields.length > 0) {
        throw new Error(
            `FATAL ERROR: Missing required configuration values for: ${missingFields.join(
                ", ",
            )}. Please check your .env.local file.`,
        );
    }
};

// Export the frozen config object and the validator function for use in other modules.
module.exports = {
    config,
    validateConfig,
};