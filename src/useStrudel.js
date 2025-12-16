import { useState, useRef, useCallback, useEffect } from 'react';

let globalRepl = null;
let globalAudioContext = null;
let isInitialized = false;
let initPromise = null;
let samplesFunction = null; // Reference to the samples function for loading custom samples

async function initStrudel() {
  if (isInitialized && globalRepl) return { repl: globalRepl, audioContext: globalAudioContext };
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('Loading Strudel packages...');

      // Import all required packages
      const [core, webaudio, mini, tonal, transpilerPkg] = await Promise.all([
        import('@strudel/core'),
        import('@strudel/webaudio'),
        import('@strudel/mini'),
        import('@strudel/tonal'),
        import('@strudel/transpiler')
      ]);

      console.log('Packages loaded, initializing audio...');

      const { repl, evalScope } = core;
      const { getAudioContext, webaudioOutput, initAudioOnFirstClick, registerSynthSounds, samples } = webaudio;
      const { transpiler } = transpilerPkg;

      // Get audio context
      globalAudioContext = getAudioContext();

      // Initialize audio on first click
      initAudioOnFirstClick();

      // Register synth sounds
      registerSynthSounds();

      // Store the samples function for later use
      samplesFunction = samples;

      // Set up evalScope with all modules - this makes functions globally available
      await evalScope(
        import('@strudel/core'),
        import('@strudel/mini'),
        import('@strudel/webaudio'),
        import('@strudel/tonal')
      );

      console.log('Loading samples...');

      // Load samples
      await samples('github:tidalcycles/dirt-samples');

      console.log('Creating REPL instance...');

      // Create the REPL with proper configuration
      globalRepl = repl({
        defaultOutput: webaudioOutput,
        getTime: () => globalAudioContext.currentTime,
        transpiler,
      });

      isInitialized = true;
      console.log('Strudel initialized successfully!');

      return { repl: globalRepl, audioContext: globalAudioContext };
    } catch (err) {
      console.error('Failed to initialize Strudel:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

// Track which patterns are currently playing
let activeTracks = new Set();

export function useStrudel() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [activeTrackIds, setActiveTrackIds] = useState(new Set());
  const replRef = useRef(null);

  // Initialize on first interaction
  const initialize = useCallback(async () => {
    if (isReady && replRef.current) return true;

    setIsLoading(true);
    setError(null);

    try {
      const { repl, audioContext } = await initStrudel();
      replRef.current = repl;

      // Resume audio context (required by browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      setIsReady(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      return false;
    }
  }, [isReady]);

  // Store pattern code for each track (for multi-track rebuilding)
  const trackPatternsRef = useRef({});

  // Play a pattern (multi-track: adds to existing patterns)
  // sampleUrl: optional URL to pre-load as a sample before evaluating
  const play = useCallback(async (code, trackId = 'default', exclusive = false, sampleUrl = null) => {
    setIsLoading(true);
    setError(null);

    try {
      // Initialize if needed
      if (!isReady || !replRef.current) {
        const success = await initialize();
        if (!success) {
          setIsLoading(false);
          return false;
        }
      }

      // Resume audio context if needed
      if (globalAudioContext?.state === 'suspended') {
        await globalAudioContext.resume();
      }

      // Pre-load sample if URL provided (bypasses transpiler parsing)
      if (sampleUrl && samplesFunction) {
        console.log('Pre-loading sample:', sampleUrl);
        await samplesFunction({ _smp: sampleUrl });
      }

      console.log('Evaluating pattern for track:', trackId, 'exclusive:', exclusive);

      // The code may contain setcps() call at the start - extract it
      const lines = code.trim().split('\n');
      let setCpsLine = '';
      let patternCode = code.trim();

      if (lines[0].trim().startsWith('setcps(')) {
        setCpsLine = lines[0];
        patternCode = lines.slice(1).join('\n').trim();
      }

      // Store the pattern code for this track
      if (exclusive) {
        // Clear all stored patterns in exclusive mode
        trackPatternsRef.current = {};
        activeTracks.clear();
      }

      // Store this track's pattern
      trackPatternsRef.current[trackId] = patternCode;
      activeTracks.add(trackId);

      // Build combined code - stack all patterns into one
      const patternsList = Object.values(trackPatternsRef.current);
      let combinedCode;

      if (patternsList.length === 1) {
        // Single pattern - just play it directly
        combinedCode = setCpsLine
          ? `${setCpsLine};\n${patternsList[0]}`
          : patternsList[0];
      } else {
        // Multiple patterns - wrap them all in stack()
        const stackedPatterns = patternsList
          .map(p => `(${p})`)
          .join(',\n  ');
        combinedCode = setCpsLine
          ? `${setCpsLine};\nstack(\n  ${stackedPatterns}\n)`
          : `stack(\n  ${stackedPatterns}\n)`;
      }

      console.log('Combined code for all tracks:', combinedCode);

      // Always hush and re-evaluate all patterns together
      await replRef.current.evaluate(combinedCode, true, true);

      setActiveTrackIds(new Set(activeTracks));
      setIsPlaying(true);
      setIsLoading(false);
      console.log('Playing! Active tracks:', Array.from(activeTracks));
      return true;
    } catch (err) {
      console.error('Play error:', err);
      setError(err.message);
      setIsLoading(false);
      return false;
    }
  }, [isReady, initialize]);

  // Stop a specific track (or all if no trackId)
  const stopTrack = useCallback(async (trackId) => {
    if (!replRef.current) return;

    try {
      if (trackId) {
        // Remove this track from stored patterns
        console.log('Stopping track:', trackId);
        delete trackPatternsRef.current[trackId];
        activeTracks.delete(trackId);
        setActiveTrackIds(new Set(activeTracks));

        if (activeTracks.size === 0) {
          // No more tracks, just hush
          await replRef.current.evaluate('hush()');
          setIsPlaying(false);
        } else {
          // Rebuild and play remaining tracks using stack()
          const patternsList = Object.values(trackPatternsRef.current);
          let combinedCode;

          if (patternsList.length === 1) {
            combinedCode = patternsList[0];
          } else {
            const stackedPatterns = patternsList
              .map(p => `(${p})`)
              .join(',\n  ');
            combinedCode = `stack(\n  ${stackedPatterns}\n)`;
          }

          console.log('Rebuilding with remaining tracks:', combinedCode);
          await replRef.current.evaluate(combinedCode, true, true);
        }
      } else {
        // Stop all tracks
        await replRef.current.evaluate('hush()');
        trackPatternsRef.current = {};
        activeTracks.clear();
        setActiveTrackIds(new Set());
        setIsPlaying(false);
      }
      console.log('Active tracks after stop:', Array.from(activeTracks));
    } catch (err) {
      console.error('Stop track error:', err);
    }
  }, []);

  // Stop all playback
  const stop = useCallback(async () => {
    if (replRef.current) {
      try {
        replRef.current.stop();
        activeTracks.clear();
        setActiveTrackIds(new Set());
        setIsPlaying(false);
      } catch (err) {
        console.error('Stop error:', err);
      }
    }
  }, []);

  // Hush (silence all but keep scheduler running)
  const hush = useCallback(async () => {
    if (replRef.current) {
      try {
        await replRef.current.evaluate('hush()');
        trackPatternsRef.current = {};
        activeTracks.clear();
        setActiveTrackIds(new Set());
        setIsPlaying(false);
      } catch (err) {
        console.error('Hush error:', err);
      }
    }
  }, []);

  // Set tempo (CPS)
  const setCps = useCallback((cps) => {
    if (replRef.current) {
      replRef.current.setCps(cps);
    }
  }, []);

  // Check if a specific track is playing
  const isTrackPlaying = useCallback((trackId) => {
    return activeTrackIds.has(trackId);
  }, [activeTrackIds]);

  return {
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
    isTrackPlaying,
  };
}
