const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');  // Add this
const app = express();
app.use(express.json({ strict: false }));
require('dotenv').config();  // Loads .env
app.use(cors());  // Add this - allows all origins for POC (secure later)

// Your Postgres Pool and routes (same as before)
const pool = new Pool({
  connectionString: process.env.PG_URL,
  ssl: { rejectUnauthorized: false }
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
    const result = { score: 69.3, division: 'FCS', notes: 'Balanced profile' };
    await pool.query('INSERT INTO evals (player_name, score, division, notes) VALUES ($1, $2, $3, $4)',
      [athlete_data.Player_Name, result.score, result.division, result.notes]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('API running on port 3000'));