/**
 * WhatsApp Service Module using Green API
 * @module services/whatsappService
 */

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { config } = require("../utils/config");
const logger = require("../utils/logger");
const { stripHtml, formatFileSize } = require("../utils/formatter");
const { delay } = require("../utils/helpers");

/**
 * WhatsApp Service Class for sending messages via Green API
 */
class WhatsAppService {
    /**
     * Creates an instance of WhatsAppService
     */
    constructor() {
        this.baseUrl = config.greenApi.baseUrl;
        this.idInstance = config.greenApi.idInstance;
        this.apiToken = config.greenApi.apiToken;
        this.apiClient = this.createApiClient();
    }

    /**
     * Creates an axios instance with default configuration
     * @returns {Object} Axios instance
     */
    createApiClient() {
        return axios.create({
            baseURL: `${this.baseUrl}/waInstance${this.idInstance}`,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * Formats phone number for WhatsApp API
     * @param {string} phoneNumber - Phone number to format
     * @returns {string} Formatted phone number
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-numeric characters
        let cleaned = phoneNumber.replace(/\D/g, "");

        // Add country code if not present (assuming Indonesia)
        if (cleaned.startsWith("0")) {
            cleaned = "62" + cleaned.substring(1);
        }

        // Add WhatsApp suffix
        return cleaned + "@c.us";
    }

    /**
     * Checks the status of WhatsApp instance
     * @returns {Promise<Object>} Instance status
     */
    async checkStatus() {
        try {
            const response = await this.apiClient.get(
                `/getStateInstance/${this.apiToken}`,
            );
            logger.info("WhatsApp Service: Instance status checked successfully.", { status: response.data });
            return response.data;
        } catch (error) {
            logger.error("WhatsApp Service: Failed to check instance status.", { message: error.message });
            throw error;
        }
    }

    /**
     * Sends a text message via WhatsApp
     * @param {string} recipient - Recipient phone number
     * @param {string} message - Message text
     * @returns {Promise<Object>} API response
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

            logger.info(`WhatsApp Service: Text message sent successfully to ${recipient}.`);
            return response.data;
        } catch (error) {
            logger.error(`WhatsApp Service: Failed to send text message to ${recipient}.`, { message: error.message });
            throw error;
        }
    }

    /**
     * Sends a file via WhatsApp
     * @param {string} recipient - Recipient phone number
     * @param {string} filePath - Path to the file
     * @param {string} caption - File caption
     * @param {string} filename - Original filename
     * @returns {Promise<Object>} API response
     */
    async sendFile(recipient, filePath, caption, filename) {
        try {
            const formattedRecipient = this.formatPhoneNumber(recipient);

            // Read file as base64
            const fileBuffer = fs.readFileSync(filePath);
            const base64File = fileBuffer.toString("base64");

            const response = await this.apiClient.post(
                `/sendFileByUpload/${this.apiToken}`,
                {
                    chatId: formattedRecipient,
                    file: base64File,
                    fileName: filename,
                    caption: caption || "",
                },
            );

            logger.info(`WhatsApp Service: File sent successfully to ${recipient}: ${filename}`);
            return response.data;
        } catch (error) {
            logger.error(`WhatsApp Service: Failed to send file ${filename} to ${recipient}.`, { message: error.message });
            throw error;
        }
    }

    /**
     * Sends an image via WhatsApp
     * @param {string} recipient - Recipient phone number
     * @param {string} imagePath - Path to the image
     * @param {string} caption - Image caption
     * @returns {Promise<Object>} API response
     */
    async sendImage(recipient, imagePath, caption) {
        try {
            const formattedRecipient = this.formatPhoneNumber(recipient);

            // Read image as base64
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString("base64");

            const response = await this.apiClient.post(
                `/sendFileByUpload/${this.apiToken}`,
                {
                    chatId: formattedRecipient,
                    file: base64Image,
                    fileName: path.basename(imagePath),
                    caption: caption || "",
                },
            );

            logger.info(`WhatsApp Service: Image sent successfully to ${recipient}.`);
            return response.data;
        } catch (error) {
            logger.error(`WhatsApp Service: Failed to send image to ${recipient}.`, { message: error.message });
            throw error;
        }
    }

    /**
     * Forwards an email to WhatsApp
     * @param {Object} emailData - Processed email data
     * @returns {Promise<void>}
     */
    async forwardEmail(emailData) {
        try {
            // Prepare the message
            const header = `📧 *Email Forward*\n`;
            const from = `*From:* ${emailData.from}\n`;
            const to = `*To:* ${emailData.to}\n`;
            const subject = `*Subject:* ${emailData.subject}\n`;
            const date = `*Date:* ${
                new Date(emailData.date).toLocaleString()
            }\n`;
            const separator = `${"─".repeat(30)}\n`;

            // Use text content, fallback to HTML if text is empty
            const content = emailData.text || stripHtml(emailData.html);

            const message =
                `${header}${from}${to}${subject}${date}${separator}\n${content}`;

            // Send the main message
            await this.sendTextMessage(config.whatsapp.targetNumber, message);

            // Send attachments if any
            const totalAttachments = (emailData.attachments?.length || 0) + (emailData.skippedAttachments?.length || 0);
            if (totalAttachments > 0) {
                const attachmentHeader =
                    `📎 *Attachments (${emailData.attachments.length} sent, ${emailData.skippedAttachments.length} skipped)*`;
                await this.sendTextMessage(
                    config.whatsapp.targetNumber,
                    attachmentHeader,
                );

                for (const attachment of emailData.attachments) {
                    try {
                        const caption = `📄 ${attachment.filename}\n💾 Size: ${
                            formatFileSize(attachment.size)
                        }`;

                        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
                        const isImage = imageExtensions.some((ext) =>
                            attachment.filename.toLowerCase().endsWith(ext)
                        );

                        if (isImage) {
                            await this.sendImage(
                                config.whatsapp.targetNumber,
                                attachment.filepath,
                                caption,
                            );
                        } else {
                            await this.sendFile(
                                config.whatsapp.targetNumber,
                                attachment.filepath,
                                caption,
                                attachment.filename,
                            );
                        }

                        await delay(2000);
                    } catch (error) {
                        logger.error(`Failed to send attachment ${attachment.filename}:`, error);
                        const errorMessage = `❌ Failed to send attachment: ${attachment.filename}`;
                        await this.sendTextMessage(config.whatsapp.targetNumber, errorMessage);
                    }
                }

                // Notify about skipped attachments
                for (const skipped of emailData.skippedAttachments) {
                    const skippedMessage = `⚠️ Skipped attachment: ${skipped.filename} (${formatFileSize(skipped.size)}) - Reason: ${skipped.reason}`;
                    await this.sendTextMessage(config.whatsapp.targetNumber, skippedMessage);
                    await delay(1000);
                }
            }

            logger.info(`WhatsApp Service: Email with subject "${emailData.subject}" was forwarded successfully.`);
        } catch (error) {
            logger.error(`WhatsApp Service: Failed to forward email with subject "${emailData.subject}".`, error);
            throw error;
        }
    }


    /**
     * Sends a notification message
     * @param {string} message - Notification message
     * @returns {Promise<Object>} API response
     */
    async sendNotification(message) {
        return this.sendTextMessage(config.whatsapp.targetNumber, message);
    }

    /**
     * Tests the WhatsApp connection
     * @returns {Promise<boolean>} Connection status
     */
    async testConnection() {
        try {
            const status = await this.checkStatus();
            if (status.stateInstance === "authorized") {
                logger.info("WhatsApp Service: Connection test successful. Instance is authorized.");
                await this.sendNotification(
                    "✅ Email to WhatsApp Forwarder is connected and running!",
                );
                return true;
            } else {
                logger.error("WhatsApp Service: Connection test failed. Instance is not authorized.", { status: status.stateInstance });
                return false;
            }
        } catch (error) {
            logger.error("WhatsApp Service: Connection test failed with an error.", error);
            return false;
        }
    }
}

module.exports = WhatsAppService;
