/**
 * Voice IVR (Interactive Voice Response) handler using Twilio Voice + TwiML.
 *
 * Farmers call the Twilio number and navigate via keypad (DTMF) through
 * a menu to get a profit-based crop recommendation or a weather alert,
 * entirely by voice - no smartphone or app required.
 *
 * Setup (in addition to SMS setup already done):
 * 1. In Twilio Console -> Phone Numbers -> your number -> Voice Configuration
 * 2. Set "A call comes in" webhook to: https://YOUR_NGROK_URL/voice  (HTTP POST)
 * 3. You need a public URL for Twilio to reach your local server - use ngrok:
 *      ngrok http 8080
 *    then copy the https://xxxx.ngrok-free.app URL it gives you.
 */

const express = require('express');
const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;
const { recommendCrops } = require('./profitCalculator');
const { getWeatherAlert } = require('./weatherAlerts');

const router = express.Router();

const SOIL_MENU = { 1: 'alluvial', 2: 'black', 3: 'red', 4: 'clayey', 5: 'sandy loam' };
const LAND_TYPE_MENU = { 1: 'dryland', 2: 'wetland' };
const WATER_MENU = { 1: 'none', 2: 'low', 3: 'medium', 4: 'high' };
const SEASON_MENU = { 1: 'kharif', 2: 'rabi', 3: 'zaid' };

function qs(params) {
  return new URLSearchParams(params).toString();
}

// --- Entry point: incoming call ---
router.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: '/voice/menu',
    method: 'POST',
    timeout: 8,
  });
  gather.say(
    'Welcome to Kisan Alert. Press 1 for a profit based crop recommendation. Press 2 for a weather dry spell alert. Press 3 to report a crop health issue.'
  );
  twiml.say('We did not receive any input. Goodbye.');
  res.type('text/xml').send(twiml.toString());
});

// --- Main menu router ---
router.post('/voice/menu', (req, res) => {
  const digit = req.body.Digits;
  const twiml = new VoiceResponse();

  if (digit === '1') {
    const gather = twiml.gather({ numDigits: 1, action: '/voice/crop/landtype', method: 'POST', timeout: 8 });
    gather.say('Press 1 for dry land. Press 2 for wetland.');
  } else if (digit === '2') {
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice/weather',
      method: 'POST',
      speechTimeout: 'auto',
    });
    gather.say('Please say the name of your village or town after the beep.');
  } else if (digit === '3') {
    twiml.say(
      'To report a crop health issue, please send a photo by text message to this same number. We will text you back a diagnosis shortly. Goodbye.'
    );
  } else {
    twiml.say('Sorry, that was not a valid option. Goodbye.');
  }

  res.type('text/xml').send(twiml.toString());
});

// --- Crop recommendation flow: land type -> soil type -> water -> season -> land area -> result ---
router.post('/voice/crop/landtype', (req, res) => {
  const landType = LAND_TYPE_MENU[req.body.Digits];
  const twiml = new VoiceResponse();

  if (!landType) {
    twiml.say('Sorry, that was not a valid option. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  const gather = twiml.gather({
    numDigits: 1,
    action: `/voice/crop/soiltype?${qs({ landType })}`,
    method: 'POST',
    timeout: 8,
  });
  gather.say(
    'Press 1 for alluvial soil. Press 2 for black soil. Press 3 for red soil. Press 4 for clayey soil. Press 5 for sandy loam soil.'
  );
  res.type('text/xml').send(twiml.toString());
});

router.post('/voice/crop/soiltype', (req, res) => {
  const { landType } = req.query;
  const soilType = SOIL_MENU[req.body.Digits];
  const twiml = new VoiceResponse();

  if (!soilType) {
    twiml.say('Sorry, that was not a valid option. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  const gather = twiml.gather({
    numDigits: 1,
    action: `/voice/crop/water?${qs({ landType, soilType })}`,
    method: 'POST',
    timeout: 8,
  });
  gather.say(
    'Press 1 for no water source. Press 2 for low water availability. Press 3 for medium. Press 4 for high water availability.'
  );
  res.type('text/xml').send(twiml.toString());
});

router.post('/voice/crop/water', (req, res) => {
  const { landType, soilType } = req.query;
  const waterAvailability = WATER_MENU[req.body.Digits];
  const twiml = new VoiceResponse();

  if (!waterAvailability) {
    twiml.say('Sorry, that was not a valid option. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  const gather = twiml.gather({
    numDigits: 1,
    action: `/voice/crop/season?${qs({ landType, soilType, waterAvailability })}`,
    method: 'POST',
    timeout: 8,
  });
  gather.say('Press 1 for kharif season. Press 2 for rabi season. Press 3 for zaid season.');
  res.type('text/xml').send(twiml.toString());
});

router.post('/voice/crop/season', (req, res) => {
  const { landType, soilType, waterAvailability } = req.query;
  const season = SEASON_MENU[req.body.Digits];
  const twiml = new VoiceResponse();

  if (!season) {
    twiml.say('Sorry, that was not a valid option. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  const gather = twiml.gather({
    finishOnKey: '#',
    action: `/voice/crop/result?${qs({ landType, soilType, waterAvailability, season })}`,
    method: 'POST',
    timeout: 10,
  });
  gather.say('Please enter your land area in cents using the keypad, then press pound.');
  res.type('text/xml').send(twiml.toString());
});

router.post('/voice/crop/result', (req, res) => {
  const { landType, soilType, waterAvailability, season } = req.query;
  const landArea = parseInt(req.body.Digits, 10);
  const twiml = new VoiceResponse();

  if (!landArea || landArea <= 0) {
    twiml.say('Sorry, we could not read a valid land area. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  const result = recommendCrops({
    landArea,
    landAreaUnit: 'cents',
    soilType,
    landType,
    waterAvailability,
    season,
  });

  if (!result.success) {
    twiml.say(
      'No suitable crops were found in our database for these conditions. Please contact your nearest Rythu Seva Kendra for further guidance. Goodbye.'
    );
    return res.type('text/xml').send(twiml.toString());
  }

  const top = result.topRecommendation;
  const second = result.ranked[1];

  let message = `Based on your land, the most profitable crop is ${top.crop}, with an estimated profit of ${top.expected_profit} rupees.`;
  if (second) {
    const diff = top.expected_profit - second.expected_profit;
    message += ` This is ${diff} rupees more profit than the next best option, ${second.crop}.`;
  }
  message += ` This is an estimate with ${top.confidence} confidence. For a detailed breakdown and other crop options, please check the Kisan Alert web dashboard. Thank you, and goodbye.`;

  twiml.say(message);
  res.type('text/xml').send(twiml.toString());
});

// --- Weather alert flow (voice input for location) ---
router.post('/voice/weather', async (req, res) => {
  const location = req.body.SpeechResult;
  const twiml = new VoiceResponse();

  if (!location) {
    twiml.say('Sorry, we did not catch that. Please try calling again. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  try {
    const alert = await getWeatherAlert(location);
    const message = `Weather outlook for ${alert.location}: ${alert.riskLevel} dry spell risk. ${alert.guidance}`;
    twiml.say(message);
  } catch (err) {
    twiml.say(
      `Sorry, we could not find weather data for ${location}. Please check the location name and try again. Goodbye.`
    );
  }

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;
