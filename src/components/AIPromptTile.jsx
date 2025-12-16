import React, { useState, useRef, useEffect } from 'react';

const API_URL = 'http://localhost:3001/api';

export function AIPromptTile({ onPatternGenerated }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll the prompt text as user types
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [prompt]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() })
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Pass the generated pattern to parent
        onPatternGenerated?.({
          id: `ai-${Date.now()}`,
          name: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
          description: prompt,
          code: data.code,
          color: '#EC4899', // Pink for AI-generated
          bpm: 120, // Default BPM
          isAI: true
        });

        // Reset
        setPrompt('');
        setIsExpanded(false);
      }
    } catch (err) {
      setError('Failed to generate. Is the server running?');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setPrompt('');
    }
  };

  if (!isExpanded) {
    return (
      <div
        className="sequence-card ai-prompt-tile collapsed"
        onClick={() => setIsExpanded(true)}
        style={{ '--accent-color': '#EC4899' }}
      >
        <div className="ai-add-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div className="ai-add-text">
          <span className="ai-label">AI Generate</span>
          <span className="ai-hint">Describe your sound...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sequence-card ai-prompt-tile expanded"
      style={{ '--accent-color': '#EC4899' }}
    >
      <div className="card-indicator" style={{ opacity: 1 }} />

      <div className="ai-header">
        <span className="ai-label">Describe your track</span>
        <button
          className="ai-close-btn"
          onClick={() => {
            setIsExpanded(false);
            setPrompt('');
            setError(null);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="ai-prompt-scroll" ref={scrollRef}>
        <textarea
          ref={textareaRef}
          className="ai-prompt-input"
          placeholder="e.g., chill lo-fi beat with soft piano and vinyl crackle..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
        />
      </div>

      {error && (
        <div className="ai-error">{error}</div>
      )}

      <div className="ai-footer">
        <span className="ai-hint">
          {isGenerating ? 'Generating...' : 'Press Enter to generate'}
        </span>
        {isGenerating && <span className="loading-spinner small" />}
      </div>
    </div>
  );
}
