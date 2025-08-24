const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

// Fallback in-memory storage when database is unavailable
const evalFallback = new Map();

router.use((req, _res, next) => {
  console.log('[eval-router]', req.method, req.originalUrl, 'base:', req.baseUrl, 'url:', req.url);
  next();
});

// GET /api/eval/latest - Get latest evaluation for user
router.get('/latest', async (req, res) => {
  try {
    const { email, user_id } = req.query;
    console.log('[EVAL] Get latest evaluation request:', { email, user_id });

    if (!email && !user_id) {
      return res.status(400).json({ error: 'Missing email or user_id parameter' });
    }

    let whereClause = {};
    if (user_id) {
      whereClause.user_id = parseInt(user_id);
    } else if (email) {
      whereClause.user = { email: String(email) };
    }

    // Find most recent evaluation for user
    let evaluation;
    try {
      evaluation = await prisma.eval.findFirst({
        where: whereClause,
        orderBy: { eval_date: 'desc' },
        include: {
          user: true
        }
      });
    } catch (dbError) {
      console.warn('[EVAL] Database unavailable for GET, using fallback:', dbError.message);
      const userKey = email || user_id;
      evaluation = evalFallback.get(userKey);
    }

    if (!evaluation) {
      return res.status(404).json({ error: 'No evaluations found for user' });
    }

    console.log('[EVAL] Found evaluation:', evaluation.id, 'for user:', evaluation.user?.email || user_id);

    // Transform evaluation data to expected format
    const response = {
      id: evaluation.id,
      score: evaluation.score || 50,
      predicted_tier: evaluation.division || 'D3/NAIA',
      predicted_division: evaluation.division || 'D3/NAIA',
      notes: evaluation.notes || '',
      probability: evaluation.probability || 0.5,
      confidence_score: evaluation.probability || 0.5,
      performance_score: evaluation.performance_score || 30,
      combine_score: evaluation.combine_score || 13,
      upside_score: evaluation.upside_score || 8,
      goals: evaluation.goals || [
        'Improve performance for next division level',
        'Focus on position-specific skills development', 
        'Maintain academic eligibility'
      ],
      position: evaluation.position || 'QB',
      playerName: evaluation.player_name || evaluation.user?.name || 'Unknown Player',
      explainability: {
        input_data: evaluation.what_if_results ? JSON.parse(evaluation.what_if_results) : {},
        prediction_probabilities: null
      },
      created_at: evaluation.eval_date,
      updated_at: evaluation.eval_date
    };

    return res.json(response);

  } catch (error) {
    console.error('[EVAL] Error fetching latest evaluation:', error);
    return res.status(500).json({ error: 'Failed to fetch evaluation' });
  }
});

// POST /api/eval/save - Save evaluation results
router.post('/save', async (req, res) => {
  try {
    const { 
      user_email, 
      user_id, 
      position,
      player_name,
      predicted_tier,
      predicted_division,
      score,
      probability,
      confidence_score,
      performance_score,
      combine_score,
      upside_score,
      goals,
      notes,
      explainability,
      input_data
    } = req.body;

    console.log('[EVAL] Save evaluation request for:', user_email || user_id);

    let evaluation;
    try {
      // Find or create user
      let user;
      if (user_email) {
        user = await prisma.user.findUnique({
          where: { email: String(user_email) }
        });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: String(user_email),
              password_hash: '',
              name: player_name || 'Unknown Player'
            }
          });
        }
      } else if (user_id) {
        user = await prisma.user.findUnique({
          where: { id: parseInt(user_id) }
        });
      }

      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      // Create evaluation record
      evaluation = await prisma.eval.create({
        data: {
          user_id: user.id,
          position: position || 'QB',
          player_name: player_name || user.name || 'Unknown Player',
          division: predicted_tier || 'D3/NAIA',
          score: parseFloat(score) || 50,
          probability: parseFloat(probability) || 0.5,
          performance_score: parseFloat(performance_score) || 30,
          combine_score: parseFloat(combine_score) || 13,
          upside_score: parseFloat(upside_score) || 8,
          goals: goals || [
            'Improve performance for next division level',
            'Focus on position-specific skills development',
            'Maintain academic eligibility'
          ],
          notes: notes || '',
          what_if_results: input_data ? JSON.stringify(input_data) : null,
        }
      });
      
      console.log('[EVAL] Created evaluation via Prisma:', evaluation.id);
    } catch (dbError) {
      console.warn('[EVAL] Database unavailable, using fallback storage:', dbError.message);
      
      // Fallback to in-memory storage
      const userKey = user_email || user_id;
      evaluation = {
        id: Date.now(),
        score: parseFloat(score) || 50,
        division: predicted_tier || 'D3/NAIA',
        notes: notes || '',
        probability: parseFloat(probability) || 0.5,
        performance_score: parseFloat(performance_score) || 30,
        combine_score: parseFloat(combine_score) || 13,
        upside_score: parseFloat(upside_score) || 8,
        goals: goals || [
          'Improve performance for next division level',
          'Focus on position-specific skills development',
          'Maintain academic eligibility'
        ],
        position: position || 'QB',
        player_name: player_name || 'Unknown Player',
        what_if_results: input_data ? JSON.stringify(input_data) : null,
        eval_date: new Date(),
        user: {
          email: user_email,
          name: player_name
        }
      };
      
      evalFallback.set(userKey, evaluation);
      console.log('[EVAL] Created evaluation via fallback:', evaluation.id, 'for user:', userKey);
    }

    return res.status(201).json({ id: evaluation.id, message: 'Evaluation saved successfully' });

  } catch (error) {
    console.error('[EVAL] Error saving evaluation:', error);
    return res.status(500).json({ error: 'Failed to save evaluation' });
  }
});

module.exports = router;