/**
 * @file Manages all interactions with the Gmail IMAP server.
 * @module services/gmailService
 * @requires imap
 * @requires mailparser
 * @requires fs.promises
 * @requires path
 * @requires ../utils/config
 * @requires ../utils/logger
 */

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs").promises;
const path = require("path");
const { config } = require("../utils/config");
const logger = require("../utils/logger");

/**
 * @class GmailService
 * @description Handles connecting to Gmail, fetching, parsing, and processing emails.
 */
class GmailService {
    /**
     * Initializes a new instance of the GmailService.
     */
    constructor() {
        /** @type {Imap|null} The IMAP connection instance. */
        this.imap = null;
        /** @type {boolean} Flag indicating the connection status. */
        this.isConnected = false;
        /** @type {string} The absolute path to the directory where attachments are stored. */
        this.attachmentsDir = path.join(process.cwd(), "attachments");
    }

    /**
     * Ensures the attachments directory exists.
     * This is called at startup to prepare for saving attachments.
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await fs.mkdir(this.attachmentsDir, { recursive: true });
            logger.info("Gmail Service: Attachments directory is ready.");
        } catch (error) {
            logger.error(
                "Gmail Service: Failed to create attachments directory.",
                { error },
            );
            throw error; // Propagate the error to halt startup if necessary.
        }
    }

    /**
     * Establishes a connection to the Gmail IMAP server using credentials from the config.
     * @returns {Promise<void>} A promise that resolves on successful connection or rejects on error.
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.imap = new Imap({
                user: config.gmail.user,
                password: config.gmail.password,
                host: config.gmail.host,
                port: config.gmail.port,
                tls: config.gmail.tls,
                tlsOptions: { rejectUnauthorized: false }, // Necessary for some environments
            });

            // --- IMAP Event Handlers ---
            this.imap.once("ready", () => {
                this.isConnected = true;
                logger.info("Gmail Service: Successfully connected to IMAP server.");
                resolve();
            });

            this.imap.once("error", (err) => {
                logger.error("Gmail Service: IMAP connection error.", { error: err });
                this.isConnected = false;
                reject(err);
            });

            this.imap.once("end", () => {
                this.isConnected = false;
                logger.info("Gmail Service: IMAP connection has ended.");
            });

            // Initiate the connection.
            this.imap.connect();
        });
    }

    /**
     * Opens the INBOX mailbox.
     * @returns {Promise<object>} A promise that resolves with the mailbox object or rejects on error.
     */
    openInbox() {
        return new Promise((resolve, reject) => {
            this.imap.openBox("INBOX", false, (err, box) => {
                if (err) {
                    logger.error("Gmail Service: Failed to open INBOX.", { error: err });
                    return reject(err);
                }
                logger.info("Gmail Service: INBOX opened successfully.");
                resolve(box);
            });
        });
    }

    /**
     * Searches for unread emails from the senders specified in the configuration.
     * @returns {Promise<number[]>} A promise that resolves with an array of email UIDs.
     */
    searchUnreadFromSenders() {
        return new Promise((resolve, reject) => {
            // Get and parse the list of sender emails from config.
            const senders = config.filter.senderEmail
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            if (senders.length === 0) {
                logger.warn("Gmail Service: No sender emails configured for filtering. Skipping search.");
                return resolve([]);
            }

            // Construct the IMAP search criteria.
            const searchCriteria = ["UNSEEN"];
            const senderCriteria = senders.map(sender => ["FROM", sender]);
            
            // Use OR for multiple senders.
            if (senderCriteria.length > 1) {
                searchCriteria.push("OR", ...senderCriteria);
            } else {
                searchCriteria.push(...senderCriteria);
            }

            this.imap.search(searchCriteria, (err, results) => {
                if (err) {
                    logger.error("Gmail Service: Email search failed.", { error: err });
                    return reject(err);
                }
                if (results.length > 0) {
                    logger.info(
                        `Gmail Service: Found ${results.length} new email(s) from [${senders.join(", ")}]`,
                    );
                }
                resolve(results);
            });
        });
    }

    /**
     * Fetches the full content of an email by its UID and parses it.
     * @param {number} uid - The Unique ID of the email to fetch.
     * @returns {Promise<object>} A promise that resolves with the parsed email object.
     */
    fetchEmail(uid) {
        return new Promise((resolve, reject) => {
            const fetch = this.imap.fetch(uid, {
                bodies: "", // Fetch the entire message body
                markSeen: true, // Mark the email as read upon fetching
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
                        // Use mailparser to parse the raw email buffer.
                        const parsed = await simpleParser(buffer);
                        resolve(parsed);
                    } catch (parseError) {
                        logger.error("Gmail Service: Failed to parse email.", { uid, error: parseError });
                        reject(parseError);
                    }
                });
            });

            fetch.once("error", (err) => {
                logger.error("Gmail Service: Email fetch error.", { uid, error: err });
                reject(err);
            });
        });
    }

    /**
     * Processes a parsed email object: extracts key information and handles attachments.
     * @param {object} email - The parsed email object from `simpleParser`.
     * @returns {Promise<object>} A structured object containing the email data and attachment details.
     */
    async processEmail(email) {
        const processedData = {
            from: email.from?.text || "",
            to: email.to?.text || "",
            subject: email.subject || "(No Subject)",
            date: email.date || new Date(),
            text: email.text || "",
            html: email.html || "",
            attachments: [],
            skippedAttachments: [],
        };

        if (email.attachments && email.attachments.length > 0) {
            for (const attachment of email.attachments) {
                try {
                    // Check if the attachment exceeds the configured size limit.
                    const sizeMB = attachment.size / (1024 * 1024);
                    if (sizeMB > config.app.maxAttachmentSizeMB) {
                        logger.warn(
                            `Skipping attachment "${attachment.filename}" because it exceeds the size limit (${sizeMB.toFixed(2)}MB).`,
                        );
                        processedData.skippedAttachments.push({
                            filename: attachment.filename,
                            size: attachment.size,
                            reason: "Exceeds size limit",
                        });
                        continue; // Skip to the next attachment
                    }

                    // Save the attachment to the local filesystem.
                    const filename = `${Date.now()}_${attachment.filename}`;
                    const filepath = path.join(this.attachmentsDir, filename);
                    await fs.writeFile(filepath, attachment.content);

                    processedData.attachments.push({
                        filename: attachment.filename,
                        filepath: filepath,
                        contentType: attachment.contentType,
                        size: attachment.size,
                    });
                    logger.info(`Gmail Service: Attachment saved successfully: "${filename}"`);
                } catch (error) {
                    logger.error(
                        `Gmail Service: Failed to save attachment "${attachment.filename}".`,
                        { error },
                    );
                }
            }
        }

        return processedData;
    }

    /**
     * The main workflow method to check for and process new emails.
     * @returns {Promise<object[]>} A promise that resolves with an array of all processed emails.
     */
    async checkEmails() {
        const processedEmails = [];
        try {
            // Connect if not already connected.
            if (!this.isConnected) {
                await this.connect();
            }

            await this.openInbox();
            const uids = await this.searchUnreadFromSenders();

            // Process each found email UID.
            for (const uid of uids) {
                try {
                    const email = await this.fetchEmail(uid);
                    const processedEmail = await this.processEmail(email);
                    processedEmails.push(processedEmail);
                    logger.info(`Gmail Service: Successfully processed email UID ${uid} with subject "${processedEmail.subject}".`);
                } catch (error) {
                    logger.error(`Gmail Service: Failed to process email UID ${uid}.`, { error });
                }
            }

            return processedEmails;
        } catch (error) {
            logger.error("Gmail Service: A critical error occurred during the email check cycle.", { error });
            // Re-throw to allow the main loop to handle reconnection logic.
            throw error;
        }
    }

    /**
     * Gracefully disconnects from the IMAP server.
     */
    disconnect() {
        if (this.imap && this.isConnected) {
            this.imap.end();
        }
    }

    /**
     * Cleans up old attachments from the attachments directory.
     * @param {number} [daysToKeep=7] - The number of days to keep attachment files.
     * @returns {Promise<void>}
     */
    async cleanupAttachments(daysToKeep = 7) {
        try {
            const files = await fs.readdir(this.attachmentsDir);
            const now = Date.now();
            const cutoffTime = daysToKeep * 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filepath = path.join(this.attachmentsDir, file);
                const stats = await fs.stat(filepath);

                // If the file is older than the cutoff time, delete it.
                if (now - stats.mtimeMs > cutoffTime) {
                    await fs.unlink(filepath);
                    logger.info(`Gmail Service: Deleted old attachment: "${file}"`);
                }
            }
        } catch (error) {
            // Log errors but don't throw, as cleanup is a non-critical background task.
            logger.error("Gmail Service: Failed to cleanup old attachments.", { error });
        }
    }
}

module.exports = GmailService;