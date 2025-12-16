import React from 'react';

export function Controls({
  tempo,
  onTempoChange
}) {
  return (
    <div className="controls">
      <div className="sliders">
        <div className="slider-group">
          <label>
            <span>Tempo</span>
            <span className="value">{tempo}%</span>
          </label>
          <input
            type="range"
            min="50"
            max="150"
            value={tempo}
            onChange={(e) => onTempoChange(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
