/**
 * Uses Gemini multimodal (via the free Google AI Studio API) to diagnose
 * crop health issues from a farmer-submitted photo.
 *
 * Uses the same GEMINI_API_KEY already configured for explanations.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;

const DIAGNOSIS_PROMPT = `You are an agricultural expert helping a small-scale Indian farmer diagnose a crop health issue from a photo.

Look at the image carefully and respond ONLY with a JSON object (no markdown fences, no preamble) in this exact shape:

{
  "crop_identified": "string - your best guess at the crop, or 'unclear' if not identifiable",
  "issue": "string - the disease, pest, nutrient deficiency, or condition you observe, or 'no visible issue' if the plant looks healthy",
  "severity": "mild" | "moderate" | "severe",
  "confidence": "high" | "medium" | "low",
  "remedy": "string - 2-3 sentences of practical, actionable advice a small farmer could follow",
  "reasoning": "string - one sentence on what visual signs led to this diagnosis"
}

Be honest about uncertainty - if the image is blurry, poorly lit, or the symptoms are ambiguous, use "low" confidence rather than guessing confidently. Do not invent a diagnosis you are not reasonably sure of.`;

/**
 * Diagnoses a crop health issue from an image buffer.
 * @param {Buffer} imageBuffer - raw image bytes
 * @param {string} mimeType - e.g. 'image/jpeg', 'image/png'
 */
async function diagnoseCropImage(imageBuffer, mimeType) {
  if (!API_KEY) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. Get a free key at https://aistudio.google.com/'
    );
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType,
    },
  };

  const result = await model.generateContent([DIAGNOSIS_PROMPT, imagePart]);
  const rawText = result.response.text().trim();

  // Strip markdown code fences if Gemini adds them despite instructions
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

  let diagnosis;
  try {
    diagnosis = JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error(`Could not parse diagnosis response as JSON: ${rawText.slice(0, 200)}`);
  }

  const shouldEscalate = diagnosis.confidence === 'low' || diagnosis.severity === 'severe';
  const escalationReason = shouldEscalate
    ? diagnosis.confidence === 'low' && diagnosis.severity === 'severe'
      ? 'Low diagnostic confidence and severe symptoms observed'
      : diagnosis.confidence === 'low'
      ? 'Low diagnostic confidence - needs expert visual confirmation'
      : 'Severe symptoms observed - needs prompt expert attention'
    : null;

  return {
    ...diagnosis,
    escalate: shouldEscalate,
    escalationReason,
  };
}

module.exports = { diagnoseCropImage };
