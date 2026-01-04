const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const { google } = require('googleapis');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// ============ WEBHOOK VERIFICATION ============
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
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
      
      for (const message of messages) {
        const sender = message.from;
        const messageText = message.text?.body || '';
        const messageId = message.id;

        console.log(`Message from ${sender}: ${messageText}`);
        
        // Process the message (language detection, AI response, lead scoring)
        await processMessage(sender, messageText, messageId);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// ============ MESSAGE PROCESSING ============
async function processMessage(phoneNumber, messageText, messageId) {
  try {
    // 1. Detect language
    const language = detectLanguage(messageText);
    
    // 2. Get AI response based on language
    const aiResponse = await getAIResponse(messageText, language);
    
    // 3. Extract lead info and score
    const leadScore = extractLeadInfo(messageText, aiResponse, language);
    
    // 4. Send response back to WhatsApp
    await sendWhatsAppMessage(phoneNumber, aiResponse);
    
    // 5. Save to Google Sheets if qualified
    if (leadScore >= 50) {
      await saveLeadToSheets(phoneNumber, messageText, leadScore, language);
    }
    
  } catch (error) {
    console.error('Error processing message:', error);
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

// ============ AI RESPONSE GENERATION ============
async function getAIResponse(userMessage, language) {
  try {
    const systemPrompts = {
      'en': 'You are a helpful sales assistant for Priyadarshini Filaments. Be professional and conversational. Ask about their product interest and farming needs.',
      'hi': 'आप Priyadarshini Filaments के लिए एक सहायक विक्रय प्रतिनिधि हैं। पेशेदार और बातचीत करने वाले बनें। उनके उत्पाद की रुचि और कृषि आवश्यकताओं के बारे में पूछें।',
      'kn': 'ನೀವು Priyadarshini Filaments ಗಾಗಿ ಸಹಾಯಕ ಮಾರಾಟ ಪ್ರತಿನಿಧಿ. ವೃत್ತಿಪರ ಮತ್ತು ಸಂವಾದಾತ್ಮಕವಾಗಿ ಇರಿ. ಅವರ ಉತ್ಪನ್ನ ಆಸಕ್ತಿ ಮತ್ತು ಕೃಷಿ ಅಗತ್ಯತೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ.',
      'ta': 'நீங்கள் Priyadarshini Filaments க்கான உதவிக் கொடுக்கும் விற்பனை பிரতிநிதி. পொறுமையுள்ள மற்றும் உரையாடல் நிலையில் இருக்கவும். அவர்களின் பொருட்களை ஆர்வத்திற்கும் விவசாய தேவைகளைப் பற்றிக் கேளுங்கள்.',
      'te': 'మీరు Priyadarshini Filaments కోసం సహాయక విక్రయ ప్రతినిధి. నిపుణమైన మరియు సంభాషణ కలిగిఉండండి. వారి ఉత్పత్తి ఆసక్తి మరియు వ్యవసాయ అవసరాల గురించి అడగండి.'
    };
    
    // Mock response (in production, call OpenAI API)
    const mockResponses = {
      'en': 'Hello! Thank you for your interest in Priyadarshini Filaments. What type of agricultural products are you interested in? We offer Agrotech, Hometech, Aquatech, Indutech, Packtech, and more.',
      'hi': 'नमस्ते! Priyadarshini Filaments में आपकी रुचि के लिए धन्यवाद। आप किस प्रकार के कृषि उत्पादों में रुचि रखते हैं?',
      'kn': 'ಹಲೋ! Priyadarshini Filaments ಗೆ ಆಸಕ್ತಿ ತೋರಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.',
      'ta': 'வணக்கம்! Priyadarshini Filaments ல் உங்கள் ஆர்வத்திற்கு நன்றி.',
      'te': 'హలో! Priyadarshini Filaments ప్రति మీ ఆసక్తికి ధన్యవాదాలు.'
    };
    
    return mockResponses[language] || mockResponses['en'];
  } catch (error) {
    console.error('AI Response Error:', error);
    return 'Sorry, I could not process your message. Please try again.';
  }
}

// ============ LEAD SCORING ============
function extractLeadInfo(message, aiResponse, language) {
  let score = 10; // Base score
  
  // Increase score based on product keywords
  const productKeywords = {
    'agrotech': 20, 'hometech': 20, 'aquatech': 20, 
    'indutech': 20, 'packtech': 20, 'weed': 15, 'mulch': 15,
    'farm': 10, 'agriculture': 15, 'crop': 15
  };
  
  const messageLower = message.toLowerCase();
  for (const [keyword, points] of Object.entries(productKeywords)) {
    if (messageLower.includes(keyword)) score += points;
  }
  
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
    
    console.log('Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error);
  }
}

// ============ SAVE TO GOOGLE SHEETS ============
async function saveLeadToSheets(phoneNumber, message, score, language) {
  try {
    // This requires Google Sheets API setup
    // For now, logging the data
    console.log(`Lead saved: ${phoneNumber}, Score: ${score}, Language: ${language}`);
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
  }
}

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`\n✅ WhatsApp Bot Backend started on http://localhost:${PORT}`);
  console.log('📡 Webhook URL: /webhook');
  console.log('❤️  Health check: /health\n');
});

module.exports = app;
