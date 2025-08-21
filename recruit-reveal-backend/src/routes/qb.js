const express = require('express');
const { query } = require('../db/databricks');
const { z } = require('zod');

const router = express.Router();

// Get catalog and schema from environment
const CAT = process.env.DATABRICKS_CATALOG || 'recruit_reveal_databricks';
const SCH = process.env.DATABRICKS_SCHEMA || 'default';
const TABLE = `${CAT}.${SCH}.qb`;

// Validation schemas
const ListQuerySchema = z.object({
  division: z.enum(['Power 5', 'FCS', 'D2', 'D3/NAIA']).optional(),
  grad_year: z.coerce.number().int().min(2020).max(2030).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

const SearchBodySchema = z.object({
  name: z.string().optional(),
  state: z.string().length(2).optional(),
  division: z.enum(['Power 5', 'FCS', 'D2', 'D3/NAIA']).optional(),
  grad_year: z.number().int().min(2020).max(2030).optional(),
  limit: z.number().int().min(1).max(500).default(100)
});

const PredictionsBodySchema = z.object({
  topN: z.number().int().min(1).max(1000).default(100)
});

/**
 * GET /api/qb
 * List QB data with optional filters
 */
router.get('/', async (req, res) => {
  try {
    // Validate query parameters
    const params = ListQuerySchema.parse(req.query);
    
    // Build WHERE clause
    const where = [];
    const queryParams = [];
    
    if (params.division) {
      where.push('Division = ?');
      queryParams.push(params.division);
    }
    
    if (params.grad_year) {
      where.push('Grad_year = ?');
      queryParams.push(params.grad_year);
    }
    
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    
    // Execute query with limit - using SELECT * to see all columns
    const sqlText = `
      SELECT *
      FROM ${TABLE}
      ${whereClause}
      ORDER BY Grad_year DESC, Player_Name
      LIMIT ${params.limit}
    `;
    
    console.log('Executing query:', sqlText);
    console.log('With params:', queryParams);
    
    const rows = await query(sqlText, queryParams);
    
    // Get total count for pagination
    const countSql = `SELECT COUNT(*) as total FROM ${TABLE} ${whereClause}`;
    const countResult = await query(countSql, queryParams);
    const totalCount = countResult[0]?.total || 0;
    
    res.json({
      rows,
      count: rows.length,
      total: totalCount,
      limit: params.limit
    });
    
  } catch (error) {
    console.error('Error in GET /api/qb:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch QB data',
      details: error.message
    });
  }
});

/**
 * POST /api/qb/search
 * Search QBs with flexible filters
 */
router.post('/search', async (req, res) => {
  try {
    // Validate request body
    const params = SearchBodySchema.parse(req.body);
    
    // Build WHERE clause
    const where = [];
    const queryParams = [];
    
    if (params.name) {
      where.push('LOWER(Player_Name) LIKE ?');
      queryParams.push(`%${params.name.toLowerCase()}%`);
    }
    
    if (params.state) {
      where.push('State = ?');
      queryParams.push(params.state.toUpperCase());
    }
    
    if (params.division) {
      where.push('Division = ?');
      queryParams.push(params.division);
    }
    
    if (params.grad_year) {
      where.push('Grad_year = ?');
      queryParams.push(params.grad_year);
    }
    
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    
    // Execute search query - using SELECT * to get all columns
    const sqlText = `
      SELECT *
      FROM ${TABLE}
      ${whereClause}
      ORDER BY Player_Name
      LIMIT ${params.limit}
    `;
    
    console.log('Executing search:', sqlText);
    console.log('With params:', queryParams);
    
    const rows = await query(sqlText, queryParams);
    
    res.json({
      rows,
      count: rows.length,
      searchCriteria: params
    });
    
  } catch (error) {
    console.error('Error in POST /api/qb/search:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
});

/**
 * POST /api/qb/predictions/preview
 * Get prediction results if available
 */
router.post('/predictions/preview', async (req, res) => {
  try {
    // Validate request body
    const params = PredictionsBodySchema.parse(req.body);
    const predTable = `${CAT}.${SCH}.qb_predictions`;
    
    try {
      // Try to fetch predictions
      const sqlText = `
        SELECT 
          id,
          name,
          y_true,
          y_pred,
          prob_p5,
          prob_fcs,
          prob_d2,
          prob_d3,
          updated_at
        FROM ${predTable}
        ORDER BY updated_at DESC
        LIMIT ${params.topN}
      `;
      
      const rows = await query(sqlText);
      
      res.json({
        available: true,
        rows,
        count: rows.length
      });
      
    } catch (tableError) {
      // Table doesn't exist or query failed
      console.log('Predictions table not available:', tableError.message);
      
      res.json({
        available: false,
        rows: [],
        message: 'Predictions table not yet available. Run training pipeline to generate predictions.'
      });
    }
    
  } catch (error) {
    console.error('Error in POST /api/qb/predictions/preview:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch predictions',
      details: error.message
    });
  }
});

module.exports = router;