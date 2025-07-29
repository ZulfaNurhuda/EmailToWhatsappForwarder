/**
 * @file Configures and exports a Winston logger for application-wide logging.
 * @module utils/logger
 * @requires winston
 * @requires path
 * @requires fs
 * @requires ./config
 */

const winston = require("winston");
const path = require("path");
const fs = require("fs");
const { config } = require("./config");

// --- Directory Setup ---
// Ensures that the directory for log files exists before trying to write to it.
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (error) {
        // If the directory cannot be created, log an error to the console and exit.
        console.error("Failed to create logs directory:", error);
        process.exit(1);
    }
}

// --- Helper for Safe JSON Stringification ---
/**
 * Safely stringifies a JavaScript object, handling circular references
 * by replacing them with a placeholder string '[Circular]'.
 *
 * @param {object} obj - The object to be stringified.
 * @returns {string} A JSON string representation of the object.
 */
const safeStringify = (obj) => {
    const cache = new Set();
    return JSON.stringify(
        obj,
        (key, value) => {
            // If the value is an object and has been seen before, it's a circular reference.
            if (typeof value === "object" && value !== null) {
                if (cache.has(value)) {
                    return "[Circular]"; // Replace with a placeholder.
                }
                cache.add(value); // Store the new object in the cache.
            }
            return value;
        },
        2, // Use an indentation of 2 spaces for pretty-printing.
    );
};

// --- Custom Log Formats ---
/**
 * A custom Winston format for console logging.
 * It includes colorization, a timestamp, and pretty-prints metadata.
 */
const consoleFormat = winston.format.combine(
    winston.format.colorize(), // Apply colors to the log levels.
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Add a timestamp.
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        // Stringify metadata only if it exists.
        const metaStr = Object.keys(meta).length ? safeStringify(meta) : "";
        return `${timestamp} [${level}]: ${message} ${metaStr}`.trim();
    }),
);

/**
 * A custom Winston format for file logging.
 * It includes a timestamp, error stack traces, and outputs in JSON format.
 */
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Add a timestamp.
    winston.format.errors({ stack: true }), // Include stack traces for errors.
    winston.format.json(), // Log in JSON format.
);

// --- Logger Instance ---
/**
 * The main logger instance, configured with multiple transports.
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
    // Set the minimum log level from the application config.
    level: config.app.logLevel || "info",
    // A base format that includes error stacks and allows for string interpolation.
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.splat(),
    ),
    // Default metadata to be included in every log entry.
    defaultMeta: { service: "email-to-whatsapp-forwarder" },
    // Define the transports (outputs) for the logs.
    transports: [
        // Console transport for development and immediate feedback.
        new winston.transports.Console({
            format: consoleFormat,
        }),
        // File transport for all logs, with rotation.
        new winston.transports.File({
            filename: path.join(logsDir, "combined.log"),
            format: fileFormat,
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5, // Keep up to 5 old log files.
            tailable: true,
        }),
        // Separate file transport for error logs only.
        new winston.transports.File({
            filename: path.join(logsDir, "error.log"),
            level: "error", // Only log entries with level 'error'.
            format: fileFormat,
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5,
            tailable: true,
        }),
    ],
});

// --- Global Error Handlers ---
/**
 * Catches and logs unhandled promise rejections.
 * This prevents the application from crashing silently on unhandled async errors.
 */
process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", { promise, reason });
});

/**
 * Catches and logs uncaught exceptions.
 * This is a final safety net for synchronous errors. The process will exit after logging.
 */
process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", { error });
    process.exit(1); // Exit with a failure code.
});

// Export the configured logger instance.
module.exports = logger;