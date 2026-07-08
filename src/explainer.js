/**
 * Uses the Gemini Developer API (via Google AI Studio) to turn the ranked
 * profit comparison into a plain-language explanation the farmer can
 * understand, ideally in their preferred language.
 *
 * This uses the FREE Gemini API tier - no Google Cloud billing required.
 *
 * Setup:
 * 1. Go to https://aistudio.google.com/
 * 2. Sign in with a Google account
 * 3. Click "Get API key" -> Create API key
 * 4. Set it as an environment variable: export GEMINI_API_KEY=your-key-here
 *
 * npm install @google/generative-ai
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;

function buildPrompt(rankedCrops, language) {
  const [top, second] = rankedCrops;

  const comparisonLine = second
    ? `The top recommendation is ${top.crop} with an expected profit of ₹${top.expected_profit}, compared to ${second.crop} at ₹${second.expected_profit} (a difference of ₹${top.expected_profit - second.expected_profit}).`
    : `The only viable option is ${top.crop} with an expected profit of ₹${top.expected_profit}.`;

  return `You are an agricultural advisor speaking to a small-scale Indian farmer.
Write a short, clear, respectful explanation (3-4 sentences max) in ${language} explaining
why ${top.crop} is the recommended crop over the alternatives, based on this data:

${comparisonLine}

Confidence level for this recommendation: ${top.confidence}.
Additional context: ${top.notes}

Keep the tone practical and non-technical - the farmer should immediately understand the
financial reasoning. Do not use complex jargon. If confidence is "medium" or "low",
gently note that this is an estimate.`;
}

/**
 * Calls the Gemini API to generate the natural-language explanation.
 * Returns the explanation text.
 */
async function generateExplanation(rankedCrops, language = 'English') {
  if (!API_KEY) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. Get a free key at https://aistudio.google.com/ and set it before calling generateExplanation().'
    );
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = buildPrompt(rankedCrops, language);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text.trim();
}

module.exports = { generateExplanation, buildPrompt };
