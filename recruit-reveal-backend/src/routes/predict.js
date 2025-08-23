const { Router } = require('express');
const { query, CAT, SCH } = require('../db/databricks');

// Position → Serving URL
const QB_URL = process.env.DATABRICKS_MODEL_QB_URL;
const RB_URL = process.env.DATABRICKS_MODEL_RB_URL;
const WR_URL = process.env.DATABRICKS_MODEL_WR_URL;
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN;
const HOST = process.env.DATABRICKS_HOST || process.env.databricks_host;

// Class mapping – keep aligned with training
const ID2DIV = { 0: 'D3/NAIA', 1: 'D2', 2: 'FCS', 3: 'Power 5' };
const DIV2ID = Object.fromEntries(Object.entries(ID2DIV).map(([k, v]) => [v, +k]));

// Default sliders per position (safe starting set)
// If you see real feature names in the model signature, prefer those.
const SLIDERS = {
  QB: [
    { key: 'Forty_Yard_Dash', label: '40-yard (s)', min: 4.4, max: 5.4, step: 0.01, direction: 'lower_better' },
    { key: 'Senior_YPG', label: 'Senior Yds/Game', min: 50, max: 500, step: 5, direction: 'higher_better' },
    { key: 'Senior_TD_Passes', label: 'Senior TD Passes', min: 0, max: 70, step: 1, direction: 'higher_better' },
    { key: 'Vertical_Jump', label: 'Vertical (in)', min: 20, max: 45, step: 0.5, direction: 'higher_better' }
  ],
  RB: [
    { key: 'Forty_Yard_Dash', label: '40-yard (s)', min: 4.3, max: 5.2, step: 0.01, direction: 'lower_better' },
    { key: 'Senior_YPG', label: 'Senior Yds/Game', min: 20, max: 350, step: 5, direction: 'higher_better' },
    { key: 'Senior_TD', label: 'Senior TD', min: 0, max: 40, step: 1, direction: 'higher_better' },
    { key: 'Vertical_Jump', label: 'Vertical (in)', min: 24, max: 44, step: 0.5, direction: 'higher_better' }
  ],
  WR: [
    { key: 'Forty_Yard_Dash', label: '40-yard (s)', min: 4.3, max: 5.2, step: 0.01, direction: 'lower_better' },
    { key: 'Senior_rec_yds', label: 'Senior Rec Yards', min: 100, max: 2500, step: 10, direction: 'higher_better' },
    { key: 'Senior_rec_td', label: 'Senior Rec TD', min: 0, max: 40, step: 1, direction: 'higher_better' },
    { key: 'Vertical_Jump', label: 'Vertical (in)', min: 24, max: 44, step: 0.5, direction: 'higher_better' }
  ]
};

const SCHEMA_CACHE = {}; // pos → { columns: [col names], timestamp: Date }

function endpointForPos(pos) {
  if (pos === 'QB') return QB_URL;
  if (pos === 'RB') return RB_URL;
  if (pos === 'WR') return WR_URL;
  return null;
}

function parseEndpointName(invUrl) {
  const m = (invUrl || '').match(/serving-endpoints\/([^/]+)\/invocations/i);
  return m ? m[1] : null;
}

async function fetchSchemaOnce(pos) {
  const cached = SCHEMA_CACHE[pos];
  const now = Date.now();
  // TTL: 10 minutes
  if (cached && (now - cached.timestamp) < 600000) {
    return cached.columns;
  }

  const inv = endpointForPos(pos);
  const ep = parseEndpointName(inv);
  if (!ep || !HOST) return null;

  const hostUrl = HOST.startsWith('http') ? HOST : `https://${HOST}`;
  const url = `${hostUrl.replace(/\/+$/, '')}/api/2.0/serving-endpoints/${ep}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  try {
    const r = await fetch(url, { 
      headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!r.ok) return null;
    const j = await r.json();
    const cols = j?.config?.served_entities?.[0]?.input_schema?.columns?.map(c => c.name) || null;
    SCHEMA_CACHE[pos] = { columns: cols, timestamp: now };
    return cols;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`Schema fetch timeout for ${pos}`);
    }
    return null;
  }
}

function padToSchema(rec, cols) {
  if (!cols) return rec;
  const out = { ...rec };
  for (const c of cols) if (!(c in out)) out[c] = null;
  return out;
}

function clampToSlider(value, slider) {
  const num = Number(value);
  if (!isFinite(num)) return slider.min;
  return Math.max(slider.min, Math.min(slider.max, num));
}

async function invokeServing(invocationsUrl, record) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const res = await fetch(invocationsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DATABRICKS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dataframe_records: [record] }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(`Serving error: ${res.status} ${JSON.stringify(data)}`);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Databricks serving endpoint did not respond within 8 seconds');
    }
    throw error;
  }
}

function decodePrediction(data) {
  // If predictions: [[probs...]] OR [classId]
  if (!Array.isArray(data?.predictions)) return { classId: null, probs: null };
  const first = data.predictions[0];
  if (Array.isArray(first)) {
    const probs = first.map(Number);
    const classId = probs.indexOf(Math.max(...probs));
    return { classId, probs };
  }
  return { classId: Number(first), probs: null };
}

const router = Router();

router.use((req, _res, next) => {
  console.log('[predict-router]', req.method, req.originalUrl, 'base:', req.baseUrl, 'url:', req.url);
  next();
});

// pure-alive endpoint (no DB)
router.get('/_alive', (_req, res) => res.json({ ok: true, router: 'predict' }));

const UDFS = {
  qb: `${CAT}.${SCH}.rr_predict_qb`,
  rb: `${CAT}.${SCH}.rr_predict_rb`,
  wr: `${CAT}.${SCH}.rr_predict_wr`,
};

function sqlString(str) { return String(str).replace(/'/g, "''"); }

router.get('/udfs', async (_req, res) => {
  try {
    const rows = await query(`SHOW FUNCTIONS`);
    const have = rows.map(r => (r.function || r.Function || r['function'])).filter(Boolean);
    res.json({ expected: UDFS, available: have });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:pos', async (req, res) => {
  try {
    const pos = String(req.params.pos || '').toLowerCase();
    if (!['qb', 'rb', 'wr'].includes(pos)) {
      return res.status(400).json({ error: "pos must be one of 'qb','rb','wr'" });
    }
    const udf = UDFS[pos];
    const payload = JSON.stringify(req.body || {});
    const sql = `SELECT ${udf}('${sqlString(payload)}') AS json`;

    const [row] = await query(sql);
    const raw = row?.json || row?.JSON || Object.values(row || {})[0];

    let out;
    try { out = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Bad UDF output', raw }); }

    return res.json({ position: pos.toUpperCase(), ...out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/predict/whatif/:pos/sliders
router.get('/whatif/:pos/sliders', (req, res) => {
  const pos = String(req.params.pos || '').toUpperCase();
  return res.json({ position: pos, sliders: SLIDERS[pos] || [] });
});

// POST /api/predict/whatif/:pos
router.post('/whatif/:pos', async (req, res) => {
  try {
    const pos = String(req.params.pos || '').toUpperCase();
    const base = req.body?.base || {};
    const targetLabel = req.body?.target_label || 'FCS';
    const threshold = Number(req.body?.threshold ?? 0.5);
    const candidates = req.body?.candidates;

    const inv = endpointForPos(pos);
    if (!inv) return res.status(400).json({ error: 'Unknown position or missing serving URL' });

    const schema = await fetchSchemaOnce(pos);
    const sliders = (SLIDERS[pos] || []).filter(s => !candidates || candidates.includes(s.key));
    if (!sliders.length) return res.status(400).json({ error: 'No candidate sliders for this position.' });

    // Helper: binary search to minimal change that meets target
    async function searchThreshold({ field, min, max, direction }) {
      const startVal = Number(base[field]);
      if (!isFinite(startVal)) return null;

      // Clamp starting value to slider bounds
      const clampedStart = Math.max(min, Math.min(max, startVal));
      let lo = min, hi = max, best = null;
      for (let i = 0; i < 9; i++) {
        const mid = +(((lo + hi) / 2).toFixed(4));
        const rec = padToSchema({ ...base, [field]: mid }, schema);
        const out = decodePrediction(await invokeServing(inv, rec));

        const targetId = DIV2ID[targetLabel];
        const ok = out.probs
          ? ((out.probs[targetId] ?? 0) >= threshold)
          : (out.classId === targetId);

        // higher_better: if ok at mid -> try lower side (smaller improvement), else go higher
        // lower_better: inverse
        const goLower = direction === 'higher_better' ? ok : !ok;
        if (goLower) {
          best = { value: mid, classId: out.classId, probs: out.probs };
          hi = mid - (direction === 'higher_better' ? 0.0001 : 0);
        } else {
          lo = mid + (direction === 'higher_better' ? 0.0001 : 0);
        }
        if (Math.abs(hi - lo) < 1e-3) break;
      }
      return best ? {
        field,
        from: Number(base[field]),
        to: best.value,
        delta: +(best.value - Number(base[field])).toFixed(4),
        division_id: best.classId,
        division_label: ID2DIV[best.classId] || null,
        probabilities: best.probs
      } : null;
    }

    // Try all sliders; pick smallest absolute delta
    const tries = [];
    for (const s of sliders) {
      const got = await searchThreshold(s);
      if (got) tries.push({ ...s, ...got });
    }
    tries.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    const recommendation = tries[0] || null;

    return res.json({
      position: pos,
      target_label: targetLabel,
      threshold,
      recommendation,
      candidates_tried: tries
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// router-specific 404 to prove we reached the router
router.use((req, res) => {
  res.status(404).json({ error: 'predict 404', at: req.originalUrl });
});

module.exports = router;