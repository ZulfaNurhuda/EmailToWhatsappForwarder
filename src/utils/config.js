/**
 * Configuration module for environment variables
 * @module utils/config
 */

require("dotenv").config({ path: `${process.cwd()}/.env.local` });

/**
 * Application configuration object
 * @typedef {Object} AppConfig
 * @property {Object} gmail - Gmail configuration
 * @property {string} gmail.user - Gmail username
 * @property {string} gmail.password - Gmail app password
 * @property {string} gmail.host - IMAP host
 * @property {number} gmail.port - IMAP port
 * @property {boolean} gmail.tls - Use TLS
 * @property {Object} filter - Email filter configuration
 * @property {string} filter.senderEmail - Sender email to filter
 * @property {Object} greenApi - Green API configuration
 * @property {string} greenApi.idInstance - Instance ID
 * @property {string} greenApi.apiToken - API token
 * @property {string} greenApi.baseUrl - Base URL for API
 * @property {Object} whatsapp - WhatsApp configuration
 * @property {string} whatsapp.senderNumber - Sender phone number
 * @property {string} whatsapp.targetNumber - Target phone number
 * @property {Object} app - Application configuration
 * @property {number} app.checkIntervalSeconds - Check interval in seconds
 * @property {string} app.logLevel - Log level
 * @property {number} app.maxAttachmentSizeMB - Maximum attachment size in MB
 */

/** @type {AppConfig} */
const config = {
    gmail: {
        user: process.env.GMAIL_USER || "",
        password: process.env.GMAIL_APP_PASSWORD || "",
        host: process.env.GMAIL_HOST || "imap.gmail.com",
        port: parseInt(process.env.GMAIL_PORT || "993", 10),
        tls: process.env.GMAIL_TLS === "true",
    },
    filter: {
        senderEmail: process.env.SENDER_EMAIL_FILTER || "",
    },
    greenApi: {
        idInstance: process.env.GREEN_API_ID_INSTANCE || "",
        apiToken: process.env.GREEN_API_TOKEN || "",
        baseUrl: process.env.GREEN_API_BASE_URL || "https://api.green-api.com",
    },
    whatsapp: {
        senderNumber: process.env.WHATSAPP_SENDER_NUMBER || "",
        targetNumber: process.env.WHATSAPP_TARGET_NUMBER || "",
    },
    app: {
        checkIntervalSeconds: parseInt(
            process.env.CHECK_INTERVAL_SECONDS || "30",
            10,
        ),
        logLevel: process.env.LOG_LEVEL || "info",
        maxAttachmentSizeMB: parseInt(
            process.env.MAX_ATTACHMENT_SIZE_MB || "25",
            10,
        ),
    },
};

/**
 * Validates the configuration
 * @throws {Error} If required configuration is missing
 */
const validateConfig = () => {
    const requiredFields = [
        { path: "gmail.user", value: config.gmail.user },
        { path: "gmail.password", value: config.gmail.password },
        { path: "filter.senderEmail", value: config.filter.senderEmail },
        { path: "greenApi.idInstance", value: config.greenApi.idInstance },
        { path: "greenApi.apiToken", value: config.greenApi.apiToken },
        { path: "whatsapp.targetNumber", value: config.whatsapp.targetNumber },
    ];

    const missingFields = requiredFields
        .filter((field) => !field.value)
        .map((field) => field.path);

    if (missingFields.length > 0) {
        throw new Error(
            `Missing required configuration: ${missingFields.join(", ")}`,
        );
    }
};

module.exports = {
    config,
    validateConfig,
};
