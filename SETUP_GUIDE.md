# Priyafil Backend - Complete Setup Guide

## Overview
This is a WhatsApp-powered AI lead qualification backend for Priyadarshini Filaments. It handles multi-language conversations, lead scoring, Google Sheets integration, and call scheduling.

## Prerequisites
- Node.js >= 18.0.0
- npm (comes with Node.js)
- Git
- WhatsApp Business Account
- OpenAI or Claude API key
- Google Cloud Project with Sheets API enabled

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/Karan-EMS/priyafil-backend.git
cd priyafil-backend
```

### 2. Install Dependencies
```bash
npm install
```

This will install:
- **express** - Web server framework
- **dotenv** - Environment variables management
- **axios** - HTTP client for API calls
- **googleapis** - Google Sheets API

### 3. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` file and add your credentials:

#### WhatsApp Configuration
- `WHATSAPP_API_URL` - Meta Graph API endpoint
- `WHATSAPP_ACCESS_TOKEN` - Your access token from Meta Business Suite
- `PHONE_NUMBER_ID` - Your WhatsApp phone number ID
- `BUSINESS_ACCOUNT_ID` - Your business account ID
- `WEBHOOK_VERIFY_TOKEN` - Any string you create (use for webhook verification)

#### AI Configuration
Choose ONE:
- `OPENAI_API_KEY` - For GPT-4 / GPT-3.5
- OR `CLAUDE_API_KEY` - For Claude

#### Google Sheets
- `GOOGLE_SHEETS_SPREADSHEET_ID` - Your spreadsheet ID
- `GOOGLE_SERVICE_ACCOUNT_JSON` - Path to service account JSON file

### 4. Get WhatsApp Credentials
1. Go to [Meta Business Suite](https://business.facebook.com)
2. Navigate to WhatsApp > Get Started
3. Create a WhatsApp Business Account
4. Get your phone number ID, business account ID, and access token
5. Set up webhook: `https://your-domain.com/webhook`
6. Webhook verify token: Use the token you set in .env

### 5. Set Up OpenAI / Claude API
**For OpenAI:**
1. Visit [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Add to .env as `OPENAI_API_KEY`

**For Claude:**
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Add to .env as `CLAUDE_API_KEY`

### 6. Set Up Google Sheets API
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Sheets API
4. Create Service Account credentials
5. Download JSON key file
6. Share your spreadsheet with the service account email
7. Update .env with spreadsheet ID and JSON path

### 7. Start the Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will run on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```
Returns: `{ status: 'Server is running' }`

### Webhook Verification
```
GET /webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
```
Required for WhatsApp webhook setup.

### Receive Messages
```
POST /webhook
Content-Type: application/json
```

WhatsApp will POST messages here automatically.

## Supported Languages
- English (en)
- Hindi (hi)
- Kannada (kn)
- Tamil (ta)
- Telugu (te)

Language is auto-detected based on message content.

## Features Implemented

✅ **Message Receiving** - Webhook endpoint for WhatsApp messages
✅ **Multi-Language Support** - Auto-detect & respond in 5 Indian languages
✅ **Lead Scoring** - Automatic qualification based on keywords
✅ **WhatsApp Integration** - Send responses back to customers
✅ **Error Handling** - Graceful fallbacks for API failures

## Features To-Do
- [ ] Google Sheets real-time storage
- [ ] Call scheduling & calendar sync
- [ ] OpenAI/Claude AI integration
- [ ] Translation API integration
- [ ] Database (MongoDB/MySQL) support
- [ ] Analytics & reporting

## Troubleshooting

### Server won't start
```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Webhook not receiving messages
1. Verify webhook URL is accessible from internet
2. Check webhook token matches in .env
3. WhatsApp business account is active
4. Phone number is registered

### Missing credentials error
1. Check .env file exists in root directory
2. All required variables are set
3. No typos in variable names

## Deployment

### Heroku
```bash
heroku login
heroku create your-app-name
git push heroku main
heroku config:set WHATSAPP_ACCESS_TOKEN=your_token
# Set all other env vars
```

### AWS / Azure / GCP
Update environment variables in your cloud platform's console.

## Support & Contact
For issues or questions, contact the Priyadarshini Filaments development team.
