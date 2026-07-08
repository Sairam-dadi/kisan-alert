const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { recommendCrops } = require('./profitCalculator');
const { generateExplanation } = require('./explainer');
const { getWeatherAlert } = require('./weatherAlerts');
const { diagnoseCropImage } = require('./cropDiagnosis');
const { createEscalationTicket } = require('./supabaseAdmin');
const { sendSms, makeOutboundCall } = require('./smsService');
const voiceRoutes = require('./voiceRoutes');
const smsWebhookRoutes = require('./smsWebhook');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // required for Twilio webhooks
app.use(voiceRoutes);
app.use(smsWebhookRoutes);

/**
 * POST /recommend
 * body: {
 *   landArea: number,
 *   landAreaUnit: 'acres' | 'cents',
 *   soilType: string,
 *   landType: 'dryland' | 'wetland',
 *   waterAvailability: 'none' | 'low' | 'medium' | 'high',
 *   season: 'kharif' | 'rabi' | 'zaid',
 *   location: string,
 *   language: string (optional, default 'English')
 * }
 */
app.post('/recommend', async (req, res) => {
  try {
    const input = req.body;
    const required = ['landArea', 'landAreaUnit', 'soilType', 'landType', 'waterAvailability', 'season'];
    const missing = required.filter((key) => input[key] === undefined);

    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }

    const result = recommendCrops(input);

    if (!result.success) {
      return res.status(200).json(result);
    }

    let explanation;
    try {
      explanation = await generateExplanation(result.ranked, input.language || 'English');
    } catch (explainError) {
      // If Gemini/Vertex AI isn't configured yet (e.g. GCP_PROJECT_ID missing),
      // don't fail the whole request - surface the ranked data and flag the issue.
      explanation = null;
      console.error('Explanation generation failed:', explainError.message);
    }

    return res.status(200).json({
      ...result,
      explanation,
      explanationError: explanation ? undefined : 'Explanation service unavailable - check GEMINI_API_KEY (get a free key at https://aistudio.google.com/).',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /weather-alert?location=Visakhapatnam
 */
app.get('/weather-alert', async (req, res) => {
  const { location, phone } = req.query;

  if (!location) {
    return res.status(400).json({ success: false, error: 'Missing required query param: location' });
  }

  try {
    const alert = await getWeatherAlert(location);

    let smsResult = null;
    let smsError = null;

    if (phone && (alert.riskLevel === 'medium' || alert.riskLevel === 'high')) {
      try {
        const smsBody = `Kisan Alert - ${alert.location} weather: ${alert.riskLevel.toUpperCase()} dry-spell risk. ${alert.guidance}`;
        smsResult = await sendSms(phone, smsBody);
      } catch (err) {
        console.error('Weather SMS error:', err.message);
        smsError = err.message;
      }
    }

    return res.status(200).json({ success: true, ...alert, smsResult, smsError });
  } catch (err) {
    console.error('Weather alert error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /diagnose-crop
 * multipart/form-data with a 'photo' file field, optional 'farmerEmail' text field
 */
app.post('/diagnose-crop', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No photo uploaded. Send a multipart/form-data request with a "photo" field.' });
  }

  try {
    const diagnosis = await diagnoseCropImage(req.file.buffer, req.file.mimetype);

    let ticket = null;
    let ticketError = null;
    let smsResult = null;
    let smsError = null;

    if (diagnosis.escalate) {
      try {
        ticket = await createEscalationTicket(diagnosis, req.body.farmerEmail);
      } catch (err) {
        console.error('Escalation ticket error:', err.message);
        ticketError = err.message;
      }

      if (req.body.farmerPhone) {
        try {
          const smsBody = `Kisan Alert: Your crop report (${diagnosis.crop_identified} - ${diagnosis.issue}) has been escalated to Rythu Seva Kendra for expert review. ${ticket ? `Ticket: ${ticket.id.slice(0, 8)}` : ''}`;
          smsResult = await sendSms(req.body.farmerPhone, smsBody);
        } catch (err) {
          console.error('Escalation SMS error:', err.message);
          smsError = err.message;
        }
      }
    }

    return res.status(200).json({ success: true, diagnosis, ticket, ticketError, smsResult, smsError });
  } catch (err) {
    console.error('Diagnosis error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /send-sms
 * body: { to: '+91XXXXXXXXXX', message: 'text content' }
 * Note: on a Twilio trial account, 'to' must be a Verified Caller ID.
 */
app.post('/send-sms', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields: to, message' });
  }

  try {
    const result = await sendSms(to, message);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('SMS send error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /request-call
 * body: { to: '+91XXXXXXXXXX' }
 * Places a real outbound call from your Twilio number to the farmer,
 * connecting them straight into the Kisan Alert voice menu.
 * Note: on a Twilio trial account, 'to' must be a Verified Caller ID.
 */
app.post('/request-call', async (req, res) => {
  const { to } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, error: 'Missing required field: to' });
  }

  try {
    const result = await makeOutboundCall(to);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Outbound call error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Kisan Alert backend running on port ${PORT}`));

module.exports = app;
