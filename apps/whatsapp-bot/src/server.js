const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const express = require('express');
const { authenticate } = require('./auth.js');
const { handleMessage } = require('./handler.js');

const app = express();
const PORT = process.env.WHATSAPP_BOT_PORT || 3002;

// Twilio sends form-encoded POST
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ELIZA WhatsApp Bot running', timestamp: new Date() });
});

// Twilio webhook — incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  const from = req.body.From || '';       // "whatsapp:+905..."
  const body = req.body.Body || '';       // message text
  const profileName = req.body.ProfileName || '';

  console.log(`[${new Date().toISOString()}] Message from ${from} (${profileName}): ${body}`);

  // Authenticate
  const user = await authenticate(from);

  if (!user) {
    console.log(`Unauthorized: ${from}`);
    return sendTwiML(res, 'Bu numara ELIZA sistemine kayıtlı değil. Erişim reddedildi.');
  }

  if (user.blocked) {
    console.log(`Deactivated user: ${from}`);
    return sendTwiML(res, 'Erişiminiz devre dışı bırakıldı.');
  }

  console.log(`Authenticated: ${user.name} (${user.role})`);

  if (!body.trim()) {
    return sendTwiML(res, 'Boş mesaj. Soru sorun veya .help yazın.');
  }

  try {
    const response = await handleMessage(body, user);
    return sendTwiML(res, response);
  } catch (err) {
    console.error('Handler error:', err);
    return sendTwiML(res, 'İşlem sırasında hata oluştu. Lütfen tekrar deneyin.');
  }
});

// Also support GET for Twilio webhook verification
app.get('/webhook', (req, res) => {
  res.send('ELIZA WhatsApp Bot webhook active');
});

/**
 * Send TwiML response for Twilio.
 */
function sendTwiML(res, message) {
  // Truncate long messages (WhatsApp limit ~4096 chars)
  const truncated = message.length > 4000
    ? message.slice(0, 3950) + '\n\n... (mesaj kısaltıldı)'
    : message;

  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(truncated)}</Message>
</Response>`);
}

/**
 * Escape special XML characters.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.listen(PORT, () => {
  console.log(`ELIZA WhatsApp Bot running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`Configure Twilio sandbox to POST to: https://<your-domain>/webhook`);
});
