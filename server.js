import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '8mb' }));

// ── Serve React build ────────────────────────────────────────────────────────
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ── DALL-E 3 avatar generation ───────────────────────────────────────────────
// Returns raw base64 PNG — the client resizes to 300×300 JPEG via Canvas
// before storing in Firestore (keeps Firestore doc well under 1 MB limit).
app.post('/api/generate-avatar', async (req, res) => {
  const { playerName } = req.body;

  if (!playerName || typeof playerName !== 'string') {
    return res.status(400).json({ error: 'playerName is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `NBA Jam style cartoon avatar of ${playerName.trim()}, bold colors, retro arcade game art, upper body only, stylized and fun, no text`,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });

    const imageBase64 = response.data[0].b64_json;
    res.json({ imageBase64 });
  } catch (err) {
    console.error('DALL-E error:', err?.message || err);
    const message =
      err?.status === 429 ? 'OpenAI rate limit — try again in a moment'
      : err?.status === 401 ? 'Invalid OpenAI API key'
      : err?.message || 'Generation failed';
    res.status(500).json({ error: message });
  }
});

// ── SPA fallback — Express 5 requires regex wildcard, not '*' ────────────────
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Free Throw Legends running on port ${PORT}`);
});
