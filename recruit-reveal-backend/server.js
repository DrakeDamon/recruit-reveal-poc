const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { SynapseManagementClient } = require('@azure/arm-synapse');
const { DefaultAzureCredential } = require('@azure/identity');
const bcrypt = require('bcrypt');
const app = express();
app.use(express.json({ strict: false }));
const dotenv = require('dotenv');
const dotenvResult = dotenv.config({ path: './.env' });
console.log('dotenv result:', dotenvResult.parsed || dotenvResult.error);
console.log('Loaded env vars:', Object.keys(process.env));
app.use(cors());

const prisma = new PrismaClient();

async function fetchNotebookOutput(status) {
  const result = await prisma.eval.findFirst({ orderBy: { id: 'desc' } });
  return result || {
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
  let athlete_data;
  try {
    athlete_data = req.body.athlete_data;
    if (!athlete_data || !athlete_data.Player_Name || !athlete_data.position) {
      return res.status(400).json({ error: 'Invalid input: Player_Name and position required' });
    }
    const user_id = 'test_user'; // Replace with auth user_id later
    const position = athlete_data.position;
    console.log('Triggering pipeline:', process.env.AZURE_PIPELINE_NAME, 'for position:', position);
    const credential = new DefaultAzureCredential();
    const client = new SynapseManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    const params = { parameters: { position, athlete_data } };
    const run = await client.pipelines.createRun(
      process.env.AZURE_RESOURCE_GROUP,
      process.env.AZURE_SYNAPSE_WORKSPACE,
      process.env.AZURE_PIPELINE_NAME,
      params
    );
    console.log('Pipeline run ID:', run.runId);
    const maxWait = 5 * 60 * 1000; // 5 minutes
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
    res.json(result);
  } catch (err) {
    console.error('Evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('API running on port 3000'));
