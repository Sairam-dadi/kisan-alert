/**
 * Fetches localized weather forecast from OpenWeatherMap and analyzes it
 * for dry-spell risk (extended period with no meaningful rainfall) so
 * farmers can get proactive irrigation guidance.
 *
 * Setup:
 * 1. Go to https://openweathermap.org/api and create a free account
 * 2. Get your API key from the "API keys" tab (may take up to an hour to activate)
 * 3. Set it as an environment variable: export OPENWEATHER_API_KEY=your-key-here
 */

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const GEOCODE_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

// Below this many mm of rain in the 3-hour window, we treat it as "no rain".
const RAIN_THRESHOLD_MM = 0.5;

/**
 * Converts a location name (e.g. "Visakhapatnam") into lat/lon coordinates.
 */
async function geocodeLocation(location) {
  const url = `${GEOCODE_URL}?q=${encodeURIComponent(location)},IN&limit=1&appid=${OPENWEATHER_API_KEY}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Geocoding request failed with status ${res.status}`);
  }

  const data = await res.json();

  if (!data || data.length === 0) {
    throw new Error(`Could not find location: ${location}`);
  }

  return { lat: data[0].lat, lon: data[0].lon, resolvedName: data[0].name };
}

/**
 * Fetches the 5-day / 3-hour forecast for given coordinates.
 */
async function fetchForecast(lat, lon) {
  const url = `${FORECAST_URL}?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Forecast request failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Analyzes the forecast list and determines dry-spell risk plus
 * simple irrigation/fertilization guidance.
 */
function analyzeForecast(forecastData) {
  const list = forecastData.list || [];

  const dailyRain = {};
  const dailyTemp = {};

  list.forEach((entry) => {
    const date = entry.dt_txt.split(' ')[0];
    const rain = entry.rain ? entry.rain['3h'] || 0 : 0;
    dailyRain[date] = (dailyRain[date] || 0) + rain;
    if (!dailyTemp[date]) dailyTemp[date] = [];
    dailyTemp[date].push(entry.main.temp);
  });

  const days = Object.keys(dailyRain).sort();
  const dryDays = days.filter((d) => dailyRain[d] < RAIN_THRESHOLD_MM);
  const consecutiveDryStreak = computeMaxConsecutive(days, (d) => dailyRain[d] < RAIN_THRESHOLD_MM);

  const avgTemps = days.map((d) => {
    const temps = dailyTemp[d];
    return temps.reduce((a, b) => a + b, 0) / temps.length;
  });
  const avgTempOverall = avgTemps.reduce((a, b) => a + b, 0) / (avgTemps.length || 1);

  let riskLevel = 'low';
  let guidance = 'Rainfall looks adequate over the coming days. Maintain your regular irrigation schedule.';

  if (consecutiveDryStreak >= 4) {
    riskLevel = 'high';
    guidance = `No significant rain expected for ${consecutiveDryStreak} consecutive days. Plan supplemental irrigation now, especially for young or water-sensitive crops. Consider mulching to reduce soil moisture loss.`;
  } else if (consecutiveDryStreak >= 2) {
    riskLevel = 'medium';
    guidance = `A short dry stretch of ${consecutiveDryStreak} days is expected. Monitor soil moisture and be ready to irrigate if the topsoil dries out.`;
  }

  if (avgTempOverall > 35) {
    guidance += ' Temperatures are running high — irrigate during early morning or evening to reduce evaporation loss.';
  }

  return {
    forecastDays: days,
    dryDaysCount: dryDays.length,
    maxConsecutiveDryDays: consecutiveDryStreak,
    averageTempC: Math.round(avgTempOverall * 10) / 10,
    riskLevel,
    guidance,
  };
}

function computeMaxConsecutive(sortedDays, predicate) {
  let max = 0;
  let current = 0;
  for (const day of sortedDays) {
    if (predicate(day)) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

/**
 * Main entry point: given a location name, returns the dry-spell
 * risk assessment and irrigation guidance.
 */
async function getWeatherAlert(location) {
  if (!OPENWEATHER_API_KEY) {
    throw new Error(
      'OPENWEATHER_API_KEY environment variable is not set. Get a free key at https://openweathermap.org/api'
    );
  }

  const { lat, lon, resolvedName } = await geocodeLocation(location);
  const forecastData = await fetchForecast(lat, lon);
  const analysis = analyzeForecast(forecastData);

  return {
    location: resolvedName,
    lat,
    lon,
    ...analysis,
  };
}

module.exports = { getWeatherAlert };
