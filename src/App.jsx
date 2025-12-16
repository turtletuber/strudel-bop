import { useState, useCallback, useEffect } from 'react';
import { sequences as initialSequences } from './sequences';
import { SequenceCard } from './components/SequenceCard';
import { Controls } from './components/Controls';
import { Visualizer } from './components/Visualizer';
import { AIPromptTile } from './components/AIPromptTile';
import { SampleTile } from './components/SampleTile';
import { RecordingTile } from './components/RecordingTile';
import { SequenceModal } from './components/SequenceModal';
import { useStrudel } from './useStrudel';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Initialize per-track settings
const initialTrackSettings = {};
initialSequences.forEach(seq => {
  initialTrackSettings[seq.id] = { volume: 80, reverb: 20 };
});

function App() {
  const [tempo, setTempo] = useState(100);
  const [sequences, setSequences] = useState(initialSequences);
  const [trackSettings, setTrackSettings] = useState(initialTrackSettings);
  const [multiTrackMode, setMultiTrackMode] = useState(true);
  const [modalSequence, setModalSequence] = useState(null);

  const {
    isPlaying,
    isLoading,
    isReady,
    error,
    activeTrackIds,
    play,
    stop,
    stopTrack,
    hush,
    setCps,
    initialize,
    isTrackPlaying
  } = useStrudel();

  // Build the code with current settings for a given sequence
  const buildCode = useCallback((index, customSettings = null) => {
    const seq = sequences[index];
    const baseCps = seq.bpm / 240;
    const adjustedCps = baseCps * (tempo / 100);

    // Use custom settings if provided, otherwise use track settings
    const settings = customSettings || trackSettings[seq.id];
    const vol = settings.volume;
    const rev = settings.reverb;

    // For samples, we need to handle differently - load sample separately
    if (seq.isSample) {
      return `setcps(${adjustedCps.toFixed(4)})
s("_smp").loopAt(4).gain(${(vol / 100).toFixed(2)}).room(${(rev / 100).toFixed(2)})`;
    }

    return `setcps(${adjustedCps.toFixed(4)})
${seq.code.trim()}
.gain(${(vol / 100).toFixed(2)})
.room(${(rev / 100).toFixed(2)})`;
  }, [sequences, tempo, trackSettings]);

  // Play a sequence by index
  const playSequence = useCallback(async (index, exclusive = true) => {
    const seq = sequences[index];
    const code = buildCode(index);
    const trackId = seq.id;
    // For samples, pass the URL to pre-load before evaluating
    const sampleUrl = seq.isSample ? `http://localhost:3001${seq.samplePath}` : null;
    await play(code, trackId, exclusive, sampleUrl);
  }, [sequences, buildCode, play]);

  // Handle sequence card click
  const handleSequenceClick = async (index) => {
    const trackId = sequences[index].id;
    const trackPlaying = isTrackPlaying(trackId);

    if (trackPlaying) {
      // If this track is playing, stop it
      await stopTrack(trackId);
    } else {
      // Play the track
      // In multi-track mode, add to existing; in single mode, replace
      await playSequence(index, !multiTrackMode);
    }
  };

  // Handle play button - play first sequence or stop all
  const handlePlay = async () => {
    if (isPlaying) {
      await hush();
    } else {
      await playSequence(0, true);
    }
  };

  // Handle stop button
  const handleStop = async () => {
    await hush();
  };

  // Update tempo - affects all tracks via global CPS
  const handleTempoChange = async (newTempo) => {
    setTempo(newTempo);
    // CPS affects all tracks globally, pick first active track's BPM as reference
    if (isPlaying && activeTrackIds.size > 0) {
      const firstActiveId = Array.from(activeTrackIds)[0];
      const seq = sequences.find(s => s.id === firstActiveId);
      if (seq) {
        const baseCps = seq.bpm / 240;
        const adjustedCps = baseCps * (newTempo / 100);
        setCps(adjustedCps);
      }
    }
  };

  // Update volume for a specific track
  const handleTrackVolumeChange = async (trackId, newVolume) => {
    // Update state
    setTrackSettings(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], volume: newVolume }
    }));

    // If this track is playing, re-evaluate it
    if (isTrackPlaying(trackId)) {
      const index = sequences.findIndex(s => s.id === trackId);
      if (index !== -1) {
        const seq = sequences[index];
        const code = buildCode(index, { volume: newVolume, reverb: trackSettings[trackId].reverb });
        const sampleUrl = seq.isSample ? `http://localhost:3001${seq.samplePath}` : null;
        await play(code, trackId, false, sampleUrl);
      }
    }
  };

  // Update reverb for a specific track
  const handleTrackReverbChange = async (trackId, newReverb) => {
    // Update state
    setTrackSettings(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], reverb: newReverb }
    }));

    // If this track is playing, re-evaluate it
    if (isTrackPlaying(trackId)) {
      const index = sequences.findIndex(s => s.id === trackId);
      if (index !== -1) {
        const seq = sequences[index];
        const code = buildCode(index, { volume: trackSettings[trackId].volume, reverb: newReverb });
        const sampleUrl = seq.isSample ? `http://localhost:3001${seq.samplePath}` : null;
        await play(code, trackId, false, sampleUrl);
      }
    }
  };

  // Copy sequence code to clipboard
  const handleCopySequence = (sequence) => {
    const index = sequences.findIndex(s => s.id === sequence.id);
    const code = buildCode(index);
    navigator.clipboard.writeText(code);
  };

  // Open modal for detailed editing
  const handleLongPress = (sequence) => {
    setModalSequence(sequence);
  };

  // Handle code change from modal
  const handleModalCodeChange = async (sequenceId, newCode) => {
    // Update the sequence code in state
    setSequences(prev => prev.map(s =>
      s.id === sequenceId ? { ...s, code: newCode } : s
    ));

    // If the track is playing, re-evaluate it with new code
    if (isTrackPlaying(sequenceId)) {
      const index = sequences.findIndex(s => s.id === sequenceId);
      if (index !== -1) {
        const seq = { ...sequences[index], code: newCode };
        const baseCps = seq.bpm / 240;
        const adjustedCps = baseCps * (tempo / 100);
        const settings = trackSettings[sequenceId];
        const fullCode = `setcps(${adjustedCps.toFixed(4)})
${newCode.trim()}
.gain(${(settings.volume / 100).toFixed(2)})
.room(${(settings.reverb / 100).toFixed(2)})`;
        await play(fullCode, sequenceId, false);
      }
    }

    // If it's an AI pattern, save the updated code to the server
    const sequence = sequences.find(s => s.id === sequenceId);
    if (sequence?.isAI) {
      try {
        await fetch(`${API_URL}/patterns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pattern: { ...sequence, code: newCode } })
        });
      } catch (err) {
        console.error('Failed to save updated pattern:', err);
      }
    }
  };

  // Handle AI-generated pattern - save to server
  const handlePatternGenerated = async (pattern) => {
    // Add new pattern to sequences
    setSequences(prev => [...prev, pattern]);
    // Initialize track settings for the new pattern
    setTrackSettings(prev => ({
      ...prev,
      [pattern.id]: { volume: 80, reverb: 20 }
    }));

    // Save to server for persistence
    try {
      await fetch(`${API_URL}/patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern })
      });
    } catch (err) {
      console.error('Failed to save pattern:', err);
    }
  };

  // Delete a sequence (AI pattern or sample)
  const handleDeleteSequence = async (sequence) => {
    // Stop the track if it's playing
    if (isTrackPlaying(sequence.id)) {
      await stopTrack(sequence.id);
    }

    // Remove from state
    setSequences(prev => prev.filter(s => s.id !== sequence.id));
    setTrackSettings(prev => {
      const newSettings = { ...prev };
      delete newSettings[sequence.id];
      return newSettings;
    });

    // Delete from server
    try {
      if (sequence.isAI) {
        await fetch(`${API_URL}/patterns/${sequence.id}`, { method: 'DELETE' });
      } else if (sequence.isSample) {
        // Extract filename from path
        const filename = sequence.samplePath.split('/').pop();
        await fetch(`${API_URL}/samples/${filename}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error('Failed to delete from server:', err);
    }
  };

  // Convert a downloaded sample to a sequence tile
  const sampleToSequence = (sample) => ({
    id: `sample-${sample.name.replace(/\.[^.]+$/, '')}`,
    name: sample.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
    color: '#F97316', // Orange for samples
    bpm: 120,
    description: 'Downloaded sample',
    isSample: true,
    samplePath: sample.path,
    code: `samples({ mysample: "http://localhost:3001${sample.path}" }); s("mysample").loopAt(4)`
  });

  // Handle sample downloaded - add as playable tile
  const handleSampleDownloaded = (sample) => {
    const sampleSeq = sampleToSequence(sample);
    setSequences(prev => [...prev, sampleSeq]);
    setTrackSettings(prev => ({
      ...prev,
      [sampleSeq.id]: { volume: 80, reverb: 20 }
    }));
  };

  // Load existing samples and AI patterns on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load samples
        const samplesRes = await fetch(`${API_URL}/samples`);
        const samplesData = await samplesRes.json();

        // Load AI patterns
        const patternsRes = await fetch(`${API_URL}/patterns`);
        const patternsData = await patternsRes.json();

        const newSequences = [];
        const newSettings = {};

        // Add samples
        if (samplesData.samples && samplesData.samples.length > 0) {
          const sampleSequences = samplesData.samples.map(sampleToSequence);
          newSequences.push(...sampleSequences);
          sampleSequences.forEach(seq => {
            newSettings[seq.id] = { volume: 80, reverb: 20 };
          });
        }

        // Add AI patterns
        if (patternsData.patterns && patternsData.patterns.length > 0) {
          newSequences.push(...patternsData.patterns);
          patternsData.patterns.forEach(p => {
            newSettings[p.id] = { volume: 80, reverb: 20 };
          });
        }

        if (newSequences.length > 0) {
          // Filter out duplicates by checking IDs
          setSequences(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = newSequences.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNew];
          });
          setTrackSettings(prev => ({ ...prev, ...newSettings }));
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    loadData();
  }, []);

  // Get active sequences for display
  const activeSequences = sequences.filter(s => activeTrackIds.has(s.id));
  const currentSeq = activeSequences.length > 0 ? activeSequences[0] : sequences[0];
  const displayBpm = activeSequences.length > 0
    ? Math.round(activeSequences[0].bpm * tempo / 100)
    : '--';
  const activeCount = activeTrackIds.size;

  return (
    <div className="app">
      <header>
        <h1>Strudel Bop</h1>
        <p className="subtitle">Live Coding Music Interface</p>
      </header>

      <main>
        <div className="visualizer-section">
          <Visualizer isPlaying={isPlaying} color={currentSeq.color} />
          <div className="current-info" style={{ borderColor: currentSeq.color }}>
            <span className="label">
              {isPlaying
                ? (activeCount > 1 ? `${activeCount} Tracks Playing` : 'Now Playing')
                : 'Ready'}
            </span>
            <span className="name">
              {isPlaying
                ? activeSequences.map(s => s.name).join(' + ')
                : 'Click a sequence to play'}
            </span>
            {isPlaying && <span className="bpm-display">{displayBpm} BPM</span>}
          </div>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        <Controls
          isPlaying={isPlaying}
          isLoading={isLoading}
          onPlay={handlePlay}
          onStop={handleStop}
          tempo={tempo}
          onTempoChange={handleTempoChange}
          multiTrackMode={multiTrackMode}
          onMultiTrackToggle={() => setMultiTrackMode(!multiTrackMode)}
        />

        {/* Creator Widgets - Always at top */}
        <div className="widgets-section">
          <AIPromptTile onPatternGenerated={handlePatternGenerated} />
          <SampleTile
            onSampleAdded={handleSampleDownloaded}
            savedSamples={sequences.filter(s => s.isSample).map(s => ({ name: s.samplePath.split('/').pop(), path: s.samplePath }))}
          />
          <RecordingTile />
        </div>

        {/* Sequence Tiles Grid */}
        <div className="sequences-grid">
          {sequences.map((seq, index) => (
            <SequenceCard
              key={seq.id}
              sequence={seq}
              isActive={isTrackPlaying(seq.id)}
              isPlaying={isTrackPlaying(seq.id)}
              onClick={() => handleSequenceClick(index)}
              onCopy={handleCopySequence}
              onDelete={handleDeleteSequence}
              onLongPress={handleLongPress}
              volume={trackSettings[seq.id]?.volume ?? 80}
              reverb={trackSettings[seq.id]?.reverb ?? 20}
              onVolumeChange={handleTrackVolumeChange}
              onReverbChange={handleTrackReverbChange}
            />
          ))}
        </div>

        {activeCount > 0 && (
          <div className="code-preview">
            <div className="code-header">
              <span>{activeCount > 1 ? 'Active Pattern Codes' : 'Current Pattern Code'}</span>
              <button
                className="copy-button"
                onClick={() => {
                  const allCode = activeSequences.map((seq) => {
                    const index = sequences.findIndex(s => s.id === seq.id);
                    return `// ${seq.name}\n${buildCode(index)}`;
                  }).join('\n\n');
                  navigator.clipboard.writeText(allCode);
                }}
              >
                Copy All
              </button>
            </div>
            <pre>
              <code>
                {activeSequences.map((seq) => {
                  const index = sequences.findIndex(s => s.id === seq.id);
                  return `// ${seq.name}\n${buildCode(index)}`;
                }).join('\n\n')}
              </code>
            </pre>
          </div>
        )}
      </main>

      <footer>
        <p>Click any sequence to play - Powered by Strudel</p>
      </footer>

      <SequenceModal
        sequence={modalSequence}
        isOpen={!!modalSequence}
        onClose={() => setModalSequence(null)}
        onCodeChange={handleModalCodeChange}
        isPlaying={modalSequence ? isTrackPlaying(modalSequence.id) : false}
      />
    </div>
  );
}

export default App;
