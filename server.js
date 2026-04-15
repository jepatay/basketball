import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false }));

const distPath = path.join(__dirname, 'dist');

// ── Block search engine indexing on every response ───────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// ── robots.txt — tell crawlers to stay out ───────────────────────────────────
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

// ── Password protection ───────────────────────────────────────────────────────
// Set ACCESS_KEY in your Render environment variables.
// Share the URL:  https://your-app.onrender.com/?access=YOUR_KEY
// Once validated, a cookie keeps the session alive.
const ACCESS_KEY = process.env.ACCESS_KEY;
const COOKIE_NAME = 'ftl_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(
    raw.split(';').map((c) => c.trim().split('=').map(decodeURIComponent))
  );
}

function isAuthenticated(req) {
  if (!ACCESS_KEY) return true; // no key set → open access
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] === ACCESS_KEY;
}

const LOGIN_PAGE = (error = '') => `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Free Throw Legends — Access</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0D0D0D;color:#fff;font-family:'Impact',sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#1A1A1A;border:2px solid #FF6B00;border-radius:16px;
          padding:40px 32px;max-width:360px;width:90%;text-align:center}
    h1{font-size:2.8rem;color:#FF6B00;text-shadow:3px 3px 0 #7a3200}
    h2{font-size:1.6rem;color:#FFD700;margin-bottom:24px}
    input{width:100%;background:#2A2A2A;border:2px solid #2A2A2A;border-radius:8px;
          color:#fff;font-family:inherit;font-size:1.1rem;padding:14px;
          outline:none;text-align:center;margin-bottom:12px;letter-spacing:0.1em}
    input:focus{border-color:#FF6B00}
    button{width:100%;background:#FF6B00;color:#0D0D0D;border:none;
           border-radius:8px;font-family:inherit;font-size:1.3rem;
           padding:14px;cursor:pointer;box-shadow:0 4px 0 #a34100}
    button:active{transform:translateY(3px);box-shadow:0 1px 0 #a34100}
    .error{color:#FF3352;font-size:0.9rem;margin-bottom:12px;font-family:sans-serif}
    .ball{font-size:3rem;margin-bottom:8px;display:block}
  </style>
</head>
<body>
  <div class="card">
    <span class="ball">🏀</span>
    <h1>FREE THROW</h1>
    <h2>LEGENDS</h2>
    ${error ? `<p class="error">${error}</p>` : ''}
    <form method="POST" action="/__auth">
      <input type="password" name="key" placeholder="ENTER ACCESS CODE" autofocus autocomplete="off" />
      <button type="submit">ENTER COURT</button>
    </form>
  </div>
</body>
</html>`;

// Handle ?access=KEY in the URL (shareable link with password embedded)
app.get('/', (req, res, next) => {
  if (!ACCESS_KEY) return next();
  const { access } = req.query;
  if (access === ACCESS_KEY) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${ACCESS_KEY}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`);
    return res.redirect('/');
  }
  if (!isAuthenticated(req)) {
    return res.send(LOGIN_PAGE());
  }
  next();
});

// Handle login form POST
app.post('/__auth', (req, res) => {
  const { key } = req.body;
  if (key === ACCESS_KEY) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${ACCESS_KEY}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`);
    return res.redirect('/');
  }
  res.send(LOGIN_PAGE('Wrong access code — try again'));
});

// Guard all non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/') || req.path === '/robots.txt') {
    return next();
  }
  if (ACCESS_KEY && !isAuthenticated(req)) {
    return res.redirect('/');
  }
  next();
});

// ── Serve React build ────────────────────────────────────────────────────────
app.use(express.static(distPath));

// ── DALL-E 3 avatar generation ───────────────────────────────────────────────
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

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Free Throw Legends running on port ${PORT}`);
});
