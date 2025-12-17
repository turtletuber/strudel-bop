import React, { useState, useEffect, useMemo } from 'react';

// Parameter definitions with min/max/step values
const PARAM_CONFIG = {
  gain: { min: 0, max: 1, step: 0.01, label: 'Gain', icon: '🔊' },
  room: { min: 0, max: 1, step: 0.01, label: 'Room', icon: '🏠' },
  delay: { min: 0, max: 1, step: 0.01, label: 'Delay', icon: '⏱' },
  cutoff: { min: 100, max: 5000, step: 50, label: 'Cutoff', icon: '🎚' },
  resonance: { min: 0, max: 30, step: 0.5, label: 'Resonance', icon: '〰' },
  decay: { min: 0, max: 2, step: 0.01, label: 'Decay', icon: '📉' },
  attack: { min: 0, max: 2, step: 0.01, label: 'Attack', icon: '📈' },
  release: { min: 0, max: 2, step: 0.01, label: 'Release', icon: '🎵' },
  pan: { min: -1, max: 1, step: 0.1, label: 'Pan', icon: '↔' },
  speed: { min: 0.25, max: 4, step: 0.25, label: 'Speed', icon: '⚡' },
  fast: { min: 0.25, max: 4, step: 0.25, label: 'Fast', icon: '🏃' },
  slow: { min: 0.25, max: 4, step: 0.25, label: 'Slow', icon: '🐢' },
};

// Extract parameters from code
function extractParameters(code) {
  const params = [];
  const regex = /\.(\w+)\(([0-9.]+)\)/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const [fullMatch, name, value] = match;
    if (PARAM_CONFIG[name]) {
      params.push({
        name,
        value: parseFloat(value),
        index: match.index,
        length: fullMatch.length,
        config: PARAM_CONFIG[name]
      });
    }
  }

  return params;
}

// Update a parameter value in code
function updateCodeParameter(code, paramIndex, newValue) {
  const params = extractParameters(code);
  const param = params[paramIndex];
  if (!param) return code;

  const before = code.slice(0, param.index);
  const after = code.slice(param.index + param.length);
  const newParam = `.${param.name}(${newValue})`;

  return before + newParam + after;
}

// Parse pattern from Strudel code like s("_smp ~ _smp ~") or s("bd*4")
function parsePatternFromCode(code, numSteps = 16) {
  // Try to find pattern like s("...") or sound("...")
  const match = code.match(/s\("([^"]+)"\)/);
  if (!match) return null;

  const patternStr = match[1];

  // Check for simple repetition pattern like "bd*4" or "hh*8"
  const repeatMatch = patternStr.match(/^(\w+(?::\d+)?)\*(\d+)$/);
  if (repeatMatch) {
    const [, sound, count] = repeatMatch;
    const repeatCount = parseInt(count);
    // Create evenly spaced hits
    const steps = new Array(numSteps).fill(false);
    const spacing = numSteps / repeatCount;
    for (let i = 0; i < repeatCount; i++) {
      const stepIndex = Math.floor(i * spacing);
      if (stepIndex < numSteps) steps[stepIndex] = true;
    }
    return { steps, sound };
  }

  // Otherwise parse space-separated pattern
  const tokens = patternStr.split(/\s+/);
  const steps = tokens.map(s => s !== '~' && s !== '');

  // Extract sound name from first non-rest token
  const firstSound = tokens.find(s => s !== '~' && s !== '');

  return { steps, sound: firstSound || 'bd' };
}

// Check if a pattern is "simple" (single sound, sequenceable)
function isSimplePattern(code) {
  if (!code) return false;
  const trimmed = code.trim();
  // Match patterns like: s("bd*4") or s("hh*8") with optional .gain(), etc.
  // Should NOT match stack() or complex patterns
  if (trimmed.startsWith('stack(') || trimmed.includes('\n')) return false;
  const match = trimmed.match(/^s\("([^"]+)"\)/);
  if (!match) return false;
  const pattern = match[1];
  // Simple if it's like "bd*4" or space-separated single sounds
  return /^(\w+(?::\d+)?)\*\d+$/.test(pattern) || /^[\w~:\s]+$/.test(pattern);
}

// Generate Strudel pattern code from steps
function generatePatternCode(steps, sampleName = '_smp') {
  const pattern = steps.map(hit => hit ? sampleName : '~').join(' ');
  return `s("${pattern}")`;
}

// Step Sequencer component for samples
function StepSequencer({ steps, onChange, color, numSteps = 16 }) {
  const handleStepClick = (index) => {
    const newSteps = [...steps];
    newSteps[index] = !newSteps[index];
    onChange(newSteps);
  };

  // Quick presets
  const presets = [
    { name: '4 on floor', pattern: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] },
    { name: 'Every 2', pattern: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    { name: 'Off-beat', pattern: [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1] },
    { name: 'Once', pattern: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  ];

  const applyPreset = (pattern) => {
    const newSteps = pattern.slice(0, numSteps).map(v => !!v);
    // Pad with false if needed
    while (newSteps.length < numSteps) {
      newSteps.push(false);
    }
    onChange(newSteps);
  };

  const clearAll = () => {
    onChange(new Array(numSteps).fill(false));
  };

  return (
    <div className="step-sequencer">
      <div className="step-presets">
        {presets.map((preset, idx) => (
          <button
            key={idx}
            className="step-preset-btn"
            onClick={() => applyPreset(preset.pattern)}
          >
            {preset.name}
          </button>
        ))}
        <button className="step-preset-btn clear" onClick={clearAll}>
          Clear
        </button>
      </div>
      <div className="step-grid">
        {steps.map((hit, index) => (
          <button
            key={index}
            className={`step-btn ${hit ? 'active' : ''} ${index % 4 === 0 ? 'downbeat' : ''}`}
            onClick={() => handleStepClick(index)}
            style={{ '--step-color': color }}
          >
            <span className="step-number">{index + 1}</span>
          </button>
        ))}
      </div>
      <div className="step-labels">
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
      </div>
    </div>
  );
}

export function SequenceModal({
  sequence,
  isOpen,
  onClose,
  onCodeChange,
  isPlaying
}) {
  const [localCode, setLocalCode] = useState(sequence?.code || '');
  const [params, setParams] = useState([]);
  const [steps, setSteps] = useState(new Array(16).fill(false));
  const [loopBars, setLoopBars] = useState(16);
  const [numSteps, setNumSteps] = useState(16);
  const [soundName, setSoundName] = useState('bd');
  // Default to 'code' view for regular patterns, 'sequencer' for samples/simple patterns
  const [viewMode, setViewMode] = useState('code');

  const isSample = sequence?.isSample;
  const isSimple = isSimplePattern(sequence?.code);
  const canUseSequencer = !isSample && isSimple; // Samples don't get sequencer anymore

  // Reset view mode when sequence changes
  useEffect(() => {
    // Samples always use code view now, simple patterns use sequencer
    setViewMode((isSimplePattern(sequence?.code) && !sequence?.isSample) ? 'sequencer' : 'code');
  }, [sequence?.id, sequence?.isSample, sequence?.code]);

  // Update local code when sequence changes
  useEffect(() => {
    if (sequence?.code) {
      setLocalCode(sequence.code);

      // For samples or simple patterns, try to parse existing pattern
      if (sequence.isSample || isSimplePattern(sequence.code)) {
        const parsed = parsePatternFromCode(sequence.code, 16);
        if (parsed) {
          const { steps: parsedSteps, sound } = parsed;
          // Ensure we have exactly 16 steps
          const normalizedSteps = parsedSteps.length >= 16
            ? parsedSteps.slice(0, 16)
            : [...parsedSteps, ...new Array(16 - parsedSteps.length).fill(false)];
          setSteps(normalizedSteps);
          setNumSteps(16);
          setSoundName(sound || (sequence.isSample ? '_smp' : 'bd'));
        } else {
          // Default: play on beat 1
          setSteps([true, ...new Array(15).fill(false)]);
          setSoundName(sequence.isSample ? '_smp' : 'bd');
        }

        // Try to extract loopAt value (for samples)
        if (sequence.isSample) {
          const loopMatch = sequence.code.match(/\.loopAt\((\d+)\)/);
          if (loopMatch) {
            setLoopBars(parseInt(loopMatch[1]));
          }
        }
      }
    }
  }, [sequence?.code, sequence?.isSample]);

  // Extract parameters when code changes (now includes samples!)
  useEffect(() => {
    const extracted = extractParameters(localCode);
    setParams(extracted);
  }, [localCode]);

  // Group parameters by name (aggregate duplicates)
  const groupedParams = useMemo(() => {
    const groups = {};
    params.forEach((param, index) => {
      const key = `${param.name}-${index}`;
      groups[key] = { ...param, paramIndex: index };
    });
    return Object.values(groups);
  }, [params]);

  const handleParamChange = (paramIndex, newValue) => {
    const newCode = updateCodeParameter(localCode, paramIndex, newValue);
    setLocalCode(newCode);
    onCodeChange?.(sequence.id, newCode);
  };

  const handleCodeEdit = (e) => {
    const newCode = e.target.value;
    setLocalCode(newCode);
    onCodeChange?.(sequence.id, newCode);
  };

  // Handle step sequencer changes
  const handleStepsChange = (newSteps) => {
    setSteps(newSteps);
    updatePatternCode(newSteps, loopBars);
  };

  const handleLoopBarsChange = (newLoopBars) => {
    setLoopBars(newLoopBars);
    updatePatternCode(steps, newLoopBars);
  };

  const handleNumStepsChange = (newNum) => {
    const newSteps = steps.slice(0, newNum);
    while (newSteps.length < newNum) {
      newSteps.push(false);
    }
    setNumSteps(newNum);
    setSteps(newSteps);
    updatePatternCode(newSteps, loopBars);
  };

  // Generate code from step sequencer state
  const updatePatternCode = (currentSteps, currentLoopBars) => {
    const patternCode = generatePatternCode(currentSteps, soundName);

    let newCode;
    if (isSample) {
      // Samples need .loopAt()
      newCode = `${patternCode}.loopAt(${currentLoopBars})`;
    } else {
      // Simple patterns - preserve any existing effects like .gain()
      const gainMatch = sequence.code.match(/\.gain\(([^)]+)\)/);
      const gainSuffix = gainMatch ? `.gain(${gainMatch[1]})` : '';
      newCode = `${patternCode}${gainSuffix}`;
    }

    setLocalCode(newCode);
    onCodeChange?.(sequence.id, newCode);
  };

  if (!isOpen || !sequence) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <div
              className="modal-color-dot"
              style={{ background: sequence.color }}
            />
            <h2>{sequence.name}</h2>
            {isPlaying && (
              <span className="modal-playing-badge">Playing</span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* View Mode Toggle - show for samples and simple patterns */}
          {canUseSequencer && (
            <div className="modal-view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'sequencer' ? 'active' : ''}`}
                onClick={() => setViewMode('sequencer')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="4" height="4" />
                  <rect x="10" y="3" width="4" height="4" />
                  <rect x="17" y="3" width="4" height="4" />
                  <rect x="3" y="10" width="4" height="4" />
                  <rect x="10" y="10" width="4" height="4" />
                  <rect x="17" y="10" width="4" height="4" />
                </svg>
                Sequencer
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
                onClick={() => setViewMode('code')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                Code
              </button>
            </div>
          )}

          {canUseSequencer && viewMode === 'sequencer' ? (
            // Step sequencer UI for simple patterns and samples
            <div className="modal-sample-section">
              <div className="modal-section-header">
                <span>Pattern: <strong>{soundName}</strong></span>
                <div className="modal-step-controls">
                  <label>
                    Steps:
                    <select
                      value={numSteps}
                      onChange={(e) => handleNumStepsChange(parseInt(e.target.value))}
                    >
                      <option value={8}>8</option>
                      <option value={16}>16</option>
                    </select>
                  </label>
                  {isSample && (
                    <label>
                      Loop:
                      <select
                        value={loopBars}
                        onChange={(e) => handleLoopBarsChange(parseInt(e.target.value))}
                      >
                        <option value={1}>1 bar</option>
                        <option value={2}>2 bars</option>
                        <option value={4}>4 bars</option>
                        <option value={8}>8 bars</option>
                        <option value={16}>16 bars</option>
                        <option value={32}>32 bars</option>
                        <option value={64}>64 bars</option>
                      </select>
                    </label>
                  )}
                  {!isSample && (
                    <span className="modal-bpm">{sequence.bpm} BPM</span>
                  )}
                </div>
              </div>

              <StepSequencer
                steps={steps.slice(0, numSteps)}
                onChange={handleStepsChange}
                color={sequence.color}
                numSteps={numSteps}
              />

              <div className="modal-code-preview">
                <div className="modal-section-header">
                  <span>Generated Code</span>
                </div>
                <code className="modal-code-inline">{localCode}</code>
              </div>
            </div>
          ) : (
            // Code editor UI with grid layout
            <div className="modal-body-grid">
              <div className="modal-code-section">
                <div className="modal-section-header">
                  <span>Code</span>
                  <span className="modal-bpm">{sequence.bpm} BPM</span>
                </div>
                <textarea
                  className="modal-code-editor"
                  value={localCode}
                  onChange={handleCodeEdit}
                  spellCheck={false}
                />
              </div>

              <div className="modal-params-section">
                <div className="modal-section-header">
                  <span>Parameters</span>
                  <span className="modal-param-count">{groupedParams.length} found</span>
                </div>

                {groupedParams.length > 0 ? (
                  <div className="modal-params-list">
                    {groupedParams.map((param, idx) => (
                      <div key={idx} className="modal-param">
                        <div className="modal-param-header">
                          <span className="modal-param-icon">{param.config.icon}</span>
                          <span className="modal-param-name">{param.config.label}</span>
                          <span className="modal-param-value">
                            {param.value.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={param.config.min}
                          max={param.config.max}
                          step={param.config.step}
                          value={param.value}
                          onChange={(e) => handleParamChange(param.paramIndex, parseFloat(e.target.value))}
                          className="modal-param-slider"
                          style={{ '--param-color': sequence.color }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="modal-no-params">
                    No adjustable parameters found.
                    <br />
                    <span className="modal-hint">
                      Try adding .gain(), .room(), .cutoff(), etc.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="modal-description">{sequence.description}</p>
        </div>
      </div>
    </div>
  );
}
