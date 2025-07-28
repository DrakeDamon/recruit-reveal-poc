const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');  // Add this
const { SynapseManagementClient } = require('@azure/arm-synapse');
const { DefaultAzureCredential } = require('@azure/identity');
const app = express();
const bcrypt = require('bcrypt');
const prisma = require('./prisma/client');
app.use(express.json({ strict: false }));
require('dotenv').config({ path: './.env' });
console.log('Loaded env vars:', Object.keys(process.env));
app.use(cors());  // Add this - allows all origins for POC (secure later)

// Your Postgres Pool and routes (same as before)
const pool = new Pool({
  connectionString: process.env.PG_URL,
  ssl: { rejectUnauthorized: false }
  
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Database connected:', res.rows[0]);
});

async function fetchNotebookOutput(status) {
  // Query Postgres for the latest eval (or fetch from Synapse output)
  const { rows } = await pool.query('SELECT * FROM evals ORDER BY id DESC LIMIT 1');
  const result = rows[0] || {
    score: 69.3,
    division: 'FCS',
    notes: 'Balanced profile',
    probability: 0.693, // Fit probability (0-1)
    performance_score: 70, // Stats-based (e.g., Senior_YPG * 0.4 + TD_Passes * 0.3 - Int * 0.3)
    combine_score: 65, // Combine-based (e.g., height/weight/40/vertical)
    upside_score: 0.1, // Trajectory bonus (e.g., Senior_Yds - Junior_Yds)
    underdog_bonus: 0.05, // Underdog bonus if applicable
    goals: ['Improve 40-yard dash to 4.5s', 'Increase senior TD passes'], // Recruiting goals
    switches: 'Consider switching to WR for better Power5 fit', // Position switch suggestion
    calendar_advice: 'Schedule campus visits during April 15-May 24, 2025 contact period' // From recruiting calendar
  };
  return {
    score: result.score,
    predicted_tier: result.division, // Map to EvalData's predicted_tier
    notes: result.notes,
    probability: result.probability,
    performance_score: result.performance_score,
    combine_score: result.combine_score,
    upside_score: result.upside_score,
    underdog_bonus: result.underdog_bonus,
    goals: result.goals,
    switches: result.switches,
    calendar_advice: result.calendar_advice
  };
}

// Routes Section
app.get('/', (req, res) => {
  res.json({ message: 'Recruit Reveal API is running' });
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

// POST /api/login – verify credentials and return user
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    // Optionally sign a JWT for stateless auth
    // const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    client.release();
    res.send('DB connected successfully!');
  } catch (err) {
    res.status(500).send(`DB connection error: ${err.message}`);
  }
});

app.post('/evaluate', async (req, res) => {
  let athlete_data;
  try {
    athlete_data = req.body.athlete_data;
    if (!athlete_data || !athlete_data.Player_Name) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    console.log('Triggering pipeline:', process.env.AZURE_PIPELINE_NAME);
    const credential = new DefaultAzureCredential();
    const client = new SynapseManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    const params = { parameters: athlete_data };
    const run = await client.pipelines.createRun(
      process.env.AZURE_RESOURCE_GROUP,
      process.env.AZURE_SYNAPSE_WORKSPACE,
      process.env.AZURE_PIPELINE_NAME,
      params
    );
    console.log('Pipeline run ID:', run.runId);
    const maxWait = 10 * 60 * 1000; // 10 minutes
    const start = Date.now();
    let result;
    while (Date.now() - start < maxWait) {
      const status = await client.pipelineRuns.get(
        process.env.AZURE_RESOURCE_GROUP,
        process.env.AZURE_SYNAPSE_WORKSPACE,
        run.runId
      );
      console.log('Pipeline status:', status.status);
      if (status.status === 'Succeeded') {
        result = await fetchNotebookOutput(status);
        break;
      } else if (status.status === 'Failed') {
        throw new Error('Pipeline failed');
      }
      await new Promise(r => setTimeout(r, 5000));
    }
    if (!result) throw new Error('Pipeline timed out');
    await pool.query(
      'INSERT INTO evals (player_name, score, division, notes, probability, performance_score, combine_score, upside_score, underdog_bonus, goals, switches, calendar_advice) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [
        athlete_data.Player_Name,
        result.score,
        result.predicted_tier,
        result.notes,
        result.probability,
        result.performance_score,
        result.combine_score,
        result.upside_score,
        result.underdog_bonus,
        result.goals,
        result.switches,
        result.calendar_advice
      ]
    );
    res.json(result);
  } catch (err) {
    console.error('Evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Custom function to fetch output (e.g., from Postgres or blob)
async function fetchNotebookOutput(status) {
  // Example: Query Postgres for result (assume notebook inserts to evals table)
  const { rows } = await pool.query('SELECT * FROM evals ORDER BY id DESC LIMIT 1');
  return rows[0] || { score: 69.3, division: 'FCS', notes: 'Balanced profile' };  // Fallback
}

app.listen(3000, () => console.log('API running on port 3000'));