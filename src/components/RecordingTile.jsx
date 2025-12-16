import React, { useState } from 'react';

export function RecordingTile() {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <div
        className="sequence-card recording-tile collapsed"
        style={{ '--accent-color': '#10B981' }}
      >
        <div className="recording-collapsed-content" onClick={() => setIsExpanded(true)}>
          <div className="recording-add-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <div className="recording-add-text">
            <span className="recording-label">Record</span>
            <span className="recording-hint">coming soon</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sequence-card recording-tile expanded"
      style={{ '--accent-color': '#10B981' }}
    >
      <div className="card-indicator" style={{ opacity: 1 }} />

      <div className="recording-header">
        <span className="recording-label">Recording</span>
        <button
          className="recording-close-btn"
          onClick={() => setIsExpanded(false)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="recording-content">
        <div className="recording-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
          <span>Coming Soon</span>
        </div>
      </div>

      <div className="recording-footer">
        <span className="recording-hint">Record audio directly</span>
      </div>
    </div>
  );
}
