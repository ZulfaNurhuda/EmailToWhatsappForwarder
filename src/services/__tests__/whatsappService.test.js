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
        fs.createReadStream.mockReset();

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

            fs.createReadStream.mockReturnValue(Buffer.from('file content'));
            axios.post.mockResolvedValue({ data: { idMessage: 'file-id' } });

            await whatsappService.sendFile(recipient, filePath, caption, filename);

            expect(fs.createReadStream).toHaveBeenCalledWith(filePath);
            expect(axios.post).toHaveBeenCalledWith(
                `/sendFileByUpload/${config.greenApi.apiToken}`,
                expect.any(Object), // FormData object
                expect.any(Object) // Headers
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
            fs.createReadStream.mockReturnValue(Buffer.from('mock file content'));
            axios.post.mockResolvedValue({ data: {} }); // Mock successful send
        });

        it('should send a single, formatted message for the email', async () => {
            await whatsappService.forwardEmail(emailData);

            const expectedMessage = `*📧 >> EMAIL TO WHATSAPP FORWARDER*\n\n───\n\n*ℹ️ - EMAIL INFORMATION*\n\n*From:* ${emailData.from}\n*To:* ${emailData.to}\n*Date:* ${new Date(emailData.date).toLocaleString()}\n\n───\n\n*📝 - EMAIL CONTENT*\n\n*Subject:* ${emailData.subject}\n\n${emailData.text}`;

            // Check that sendTextMessage was called for the main message
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendMessage/'),
                expect.objectContaining({
                    message: expect.stringContaining(expectedMessage)
                })
            );
        });

        

        it('should attempt to send all valid attachments and notify of skipped ones', async () => {
            await whatsappService.forwardEmail(emailData);

            // 1 call for the main message, 2 for attachments, 1 for skipped
            expect(axios.post).toHaveBeenCalledTimes(4);

            // Check that sendFile was called for each valid attachment
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendFileByUpload/'),
                expect.any(Object), // FormData
                expect.any(Object)  // Headers
            );

            // Check that a notification is sent for skipped attachments
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendMessage/'),
                expect.objectContaining({
                    message: expect.stringContaining('Skipped Attachments')
                })
            );
        });

        
    });
});
