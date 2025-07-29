/**
 * Main Application Entry Point
 * @module app
 */

const { config, validateConfig } = require("./utils/config");
const logger = require("./utils/logger");
const GmailService = require("./services/gmailService");
const WhatsAppService = require("./services/whatsappService");

/**
 * Main application class
 */
class EmailToWhatsAppForwarder {
    /**
     * Creates an instance of the forwarder
     */
    constructor() {
        this.gmailService = new GmailService();
        this.whatsappService = new WhatsAppService();
        this.isRunning = false;
        this.checkInterval = null;
    }

    /**
     * Initializes the application
     */
    async initialize() {
        try {
            logger.info("App: Initializing Email to WhatsApp Forwarder...");

            // Validate configuration
            validateConfig();
            logger.info("App: Configuration validated successfully.");

            // Initialize services
            await this.gmailService.initialize();

            // Test WhatsApp connection
            const isWhatsAppConnected = await this.whatsappService
                .testConnection();
            if (!isWhatsAppConnected) {
                throw new Error(
                    "App: WhatsApp connection failed. Please check your Green API credentials.",
                );
            }

            logger.info("App: All services initialized successfully.");
        } catch (error) {
            logger.error("App: Initialization failed.", error);
            throw error;
        }
    }

    /**
     * Processes new emails
     */
    async processEmails() {
        try {
            logger.info("App: Starting email processing cycle.");

            const emails = await this.gmailService.checkEmails();

            if (emails.length === 0) {
                logger.info("App: No new emails to process in this cycle.");
                return;
            }

            logger.info(`App: Found ${emails.length} new email(s) to forward.`);

            for (const email of emails) {
                try {
                    await this.whatsappService.forwardEmail(email);

                    // Clean up attachments after successful forwarding
                    for (const attachment of email.attachments) {
                        try {
                            const fs = require("fs").promises;
                            await fs.unlink(attachment.filepath);
                            logger.debug(
                                `App: Successfully deleted temporary attachment: ${attachment.filepath}`,
                            );
                        } catch (error) {
                            logger.warn(
                                `App: Could not delete temporary attachment: ${attachment.filepath}`,
                                error,
                            );
                        }
                    }
                } catch (error) {
                    logger.error(
                        `App: Failed to forward email with subject "${email.subject}".`,
                        error,
                    );

                    // Send error notification
                    try {
                        const errorMessage =
                            `❌ Failed to forward email:\n*Subject:* ${email.subject}\n*Error:* ${error.message}`;
                        await this.whatsappService.sendNotification(
                            errorMessage,
                        );
                    } catch (notifyError) {
                        logger.error(
                            "App: Failed to send a WhatsApp notification about the forwarding failure.",
                            notifyError,
                        );
                    }
                }
            }
        } catch (error) {
            logger.error("App: A critical error occurred during the email processing cycle.", error);

            // Reconnect Gmail if needed
            if (
                error.message.includes("IMAP") ||
                error.message.includes("connection")
            ) {
                logger.info("App: Attempting to reconnect to Gmail due to a connection error...");
                try {
                    this.gmailService.disconnect();
                    await this.gmailService.connect();
                    logger.info("App: Reconnected to Gmail successfully.");
                } catch (reconnectError) {
                    logger.error(
                        "App: Failed to reconnect to Gmail after a connection error.",
                        reconnectError,
                    );
                }
            }
        }
    }

    /**
     * Starts the forwarder
     */
    async start() {
        try {
            await this.initialize();

            this.isRunning = true;
            logger.info(
                `App: Starting email forwarder. New emails will be checked every ${config.app.checkIntervalSeconds} seconds.`,
            );

            // Process emails immediately on start
            await this.processEmails();

            // Set up periodic checking
            this.checkInterval = setInterval(async () => {
                if (this.isRunning) {
                    await this.processEmails();
                }
            }, config.app.checkIntervalSeconds * 1000);

            // Set up periodic cleanup (once per day)
            setInterval(async () => {
                logger.info("App: Starting daily attachment cleanup task.");
                await this.gmailService.cleanupAttachments(7);
            }, 24 * 60 * 60 * 1000);

            logger.info("App: Email to WhatsApp forwarder is now running.");
        } catch (error) {
            logger.error("App: A fatal error occurred during startup.", error);
            this.stop();
            process.exit(1);
        }
    }

    /**
     * Stops the forwarder
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
     * Handles graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`App: Received ${signal}. Initiating graceful shutdown...`);

            try {
                // Send shutdown notification
                await this.whatsappService.sendNotification(
                    "🛑 The Email to WhatsApp Forwarder is shutting down.",
                );
            } catch (error) {
                logger.error("App: Failed to send the shutdown notification to WhatsApp.", error);
            }

            this.stop();
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    }
}

// Main execution
if (require.main === module) {
    const forwarder = new EmailToWhatsAppForwarder();

    // Setup graceful shutdown
    forwarder.setupGracefulShutdown();

    // Start the forwarder
    forwarder.start().catch((error) => {
        logger.error("Fatal error:", error);
        process.exit(1);
    });
}

module.exports = EmailToWhatsAppForwarder;
