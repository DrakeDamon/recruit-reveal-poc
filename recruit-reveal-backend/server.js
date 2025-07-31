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

app.post('/evaluate', async (req, res) => {
  try {
    const athlete_data = req.body.athlete_data;
    if (!athlete_data || !athlete_data.Player_Name || !athlete_data.position) {
      return res.status(400).json({ error: 'Invalid input: Player_Name and position required' });
    }
    
    // Create a test user if it doesn't exist, or use existing one
    let user = await prisma.user.findFirst({ where: { email: 'test@example.com' } });
    if (!user) {
      user = await prisma.user.create({ 
        data: { 
          email: 'test@example.com', 
          password_hash: await bcrypt.hash('test123', 10) 
        } 
      });
    }
    const user_id = String(user.id);
    const position = athlete_data.position;
    console.log('Triggering pipeline:', process.env.AZURE_PIPELINE_NAME, 'for position:', position);
    
    const result = await triggerPipeline({
      notebookName: process.env.AZURE_NOTEBOOK_NAME,
      pipelineParameters: { position, athlete_data }
    });
    
    // Skip database save in mock mode to avoid foreign key issues
    if (process.env.MOCK_SYNAPSE !== 'true') {
      await prisma.eval.create({
        data: {
          user_id,
          player_name: athlete_data.Player_Name,
          position,
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
    res.json(result);
  } catch (err) {
    console.error('Evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
