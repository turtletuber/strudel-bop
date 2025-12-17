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
const STRUDEL_SYSTEM_PROMPT = `You are a Strudel code generator. Strudel is a JavaScript library for live coding music.

CRITICAL: Return ONLY valid JavaScript code. NO markdown, NO explanations, NO comments.
NEVER use TidalCycles/Haskell syntax like $ or arp "up". Use JavaScript method chaining only.

Available samples: bd (kick), sd (snare), hh (hi-hat), cp (clap/snap)
Available synths: sawtooth, square, triangle, sine

Basic patterns:
- s("bd*4") - plays bd sample 4 times per cycle
- s("bd sd hh cp") - plays 4 sounds in sequence
- s("~ sd ~ sd") - tilde is rest/silence
- note("c3 e3 g3").s("sawtooth") - plays notes with synth

Layering: Use stack() to combine patterns
stack(
  s("bd*4").gain(0.9),
  s("~ sd ~ sd").gain(0.7),
  note("<c3 e3 g3>").s("sawtooth").gain(0.6)
)

Common methods (all need arguments):
- .gain(0.8) - volume (0-1)
- .fast(2) - speed up
- .slow(2) - slow down
- .cutoff(800) - filter frequency
- .room(0.3) - reverb (0-1)
- .decay(0.2) - envelope decay
- .pan(0.5) - stereo position (0-1)

REMEMBER: JavaScript syntax only. All methods use dots and parentheses.`;

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
      model: 'gemini-1.5-flash'
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
