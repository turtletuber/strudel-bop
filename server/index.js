import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(__dirname, '..', 'public', 'samples');

// Detect yt-dlp and ffmpeg paths (works locally and on Railway)
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';

// Initialize Gemini (API key from environment)
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Ensure samples directory exists
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve samples statically
app.use('/samples', express.static(SAMPLES_DIR));

// Get list of downloaded samples
app.get('/api/samples', (req, res) => {
  try {
    const files = fs.readdirSync(SAMPLES_DIR)
      .filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
      .map(f => ({
        name: f,
        path: `/samples/${f}`,
        size: fs.statSync(path.join(SAMPLES_DIR, f)).size
      }));
    res.json({ samples: files });
  } catch (err) {
    res.json({ samples: [] });
  }
});

// Get video/audio info without downloading
app.post('/api/info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const args = [
    '--dump-json',
    '--no-download',
    url
  ];

  const ytdlp = spawn(YT_DLP_PATH, args);
  let output = '';
  let error = '';

  ytdlp.stdout.on('data', (data) => {
    output += data.toString();
  });

  ytdlp.stderr.on('data', (data) => {
    error += data.toString();
  });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      return res.status(400).json({ error: error || 'Failed to fetch info' });
    }
    try {
      const info = JSON.parse(output);
      res.json({
        title: info.title,
        duration: info.duration,
        thumbnail: info.thumbnail,
        uploader: info.uploader,
        url: url
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse info' });
    }
  });
});

// Download audio sample
app.post('/api/download', async (req, res) => {
  const { url, startTime, endTime, filename } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Generate safe filename
  const safeName = (filename || `sample_${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50);
  const outputPath = path.join(SAMPLES_DIR, `${safeName}.mp3`);

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outputPath,
    '--no-playlist',
    '--ffmpeg-location', FFMPEG_PATH
  ];

  // Add time range if specified
  if (startTime && endTime) {
    args.push('--download-sections', `*${startTime}-${endTime}`);
  }

  args.push(url);

  console.log('Running yt-dlp with args:', args.join(' '));

  const ytdlp = spawn(YT_DLP_PATH, args);
  let error = '';
  let progress = '';

  ytdlp.stdout.on('data', (data) => {
    progress += data.toString();
    console.log('yt-dlp:', data.toString());
  });

  ytdlp.stderr.on('data', (data) => {
    error += data.toString();
    console.error('yt-dlp error:', data.toString());
  });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      return res.status(400).json({ error: error || 'Download failed' });
    }

    // Check if file exists
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      res.json({
        success: true,
        filename: `${safeName}.mp3`,
        path: `/samples/${safeName}.mp3`,
        size: stats.size
      });
    } else {
      // yt-dlp might have added a different extension or modified name
      const files = fs.readdirSync(SAMPLES_DIR).filter(f => f.includes(safeName));
      if (files.length > 0) {
        const actualFile = files[0];
        const stats = fs.statSync(path.join(SAMPLES_DIR, actualFile));
        res.json({
          success: true,
          filename: actualFile,
          path: `/samples/${actualFile}`,
          size: stats.size
        });
      } else {
        res.status(500).json({ error: 'Download completed but file not found' });
      }
    }
  });
});

// Delete a sample
app.delete('/api/samples/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(SAMPLES_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Sample not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete sample' });
  }
});

// Generate Strudel code with Gemini
const STRUDEL_SYSTEM_PROMPT = `You are an expert Strudel code generator. Strudel is a powerful JavaScript library for live coding music and algorithmic composition.

CRITICAL: Return ONLY valid JavaScript code. NO markdown, NO explanations, NO comments outside the code.
NEVER use TidalCycles/Haskell syntax like $ or arp "up". Use JavaScript method chaining only.

=== SOUND SOURCES ===
Samples: bd (kick), sd/sn (snare), hh/hat (hihat), cp (clap), oh (open hat), lt/mt/ht (toms), rim, perc, 808 (drums)
Synths: sawtooth, square, triangle, sine, fm, am, piano, gtr (guitar)
More samples: bass, casio, crow, pluck, jazz, wind, metal, space, numbers

=== MINI-NOTATION SYNTAX ===
Sequences: s("bd sd hh cp") - 4 sounds in one cycle
Repetition: s("bd*4") - plays bd 4 times per cycle
Rests: s("bd ~ hh ~") - tilde (~) is silence
Alternation: s("<bd sd hh>") - angle brackets alternate each cycle
Subdivision: s("bd [sd cp] hh") - square brackets subdivide time
Division: s("[bd sd hh]/2") - pattern plays over 2 cycles
Euclidean: s("bd(3,8)") - 3 hits distributed over 8 steps
Choice: s("bd|sd|hh") - randomly choose one each time

=== PATTERN LAYERING ===
stack() - layer multiple patterns:
stack(
  s("bd*4").gain(0.9),
  s("~ sd ~ sd").gain(0.7),
  s("hh*8").gain(0.5)
)

=== PATTERN TRANSFORMATIONS ===
Timing: .fast(2), .slow(2), .hurry(1.5)
Reversal: .rev() - reverse each cycle
Conditional: .every(4, x=>x.rev()) - apply function every N cycles
  .sometimes(x=>x.fast(2)) - randomly apply ~50% of the time
  .rarely(x=>x.degradeBy(0.5)) - rarely apply
  .often(x=>x.gain(1.2)) - often apply
Degradation: .degradeBy(0.3) - randomly remove 30% of events
Repetition: .ply(3) - repeat each event 3 times
Rotation: .iter(4) - rotate pattern over 4 cycles
Palindrome: .palindrome() - play forward then backward
Juxtaposition: .jux(x=>x.rev()) - different versions L/R channels

=== PITCH & SCALES ===
Notes: note("c3 e3 g3") or note("0 2 4 7").scale("C minor")
Scales: .scale("C major"), .scale("D minor"), .scale("C:minor pentatonic")
Chords: chord("<C^7 Dm7 G7>") - play chords
Arpeggiation: note("c e g").arp() or .arp("up down updown")
Transposition: .add(note(7)) - transpose up
Degrees: n("0 2 4 7").scale("C minor") - scale degrees

=== AUDIO EFFECTS ===
Filters: .lpf(1200) - lowpass, .hpf(500) - highpass, .bandf(800) - bandpass
  .resonance(10) - filter resonance, .vowel("a e i o u")
Distortion: .distort(0.5), .shape(0.8), .crush(4) - bit crush, .coarse(8)
Modulation: .tremolo(8), .phaser(4), .phaserDepth(0.5)
Spatial: .room(0.5) - reverb, .roomsize(0.9), .delay(0.25), .pan(0.5)
  .orbit(2) - route to different output
Envelope: .attack(0.05), .decay(0.2), .sustain(0.5), .release(0.3)
Volume: .gain(0.8), .amp(0.7), .velocity(0.9)
Other: .cutoff(1000), .drive(0.3), .compressor(4)

=== ADVANCED TECHNIQUES ===
Polyrhythm: stack(s("bd*3"), s("hh*4")) - 3 against 4
Polymetric: stack(s("bd sd hh"), s("cp*5"))
Variables: let drums = s("bd sd"); drums.fast(2)
Concatenation: cat(s("bd*4"), s("hh*8")) - switch each cycle
Fast cat: fastcat(s("bd"), s("sd")) - switch quickly
Pattern arithmetic: note("c e g").add(12) - octave up
  note("0 2 4").mul(2), note("c d e").sub(12)
Randomness: n(irand(8)) - random 0-7, rand.range(50, 100)
Probability: .sometimesBy(0.3, x=>x.fast(2)) - 30% chance
Masking: s("bd sd hh cp").mask("1 0 1 0") - apply structural mask
Sample selection: s("bd:2") - use sample variant 2
Speed/pitch: .speed(1.5) - play faster/higher, .speed(-1) - reverse

=== EXAMPLE PATTERNS ===
// Techno beat with bassline
stack(
  s("bd*4").gain(0.9),
  s("~ sd ~ sd").gain(0.8),
  s("hh*8").gain(0.5).pan(saw.range(0,1)),
  note("<c2 c2 eb2 f2>").s("sawtooth").lpf(800).gain(0.7)
)

// Melodic pattern with effects
note("0 2 [4 7] 5".scale("D minor"))
  .s("triangle")
  .room(0.5)
  .lpf(1200)
  .sometimes(x=>x.fast(2))
  .every(4, x=>x.rev())

// Euclidean rhythm
s("bd(3,8) sd(5,8,2) hh(7,8)")
  .gain(0.8)
  .room(0.3)

REMEMBER:
- JavaScript syntax only - use dots and parentheses
- Chain methods: .method1().method2()
- Use stack() for layering, not multiple s() calls
- Angle brackets <> for alternation, square brackets [] for subdivision
- Always specify arguments for methods that need them`;

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!genAI) {
    return res.status(500).json({
      error: 'Gemini API key not configured. Set GEMINI_API_KEY environment variable.'
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite'
    });

    const fullPrompt = STRUDEL_SYSTEM_PROMPT + '\n\n' + prompt;

    const result = await model.generateContent(fullPrompt);

    const response = await result.response;
    let code = response.text().trim();

    // Clean up any markdown code blocks if present
    code = code.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '').trim();

    res.json({
      success: true,
      code,
      prompt
    });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate code' });
  }
});

// AI Patterns storage
const PATTERNS_FILE = path.join(__dirname, '..', 'data', 'patterns.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Get saved AI patterns
app.get('/api/patterns', (req, res) => {
  try {
    if (fs.existsSync(PATTERNS_FILE)) {
      const data = fs.readFileSync(PATTERNS_FILE, 'utf8');
      res.json({ patterns: JSON.parse(data) });
    } else {
      res.json({ patterns: [] });
    }
  } catch (err) {
    console.error('Error loading patterns:', err);
    res.json({ patterns: [] });
  }
});

// Save a new AI pattern
app.post('/api/patterns', (req, res) => {
  const { pattern } = req.body;

  if (!pattern || !pattern.id) {
    return res.status(400).json({ error: 'Pattern is required' });
  }

  try {
    let patterns = [];
    if (fs.existsSync(PATTERNS_FILE)) {
      const data = fs.readFileSync(PATTERNS_FILE, 'utf8');
      patterns = JSON.parse(data);
    }

    // Add or update pattern
    const existingIndex = patterns.findIndex(p => p.id === pattern.id);
    if (existingIndex >= 0) {
      patterns[existingIndex] = pattern;
    } else {
      patterns.push(pattern);
    }

    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2));
    res.json({ success: true, pattern });
  } catch (err) {
    console.error('Error saving pattern:', err);
    res.status(500).json({ error: 'Failed to save pattern' });
  }
});

// Delete a saved AI pattern
app.delete('/api/patterns/:id', (req, res) => {
  const { id } = req.params;

  try {
    if (!fs.existsSync(PATTERNS_FILE)) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    const data = fs.readFileSync(PATTERNS_FILE, 'utf8');
    let patterns = JSON.parse(data);
    patterns = patterns.filter(p => p.id !== id);

    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting pattern:', err);
    res.status(500).json({ error: 'Failed to delete pattern' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Sample server running on http://localhost:${PORT}`);
  console.log(`Samples directory: ${SAMPLES_DIR}`);
});
