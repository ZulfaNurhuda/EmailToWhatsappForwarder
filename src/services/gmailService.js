/**
 * Gmail Service Module
 * @module services/gmailService
 */

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs").promises;
const path = require("path");
const { config } = require("../utils/config");
const logger = require("../utils/logger");

/**
 * Gmail Service Class for handling email operations
 */
class GmailService {
    /**
     * Creates an instance of GmailService
     */
    constructor() {
        this.imap = null;
        this.isConnected = false;
        this.attachmentsDir = path.join(process.cwd(), "attachments");
    }

    /**
     * Initializes the service by creating necessary directories
     */
    async initialize() {
        try {
            await fs.mkdir(this.attachmentsDir, { recursive: true });
            logger.info("Gmail Service: Attachments directory created successfully.");
        } catch (error) {
            logger.error("Gmail Service: Failed to create attachments directory.", error);
            throw error;
        }
    }

    /**
     * Connects to Gmail IMAP server
     * @returns {Promise<void>}
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.imap = new Imap({
                user: config.gmail.user,
                password: config.gmail.password,
                host: config.gmail.host,
                port: config.gmail.port,
                tls: config.gmail.tls,
                tlsOptions: { rejectUnauthorized: false },
            });

            this.imap.once("ready", () => {
                this.isConnected = true;
                logger.info("Gmail Service: Successfully connected to IMAP server.");
                resolve();
            });

            this.imap.once("error", (err) => {
                logger.error("Gmail Service: IMAP connection error.", err);
                this.isConnected = false;
                reject(err);
            });

            this.imap.once("end", () => {
                this.isConnected = false;
                logger.info("Gmail Service: IMAP connection ended.");
            });

            this.imap.connect();
        });
    }

    /**
     * Opens the inbox folder
     * @returns {Promise<Object>} Box object
     */
    openInbox() {
        return new Promise((resolve, reject) => {
            this.imap.openBox("INBOX", false, (err, box) => {
                if (err) {
                    logger.error("Gmail Service: Failed to open INBOX.", err);
                    reject(err);
                } else {
                    logger.info("Gmail Service: INBOX opened successfully.");
                    resolve(box);
                }
            });
        });
    }

    /**
     * Searches for unread emails from specific senders
     * @returns {Promise<number[]>} Array of email UIDs
     */
    searchUnreadFromSenders() {
        return new Promise((resolve, reject) => {
            const senders = config.filter.senderEmail
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            if (senders.length === 0) {
                logger.warn("No sender emails configured for filtering.");
                return resolve([]);
            }

            const searchCriteria = ["UNSEEN"];
            if (senders.length > 1) {
                const senderCriteria = senders.map(sender => ["FROM", sender]);
                searchCriteria.push("OR", ...senderCriteria);
            } else {
                searchCriteria.push(["FROM", senders[0]]);
            }

            this.imap.search(searchCriteria, (err, results) => {
                if (err) {
                    logger.error("Gmail Service: Email search failed.", err);
                    reject(err);
                } else {
                    logger.info(
                        `Gmail Service: Found ${results.length} new email(s) from [${senders.join(", ")}].`,
                    );
                    resolve(results);
                }
            });
        });
    }

    /**
     * Fetches and parses an email by UID
     * @param {number} uid - Email UID
     * @returns {Promise<Object>} Parsed email object
     */
    fetchEmail(uid) {
        return new Promise((resolve, reject) => {
            const fetch = this.imap.fetch(uid, {
                bodies: "",
                markSeen: true,
            });

            let buffer = "";

            fetch.on("message", (msg) => {
                msg.on("body", (stream) => {
                    stream.on("data", (chunk) => {
                        buffer += chunk.toString("utf8");
                    });
                });

                msg.once("end", async () => {
                    try {
                        const parsed = await simpleParser(buffer);
                        resolve(parsed);
                    } catch (parseError) {
                        logger.error("Failed to parse email:", parseError);
                        reject(parseError);
                    }
                });
            });

            fetch.once("error", (err) => {
                logger.error("Fetch error:", err);
                reject(err);
            });

            fetch.once("end", () => {
                logger.debug(`Fetched email UID: ${uid}`);
            });
        });
    }

    /**
     * Processes email content and attachments
     * @param {Object} email - Parsed email object
     * @returns {Promise<Object>} Processed email data
     */
    async processEmail(email) {
        const processedData = {
            from: email.from.text,
            to: email.to.text,
            subject: email.subject || "(No Subject)",
            date: email.date,
            text: email.text || "",
            html: email.html || "",
            attachments: [],
            skippedAttachments: [],
        };

        // Process attachments
        if (email.attachments && email.attachments.length > 0) {
            for (const attachment of email.attachments) {
                try {
                    // Check attachment size
                    const sizeMB = attachment.size / (1024 * 1024);
                    if (sizeMB > config.app.maxAttachmentSizeMB) {
                        logger.warn(
                            `Skipping attachment ${attachment.filename} because it exceeds the size limit (${sizeMB.toFixed(2)}MB).`,
                        );
                        processedData.skippedAttachments.push({
                            filename: attachment.filename,
                            size: attachment.size,
                            reason: "Exceeds size limit",
                        });
                        continue;
                    }

                    // Save attachment
                    const filename = `${Date.now()}_${attachment.filename}`;
                    const filepath = path.join(this.attachmentsDir, filename);

                    await fs.writeFile(filepath, attachment.content);

                    processedData.attachments.push({
                        filename: attachment.filename,
                        filepath: filepath,
                        contentType: attachment.contentType,
                        size: attachment.size,
                    });

                    logger.info(`Gmail Service: Attachment saved successfully: ${filename}`);
                } catch (error) {
                    logger.error(
                        `Gmail Service: Failed to save attachment ${attachment.filename}.`,
                        error,
                    );
                }
            }
        }

        return processedData;
    }

    /**
     * Marks an email as seen
     * @param {number} uid - Email UID
     * @returns {Promise<void>}
     */
    markAsSeen(uid) {
        return new Promise((resolve, reject) => {
            this.imap.addFlags(uid, "\\Seen", (err) => {
                if (err) {
                    logger.error(`Failed to mark email ${uid} as seen:`, err);
                    reject(err);
                } else {
                    logger.debug(`Marked email ${uid} as seen`);
                    resolve();
                }
            });
        });
    }

    /**
     * Checks for new emails and processes them
     * @returns {Promise<Object[]>} Array of processed emails
     */
    async checkEmails() {
        const processedEmails = [];

        try {
            if (!this.isConnected) {
                await this.connect();
            }

            await this.openInbox();
            const uids = await this.searchUnreadFromSenders();

            for (const uid of uids) {
                try {
                    const email = await this.fetchEmail(uid);
                    const processedEmail = await this.processEmail(email);
                    processedEmails.push(processedEmail);

                    logger.info(`Gmail Service: Successfully processed email with UID ${uid} and subject "${processedEmail.subject}".`);
                } catch (error) {
                    logger.error(`Gmail Service: Failed to process email with UID ${uid}.`, error);
                }
            }

            return processedEmails;
        } catch (error) {
            logger.error("Gmail Service: A critical error occurred while checking emails.", error);
            throw error;
        }
    }

    /**
     * Disconnects from Gmail IMAP server
     */
    disconnect() {
        if (this.imap && this.isConnected) {
            this.imap.end();
            this.isConnected = false;
            logger.info("Gmail Service: Disconnected from IMAP server.");
        }
    }

    /**
     * Cleans up old attachments
     * @param {number} daysToKeep - Number of days to keep attachments
     */
    async cleanupAttachments(daysToKeep = 7) {
        try {
            const files = await fs.readdir(this.attachmentsDir);
            const now = Date.now();
            const cutoffTime = daysToKeep * 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filepath = path.join(this.attachmentsDir, file);
                const stats = await fs.stat(filepath);

                if (now - stats.mtimeMs > cutoffTime) {
                    await fs.unlink(filepath);
                    logger.info(`Gmail Service: Deleted old attachment: ${file}`);
                }
            }
        } catch (error) {
            logger.error("Gmail Service: Failed to cleanup old attachments.", error);
        }
    }
}

module.exports = GmailService;
