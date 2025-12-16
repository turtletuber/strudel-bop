import React, { useState, useRef, useEffect } from 'react';

export function SequenceCard({
  sequence,
  isActive,
  isPlaying,
  onClick,
  onCopy,
  onDelete,
  onLongPress,
  volume,
  reverb,
  onVolumeChange,
  onReverbChange
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [showMenu]);

  const handleMouseDown = (e) => {
    isLongPress.current = false;

    // Store touch start position to detect dragging
    if (e.touches) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowMenu(true);
      // Haptic feedback on mobile if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms for long press
  };

  const handleMouseMove = (e) => {
    // Cancel long press if finger moves too much (scrolling)
    if (e.touches && longPressTimer.current) {
      const moveThreshold = 10; // pixels
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

      if (dx > moveThreshold || dy > moveThreshold) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (!isLongPress.current && !showMenu) {
      onClick?.();
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onLongPress?.(sequence);
  };

  const handleMenuCopy = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onCopy) {
      onCopy(sequence);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleMenuDelete = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirmDelete) {
      onDelete?.(sequence);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    if (onCopy) {
      onCopy(sequence);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete?.(sequence);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Reset after 3 seconds if not confirmed
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleVolumeChange = (e) => {
    e.stopPropagation();
    onVolumeChange?.(sequence.id, Number(e.target.value));
  };

  const handleReverbChange = (e) => {
    e.stopPropagation();
    onReverbChange?.(sequence.id, Number(e.target.value));
  };

  // Show delete button only for deletable items (AI or samples)
  const isDeletable = sequence.isAI || sequence.isSample;

  return (
    <div
      className={`sequence-card ${isActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}`}
      style={{
        '--accent-color': sequence.color
      }}
    >
      <div className="card-indicator" />

      {/* Clickable header area */}
      <div
        className="card-header"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onTouchCancel={handleMouseUp}
      >
        <div className="card-title-row">
          <h3>{sequence.name}</h3>
          {isPlaying && (
            <div className="playing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
        <p className="description">{sequence.description}</p>
      </div>


      {/* Desktop actions - hidden on mobile */}
      <div className="card-actions card-actions-desktop">
        {isDeletable && (
          <button
            className={`card-delete-btn ${confirmDelete ? 'confirm' : ''}`}
            onClick={handleDeleteClick}
            title={confirmDelete ? 'Click again to delete' : 'Delete'}
          >
            {confirmDelete ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
        )}
        <button
          className={`card-copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile long-press menu */}
      {showMenu && (
        <div className="card-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          {/* Volume and Reverb Sliders */}
          <div className="menu-sliders">
            <div className="menu-slider">
              <label>
                <span>Volume</span>
                <span className="value">{volume}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="menu-slider">
              <label>
                <span>Reverb</span>
                <span className="value">{reverb}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={reverb}
                onChange={handleReverbChange}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Menu divider */}
          <div className="menu-divider"></div>

          {/* Menu buttons */}
          <button className="menu-item" onClick={handleEdit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
          </button>
          <button className="menu-item" onClick={handleMenuCopy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy Code
          </button>
          {isDeletable && (
            <button className="menu-item menu-item-danger" onClick={handleMenuDelete}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              {confirmDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
          )}
          <button className="menu-item" onClick={() => setShowMenu(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
        </div>
      )}

      {/* Backdrop for menu */}
      {showMenu && (
        <div className="card-menu-backdrop" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}
