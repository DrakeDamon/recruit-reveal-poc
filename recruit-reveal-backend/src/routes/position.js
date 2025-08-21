// src/routes/position.js
const { Router } = require('express');
const { z } = require('zod');
const { query, CAT, SCH } = require('../db/databricks');

const ListQuerySchema = z.object({
  division: z.string().optional(),
  grad_year: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

function makePositionRouter(position, options = {}) {
  const allowed = new Set(['qb', 'rb', 'wr']);
  if (!allowed.has(position)) throw new Error('Invalid position');
  const TBL = `\`${CAT}\`.\`${SCH}\`.\`${position}\``;

  // Normalize column differences across CSVs/tables:
  // QB/RB: Player_Name, WR: Name, Grad_year varies  
  const NAME = position === 'wr' ? 'Name' : 'Player_Name';
  const GRAD = position === 'wr' ? 'Grad_Year' : 'Grad_year';

  // Sensible default sort that exists in all tables now:
  const defaultSort = options.sort || `${NAME} ASC`;

  const router = Router();

  // GET /api/<pos>?division=&grad_year=&limit=
  router.get('/', async (req, res) => {
    try {
      const q = ListQuerySchema.parse(req.query);
      const clauses = [];
      const params = [];

      if (q.division) { clauses.push('Division = ?'); params.push(q.division); }
      if (q.grad_year) { clauses.push(`${GRAD} = ?`); params.push(q.grad_year); }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const sql = `
        SELECT
          ${NAME} AS Player_Name,
          ${GRAD} AS Graduation_Year,
          Division,
          State,
          Forty_Yard_Dash,
          Shuttle,
          Vertical_Jump,
          Broad_Jump
        FROM ${TBL}
        ${where}
        ORDER BY ${defaultSort}
        LIMIT ?
      `;
      params.push(q.limit);

      const rows = await query(sql, params);
      res.json({ rows, count: rows.length });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/<pos>/search { name, state, division, grad_year, limit }
  router.post('/search', async (req, res) => {
    try {
      const Body = z.object({
        name: z.string().min(1).optional(),
        state: z.string().length(2).optional(),
        division: z.string().optional(),
        grad_year: z.coerce.number().int().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(50),
      });
      const b = Body.parse(req.body);

      const clauses = [];
      const params = [];

      if (b.name) { clauses.push(`${NAME} ILIKE ?`); params.push(`%${b.name}%`); }
      if (b.state) { clauses.push(`State = ?`); params.push(b.state); }
      if (b.division) { clauses.push(`Division = ?`); params.push(b.division); }
      if (b.grad_year) { clauses.push(`${GRAD} = ?`); params.push(b.grad_year); }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const sql = `
        SELECT
          ${NAME} AS Player_Name,
          ${GRAD} AS Graduation_Year,
          Division,
          State,
          Forty_Yard_Dash,
          Shuttle,
          Vertical_Jump,
          Broad_Jump
        FROM ${TBL}
        ${where}
        ORDER BY ${defaultSort}
        LIMIT ?
      `;
      params.push(b.limit);

      const rows = await query(sql, params);
      res.json({ rows, count: rows.length });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { makePositionRouter };