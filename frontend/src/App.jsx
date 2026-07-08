import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import CropDiagnosis from './CropDiagnosis';

const SOIL_TYPES = ['alluvial', 'black', 'red', 'clayey', 'sandy loam'];
const LAND_TYPES = ['dryland', 'wetland'];
const WATER_LEVELS = ['none', 'low', 'medium', 'high'];
const SEASONS = ['kharif', 'rabi', 'zaid'];
const LANGUAGES = ['English', 'Telugu', 'Hindi', 'Tamil'];

const DEFAULT_API_URL = 'http://localhost:8080';

function formatRupees(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function handleSignOut() {
    supabase.auth.signOut();
  }

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

  if (checkingSession) {
    return <div className="app"><p className="empty-state">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="app">
        <Auth onAuthed={setSession} />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow">Kisan Alert</p>
            <h1 className="title">Profit-oriented crop recommendation</h1>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Sign out
          </button>
        </div>
        <p className="subtitle">
          Enter your land and season details to see which crops are viable — ranked by
          expected profit, not just tradition.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Signed in as {session.user.email}
        </p>
        <div className="settings-row">
          <span>API endpoint</span>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 className="results-heading" style={{ marginBottom: 4 }}>Talk to Kisan Alert by phone</h2>
          <p className="results-sub" style={{ margin: 0 }}>
            No app or data needed — get a call and navigate by keypad, just like calling a helpline.
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <button
            className="submit-btn"
            onClick={handleRequestCall}
            disabled={!form.phoneNumber || callRequesting}
          >
            {callRequesting ? 'Calling…' : 'Request a call'}
          </button>
          {!form.phoneNumber && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              Enter your phone number below first
            </p>
          )}
          {callStatus && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0' }}>{callStatus}</p>
          )}
        </div>
      </div>

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
            <select
              value={form.landAreaUnit}
              onChange={(e) => updateField('landAreaUnit', e.target.value)}
            >
              <option value="cents">Cents</option>
              <option value="acres">Acres</option>
            </select>
          </div>
          <div className="field">
            <label>Soil type</label>
            <select
              value={form.soilType}
              onChange={(e) => updateField('soilType', e.target.value)}
            >
              {SOIL_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Land type</label>
            <select
              value={form.landType}
              onChange={(e) => updateField('landType', e.target.value)}
            >
              {LAND_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Water availability</label>
            <select
              value={form.waterAvailability}
              onChange={(e) => updateField('waterAvailability', e.target.value)}
            >
              {WATER_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Season</label>
            <select
              value={form.season}
              onChange={(e) => updateField('season', e.target.value)}
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
            <select
              value={form.language}
              onChange={(e) => updateField('language', e.target.value)}
            >
              {LANGUAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
                <span
                  className={`confidence-tag ${
                    crop.confidence === 'high' ? 'confidence-high' : 'confidence-medium'
                  }`}
                >
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

      {weatherLoading && (
        <div className="card">
          <p className="empty-state">Checking forecast…</p>
        </div>
      )}

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
            <h2 className="weather-heading">
              Dry-spell outlook — {weather.location}
            </h2>
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

      <CropDiagnosis apiUrl={apiUrl} farmerEmail={session.user.email} farmerPhone={form.phoneNumber} />
    </div>
  );
}
