/**
 * Logger module using Winston
 * @module utils/logger
 */

const winston = require("winston");
const path = require("path");
const fs = require("fs");
const { config } = require("./config");

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Safely stringifies an object, handling circular references.
 * @param {Object} obj - The object to stringify.
 * @returns {string} The JSON string.
 */
const safeStringify = (obj) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                // Circular reference found, discard key
                return '[Circular]';
            }
            // Store value in our collection
            cache.add(value);
        }
        return value;
    }, 2); // The '2' argument prettifies the JSON output
};

/**
 * Custom format for console output
 */
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length
            ? safeStringify(meta)
            : "";
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    }),
);

/**
 * Custom format for file output
 */
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

/**
 * Winston logger instance
 */
const logger = winston.createLogger({
    level: config.app.logLevel || "info",
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.splat(),
    ),
    defaultMeta: { service: "email-to-whatsapp-forwarder" },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat,
        }),
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, "combined.log"),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // File transport for errors
        new winston.transports.File({
            filename: path.join(logsDir, "error.log"),
            level: "error",
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

/**
 * Log unhandled promise rejections
 */
process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", { promise, reason });
});

/**
 * Log uncaught exceptions
 */
process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    process.exit(1);
});

module.exports = logger;
