/**
 * Handles incoming SMS/MMS messages from farmers.
 *
 * If a farmer texts a photo of a crop to the Twilio number, this fetches
 * the image, runs it through the same Gemini diagnosis used by the web
 * dashboard, and replies with a text message containing the diagnosis.
 *
 * Setup:
 * 1. In Twilio Console -> Phone Numbers -> your number -> Messaging Configuration
 * 2. Set "A message comes in" webhook to: https://YOUR_NGROK_URL/sms-webhook (HTTP POST)
 */

const express = require('express');
const twilio = require('twilio');
const { MessagingResponse } = twilio.twiml;
const { diagnoseCropImage } = require('./cropDiagnosis');
const { createEscalationTicket } = require('./supabaseAdmin');

const router = express.Router();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

async function fetchTwilioMedia(url) {
  const authHeader = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: authHeader } });

  if (!res.ok) {
    throw new Error(`Failed to fetch media from Twilio (status ${res.status})`);
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

router.post('/sms-webhook', async (req, res) => {
  const twiml = new MessagingResponse();
  const numMedia = parseInt(req.body.NumMedia || '0', 10);
  const from = req.body.From;

  if (numMedia === 0) {
    twiml.message(
      'Welcome to Kisan Alert. To get a crop health diagnosis, send a photo of the affected crop as a picture message. For crop recommendations and weather alerts, call this same number.'
    );
    return res.type('text/xml').send(twiml.toString());
  }

  try {
    const mediaUrl = req.body.MediaUrl0;
    const { buffer, contentType } = await fetchTwilioMedia(mediaUrl);
    const diagnosis = await diagnoseCropImage(buffer, contentType);

    let replyText = `Diagnosis: ${diagnosis.crop_identified} - ${diagnosis.issue} (${diagnosis.severity} severity, ${diagnosis.confidence} confidence). ${diagnosis.remedy}`;

    if (diagnosis.escalate) {
      try {
        const ticket = await createEscalationTicket(diagnosis, null);
        replyText += ` This has been escalated to your local Rythu Seva Kendra. Ticket: ${ticket.id.slice(0, 8)}.`;
      } catch (err) {
        console.error('SMS escalation ticket error:', err.message);
        replyText += ' We recommend contacting your local Rythu Seva Kendra for follow-up.';
      }
    }

    twiml.message(replyText);
  } catch (err) {
    console.error('SMS diagnosis error:', err.message);
    twiml.message(
      'Sorry, we could not process that photo. Please make sure it is a clear image of the affected crop and try again.'
    );
  }

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;
