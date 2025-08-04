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

// Mock triggerPipeline function with enhanced imputation response
const mockEvalResult = {
  score: 69.3,
  predicted_tier: 'FCS',
  predicted_division: 'FCS',
  notes: 'Balanced profile with good potential',
  probability: 0.693,
  confidence_score: 0.693,
  performance_score: 0.70,
  combine_score: 0.65,
  upside_score: 0.10,
  underdog_bonus: 0.05,
  goals: ['Improve 40-yard dash to 4.5s', 'Increase senior TD passes'],
  switches: 'Consider switching to WR for better Power5 fit',
  calendar_advice: 'Schedule campus visits during April 15-May 24, 2025 contact period',
  imputation_flags: {
    forty_yard_dash_imputed: true,
    vertical_jump_imputed: false,
    shuttle_imputed: true,
    broad_jump_imputed: false,
    bench_press_imputed: true
  },
  data_completeness_warning: true,
  feature_importance: {
    speed_power_ratio: 0.2096,
    ath_power: 0.1145,
    combine_confidence: 0.0577
  }
};

triggerPipeline.mockResolvedValue(mockEvalResult);

// Set up the /evaluate route (simplified version of server.js)
const bcrypt = require('bcrypt');
const prisma = mockPrismaClient;

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

    // Mock user creation/retrieval
    let user = { id: 1, email: 'test@example.com' };
    mockPrismaClient.user.findFirst.mockResolvedValue(user);

    const result = await triggerPipeline({
      notebookName: 'test-notebook',
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
      imputation_flags: result.imputation_flags || {
        forty_yard_dash_imputed: false,
        vertical_jump_imputed: false,
        shuttle_imputed: false,
        broad_jump_imputed: false,
        bench_press_imputed: false
      },
      data_completeness_warning: result.data_completeness_warning || false
    };

    res.json(enhancedResult);
  } catch (err) {
    console.error('Evaluate error:', err);
    res.status(500).json({
      error: err.message,
      details: 'Failed to process athlete evaluation'
    });
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
        predicted_division: expect.any(String),
        notes: expect.any(String),
        probability: expect.any(Number),
        confidence_score: expect.any(Number),
        performance_score: expect.any(Number),
        combine_score: expect.any(Number),
        upside_score: expect.any(Number),
        goals: expect.any(Array),
        switches: expect.any(String),
        calendar_advice: expect.any(String),
        imputation_flags: expect.any(Object),
        data_completeness_warning: expect.any(Boolean),
        feature_importance: expect.any(Object)
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
        predicted_division: expect.any(String),
        notes: expect.any(String),
        probability: expect.any(Number),
        confidence_score: expect.any(Number),
        performance_score: expect.any(Number),
        combine_score: expect.any(Number),
        upside_score: expect.any(Number),
        goals: expect.any(Array),
        switches: expect.any(String),
        calendar_advice: expect.any(String),
        imputation_flags: expect.any(Object),
        data_completeness_warning: expect.any(Boolean),
        feature_importance: expect.any(Object)
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
        error: 'Invalid input: athlete_data with position required'
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
        error: 'Position is required for evaluation'
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
        error: 'Invalid input: athlete_data with position required'
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
        error: 'Pipeline failed',
        details: 'Failed to process athlete evaluation'
      });
    });

    it('should handle missing combine data with imputation flags', async () => {
      const incompleteData = {
        athlete_data: {
          Player_Name: 'Incomplete Player',
          position: 'WR',
          grad_year: 2025,
          state: 'FL',
          senior_yds: 1000,
          senior_rec: 50,
          senior_td: 10
          // Missing combine data: forty_yard_dash, vertical_jump, etc.
        }
      };

      const response = await request(app)
        .post('/evaluate')
        .send(incompleteData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        score: expect.any(Number),
        predicted_tier: expect.any(String),
        imputation_flags: expect.objectContaining({
          forty_yard_dash_imputed: expect.any(Boolean),
          vertical_jump_imputed: expect.any(Boolean),
          shuttle_imputed: expect.any(Boolean),
          broad_jump_imputed: expect.any(Boolean),
          bench_press_imputed: expect.any(Boolean)
        }),
        data_completeness_warning: expect.any(Boolean)
      });
    });

    it('should handle new API format with position at root level', async () => {
      const newFormatData = {
        Player_Name: 'New Format Player',
        position: 'RB',
        grad_year: 2025,
        state: 'TX',
        senior_yds: 1500,
        senior_avg: 5.2,
        senior_td: 18
      };

      const response = await request(app)
        .post('/api/evaluate')
        .send(newFormatData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        score: expect.any(Number),
        predicted_tier: expect.any(String),
        predicted_division: expect.any(String),
        confidence_score: expect.any(Number)
      });

      expect(triggerPipeline).toHaveBeenCalledWith({
        notebookName: 'test-notebook',
        pipelineParameters: {
          position: 'RB',
          athlete_data: newFormatData
        }
      });
    });

    it('should include feature importance in response', async () => {
      const dataWithStats = {
        athlete_data: {
          Player_Name: 'Feature Test',
          position: 'QB',
          grad_year: 2025,
          state: 'CA',
          senior_ypg: 280,
          senior_tds: 25,
          senior_comp_pct: 65,
          forty_yard_dash: 4.6,
          vertical_jump: 32
        }
      };

      const response = await request(app)
        .post('/evaluate')
        .send(dataWithStats);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        feature_importance: expect.objectContaining({
          speed_power_ratio: expect.any(Number),
          ath_power: expect.any(Number),
          combine_confidence: expect.any(Number)
        })
      });
    });
  });
});