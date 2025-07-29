/**
 * @file The main entry point for the Email to WhatsApp Forwarder application.
 * @module app
 * @requires ./utils/config
 * @requires ./utils/logger
 * @requires ./services/gmailService
 * @requires ./services/whatsappService
 */

const { config, validateConfig } = require("./utils/config");
const logger = require("./utils/logger");
const GmailService = require("./services/gmailService");
const WhatsAppService = require("./services/whatsappService");

/**
 * @class EmailToWhatsAppForwarder
 * @description Orchestrates the entire email forwarding process.
 */
class EmailToWhatsAppForwarder {
    /**
     * Initializes the application services.
     */
    constructor() {
        /** @type {GmailService} The service for interacting with Gmail. */
        this.gmailService = new GmailService();
        /** @type {WhatsAppService} The service for sending WhatsApp messages. */
        this.whatsappService = new WhatsAppService();
        /** @type {boolean} A flag to control the main processing loop. */
        this.isRunning = false;
        /** @type {NodeJS.Timeout|null} The timer for the periodic email check. */
        this.checkInterval = null;
    }

    /**
     * Initializes and validates all services and configurations.
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.info("App: Initializing Email to WhatsApp Forwarder...");

            // 1. Validate essential environment variables.
            validateConfig();
            logger.info("App: Configuration validated successfully.");

            // 2. Initialize the Gmail service (e.g., create attachments directory).
            await this.gmailService.initialize();

            // 3. Test the WhatsApp connection to ensure the API is ready.
            const isWhatsAppConnected = await this.whatsappService.testConnection();
            if (!isWhatsAppConnected) {
                throw new Error(
                    "App: WhatsApp connection test failed. Please check Green API credentials and instance status.",
                );
            }

            logger.info("App: All services initialized successfully.");
        } catch (error) {
            logger.error("App: A fatal error occurred during initialization.", { error });
            throw error; // Propagate the error to stop the application.
        }
    }

    /**
     * The core logic loop: checks for new emails and forwards them.
     * @returns {Promise<void>}
     */
    async processEmails() {
        try {
            logger.info("App: Starting email processing cycle.");

            // 1. Fetch new emails from the Gmail service.
            const emails = await this.gmailService.checkEmails();

            if (emails.length === 0) {
                logger.info("App: No new emails to process in this cycle.");
                return;
            }

            logger.info(`App: Found ${emails.length} new email(s) to forward.`);

            // 2. Iterate through and forward each email.
            for (const email of emails) {
                try {
                    await this.whatsappService.forwardEmail(email);

                    // 3. Clean up temporary attachments after successful forwarding.
                    for (const attachment of email.attachments) {
                        try {
                            const fs = require("fs").promises;
                            await fs.unlink(attachment.filepath);
                            logger.debug(`App: Deleted temporary attachment: ${attachment.filepath}`);
                        } catch (cleanupError) {
                            logger.warn(`App: Failed to delete temporary attachment: ${attachment.filepath}`, { error: cleanupError });
                        }
                    }
                } catch (forwardingError) {
                    logger.error(`App: Failed to forward email with subject "${email.subject}".`, { error: forwardingError });
                    // Attempt to send a notification about the failure.
                    await this.notifyOfFailure(email, forwardingError);
                }
            }
        } catch (cycleError) {
            logger.error("App: A critical error occurred during the email processing cycle.", { error: cycleError });
            // Handle IMAP connection errors by attempting to reconnect.
            if (cycleError.message.includes("IMAP") || cycleError.message.includes("connection")) {
                await this.handleReconnection();
            }
        }
    }

    /**
     * Sends a WhatsApp notification about a failed forwarding attempt.
     * @param {object} email - The email that failed to forward.
     * @param {Error} error - The error that occurred.
     * @returns {Promise<void>}
     */
    async notifyOfFailure(email, error) {
        try {
            const errorMessage = `❌ Failed to forward email:\n*Subject:* ${email.subject}\n*Error:* ${error.message}`;
            await this.whatsappService.sendNotification(errorMessage);
        } catch (notifyError) {
            logger.error("App: CRITICAL - Failed to send a WhatsApp notification about a forwarding failure.", { error: notifyError });
        }
    }

    /**
     * Handles the logic for reconnecting to the Gmail IMAP server.
     * @returns {Promise<void>}
     */
    async handleReconnection() {
        logger.info("App: Attempting to reconnect to Gmail due to a connection error...");
        try {
            this.gmailService.disconnect();
            await this.gmailService.connect();
            logger.info("App: Reconnected to Gmail successfully.");
        } catch (reconnectError) {
            logger.error("App: Failed to reconnect to Gmail. The application may be unstable.", { error: reconnectError });
        }
    }

    /**
     * Starts the application's main loop and periodic tasks.
     * @returns {Promise<void>}
     */
    async start() {
        try {
            await this.initialize();
            this.isRunning = true;
            logger.info(`App: Starting email forwarder. Checking every ${config.app.checkIntervalSeconds} seconds.`);

            // Run an initial check immediately on startup.
            await this.processEmails();

            // Set up the interval for periodic email checks.
            this.checkInterval = setInterval(() => {
                if (this.isRunning) {
                    this.processEmails();
                }
            }, config.app.checkIntervalSeconds * 1000);

            // Set up a daily interval for cleaning up old attachments.
            setInterval(() => {
                logger.info("App: Starting daily attachment cleanup task.");
                this.gmailService.cleanupAttachments(7); // Keep attachments for 7 days.
            }, 24 * 60 * 60 * 1000); // 24 hours

            logger.info("App: Email to WhatsApp forwarder is now running.");
        } catch (error) {
            logger.error("App: A fatal error occurred during startup. The application will now exit.", { error });
            this.stop();
            process.exit(1);
        }
    }

    /**
     * Stops the application, clearing intervals and disconnecting services.
     */
    stop() {
        logger.info("App: Stopping the email forwarder...");
        this.isRunning = false;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info("App: Email checking interval has been cleared.");
        }

        this.gmailService.disconnect();
        logger.info("App: The email forwarder has been stopped.");
    }

    /**
     * Sets up listeners for process signals to ensure graceful shutdown.
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`App: Received ${signal}. Initiating graceful shutdown...`);
            try {
                await this.whatsappService.sendNotification("🛑 The Email to WhatsApp Forwarder is shutting down.");
            } catch (error) {
                logger.warn("App: Could not send shutdown notification to WhatsApp.", { error });
            }
            this.stop();
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM")); // For termination signals (e.g., from Docker)
        process.on("SIGINT", () => shutdown("SIGINT"));   // For Ctrl+C in the terminal
    }
}

// --- Main Execution Block ---
// This ensures the application only runs when the script is executed directly.
if (require.main === module) {
    const forwarder = new EmailToWhatsAppForwarder();
    forwarder.setupGracefulShutdown();
    forwarder.start();
}

module.exports = EmailToWhatsAppForwarder;