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
            logger.info("Initializing Email to WhatsApp Forwarder...");

            // Validate configuration
            validateConfig();
            logger.info("Configuration validated successfully");

            // Initialize services
            await this.gmailService.initialize();

            // Test WhatsApp connection
            const isWhatsAppConnected = await this.whatsappService
                .testConnection();
            if (!isWhatsAppConnected) {
                throw new Error(
                    "WhatsApp connection failed. Please check your Green API credentials.",
                );
            }

            logger.info("All services initialized successfully");
        } catch (error) {
            logger.error("Initialization failed:", error);
            throw error;
        }
    }

    /**
     * Processes new emails
     */
    async processEmails() {
        try {
            logger.info("Checking for new emails...");

            const emails = await this.gmailService.checkEmails();

            if (emails.length === 0) {
                logger.info("No new emails found");
                return;
            }

            logger.info(`Found ${emails.length} new email(s) to forward`);

            for (const email of emails) {
                try {
                    await this.whatsappService.forwardEmail(email);

                    // Clean up attachments after successful forwarding
                    for (const attachment of email.attachments) {
                        try {
                            const fs = require("fs").promises;
                            await fs.unlink(attachment.filepath);
                            logger.debug(
                                `Deleted attachment: ${attachment.filepath}`,
                            );
                        } catch (error) {
                            logger.warn(
                                `Failed to delete attachment: ${attachment.filepath}`,
                                error,
                            );
                        }
                    }
                } catch (error) {
                    logger.error(
                        `Failed to forward email "${email.subject}":`,
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
                            "Failed to send error notification:",
                            notifyError,
                        );
                    }
                }
            }
        } catch (error) {
            logger.error("Email processing failed:", error);

            // Reconnect Gmail if needed
            if (
                error.message.includes("IMAP") ||
                error.message.includes("connection")
            ) {
                logger.info("Attempting to reconnect to Gmail...");
                try {
                    this.gmailService.disconnect();
                    await this.gmailService.connect();
                    logger.info("Reconnected to Gmail successfully");
                } catch (reconnectError) {
                    logger.error(
                        "Failed to reconnect to Gmail:",
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
                `Starting email forwarder with ${config.app.checkIntervalSeconds}s interval`,
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
                logger.info("Running attachment cleanup...");
                await this.gmailService.cleanupAttachments(7);
            }, 24 * 60 * 60 * 1000);

            logger.info("Email to WhatsApp forwarder is running");
        } catch (error) {
            logger.error("Failed to start forwarder:", error);
            this.stop();
            process.exit(1);
        }
    }

    /**
     * Stops the forwarder
     */
    stop() {
        logger.info("Stopping email forwarder...");

        this.isRunning = false;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.gmailService.disconnect();

        logger.info("Email forwarder stopped");
    }

    /**
     * Handles graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);

            try {
                // Send shutdown notification
                await this.whatsappService.sendNotification(
                    "🛑 Email to WhatsApp Forwarder is shutting down...",
                );
            } catch (error) {
                logger.error("Failed to send shutdown notification:", error);
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
