import { useState, useRef } from 'react';

export default function CropDiagnosis({ apiUrl, farmerEmail, farmerPhone }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setResponse(null);
    setError(null);
  }

  async function handleDiagnose() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    const formData = new FormData();
    formData.append('photo', file);
    if (farmerEmail) formData.append('farmerEmail', farmerEmail);
    if (farmerPhone) formData.append('farmerPhone', farmerPhone);

    try {
      const res = await fetch(`${apiUrl}/diagnose-crop`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Diagnosis failed.');
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(`Could not reach the backend at ${apiUrl}.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="results-heading">Crop health diagnosis</h2>
      <p className="results-sub">Upload a photo of the affected crop for an AI diagnosis.</p>

      <div
        className="diagnosis-upload"
        onClick={() => fileInputRef.current.click()}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Selected crop" className="diagnosis-preview" />
        ) : (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Click to select a photo of the affected crop
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>

      <div className="submit-row">
        <button
          className="submit-btn"
          onClick={handleDiagnose}
          disabled={!file || loading}
        >
          {loading ? 'Diagnosing…' : 'Diagnose crop'}
        </button>
        {error && <span className="error-text">{error}</span>}
      </div>

      {response && (
        <div className="diagnosis-result">
          <p className="diagnosis-issue">
            {response.diagnosis.crop_identified} — {response.diagnosis.issue}
          </p>
          <div className="diagnosis-tags">
            <span className={`severity-tag severity-${response.diagnosis.severity}`}>
              {response.diagnosis.severity} severity
            </span>
            <span
              className={`confidence-tag ${
                response.diagnosis.confidence === 'high' ? 'confidence-high' : 'confidence-medium'
              }`}
            >
              {response.diagnosis.confidence} confidence
            </span>
          </div>
          <p className="diagnosis-remedy">{response.diagnosis.remedy}</p>
          <p className="diagnosis-reasoning">{response.diagnosis.reasoning}</p>

          {response.diagnosis.escalate && (
            <div className="escalation-box">
              <p className="escalation-title">Escalated to Rythu Seva Kendra</p>
              <p className="escalation-text">{response.diagnosis.escalationReason}</p>
              {response.ticket && (
                <p className="ticket-id">Ticket ID: {response.ticket.id}</p>
              )}
              {response.ticketError && (
                <p className="ticket-id" style={{ color: '#8A3324' }}>
                  Note: ticket could not be saved ({response.ticketError})
                </p>
              )}
              {response.smsResult && (
                <p className="ticket-id">SMS sent to your phone confirming escalation.</p>
              )}
              {response.smsError && (
                <p className="ticket-id" style={{ color: '#8A3324' }}>
                  SMS not sent: {response.smsError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
