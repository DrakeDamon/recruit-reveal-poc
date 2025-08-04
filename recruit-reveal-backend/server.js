const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { SynapseManagementClient } = require('@azure/arm-synapse');
const { DefaultAzureCredential } = require('@azure/identity');
const { triggerPipeline } = require('./lib/synapse');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const app = express();
app.use(express.json({ strict: false }));
const dotenv = require('dotenv');
const dotenvResult = dotenv.config({ path: './.env' });
console.log('dotenv result:', dotenvResult.parsed || dotenvResult.error);
console.log('Loaded env vars:', Object.keys(process.env));
console.log('MOCK_SYNAPSE:', process.env.MOCK_SYNAPSE);
app.use(cors());

const prisma = new PrismaClient();
const pool = new Pool({connectionString: process.env.PG_URL, ssl: {rejectUnauthorized: false}});

async function fetchNotebookOutput(status) {
  const {rows} = await pool.query('SELECT * FROM evals ORDER BY id DESC LIMIT 1');
  return rows[0] || {
    score: 69.3,
    predicted_tier: 'FCS',
    notes: 'Balanced profile',
    probability: 0.693,
    performance_score: 70,
    combine_score: 65,
    upside_score: 0.1,
    underdog_bonus: 0.05,
    goals: ['Improve 40-yard dash to 4.5s', 'Increase senior TD passes'],
    switches: 'Consider switching to WR for better Power5 fit',
    calendar_advice: 'Schedule campus visits during April 15-May 24, 2025 contact period'
  };
}

// Routes Section
app.get('/', (req, res) => {
  res.json({ message: 'Recruit Reveal API is running' });
});

app.get('/evaluate', (req, res) => {
  res.json({ message: 'Evaluate endpoint is running. Use POST to submit athlete data.' });
});

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'User already exists' });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password_hash } });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/test-db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT NOW()`;
    res.send('DB connected successfully!');
  } catch (err) {
    res.status(500).send(`DB connection error: ${err.message}`);
  }
});

app.get('/eval/history', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    const result = await prisma.eval.findMany({
      where: { user_id: String(user_id) },
      orderBy: { eval_date: 'desc' },
      select: {
        eval_date: true,
        score: true,
        division: true,
        notes: true,
        probability: true,
        performance_score: true,
        combine_score: true,
        upside_score: true,
        underdog_bonus: true,
        goals: true,
        switches: true,
        calendar_advice: true
      }
    });
    res.json(result.map(r => ({ ...r, predicted_tier: r.division, fit_score: r.score })));
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post(['/evaluate', '/api/evaluate'], async (req, res) => {
  try {
    const { athlete_data, position, user_id } = req.body;

    // Validate required data
    if (!athlete_data && !position) {
      return res.status(400).json({
        error: 'Invalid input: athlete_data with position required'
      });
    }

    // Handle both old and new request formats
    const athleteData = athlete_data || req.body;
    const athletePosition = position || athleteData.position;
    const playerName = athleteData.Player_Name || athleteData.name || 'Unknown Player';

    if (!athletePosition) {
      return res.status(400).json({
        error: 'Position is required for evaluation'
      });
    }

    // Use provided user_id or create/find test user
    let evaluationUserId = user_id;
    if (!evaluationUserId) {
      let user = await prisma.user.findFirst({ where: { email: 'test@example.com' } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: 'test@example.com',
            password_hash: await bcrypt.hash('test123', 10)
          }
        });
      }
      evaluationUserId = user.id;
    }

    console.log('Triggering pipeline for position:', athletePosition);

    const result = await triggerPipeline({
      notebookName: process.env.AZURE_NOTEBOOK_NAME || process.env.AZURE_PIPELINE_NAME,
      pipelineParameters: {
        position: athletePosition,
        athlete_data: athleteData
      }
    });

    // Add imputation flags to response (will be populated by Synapse pipeline)
    const enhancedResult = {
      ...result,
      predicted_division: result.predicted_tier,
      confidence_score: result.probability,
      feature_importance: result.explainability || {},
      imputation_flags: {
        forty_yard_dash_imputed: false,
        vertical_jump_imputed: false,
        shuttle_imputed: false,
        broad_jump_imputed: false,
        bench_press_imputed: false
      },
      data_completeness_warning: false
    };

    // Save evaluation to database
    if (process.env.MOCK_SYNAPSE !== 'true') {
      await prisma.eval.create({
        data: {
          user_id: evaluationUserId,
          player_name: playerName,
          position: athletePosition,
          score: result.score,
          division: result.predicted_tier,
          notes: result.notes,
          probability: result.probability,
          performance_score: result.performance_score,
          combine_score: result.combine_score,
          upside_score: result.upside_score,
          underdog_bonus: result.underdog_bonus,
          goals: result.goals,
          switches: result.switches,
          calendar_advice: result.calendar_advice
        }
      });
    }

    res.json(enhancedResult);
  } catch (err) {
    console.error('Evaluate error:', err);
    res.status(500).json({
      error: err.message,
      details: 'Failed to process athlete evaluation'
    });
  }
});

app.get('/api/profile/get', async (req, res) => {
  try {
    const { user_id, email } = req.query;
    if (!user_id && !email) {
      return res.status(400).json({ error: 'Missing user_id or email' });
    }

    const whereClause = email ? { email: String(email) } : { id: parseInt(user_id) };
    const user = await prisma.user.findUnique({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        position: true,
        graduation_year: true,
        state: true,
        height: true,
        weight: true,
        profile_photo_url: true,
        video_links: true,
        privacy_setting: true,
        email_notifications: true,
        profile_complete: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Profile get error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/profile/update', async (req, res) => {
  try {
    const { user_id, email, ...profileData } = req.body;
    if (!user_id && !email) {
      return res.status(400).json({ error: 'Missing user_id or email' });
    }

    const whereClause = email ? { email: String(email) } : { id: parseInt(user_id) };

    // Check if profile is now complete
    const isComplete = profileData.name && profileData.position;
    if (isComplete) {
      profileData.profile_complete = true;
    }

    const updatedUser = await prisma.user.update({
      where: whereClause,
      data: profileData,
      select: {
        id: true,
        email: true,
        name: true,
        position: true,
        graduation_year: true,
        state: true,
        height: true,
        weight: true,
        profile_photo_url: true,
        video_links: true,
        privacy_setting: true,
        email_notifications: true,
        profile_complete: true
      }
    });

    res.json(updatedUser);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
