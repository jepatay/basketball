import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '4mb' }));

// ── Serve React build ────────────────────────────────────────────────────────
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ── DALL-E avatar generation ─────────────────────────────────────────────────
app.post('/api/generate-avatar', async (req, res) => {
  const { playerName, playerSlug } = req.body;

  if (!playerName || typeof playerName !== 'string') {
    return res.status(400).json({ error: 'playerName is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Generate with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `NBA Jam style cartoon avatar of ${playerName}, bold colors, retro arcade game art, transparent background, upper body only, stylized and fun, no text`,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });

    const rawBase64 = response.data[0].b64_json;
    const imageBuffer = Buffer.from(rawBase64, 'base64');

    // Resize to 300×300 JPEG (~30-60 KB) so it fits safely in a Firestore document
    const resized = await sharp(imageBuffer)
      .resize(300, 300, { fit: 'cover', position: 'top' })
      .jpeg({ quality: 82 })
      .toBuffer();

    const finalBase64 = resized.toString('base64');

    res.json({ imageBase64: finalBase64, playerSlug });
  } catch (err) {
    console.error('DALL-E generation error:', err?.message || err);
    const message = err?.status === 429
      ? 'OpenAI rate limit hit — try again in a moment'
      : err?.message || 'Generation failed';
    res.status(500).json({ error: message });
  }
});

// ── SPA fallback (client-side routing) ──────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Free Throw Legends server running on port ${PORT}`);
});
