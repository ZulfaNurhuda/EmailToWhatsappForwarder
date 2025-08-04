/**
 * @file Manages all interactions with the Green API for sending WhatsApp messages.
 * @module services/whatsappService
 * @requires axios
 * @requires form-data
 * @requires fs
 * @requires path
 * @requires ../utils/config
 * @requires ../utils/logger
 * @requires ../utils/formatter
 * @requires ../utils/helpers
 */

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const { config } = require("../utils/config");
const logger = require("../utils/logger");
const { formatImagePlaceholders, formatFileSize, stripHtml } = require("../utils/formatter");
const { delay } = require("../utils/helpers");

/**
 * @class WhatsAppService
 * @description Handles the formatting and sending of messages and files via the Green API.
 */
class WhatsAppService {
    /**
     * Initializes a new instance of the WhatsAppService, setting up API clients.
     */
    constructor() {
        /** @type {string} The Green API instance ID. */
        this.idInstance = config.greenApi.idInstance;
        /** @type {string} The Green API instance token. */
        this.apiToken = config.greenApi.apiToken;

        /**
         * @type {axios.AxiosInstance}
         * An Axios client for standard JSON-based API calls (e.g., sending text messages).
         */
        this.apiClient = axios.create({
            baseURL: `${config.greenApi.baseUrl}/waInstance${this.idInstance}`,
            timeout: 30000, // 30-second timeout for standard requests
            headers: { "Content-Type": "application/json" },
        });

        /**
         * @type {axios.AxiosInstance}
         * An Axios client specifically for media uploads, which use multipart/form-data.
         */
        this.mediaApiClient = axios.create({
            baseURL: `${config.greenApi.mediaUrl}/waInstance${this.idInstance}`,
            timeout: 60000, // 60-second timeout to accommodate larger file uploads
        });
    }

    /**
     * Formats a standard phone number into the WhatsApp-specific format (e.g., "6281234567890@c.us").
     * @param {string} phoneNumber - The phone number to format.
     * @returns {string} The formatted WhatsApp chat ID.
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-numeric characters.
        let cleaned = phoneNumber.replace(/\D/g, "");

        // If the number starts with '0', replace it with the country code (assuming '62' for Indonesia).
        if (cleaned.startsWith("0")) {
            cleaned = "62" + cleaned.substring(1);
        }

        // Append the standard WhatsApp suffix for user chats.
        return cleaned + "@c.us";
    }

    /**
     * Checks the authorization status of the Green API instance.
     * @returns {Promise<object>} A promise that resolves with the instance status data.
     */
    async checkStatus() {
        try {
            const response = await this.apiClient.get(
                `/getStateInstance/${this.apiToken}`,
            );
            logger.info("WhatsApp Service: Instance status checked successfully.", {
                status: response.data,
            });
            return response.data;
        } catch (error) {
            logger.error("WhatsApp Service: Failed to check instance status.", {
                message: error.message,
            });
            throw error; // Propagate the error for handling in the main application loop.
        }
    }

    /**
     * Sends a plain text message to a specified recipient.
     * @param {string} recipient - The recipient's phone number.
     * @param {string} message - The text message to send.
     * @returns {Promise<object>} A promise that resolves with the API response.
     */
    async sendTextMessage(recipient, message) {
        try {
            const formattedRecipient = this.formatPhoneNumber(recipient);
            const response = await this.apiClient.post(
                `/sendMessage/${this.apiToken}`,
                {
                    chatId: formattedRecipient,
                    message: message,
                },
            );
            logger.info(
                `WhatsApp Service: Text message sent successfully to ${recipient}.`,
            );
            return response.data;
        } catch (error) {
            logger.error(
                `WhatsApp Service: Failed to send text message to ${recipient}.`,
                { message: error.message },
            );
            throw error;
        }
    }

    /**
     * Uploads and sends a file (document, image, etc.) to a specified recipient.
     * @param {string} recipient - The recipient's phone number.
     * @param {string} filePath - The local path to the file to be sent.
     * @param {string} caption - The caption to send along with the file.
     * @param {string} filename - The original name of the file.
     * @returns {Promise<object>} A promise that resolves with the API response.
     */
    async sendFile(recipient, filePath, caption, filename) {
        try {
            const formattedRecipient = this.formatPhoneNumber(recipient);

            // Use FormData to construct a multipart/form-data request.
            const form = new FormData();
            form.append("chatId", formattedRecipient);
            form.append("file", fs.createReadStream(filePath));
            form.append("caption", caption || "");
            form.append("fileName", filename);

            const response = await this.mediaApiClient.post(
                `/sendFileByUpload/${this.apiToken}`,
                form,
                { headers: form.getHeaders() }, // Let FormData set the correct headers.
            );

            logger.info(
                `WhatsApp Service: File sent successfully to ${recipient}: ${filename}`,
            );
            return response.data;
        } catch (error) {
            logger.error(`WhatsApp Service: Failed to send file.`, {
                message: error.message,
                fileName: filename,
                recipient: recipient,
            });
            throw error;
        }
    }

    /**
     * Formats and forwards a processed email data object to the target WhatsApp number.
     * @param {object} emailData - The processed email data from GmailService.
     * @returns {Promise<void>}
     */
    async forwardEmail(emailData) {
        try {
            const separator = "───";

            // --- Assemble the main message body ---
            const header = `⌬  >>  𝗘𝗠𝗔𝗜𝗟 𝗙𝗢𝗥𝗪𝗔𝗥𝗗𝗘𝗥`;
            const infoHeader = `*ℹ️ - EMAIL INFORMATION*`;
            const from = `*From:* ${emailData.from}`;
            const date = `*Date:* ${new Date(emailData.date).toLocaleString()}`;
            const contentHeader = `*📝 - EMAIL CONTENT*`;
            const subject = `*Subject:* ${emailData.subject}`;
            let rawBodyText;
            if (emailData.text) {
                rawBodyText = emailData.text;
            } else if (emailData.html) {
                rawBodyText = stripHtml(emailData.html);
            } else {
                rawBodyText = '';
            }
            const body = formatImagePlaceholders(rawBodyText);

            // --- Attachment Information ---
            const totalAttachments = (emailData.attachments?.length || 0) + (emailData.skippedAttachments?.length || 0);
            let attachmentText = "";
            if (totalAttachments > 0) {
                attachmentText = `*📎 Attachments (${emailData.attachments.length} sent, ${emailData.skippedAttachments.length} skipped)*`;
            }

            // --- Construct the final message ---
            let message = `${header}\n\n${separator}\n\n${infoHeader}\n\n${from}\n${date}\n\n${separator}\n\n${contentHeader}\n\n${subject}\n\n${body}`;
            if (attachmentText) {
                message += `\n${separator}\n\n${attachmentText}`;
            }

            // Send the consolidated text message.
            await this.sendTextMessage(config.whatsapp.targetNumber, message);

            // --- Send Attachments ---
            for (const attachment of emailData.attachments) {
                try {
                    const caption = `📄 ${attachment.filename}\n💾 Size: ${formatFileSize(attachment.size)}`;
                    await this.sendFile(
                        config.whatsapp.targetNumber,
                        attachment.filepath,
                        caption,
                        attachment.filename,
                    );
                    await delay(2000); // Add a delay to avoid rate-limiting issues.
                } catch (error) {
                    logger.error(`WhatsApp Service: Failed to send attachment.`, {
                        message: error.message,
                        fileName: attachment.filename,
                    });
                    // Send a failure notification to WhatsApp for the specific attachment.
                    const errorMessage = `❌ Failed to send attachment: ${attachment.filename}`;
                    await this.sendTextMessage(config.whatsapp.targetNumber, errorMessage);
                }
            }

            // --- Notify about Skipped Attachments ---
            if (emailData.skippedAttachments.length > 0) {
                let skippedMessage = "*⚠️ Skipped Attachments:*\n";
                for (const skipped of emailData.skippedAttachments) {
                    skippedMessage += `- ${skipped.filename} (${formatFileSize(skipped.size)}) - ${skipped.reason}\n`;
                }
                await this.sendTextMessage(config.whatsapp.targetNumber, skippedMessage.trim());
                await delay(1000);
            }

            logger.info(`WhatsApp Service: Email with subject "${emailData.subject}" was forwarded successfully.`);
        } catch (error) {
            logger.error(`WhatsApp Service: Failed to forward email with subject "${emailData.subject}".`, { error });
            throw error;
        }
    }

    /**
     * Sends a simple notification message to the configured target number.
     * @param {string} message - The notification message to send.
     * @returns {Promise<object>} A promise that resolves with the API response.
     */
    async sendNotification(message) {
        return this.sendTextMessage(config.whatsapp.targetNumber, message);
    }

    /**
     * Tests the connection to the WhatsApp API by checking the instance status.
     * Sends a success or failure notification.
     * @returns {Promise<boolean>} A promise that resolves with `true` if authorized, otherwise `false`.
     */
    async testConnection() {
        try {
            const status = await this.checkStatus();
            if (status.stateInstance === "authorized") {
                logger.info("WhatsApp Service: Connection test successful. Instance is authorized.");
                await this.sendNotification("✅ Email to WhatsApp Forwarder is connected and running!");
                return true;
            } else {
                logger.error("WhatsApp Service: Connection test failed. Instance is not authorized.", { status: status.stateInstance });
                await this.sendNotification("❌ Email to WhatsApp Forwarder connection failed. Instance is not authorized.");
                return false;
            }
        } catch (error) {
            logger.error("WhatsApp Service: Connection test failed with an error.", { error });
            // Avoid sending a notification here as the failure might be related to sending messages itself.
            return false;
        }
    }
}

module.exports = WhatsAppService;