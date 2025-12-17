import React, { useState, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function SampleTile({ onSampleAdded, savedSamples = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

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
      }
    } catch (err) {
      setError('Failed to fetch info');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = async () => {
    if (!url.trim()) return;
    setDownloading(true);
    setError(null);

    try {
      const safeName = (info?.title || `sample_${Date.now()}`)
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .substring(0, 30)
        .replace(/ /g, '_');

      const res = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          filename: safeName
        })
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        onSampleAdded?.({
          name: data.filename,
          path: data.path,
          size: data.size
        });
        setUrl('');
        setInfo(null);
        setStartTime('');
        setEndTime('');
        setIsExpanded(false);
      }
    } catch (err) {
      setError('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !info) {
      fetchInfo();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setUrl('');
      setInfo(null);
      setError(null);
    }
  };

  const handleTimeInputKeyDown = (e) => {
    if (e.key === 'Enter' && info && !downloading) {
      downloadSample();
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isExpanded) {
    return (
      <div
        className="sequence-card sample-tile collapsed"
        style={{ '--accent-color': '#F97316' }}
        ref={dropdownRef}
      >
        <div className="sample-collapsed-content" onClick={() => setIsExpanded(true)}>
          <div className="sample-add-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="sample-add-text">
            <span className="sample-label">Add Sample</span>
            <span className="sample-hint">from URL</span>
          </div>
        </div>
        {savedSamples.length > 0 && (
          <button
            className="sample-dropdown-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span className="sample-count">{savedSamples.length}</span>
          </button>
        )}
        {showDropdown && (
          <div className="sample-dropdown">
            <div className="sample-dropdown-header">Saved Samples</div>
            {savedSamples.map((sample, idx) => (
              <div key={idx} className="sample-dropdown-item">
                <span className="sample-dropdown-name">
                  {sample.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="sequence-card sample-tile expanded"
      style={{ '--accent-color': '#F97316' }}
    >
      <div className="card-indicator" style={{ opacity: 1 }} />

      <div className="sample-header">
        <span className="sample-label">{info ? info.title?.substring(0, 20) + '...' : 'Add from URL'}</span>
        <button
          className="sample-close-btn"
          onClick={() => {
            setIsExpanded(false);
            setUrl('');
            setInfo(null);
            setError(null);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {!info ? (
        <div className="sample-url-section">
          <input
            ref={inputRef}
            type="text"
            className="sample-url-input"
            placeholder="Paste URL and press Enter..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <span className="sample-url-hint">
            {loading ? 'Fetching...' : 'Press Enter'}
          </span>
          {loading && <span className="loading-spinner small" />}
        </div>
      ) : (
        <div className="sample-info" onKeyDown={handleTimeInputKeyDown}>
          <div className="sample-meta">
            <span className="sample-duration">{formatDuration(info.duration)}</span>
          </div>
          <div className="sample-time-row">
            <input
              type="text"
              placeholder="0:00"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <span>→</span>
            <input
              type="text"
              placeholder={formatDuration(info.duration)}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      )}

      {error && <div className="sample-error">{error}</div>}

      {info && (
        <div className="sample-footer">
          <span className="sample-hint">Set time range (optional)</span>
          <button
            className="sample-download-btn"
            onClick={downloadSample}
            disabled={downloading}
          >
            {downloading ? (
              <span className="loading-spinner small" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
