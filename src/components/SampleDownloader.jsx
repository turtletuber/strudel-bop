import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function SampleDownloader({ onSampleDownloaded }) {
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [customName, setCustomName] = useState('');

  // Load existing samples on mount
  useEffect(() => {
    fetchSamples();
  }, []);

  const fetchSamples = async () => {
    try {
      const res = await fetch(`${API_URL}/samples`);
      const data = await res.json();
      setSamples(data.samples || []);
    } catch (err) {
      console.error('Failed to fetch samples:', err);
    }
  };

  const fetchInfo = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_URL}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setInfo(data);
        setCustomName(data.title.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30));
      }
    } catch (err) {
      setError('Failed to fetch info. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = async () => {
    if (!url.trim()) return;

    setDownloading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          filename: customName || undefined
        })
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Refresh samples list
        await fetchSamples();
        // Notify parent
        onSampleDownloaded?.(data);
        // Clear form
        setUrl('');
        setInfo(null);
        setStartTime('');
        setEndTime('');
        setCustomName('');
      }
    } catch (err) {
      setError('Failed to download. Is the server running?');
    } finally {
      setDownloading(false);
    }
  };

  const deleteSample = async (filename) => {
    try {
      await fetch(`${API_URL}/samples/${filename}`, { method: 'DELETE' });
      await fetchSamples();
    } catch (err) {
      console.error('Failed to delete sample:', err);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="sample-downloader">
      <div className="downloader-header">
        <h3>Sample Downloader</h3>
        <span className="subtitle">YouTube / SoundCloud</span>
      </div>

      <div className="url-input-group">
        <input
          type="text"
          placeholder="Paste YouTube or SoundCloud URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
        />
        <button
          onClick={fetchInfo}
          disabled={loading || !url.trim()}
          className="fetch-btn"
        >
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </div>

      {error && (
        <div className="downloader-error">{error}</div>
      )}

      {info && (
        <div className="info-card">
          {info.thumbnail && (
            <img src={info.thumbnail} alt={info.title} className="thumbnail" />
          )}
          <div className="info-details">
            <h4>{info.title}</h4>
            <p className="uploader">{info.uploader}</p>
            <p className="duration">Duration: {formatDuration(info.duration)}</p>
          </div>
        </div>
      )}

      {info && (
        <div className="download-options">
          <div className="time-inputs">
            <div className="time-input">
              <label>Start Time</label>
              <input
                type="text"
                placeholder="0:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="time-input">
              <label>End Time</label>
              <input
                type="text"
                placeholder={formatDuration(info.duration)}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="name-input">
            <label>Sample Name</label>
            <input
              type="text"
              placeholder="my_sample"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>

          <button
            onClick={downloadSample}
            disabled={downloading}
            className="download-btn"
          >
            {downloading ? 'Downloading...' : 'Download Sample'}
          </button>
        </div>
      )}

      {samples.length > 0 && (
        <div className="samples-list">
          <h4>Downloaded Samples ({samples.length})</h4>
          <div className="samples-grid">
            {samples.map((sample) => (
              <div key={sample.name} className="sample-item">
                <div className="sample-info">
                  <span className="sample-name">{sample.name}</span>
                  <span className="sample-size">{formatSize(sample.size)}</span>
                </div>
                <div className="sample-actions">
                  <button
                    className="play-sample-btn"
                    onClick={() => {
                      const audio = new Audio(`http://localhost:3001${sample.path}`);
                      audio.play();
                    }}
                    title="Preview"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </button>
                  <button
                    className="copy-sample-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(`samples("http://localhost:3001${sample.path}")`);
                    }}
                    title="Copy Strudel code"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                  <button
                    className="delete-sample-btn"
                    onClick={() => deleteSample(sample.name)}
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
