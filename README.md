# Email to WhatsApp Forwarder

A Node.js application that automatically forwards emails from Gmail to WhatsApp using the Green API. The application monitors a Gmail inbox for emails from specific senders and forwards their content along with attachments to a designated WhatsApp number.

## Features

- ✅ Automatic email monitoring with configurable intervals
- ✅ Sender email filtering
- ✅ Full email content forwarding (text and HTML)
- ✅ Attachment support with size limits
- ✅ Robust error handling and logging
- ✅ Graceful shutdown with notifications
- ✅ Automatic cleanup of old attachments
- ✅ Reconnection handling for network issues

## Prerequisites

Before you begin, ensure you have the following:

1. **Node.js** (v18.0.0 or higher) - [Download here](https://nodejs.org/)
2. **Git** - [Download here](https://git-scm.com/)
3. **Gmail Account** with:
   - 2-Factor Authentication enabled
   - App Password generated
4. **Green API Account** with:
   - Active instance
   - Valid API credentials
5. **WhatsApp** number connected to Green API

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/email-to-whatsapp-forwarder.git
cd email-to-whatsapp-forwarder
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your credentials:
   ```env
   # Gmail Configuration
   GMAIL_USER=abc123@gmail.com
   GMAIL_APP_PASSWORD=your_16_character_app_password
   
   # Email Filter Configuration
   SENDER_EMAIL_FILTER=test@gmail.com
   
   # Green API Configuration
   GREEN_API_ID_INSTANCE=your_instance_id
   GREEN_API_TOKEN=your_api_token
   
   # WhatsApp Configuration
   WHATSAPP_TARGET_NUMBER=082298765432
   ```

## Configuration

### Gmail App Password Setup

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to Security → 2-Step Verification
3. Enable 2-Step Verification if not already enabled
4. Go to App passwords
5. Select "Mail" and your device
6. Generate and copy the 16-character password
7. Use this password in your `.env` file

### Green API Setup

1. Sign up at [Green API](https://green-api.com/)
2. Create a new instance
3. Connect your WhatsApp number by scanning QR code
4. Copy your `idInstance` and `apiTokenInstance`
5. Add these to your `.env` file

### Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `CHECK_INTERVAL_SECONDS` | Email check interval | 30 |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | info |
| `MAX_ATTACHMENT_SIZE_MB` | Maximum attachment size | 25 |

## Usage

### Starting the Application

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

### What Happens Next

1. The application connects to Gmail via IMAP
2. Tests WhatsApp connection and sends a confirmation message
3. Starts monitoring for new emails every 30 seconds
4. When an email from the specified sender arrives:
   - Extracts the email content
   - Downloads any attachments
   - Forwards everything to the target WhatsApp number
   - Marks the email as read

### Message Format

Forwarded emails appear in WhatsApp as:

```
📧 Email Forward
From: test@gmail.com
To: abc123@gmail.com
Subject: Important Document
Date: 2025-01-15 10:30:00
──────────────────────────────

[Email content here]

📎 Attachments (2)
📄 document.pdf
💾 Size: 1.2 MB
```

## Logging

Logs are stored in the `logs/` directory:

- `combined.log` - All application logs
- `error.log` - Error logs only

Log files are automatically rotated when they reach 5MB, keeping the last 5 files.

## Troubleshooting

### Common Issues

#### Gmail Connection Failed

**Error**: `IMAP connection error: Invalid credentials`

**Solution**:
- Verify your Gmail address is correct
- Ensure you're using an App Password, not your regular password
- Check that IMAP is enabled in Gmail settings

#### WhatsApp Not Authorized

**Error**: `WhatsApp instance is not authorized`

**Solution**:
- Log into Green API dashboard
- Check if your instance is active
- Re-scan the QR code if needed
- Verify your API credentials

#### Attachments Not Sending

**Error**: `Failed to send attachment`

**Solution**:
- Check file size (default limit: 25MB)
- Ensure the file type is supported by WhatsApp
- Verify sufficient disk space for temporary storage

### Debug Mode

Enable debug logging for more detailed information:

```env
LOG_LEVEL=debug
```

## Project Structure

```
email-to-whatsapp-forwarder/
├── src/
│   ├── services/
│   │   ├── gmailService.js      # Gmail IMAP operations
│   │   └── whatsappService.js   # WhatsApp API operations
│   ├── utils/
│   │   ├── logger.js            # Winston logger configuration
│   │   └── config.js            # Environment configuration
│   └── app.js                   # Main application entry
├── logs/                        # Log files (auto-created)
├── attachments/                 # Temporary attachment storage
├── .env                         # Environment variables
├── .env.example                 # Example configuration
├── .gitignore                   # Git ignore rules
├── package.json                 # Project dependencies
├── README.md                    # This file
└── LICENSE                      # MIT License
```

## API Reference

### GmailService

```javascript
// Connect to Gmail IMAP server
await gmailService.connect();

// Check for new emails
const emails = await gmailService.checkEmails();

// Process email with attachments
const processedEmail = await gmailService.processEmail(rawEmail);
```

### WhatsAppService

```javascript
// Send text message
await whatsappService.sendTextMessage(recipient, message);

// Send file with caption
await whatsappService.sendFile(recipient, filepath, caption, filename);

// Forward complete email
await whatsappService.forwardEmail(emailData);
```

## Security Considerations

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use App Passwords** - More secure than regular passwords
3. **Limit attachment size** - Prevent memory issues
4. **Regular cleanup** - Attachments are deleted after 7 days
5. **Secure your server** - The app should run in a secure environment

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review logs in the `logs/` directory
- Open an issue on GitHub

## Acknowledgments

- [node-imap](https://github.com/mscdex/node-imap) - IMAP client
- [mailparser](https://github.com/nodemailer/mailparser) - Email parsing
- [Green API](https://green-api.com/) - WhatsApp API service
- [Winston](https://github.com/winstonjs/winston) - Logging library