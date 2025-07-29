# **🚀・Email to WhatsApp Forwarder**

### **Ever wanted your important emails to pop up right in your WhatsApp? Now they can! ✨**

Welcome to the Email to WhatsApp Forwarder! This application is your personal assistant, automatically monitoring your Gmail account for important emails from specific people and instantly forwarding them to you on WhatsApp. It's perfect for staying on top of urgent messages, whether it's from your boss, your clients, or your mom!

---

### **📋・Table of Contents**

- **✨・[What is This?](#what-is-this)**
- **🛠️・[Getting Started](#getting-started)**
- **⚙️・[Configuration](#configuration)**
- **🗺️・[How to Use](#how-to-use)**
- **💖・[Contributing](#contributing)**
- **📜・[License](#license)**
- **👋・[About Me!](#about-me)**

---

### <div id="what-is-this">**✨・What is This?**</div>

The Email to WhatsApp Forwarder is a powerful Node.js application that connects to your Gmail account, watches for new emails from senders you specify, and forwards them directly to your WhatsApp number using the Green API. It handles text, HTML, and even attachments, so you never miss a beat!

--- 

### <div id="getting-started">**🛠️・Getting Started (Let's Get This Running! 🎉)**</div>

Ready to get instant email notifications on WhatsApp? Here’s how to set it up:

1.  **Clone the magic!** ✨
    
    ```bash
    git clone https://github.com/afluz/EmailToWhatsappForwarder.git
    cd EmailToWhatsappForwarder
    ```

2.  **Install the dependencies!** 📦
    
    ```bash
    npm install
    ```

3.  **Set up your environment!** 🔑
    
    Copy the example environment file:
    
    ```bash
    cp .env.example .env.local
    ```
    
    Now, open the `.env.local` file and fill in your details. See the [Configuration](#configuration) section for more info.


---

### <div id="configuration">**⚙️・Configuration (The Nitty-Gritty Details!)**</div>

To get the forwarder working, you need to provide some key pieces of information in the `.env.local` file.

#### **Gmail Setup (IMAP)**

-   `GMAIL_USER`: Your full Gmail address (e.g., `your.email@gmail.com`).
-   `GMAIL_APP_PASSWORD`: A 16-character App Password for your Gmail account. **Do not use your regular password.**
    -   **How to get an App Password:**
        1.  Go to your [Google Account](https://myaccount.google.com/).
        2.  Navigate to **Security** > **2-Step Verification** (you must have this enabled).
        3.  At the bottom, click on **App passwords**.
        4.  Select "Mail" for the app and "Other (Custom name)" for the device, give it a name (e.g., "WhatsApp Forwarder"), and click **Generate**.
        5.  Copy the 16-character password and paste it into your `.env.local` file.

#### **Green API Setup**

-   `GREEN_API_ID_INSTANCE`: Your instance ID from Green API.
-   `GREEN_API_TOKEN`: Your API token from Green API.
    -   **How to get Green API credentials:**
        1.  Sign up or log in at [Green API](https://green-api.com/).
        2.  Create a new instance and connect your WhatsApp number by scanning the QR code.
        3.  You'll find the `idInstance` and `apiTokenInstance` on your instance dashboard.

#### **Forwarding Rules**

-   `SENDER_EMAIL_FILTER`: The email address(es) you want to forward from. For multiple emails, separate them with a comma (e.g., `boss@work.com,client@company.com`).
-   `WHATSAPP_TARGET_NUMBER`: The WhatsApp number where you want to receive the forwarded emails (e.g., `6281234567890`).

--- 

### <div id="how-to-use">**🗺️・How to Use (Start the Magic! 🚀)**</div>

Once everything is configured, starting the forwarder is simple:

```bash
npm start
```

Or, for development with automatic restarting when you make changes:

```bash
npm run dev
```

The application will start, test its connections, and begin monitoring your inbox. When a new email arrives from one of your specified senders, it will be beautifully formatted and sent to your WhatsApp!

--- 

### <div id="contributing">**💖・Contributing (Join the Fun! 🎉)**</div>

Have an idea to make this even better? Found a bug? We'd love your help! Check out our `CONTRIBUTING.md` file for guidelines on how to contribute.

--- 

### <div id="license">**📜・License (The Legal Stuff, but Friendly! 🤝)**</div>

This project is open-source and distributed under the MIT License. Feel free to use, modify, and share it! See the `LICENSE` file for more details.

---

### <div id="about-me">**👋・About Me!**</div>

**Muhammad Zulfa Fauzan Nurhuda**

A passionate developer who loves building cool and useful things. Let's connect!

<img src="https://i.imgur.com/Zp8msEG.png" alt="Logo ITB" height="90" style="border-radius: 10px">
