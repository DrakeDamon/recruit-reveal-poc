const { Router } = require('express');
const { query, CAT, SCH } = require('../db/databricks');

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

// router-specific 404 to prove we reached the router
router.use((req, res) => {
  res.status(404).json({ error: 'predict 404', at: req.originalUrl });
});

module.exports = router;