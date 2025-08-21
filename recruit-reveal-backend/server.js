const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Boot logging
console.log('[BOOT] server.js loaded at', new Date().toISOString());
console.log('[BOOT] CWD:', process.cwd());

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

console.log('[BOOT] predict require path:', require.resolve('./src/routes/predict'));

// Log every request that starts with /api/predict
app.use('/api/predict', (req, _res, next) => {
  console.log('[MOUNT-HIT] /api/predict prefix', req.method, req.url);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Inline test route to prove /api/predict path is reachable
app.get('/api/predict/__inline', (_req, res) => res.json({ ok: true, inline: true }));

app.use('/api/meta', require('./src/routes/meta'));
app.use('/api/predict', require('./src/routes/predict'));

// Route inspector
app.get('/__routes', (req, res) => {
  const stack = (app._router && app._router.stack) || [];
  const out = [];

  function walk(name, layer, base='') {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).filter(Boolean);
      out.push({ type: 'route', methods, path: base + layer.route.path });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const prefix = layer.regexp && layer.regexp.fast_slash ? base : (layer.regexp?.toString() || base);
      layer.handle.stack.forEach(l => walk('router-layer', l, base));
    }
  }
  stack.forEach(l => walk('layer', l, ''));
  res.json(out);
});

app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));