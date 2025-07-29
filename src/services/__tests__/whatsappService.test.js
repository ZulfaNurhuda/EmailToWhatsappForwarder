const WhatsAppService = require('../whatsappService');
const axios = require('axios');
const fs = require('fs');
const { config } = require('../../utils/config');

// Mock axios
jest.mock('axios');

// Mock fs to avoid actual file operations
jest.mock('fs');

describe('WhatsAppService', () => {
    let whatsappService;
    // Increase timeout for tests involving delays
    jest.setTimeout(15000);

    beforeEach(() => {
        // Reset mocks before each test
        axios.create.mockReturnThis();
        axios.post.mockReset();
        axios.get.mockReset();
        fs.readFileSync.mockReset();

        whatsappService = new WhatsAppService();
    });

    describe('Initialization', () => {
        it('should create an axios instance with the correct base URL', () => {
            expect(axios.create).toHaveBeenCalledWith({
                baseURL: `${config.greenApi.baseUrl}/waInstance${config.greenApi.idInstance}`,
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' },
            });
        });
    });

    describe('formatPhoneNumber', () => {
        it('should format Indonesian numbers correctly', () => {
            expect(whatsappService.formatPhoneNumber('081234567890')).toBe('6281234567890@c.us');
        });

        it('should handle numbers that already have country code', () => {
            expect(whatsappService.formatPhoneNumber('6281234567890')).toBe('6281234567890@c.us');
        });

        it('should remove non-numeric characters', () => {
            expect(whatsappService.formatPhoneNumber('+62 812-3456-7890')).toBe('6281234567890@c.us');
        });
    });

    describe('sendTextMessage', () => {
        it('should send a text message successfully', async () => {
            const recipient = '081234567890';
            const message = 'Hello World';
            const formattedRecipient = '6281234567890@c.us';

            axios.post.mockResolvedValue({ data: { idMessage: 'some-id' } });

            await whatsappService.sendTextMessage(recipient, message);

            expect(axios.post).toHaveBeenCalledWith(
                `/sendMessage/${config.greenApi.apiToken}`,
                {
                    chatId: formattedRecipient,
                    message: message,
                }
            );
        });

        it('should throw an error if sending fails', async () => {
            axios.post.mockRejectedValue(new Error('API Error'));
            await expect(whatsappService.sendTextMessage('08123', 'test')).rejects.toThrow('API Error');
        });
    });

    describe('sendFile', () => {
        it('should send a file successfully', async () => {
            const recipient = '081234567890';
            const filePath = '/path/to/file.pdf';
            const caption = 'Test file';
            const filename = 'file.pdf';

            fs.readFileSync.mockReturnValue(Buffer.from('file content'));
            axios.post.mockResolvedValue({ data: { idMessage: 'file-id' } });

            await whatsappService.sendFile(recipient, filePath, caption, filename);

            expect(fs.readFileSync).toHaveBeenCalledWith(filePath);
            expect(axios.post).toHaveBeenCalledWith(
                `/sendFileByUpload/${config.greenApi.apiToken}`,
                expect.objectContaining({
                    fileName: filename,
                    caption: caption,
                })
            );
        });
    });

    describe('forwardEmail', () => {
        const emailData = {
            from: 'sender@example.com',
            to: 'receiver@example.com',
            subject: 'Test Email',
            date: new Date().toISOString(),
            text: 'This is the email body.',
            html: '<p>This is the email body.</p>',
            attachments: [
                {
                    filename: 'document.pdf',
                    filepath: '/path/to/document.pdf',
                    size: 12345,
                },
                {
                    filename: 'image.png',
                    filepath: '/path/to/image.png',
                    size: 54321,
                },
            ],
            skippedAttachments: [
                {
                    filename: 'large-file.zip',
                    size: 99999999,
                    reason: 'Exceeds size limit',
                },
            ],
        };

        beforeEach(() => {
            fs.readFileSync.mockReturnValue(Buffer.from('mock file content'));
            axios.post.mockResolvedValue({ data: {} }); // Mock successful send
        });

        it('should send the main email content', async () => {
            await whatsappService.forwardEmail(emailData);

            // Check that the main text message was sent
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendMessage/'),
                expect.objectContaining({
                    message: expect.stringContaining('*Subject:* Test Email'),
                })
            );
        });

        it('should send the attachment header', async () => {
            await whatsappService.forwardEmail(emailData);

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendMessage/'),
                expect.objectContaining({
                    message: '📎 *Attachments (2 sent, 1 skipped)*',
                })
            );
        });

        it('should attempt to send all valid attachments', async () => {
            await whatsappService.forwardEmail(emailData);

            // one call for main message, one for header, two for attachments, one for skipped
            // so, 2 calls to sendFileByUpload
            expect(axios.post).toHaveBeenCalledTimes(5);
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendFileByUpload/'),
                expect.objectContaining({ fileName: 'document.pdf' })
            );
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendFileByUpload/'),
                expect.objectContaining({ fileName: 'image.png' })
            );
        });

        it('should send a notification for skipped attachments', async () => {
            await whatsappService.forwardEmail(emailData);

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendMessage/'),
                expect.objectContaining({
                    message: expect.stringContaining('⚠️ Skipped attachment: large-file.zip'),
                })
            );
        });
    });
});
