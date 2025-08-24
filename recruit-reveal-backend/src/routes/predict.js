const { Router } = require('express');
const { query, CAT, SCH } = require('../db/databricks');

// Simple SQL string escaping for Databricks UDF calls
function sqlString(str) {
  return String(str).replace(/'/g, "''");
}

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
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
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

// Map frontend field names to serving endpoint schema
function mapFrontendFields(data, position) {
  const mapped = { ...data };
  
  // Common mappings for all positions
  if (data.player_name) mapped.Player_Name = data.player_name;
  if (data.Player_Name === undefined && data.playerName) mapped.Player_Name = data.playerName;
  if (data.state) mapped.State = data.state;
  if (data.grad_year) mapped.Grad_year = data.grad_year;
  if (data.height_inches) mapped.Height_Inches = data.height_inches;
  if (data.weight_lbs) mapped.Weight_Lbs = data.weight_lbs;
  if (data.forty_yard_dash) mapped.Forty_Yard_Dash = data.forty_yard_dash;
  if (data.vertical_jump) mapped.Vertical_Jump = data.vertical_jump;
  if (data.shuttle) mapped.Shuttle = data.shuttle;
  if (data.broad_jump) mapped.Broad_Jump = data.broad_jump;
  
  // Position-specific mappings
  if (position === 'RB') {
    if (data.senior_rush_yds) mapped.Senior_Yds = data.senior_rush_yds;
    if (data.senior_touches) mapped.Senior_Touches = data.senior_touches;
    if (data.senior_avg) mapped.Senior_Avg = data.senior_avg;
    if (data.senior_rush_rec) mapped.Senior_Rec = data.senior_rush_rec;
    if (data.senior_rush_rec_yds) mapped.Senior_Rec_Yds = data.senior_rush_rec_yds;
    if (data.senior_rush_td) mapped.Senior_TD = data.senior_rush_td;
    if (data.junior_ypg) {
      // Convert junior YPG back to total yards (assuming 10 games)
      mapped.Junior_Yds = data.junior_ypg * 10;
      mapped.Junior_YPG = data.junior_ypg;
    }
  }
  
  // Provide default values for required fields
  const defaults = {
    College: mapped.College || 'Unknown',
    Division: mapped.Division || 'Unknown', 
    High_School: mapped.High_School || 'Unknown',
    State: mapped.State || 'TX',
    MaxPreps_URL: mapped.MaxPreps_URL || '',
    Scrape_Status: mapped.Scrape_Status || 'manual',
    Match_Confidence: mapped.Match_Confidence || 'high',
    Notes: mapped.Notes || ''
  };
  
  // RB specific defaults
  if (position === 'RB') {
    Object.assign(defaults, {
      Senior_Yds: mapped.Senior_Yds || 800,
      Senior_Avg: mapped.Senior_Avg || 4.5,
      Senior_Touches: mapped.Senior_Touches || 180,
      Senior_YPG: mapped.Senior_YPG || (mapped.Senior_Yds ? mapped.Senior_Yds / 10 : 80),
      Senior_Run: mapped.Senior_Run || (mapped.Senior_Touches || 180),
      Senior_Tot: mapped.Senior_Tot || (mapped.Senior_Touches || 180),
      Senior_Rec: mapped.Senior_Rec || 15,
      Senior_Rec_Yds: mapped.Senior_Rec_Yds || 120,
      Senior_Rec_Avg: mapped.Senior_Rec_Avg || 8.0,
      Senior_Lng: mapped.Senior_Lng || 35,
      Senior_TD: mapped.Senior_TD || 6,
      Junior_Yds: mapped.Junior_Yds || 600,
      Junior_Avg: mapped.Junior_Avg || 4.2,
      Junior_Touches: mapped.Junior_Touches || 140,
      Junior_YPG: mapped.Junior_YPG || 60,
      Junior_Run: mapped.Junior_Run || 140,
      Junior_Tot: mapped.Junior_Tot || 140,
      Junior_Rec: mapped.Junior_Rec || 10,
      Junior_Rec_Yds: mapped.Junior_Rec_Yds || 80,
      Junior_Rec_Avg: mapped.Junior_Rec_Avg || 8.0,
      Junior_Lng: mapped.Junior_Lng || 30,
      Junior_TD: mapped.Junior_TD || 4
    });
  }
  
  return { ...defaults, ...mapped };
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
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 8 second timeout

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
    if (!res.ok) {
      console.error(`[SERVING ERROR] ${res.status} from ${invocationsUrl}:`, data);
      throw new Error(`Serving error: ${res.status} ${JSON.stringify(data)}`);
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Databricks serving endpoint did not respond within 30 seconds');
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
    console.log(`[PREDICT] ${pos.toUpperCase()} evaluation request received:`, JSON.stringify(req.body, null, 2));
    
    if (!['qb', 'rb', 'wr'].includes(pos)) {
      return res.status(400).json({ error: "pos must be one of 'qb','rb','wr'" });
    }

    // Use serving endpoints instead of UDFs
    const invUrl = endpointForPos(pos.toUpperCase());
    if (!invUrl) {
      return res.status(400).json({ error: 'No serving endpoint configured for position' });
    }

    console.log(`[PREDICT] Using serving endpoint: ${invUrl}`);
    const schema = await fetchSchemaOnce(pos.toUpperCase());
    const mappedData = mapFrontendFields(req.body || {}, pos.toUpperCase());
    const record = padToSchema(mappedData, schema);

    const data = await invokeServing(invUrl, record);
    const decoded = decodePrediction(data);

    // Build response in expected format
    const response = {
      position: pos.toUpperCase(),
      predicted_tier: ID2DIV[decoded.classId] || 'Unknown',
      predicted_division: ID2DIV[decoded.classId] || 'Unknown',
      probability: decoded.probs ? Math.max(...decoded.probs) : 0.5,
      confidence_score: decoded.probs ? Math.max(...decoded.probs) : 0.5,
      score: Math.round((decoded.probs ? Math.max(...decoded.probs) : 0.5) * 100),
      performance_score: Math.round((decoded.probs ? Math.max(...decoded.probs) : 0.5) * 60),
      combine_score: Math.round((decoded.probs ? Math.max(...decoded.probs) : 0.5) * 25),
      upside_score: Math.round((decoded.probs ? Math.max(...decoded.probs) : 0.5) * 15),
      goals: [
        `Improve performance for ${ID2DIV[decoded.classId]} level`,
        'Focus on position-specific skills development',
        'Maintain academic eligibility'
      ],
      notes: `${pos.toUpperCase()} evaluation showing potential for ${ID2DIV[decoded.classId]} level play`,
      playerName: req.body?.Player_Name || 'Unknown Player',
      explainability: {
        input_data: req.body || {},
        prediction_probabilities: decoded.probs
      }
    };

    return res.json(response);
  } catch (e) {
    console.error('[PREDICT] Error:', e.message);
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