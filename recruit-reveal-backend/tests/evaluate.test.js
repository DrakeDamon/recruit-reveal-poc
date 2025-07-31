const request = require('supertest');
const express = require('express');

// Mock dependencies before requiring the server
jest.mock('../lib/synapse');
jest.mock('@prisma/client');

const { triggerPipeline } = require('../lib/synapse');
const { PrismaClient } = require('@prisma/client');

// Create Express app for testing (based on server.js structure)
const app = express();
app.use(express.json({ strict: false }));

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findFirst: jest.fn(),
    create: jest.fn()
  },
  eval: {
    create: jest.fn()
  }
};

PrismaClient.mockImplementation(() => mockPrismaClient);

// Mock triggerPipeline function
const mockEvalResult = {
  score: 69.3,
  predicted_tier: 'FCS',
  notes: 'Balanced profile with good potential',
  probability: 0.693,
  performance_score: 0.70,
  combine_score: 0.65,
  upside_score: 0.10,
  underdog_bonus: 0.05,
  goals: ['Improve 40-yard dash to 4.5s', 'Increase senior TD passes'],
  switches: 'Consider switching to WR for better Power5 fit',
  calendar_advice: 'Schedule campus visits during April 15-May 24, 2025 contact period'
};

triggerPipeline.mockResolvedValue(mockEvalResult);

// Set up the /evaluate route (simplified version of server.js)
const bcrypt = require('bcrypt');
const prisma = mockPrismaClient;

app.post('/evaluate', async (req, res) => {
  try {
    const athlete_data = req.body.athlete_data;
    if (!athlete_data || !athlete_data.Player_Name || !athlete_data.position) {
      return res.status(400).json({ error: 'Invalid input: Player_Name and position required' });
    }
    
    // Mock user creation/retrieval
    let user = { id: 1, email: 'test@example.com' };
    mockPrismaClient.user.findFirst.mockResolvedValue(user);
    
    const user_id = String(user.id);
    const position = athlete_data.position;
    
    const result = await triggerPipeline({
      notebookName: 'test-notebook',
      pipelineParameters: { position, athlete_data }
    });
    
    // Skip database save in test mode
    res.json(result);
  } catch (err) {
    console.error('Evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

describe('/evaluate endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /evaluate', () => {
    it('should return 200 and evaluation result for valid QB data', async () => {
      const qbData = {
        athlete_data: {
          Player_Name: 'John Doe',
          position: 'QB',
          grad_year: 2025,
          state: 'TX',
          senior_yds: 3500,
          senior_cmp: 250,
          senior_att: 400,
          senior_int: 8,
          senior_td_passes: 35
        }
      };

      const response = await request(app)
        .post('/evaluate')
        .send(qbData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        score: expect.any(Number),
        predicted_tier: expect.any(String),
        notes: expect.any(String),
        probability: expect.any(Number),
        performance_score: expect.any(Number),
        combine_score: expect.any(Number),
        upside_score: expect.any(Number),
        goals: expect.any(Array),
        switches: expect.any(String),
        calendar_advice: expect.any(String)
      });
      
      expect(triggerPipeline).toHaveBeenCalledWith({
        notebookName: 'test-notebook',
        pipelineParameters: {
          position: 'QB',
          athlete_data: qbData.athlete_data
        }
      });
    });

    it('should return 200 and evaluation result for valid RB data', async () => {
      const rbData = {
        athlete_data: {
          Player_Name: 'Jane Smith',
          position: 'RB',
          grad_year: 2025,
          state: 'CA',
          senior_yds: 1800,
          senior_touches: 285,
          senior_avg: 6.3,
          senior_rec: 45,
          senior_rec_yds: 420,
          senior_td: 22
        }
      };

      const response = await request(app)
        .post('/evaluate')
        .send(rbData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        score: expect.any(Number),
        predicted_tier: expect.any(String),
        notes: expect.any(String)
      });
      
      expect(triggerPipeline).toHaveBeenCalledWith({
        notebookName: 'test-notebook',
        pipelineParameters: {
          position: 'RB',
          athlete_data: rbData.athlete_data
        }
      });
    });

    it('should return 400 when Player_Name is missing', async () => {
      const invalidData = {
        athlete_data: {
          position: 'QB',
          grad_year: 2025
        }
      };

      const response = await request(app)
        .post('/evaluate')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid input: Player_Name and position required'
      });
      
      expect(triggerPipeline).not.toHaveBeenCalled();
    });

    it('should return 400 when position is missing', async () => {
      const invalidData = {
        athlete_data: {
          Player_Name: 'John Doe',
          grad_year: 2025
        }
      };

      const response = await request(app)
        .post('/evaluate')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid input: Player_Name and position required'
      });
      
      expect(triggerPipeline).not.toHaveBeenCalled();
    });

    it('should return 400 when athlete_data is missing entirely', async () => {
      const invalidData = {};

      const response = await request(app)
        .post('/evaluate')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid input: Player_Name and position required'
      });
      
      expect(triggerPipeline).not.toHaveBeenCalled();
    });

    it('should return 500 when triggerPipeline throws an error', async () => {
      triggerPipeline.mockRejectedValueOnce(new Error('Pipeline failed'));

      const validData = {
        athlete_data: {
          Player_Name: 'John Doe',
          position: 'QB',
          grad_year: 2025
        }
      };

      const response = await request(app)
        .post('/evaluate')
        .send(validData);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Pipeline failed'
      });
    });
  });
});