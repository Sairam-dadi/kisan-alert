import { useState, useEffect } from 'react';
import { Sprout, CloudRain, Stethoscope } from 'lucide-react';
import CropDiagnosis from './CropDiagnosis';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const SOIL_TYPES = ['alluvial', 'black', 'red', 'clayey', 'sandy loam'];
const LAND_TYPES = ['dryland', 'wetland'];
const WATER_LEVELS = ['none', 'low', 'medium', 'high'];
const SEASONS = ['kharif', 'rabi', 'zaid'];
const LANGUAGES = ['English', 'Telugu', 'Hindi', 'Tamil'];

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function formatRupees(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [apiUrl, setApiUrl] = useState(
    () => localStorage.getItem('kisanAlertApiUrl') || DEFAULT_API_URL
  );
  const [form, setForm] = useState({
    landArea: 20,
    landAreaUnit: 'cents',
    soilType: 'alluvial',
    landType: 'dryland',
    waterAvailability: 'high',
    season: 'kharif',
    location: '',
    language: 'English',
    phoneNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);
  const [callRequesting, setCallRequesting] = useState(false);
  const [callStatus, setCallStatus] = useState(null);

  useEffect(() => {
    localStorage.setItem('kisanAlertApiUrl', apiUrl);
  }, [apiUrl]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleRequestCall() {
    if (!form.phoneNumber) return;
    setCallRequesting(true);
    setCallStatus(null);

    try {
      const res = await fetch(`${apiUrl}/request-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: form.phoneNumber }),
      });
      const data = await res.json();
      setCallStatus(data.success ? 'Calling you now — pick up!' : `Failed: ${data.error}`);
    } catch (err) {
      setCallStatus(`Could not reach backend at ${apiUrl}.`);
    } finally {
      setCallRequesting(false);
    }
  }

  async function handleTextAlert() {
    if (!form.phoneNumber || !weather) return;
    setSmsSending(true);
    setSmsStatus(null);

    try {
      const body = `Kisan Alert - ${weather.location} weather: ${weather.riskLevel.toUpperCase()} dry-spell risk. ${weather.guidance}`;
      const res = await fetch(`${apiUrl}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: form.phoneNumber, message: body }),
      });
      const data = await res.json();
      setSmsStatus(data.success ? 'Sent! Check your phone.' : `Failed: ${data.error}`);
    } catch (err) {
      setSmsStatus(`Could not reach backend at ${apiUrl}.`);
    } finally {
      setSmsSending(false);
    }
  }

  async function fetchWeather(location) {
    if (!location) return;
    setWeatherLoading(true);
    setWeatherError(null);
    setWeather(null);

    try {
      const res = await fetch(`${apiUrl}/weather-alert?location=${encodeURIComponent(location)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setWeatherError(data.error || 'Could not fetch weather data.');
      } else {
        setWeather(data);
      }
    } catch (err) {
      setWeatherError(`Could not reach the backend at ${apiUrl}.`);
    } finally {
      setWeatherLoading(false);
    }
  }

  function handleSearchLocation(location) {
    updateField('location', location);
    setActivePage('weather');
    fetchWeather(location);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    if (form.location) {
      fetchWeather(form.location);
    }

    try {
      const res = await fetch(`${apiUrl}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          landArea: Number(form.landArea),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong contacting the recommendation service.');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(
        `Could not reach the backend at ${apiUrl}. Make sure the server is running (node src/server.js).`
      );
    } finally {
      setLoading(false);
    }
  }

  const maxProfit = result?.ranked?.length
    ? Math.max(...result.ranked.map((c) => c.expected_profit))
    : 0;

  const pageMeta = {
    home: { title: 'Home', subtitle: 'Welcome back to Kisan Alert' },
    advisor: { title: 'Crop Advisor', subtitle: 'Profit-ranked crop recommendations for your land' },
    weather: { title: 'Weather Alerts', subtitle: 'Dry-spell risk and irrigation guidance' },
    doctor: { title: 'Crop Doctor', subtitle: 'AI diagnosis from a photo of your crop' },
    call: { title: 'Call Support', subtitle: 'Talk to Kisan Alert like a helpline' },
  };

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        phoneNumber={form.phoneNumber}
        location={form.location}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="main-content">
        <Topbar
          pageTitle={pageMeta[activePage].title}
          pageSubtitle={pageMeta[activePage].subtitle}
          language={form.language}
          onLanguageChange={(v) => updateField('language', v)}
          languages={LANGUAGES}
          onSearchLocation={handleSearchLocation}
          onRequestCall={handleRequestCall}
          callRequesting={callRequesting}
          phoneNumber={form.phoneNumber}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <div className="page-content">
          {activePage === 'home' && (
            <>
              <div className="hero">
                <span className="hero-eyebrow">AI-Powered Agricultural Intelligence</span>
                <h2 className="hero-title">Profit-first farming, one phone number away.</h2>
                <p className="hero-subtitle">
                  Rank crops by expected profit, catch dry spells before they cost you a season,
                  and diagnose crop health from a photo — by web, call, or text.
                </p>
                <div className="hero-actions">
                  <button className="hero-btn-primary" onClick={() => setActivePage('advisor')}>
                    Get a recommendation
                  </button>
                  <button className="hero-btn-secondary" onClick={() => setActivePage('call')}>
                    Talk by phone
                  </button>
                </div>
              </div>

              <div className="feature-grid">
                <div className="feature-card" onClick={() => setActivePage('advisor')}>
                  <div className="feature-card-icon"><Sprout size={22} color="var(--accent-gold-text)" /></div>
                  <h3 className="feature-card-title">Crop Advisor</h3>
                  <p className="feature-card-body">
                    Ranks viable crops by expected profit — cost, yield, and market price — not just suitability.
                  </p>
                </div>
                <div className="feature-card" onClick={() => setActivePage('weather')}>
                  <div className="feature-card-icon"><CloudRain size={22} color="var(--accent-gold-text)" /></div>
                  <h3 className="feature-card-title">Weather Alerts</h3>
                  <p className="feature-card-body">
                    Localized dry-spell risk and irrigation guidance from live forecast data.
                  </p>
                </div>
                <div className="feature-card" onClick={() => setActivePage('doctor')}>
                  <div className="feature-card-icon"><Stethoscope size={22} color="var(--accent-gold-text)" /></div>
                  <h3 className="feature-card-title">Crop Doctor</h3>
                  <p className="feature-card-body">
                    Upload a photo of an affected crop for an AI diagnosis and remedy.
                  </p>
                </div>
              </div>

              <button
                className="advanced-settings-toggle"
                onClick={() => setShowAdvancedSettings((s) => !s)}
              >
                {showAdvancedSettings ? 'Hide' : 'Show'} advanced settings
              </button>
              {showAdvancedSettings && (
                <div className="settings-row" style={{ marginTop: 10 }}>
                  <span>API endpoint</span>
                  <input type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
                </div>
              )}
            </>
          )}

          {activePage === 'advisor' && (
            <>
              <form className="card" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="field">
                    <label>Land area</label>
                    <input
                      type="number"
                      min="1"
                      value={form.landArea}
                      onChange={(e) => updateField('landArea', e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Unit</label>
                    <select value={form.landAreaUnit} onChange={(e) => updateField('landAreaUnit', e.target.value)}>
                      <option value="cents">Cents</option>
                      <option value="acres">Acres</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Soil type</label>
                    <select value={form.soilType} onChange={(e) => updateField('soilType', e.target.value)}>
                      {SOIL_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Land type</label>
                    <select value={form.landType} onChange={(e) => updateField('landType', e.target.value)}>
                      {LAND_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Water availability</label>
                    <select value={form.waterAvailability} onChange={(e) => updateField('waterAvailability', e.target.value)}>
                      {WATER_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Season</label>
                    <select value={form.season} onChange={(e) => updateField('season', e.target.value)}>
                      {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Visakhapatnam"
                      value={form.location}
                      onChange={(e) => updateField('location', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Phone number (for SMS alerts)</label>
                    <input
                      type="tel"
                      placeholder="+919876543210"
                      value={form.phoneNumber}
                      onChange={(e) => updateField('phoneNumber', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Explanation language</label>
                    <select value={form.language} onChange={(e) => updateField('language', e.target.value)}>
                      {LANGUAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="submit-row">
                  <button className="submit-btn" type="submit" disabled={loading}>
                    {loading ? 'Calculating…' : 'Get recommendation'}
                  </button>
                  {error && <span className="error-text">{error}</span>}
                </div>
              </form>

              {result && result.success === false && (
                <div className="card">
                  <p className="empty-state">{result.message}</p>
                </div>
              )}

              {result && result.success && (
                <div className="card">
                  <h2 className="results-heading">Ranked by expected profit</h2>
                  <p className="results-sub">
                    For {result.landAreaAcres} acre{result.landAreaAcres !== 1 ? 's' : ''}, {form.soilType} soil,{' '}
                    {form.landType}, {form.waterAvailability} water, {form.season} season
                  </p>

                  {result.ranked.map((crop, i) => (
                    <div
                      key={crop.crop}
                      className={`crop-row ${i === 0 ? 'top-pick' : ''}`}
                      style={i === 0 ? { borderRadius: 8, padding: '18px 16px', marginBottom: 8 } : {}}
                    >
                      {i === 0 && <span className="stamp">Best profit</span>}
                      <span className="crop-rank">{i + 1}</span>
                      <div className="crop-main">
                        <p className="crop-name">{crop.crop}</p>
                        <div className="crop-bar-track">
                          <div
                            className="crop-bar-fill"
                            style={{ width: `${(crop.expected_profit / maxProfit) * 100}%` }}
                          />
                        </div>
                        <span className={`confidence-tag ${crop.confidence === 'high' ? 'confidence-high' : 'confidence-medium'}`}>
                          {crop.confidence} confidence
                        </span>
                      </div>
                      <div className="crop-numbers">
                        <span className="num-label">Cost</span>
                        <span className="num-label">Yield</span>
                        <span className="num-label">Profit</span>
                        <span className="num-value">{formatRupees(crop.cost_estimate)}</span>
                        <span className="num-value">{crop.expected_yield_kg} kg</span>
                        <span className="num-value profit-value">{formatRupees(crop.expected_profit)}</span>
                      </div>
                    </div>
                  ))}

                  {result.explanation && (
                    <div className="explanation-box">
                      <p className="explanation-label">Why this recommendation</p>
                      <p style={{ margin: 0 }}>{result.explanation}</p>
                    </div>
                  )}

                  {result.explanationError && (
                    <p className="explanation-note">{result.explanationError}</p>
                  )}
                </div>
              )}
            </>
          )}

          {activePage === 'weather' && (
            <>
              <div className="card">
                <h2 className="results-heading" style={{ marginBottom: 10 }}>Check dry-spell risk</h2>
                <div className="field" style={{ maxWidth: 320, marginBottom: 14 }}>
                  <label>Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Visakhapatnam"
                    value={form.location}
                    onChange={(e) => updateField('location', e.target.value)}
                  />
                </div>
                <button
                  className="submit-btn"
                  onClick={() => fetchWeather(form.location)}
                  disabled={weatherLoading || !form.location}
                >
                  {weatherLoading ? 'Checking…' : 'Check forecast'}
                </button>
              </div>

              {weatherError && (
                <div className="card">
                  <p className="error-text">{weatherError}</p>
                </div>
              )}

              {weather && (
                <div className="card weather-card">
                  <span className={`weather-badge risk-${weather.riskLevel}`}>
                    {weather.riskLevel} risk
                  </span>
                  <div>
                    <h2 className="weather-heading">Dry-spell outlook — {weather.location}</h2>
                    <p className="weather-guidance">{weather.guidance}</p>
                    <div className="weather-stats">
                      <span>Avg temp: {weather.averageTempC}°C</span>
                      <span>Dry days ahead: {weather.dryDaysCount}</span>
                      <span>Longest dry streak: {weather.maxConsecutiveDryDays} days</span>
                    </div>
                    {(weather.riskLevel === 'medium' || weather.riskLevel === 'high') && form.phoneNumber && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          className="submit-btn"
                          onClick={handleTextAlert}
                          disabled={smsSending}
                          style={{ fontSize: 12, padding: '7px 14px' }}
                        >
                          {smsSending ? 'Sending…' : 'Text me this alert'}
                        </button>
                        {smsStatus && (
                          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                            {smsStatus}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activePage === 'doctor' && (
            <CropDiagnosis apiUrl={apiUrl} farmerEmail="" farmerPhone={form.phoneNumber} />
          )}

          {activePage === 'call' && (
            <div className="card">
              <h2 className="results-heading">Talk to Kisan Alert by phone</h2>
              <p className="results-sub" style={{ marginBottom: 18 }}>
                No app or data needed — get a call and navigate by keypad, just like calling a helpline.
              </p>

              <div className="field" style={{ maxWidth: 320, marginBottom: 16 }}>
                <label>Phone number</label>
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={form.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value)}
                />
              </div>

              <button
                className="submit-btn"
                onClick={handleRequestCall}
                disabled={!form.phoneNumber || callRequesting}
              >
                {callRequesting ? 'Calling…' : 'Request a call'}
              </button>
              {callStatus && (
                <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>{callStatus}</p>
              )}

              <div className="explanation-box" style={{ marginTop: 24 }}>
                <p className="explanation-label">What you'll hear</p>
                <p style={{ margin: 0 }}>
                  Press 1 for a profit-based crop recommendation, entered by keypad. Press 2 to speak
                  your location and hear the dry-spell outlook. Press 3 for instructions to text a
                  photo for crop diagnosis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
