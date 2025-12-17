import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AIPromptTile } from './AIPromptTile';
import { SampleTile } from './SampleTile';

export function AddMenu({ onPatternGenerated, onSampleAdded, savedSamples }) {
  const [showMenu, setShowMenu] = useState(false);
  const [activeMode, setActiveMode] = useState(null); // 'ai', 'sample', or null

  const handleModeSelect = (mode) => {
    setActiveMode(mode);
    setShowMenu(false);
  };

  const handleClose = () => {
    setActiveMode(null);
  };

  const handlePatternGenerated = (pattern) => {
    onPatternGenerated(pattern);
    setActiveMode(null);
  };

  const handleSampleAdded = (sample) => {
    onSampleAdded(sample);
    setActiveMode(null);
  };

  // If a mode is active, show the full tile with spacing
  if (activeMode === 'ai') {
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <AIPromptTile onPatternGenerated={handlePatternGenerated} />
      </div>
    );
  }

  if (activeMode === 'sample') {
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <SampleTile onSampleAdded={handleSampleAdded} savedSamples={savedSamples} />
      </div>
    );
  }

  // Show compact add button
  if (!showMenu) {
    return (
      <div
        className="add-menu-compact"
        onClick={() => setShowMenu(true)}
      >
        <div className="add-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="add-label">Add Track</span>
      </div>
    );
  }

  // Show expanded menu with options - as a modal using portal
  return (
    <>
      {/* Floating + button */}
      <div
        className="add-menu-compact"
        onClick={() => setShowMenu(true)}
      >
        <div className="add-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="add-label">Add Track</span>
      </div>

      {/* Modal with options */}
      {showMenu && createPortal(
        <>
          <div className="add-menu-backdrop" onClick={() => setShowMenu(false)} />
          <div className="add-menu-modal">
            <div className="add-menu-header">
              <span>Add Track</span>
              <button className="add-menu-close" onClick={() => setShowMenu(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="add-menu-options">
        <button
          className="add-menu-option"
          onClick={() => handleModeSelect('ai')}
          style={{ '--option-color': '#EC4899' }}
        >
          <div className="option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="option-text">
            <span className="option-title">AI Generate</span>
            <span className="option-desc">Describe your sound</span>
          </div>
        </button>

        <button
          className="add-menu-option"
          onClick={() => handleModeSelect('sample')}
          style={{ '--option-color': '#F97316' }}
        >
          <div className="option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="option-text">
            <span className="option-title">Add Sample</span>
            <span className="option-desc">From YouTube or file</span>
          </div>
        </button>

        <button
          className="add-menu-option disabled"
          disabled
          style={{ '--option-color': '#6B7280' }}
        >
          <div className="option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div className="option-text">
            <span className="option-title">Record</span>
            <span className="option-desc">Coming soon</span>
          </div>
        </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
