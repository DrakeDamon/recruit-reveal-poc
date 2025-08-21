const { Router } = require('express');
const { query, CAT, SCH } = require('../db/databricks');
const router = Router();

router.get('/whereami', async (_req, res) => {
  try {
    const [env] = await query(`SELECT current_metastore() AS metastore, current_catalog() AS catalog, current_schema() AS schema`);
    res.json({ env, expected: { catalog: CAT, schema: SCH } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tables', async (_req, res) => {
  try {
    const rows = await query(`SHOW TABLES`);
    res.json({ tables: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/describe/:table', async (req, res) => {
  try {
    const t = req.params.table;
    const rows = await query(`DESCRIBE TABLE EXTENDED ${t}`);
    res.json({ table: t, describe: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/counts', async (_req, res) => {
  const out = {};
  try {
    const r = await query(`SELECT COUNT(*) AS c FROM qb`); out.qb = r[0]?.c ?? r[0]?.C;
  } catch (e) { out.qb_error = e.message; }
  try {
    const r = await query(`SELECT COUNT(*) AS c FROM rb`); out.rb = r[0]?.c ?? r[0]?.C;
  } catch (e) { out.rb_error = e.message; }
  try {
    const r = await query(`SELECT COUNT(*) AS c FROM wr`); out.wr = r[0]?.c ?? r[0]?.C;
  } catch (e) { out.wr_error = e.message; }
  res.json(out);
});

router.get('/divisions', async (_req, res) => {
  try {
    const rows = await query(`SELECT Division, COUNT(*) AS count FROM qb GROUP BY Division ORDER BY count DESC`);
    res.json({ divisions: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;