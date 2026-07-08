import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth({ onAuthed }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState('email'); // 'email' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function sendOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
    } else {
      setStage('otp');
      setInfo(`Code sent to ${email}. Check your inbox (and spam folder).`);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
    } else {
      onAuthed(data.session);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '4rem auto' }}>
      <p className="eyebrow">Kisan Alert</p>
      <h1 className="title" style={{ fontSize: 24, marginBottom: '1.25rem' }}>
        {stage === 'email' ? 'Sign in or sign up' : 'Enter verification code'}
      </h1>

      {stage === 'email' && (
        <form onSubmit={sendOtp}>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button className="submit-btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending code…' : 'Send verification code'}
          </button>
        </form>
      )}

      {stage === 'otp' && (
        <form onSubmit={verifyOtp}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {info}
          </p>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
            />
          </div>
          <button className="submit-btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Verifying…' : 'Verify and continue'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage('email');
              setOtp('');
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              marginTop: 10,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
