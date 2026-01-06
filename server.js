const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const { google } = require('googleapis');
const OpenAI = require('openai');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());

// ============ ENVIRONMENT VARIABLES ============
const PORT = process.env.PORT || 3000;
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : null;

// ============ OPENAI CLIENT ============
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ============ GOOGLE SHEETS CLIENT ============
let sheets = null;
if (GOOGLE_CREDENTIALS) {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheets = google.sheets({ version: 'v4', auth });
}

// ============ WEBHOOK VERIFICATION ============
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// ============ WEBHOOK MESSAGE RECEIVER ============
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const messages = body.entry[0].changes[0].value.messages;
      const contacts = body.entry[0].changes[0].value.contacts || [];

      for (const message of messages) {
        const sender = message.from;
        const messageText = message.text?.body || '';
        const messageId = message.id;
        const senderName = contacts[0]?.profile?.name || sender;

        console.log(`📱 Message from ${senderName} (${sender}): ${messageText}`);

        // Process the message (language detection, AI response, lead scoring)
        await processMessage(sender, messageText, messageId, senderName);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// ============ MESSAGE PROCESSING ============
async function processMessage(phoneNumber, messageText, messageId, senderName) {
  try {
    // 1. Detect language
    const language = detectLanguage(messageText);
    console.log(`🌐 Detected Language: ${language}`);

    // 2. Get AI response from OpenAI
    const aiResponse = await getAIResponse(messageText, language, senderName);
    console.log(`🤖 AI Response: ${aiResponse}`);

    // 3. Extract lead info and score
    const leadScore = extractLeadInfo(messageText, aiResponse, language);
    console.log(`📊 Lead Score: ${leadScore}`);

    // 4. Send response back to WhatsApp
    await sendWhatsAppMessage(phoneNumber, aiResponse);

    // 5. Save to Google Sheets if qualified
    if (leadScore >= 50) {
      await saveLeadToSheets(phoneNumber, senderName, messageText, aiResponse, leadScore, language);
    }
  } catch (error) {
    console.error('❌ Error processing message:', error);
  }
}

// ============ LANGUAGE DETECTION ============
function detectLanguage(text) {
  const hindiPattern = /[\u0900-\u097F]/g;
  const kannadaPattern = /[\u0C80-\u0CFF]/g;
  const tamilPattern = /[\u0B80-\u0BFF]/g;
  const teluguPattern = /[\u0C00-\u0C7F]/g;

  if (hindiPattern.test(text)) return 'hi';
  if (kannadaPattern.test(text)) return 'kn';
  if (tamilPattern.test(text)) return 'ta';
  if (teluguPattern.test(text)) return 'te';

  return 'en'; // Default to English
}

// ============ AI RESPONSE GENERATION WITH OPENAI ============
async function getAIResponse(userMessage, language, senderName) {
  try {
    const systemPrompts = {
      'en': `You are a helpful sales assistant for Priyadarshini Filaments. You help customers with agricultural products including Agrotech, Hometech, Aquatech, Indutech, and Packtech. Be professional, conversational, and helpful. Ask about their needs and provide relevant product information. Keep responses concise (under 160 characters for WhatsApp).`,
      'hi': `आप Priyadarshini Filaments के लिए एक सहायक विक्रय प्रतिनिधि हैं। कृपया पेशेदार और मैत्रीपूर्ण रहें। उनके उत्पाद की रुचि और कृषि आवश्यकताओं के बारे में पूछें। संक्षिप्त उत्तर दें।`,
      'kn': `ನೀವು Priyadarshini Filaments ಗಾಗಿ ಸಹಾಯಕ ಮಾರಾಟ ಪ್ರತಿನಿಧಿ. ವೃತ್ತಿಪರ ಮತ್ತು ಸಹಾಯಕವಾಗಿ ಇರಿ. ಸಂಕ್ಷಿಪ್ತ ಉತ್ತರ ನೀಡಿ।`,
      'ta': `நீங்கள் Priyadarshini Filaments க்கான உதவிக் கொடுக்கும் விற்பனை பிரதிநிதி. தொழிலாக மற்றும் உரையாடல் நிலையில் இருக்கவும். சுருக்கமான பதில் கொடுக்கவும்।`,
      'te': `మీరు Priyadarshini Filaments కోసం సహాయక విక్రయ ప్రతినిధి. నిపుణమైన మరియు సంభాషణ కలిగిఉండండి. సంక్షిప్త సమాధానం ఇవ్వండి।`
    };

    const message = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemPrompts[language] || systemPrompts['en']
        },
        {
          role: 'user',
          content: `Customer name: ${senderName}\nMessage: ${userMessage}`
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return message.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ OpenAI Error:', error);
    return 'Thank you for your interest! Please share more details about your needs, and we\'ll help you find the perfect solution.';
  }
}

// ============ LEAD SCORING ============
function extractLeadInfo(message, aiResponse, language) {
  let score = 10; // Base score

  // Increase score based on product keywords
  const productKeywords = {
    'agrotech': 20, 'hometech': 20, 'aquatech': 20,
    'indutech': 20, 'packtech': 20, 'weed': 15, 'mulch': 15,
    'farm': 10, 'agriculture': 15, 'crop': 15,
    'விவசாய': 15, 'खेत': 15, 'ಕೃಷಿ': 15, 'కృషి': 15
  };

  const messageLower = message.toLowerCase();
  for (const [keyword, points] of Object.entries(productKeywords)) {
    if (messageLower.includes(keyword)) score += points;
  }

  // Bonus points for specific queries
  if (messageLower.includes('price') || messageLower.includes('cost')) score += 15;
  if (messageLower.includes('delivery') || messageLower.includes('shipping')) score += 10;
  if (messageLower.includes('bulk') || messageLower.includes('wholesale')) score += 20;

  return Math.min(score, 100);
}

// ============ SEND WHATSAPP MESSAGE ============
async function sendWhatsAppMessage(phoneNumber, messageText) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: {
          body: messageText
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
  }
}

// ============ SAVE TO GOOGLE SHEETS ============
async function saveLeadToSheets(phoneNumber, senderName, message, aiResponse, score, language) {
  try {
    if (!sheets || !GOOGLE_SHEETS_ID) {
      console.log('⚠️ Google Sheets not configured. Lead data logged instead.');
      console.log(`Lead: ${senderName} (${phoneNumber}), Score: ${score}, Language: ${language}`);
      return;
    }

    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: 'Leads!A:G',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [
            timestamp,
            senderName,
            phoneNumber,
            message,
            aiResponse,
            score,
            language
          ]
        ]
      }
    });

    console.log('✅ Lead saved to Google Sheets:', senderName);
  } catch (error) {
    console.error('❌ Error saving to Google Sheets:', error);
  }
}

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    webhook: 'Ready'
  });
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`\n✅ WhatsApp AI Backend started on http://localhost:${PORT}`);
  console.log('📡 Webhook URL: /webhook');
  console.log('❤️ Health check: /health\n');
});

module.exports = app;
