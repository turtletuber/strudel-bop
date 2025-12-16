import React, { useRef, useEffect, useState } from 'react';

export function Visualizer({ isPlaying, color = '#8B5CF6' }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);

  useEffect(() => {
    // Try to get or create audio context and analyser
    const setupAudio = () => {
      try {
        // Check for existing audio context from Strudel
        const ctx = window.AudioContext || window.webkitAudioContext;
        if (!ctx) return;

        // Look for Strudel's audio context
        if (window.getAudioContext) {
          const strudelCtx = window.getAudioContext();
          if (strudelCtx) {
            const analyserNode = strudelCtx.createAnalyser();
            analyserNode.fftSize = 128;
            analyserNode.smoothingTimeConstant = 0.8;
            setAnalyser(analyserNode);
            setAudioContext(strudelCtx);
          }
        }
      } catch (e) {
        console.warn('Could not setup visualizer:', e);
      }
    };

    if (isPlaying) {
      setupAudio();
    }
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let phase = 0;

    const draw = () => {
      ctx.fillStyle = 'rgba(15, 15, 20, 0.2)';
      ctx.fillRect(0, 0, width, height);

      if (isPlaying) {
        // Animated wave visualization
        const barCount = 32;
        const barWidth = width / barCount;

        for (let i = 0; i < barCount; i++) {
          // Create dynamic heights using sine waves
          const baseHeight = Math.sin(phase + i * 0.3) * 0.3 + 0.5;
          const randomness = Math.sin(phase * 2 + i * 0.7) * 0.2;
          const barHeight = (baseHeight + randomness) * height * 0.7;

          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, `${color}33`);

          ctx.fillStyle = gradient;
          ctx.fillRect(
            i * barWidth + 2,
            height - barHeight,
            barWidth - 4,
            barHeight
          );
        }

        phase += 0.05;
      } else {
        // Idle state - flat line
        ctx.strokeStyle = `${color}66`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, color]);

  return (
    <div className="visualizer">
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
      />
    </div>
  );
}
