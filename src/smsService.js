/**
 * Sends real SMS messages via Twilio.
 *
 * Setup:
 * 1. Sign up at https://www.twilio.com/try-twilio (no credit card needed)
 * 2. Get a trial phone number and copy your Account SID, Auth Token, and number
 * 3. Verify recipient numbers under Console -> Phone Numbers -> Verified Caller IDs
 *    (trial accounts can only send to verified numbers)
 * 4. Set as environment variables:
 *    TWILIO_ACCOUNT_SID=ACxxxx
 *    TWILIO_AUTH_TOKEN=xxxx
 *    TWILIO_PHONE_NUMBER=+15077365394
 */

const twilio = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let client = null;

if (ACCOUNT_SID && AUTH_TOKEN) {
  client = twilio(ACCOUNT_SID, AUTH_TOKEN);
} else {
  console.warn('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set - SMS sending will not work.');
}

/**
 * Sends an SMS to a phone number in E.164 format (e.g. +919876543210).
 * On a Twilio trial account, the recipient must be a Verified Caller ID.
 */
async function sendSms(to, body) {
  if (!client) {
    throw new Error('Twilio is not configured on the backend (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
  }
  if (!TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER environment variable is not set.');
  }
  if (!to) {
    throw new Error('Recipient phone number is required.');
  }

  const message = await client.messages.create({
    body,
    from: TWILIO_PHONE_NUMBER,
    to,
  });

  return { sid: message.sid, status: message.status };
}

/**
 * Places an outbound voice call to a farmer's phone number, connecting
 * them to the Kisan Alert IVR menu. Requires PUBLIC_BASE_URL (your ngrok
 * URL) to be set, since Twilio needs a public URL to fetch the TwiML
 * call instructions from.
 */
async function makeOutboundCall(to) {
  if (!client) {
    throw new Error('Twilio is not configured on the backend (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
  }
  if (!TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER environment variable is not set.');
  }
  if (!to) {
    throw new Error('Recipient phone number is required.');
  }

  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error('PUBLIC_BASE_URL environment variable is not set (should be your ngrok https URL).');
  }

  const call = await client.calls.create({
    url: `${baseUrl}/voice`,
    to,
    from: TWILIO_PHONE_NUMBER,
  });

  return { sid: call.sid, status: call.status };
}

module.exports = { sendSms, makeOutboundCall };
