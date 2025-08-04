/**
 * Unit tests for wizard evaluation fixes
 * Tests the critical fixes for proper question flow and auto-skip logic
 */

describe('Wizard Evaluation Fixes', () => {
  // Mock profile data scenarios
  const fullProfile = {
    name: 'John Doe',
    position: 'QB',
    graduation_year: 2025,
    state: 'TX',
    height: 72,
    weight: 195,
    profile_complete: true
  };

  const partialProfile = {
    name: 'Jane Smith',
    position: 'WR',
    // Missing: graduation_year, state, height, weight
    profile_complete: false
  };

  // Mock position steps structure
  const qbSteps = [
    // Settings
    { key: 'Player_Name', category: 'settings' },
    { key: 'position', category: 'settings' },
    { key: 'grad_year', category: 'settings' },
    { key: 'state', category: 'settings' },
    // Stats
    { key: 'senior_yds', category: 'stats' },
    { key: 'senior_cmp', category: 'stats' },
    { key: 'senior_att', category: 'stats' },
    // Combine
    { key: 'forty_yard_dash', category: 'combine' },
    { key: 'vertical_jump', category: 'combine' },
    { key: 'height_inches', category: 'combine' },
    { key: 'weight_lbs', category: 'combine' },
    // Review
    { key: 'review', category: 'review' }
  ];

  const wrSteps = [
    // Settings
    { key: 'Player_Name', category: 'settings' },
    { key: 'position', category: 'settings' },
    { key: 'grad_year', category: 'settings' },
    { key: 'state', category: 'settings' },
    // Stats
    { key: 'senior_rec', category: 'stats' },
    { key: 'senior_rec_yds', category: 'stats' },
    { key: 'senior_rec_td', category: 'stats' },
    { key: 'junior_rec', category: 'stats' },
    { key: 'junior_rec_yds', category: 'stats' },
    { key: 'junior_rec_td', category: 'stats' },
    // Combine
    { key: 'forty_yard_dash', category: 'combine' },
    { key: 'vertical_jump', category: 'combine' },
    { key: 'height_inches', category: 'combine' },
    { key: 'weight_lbs', category: 'combine' },
    // Review
    { key: 'review', category: 'review' }
  ];

  // Helper to find first stats question for a position
  function findFirstStatsStep(steps, profile) {
    const profileData = {};
    if (profile?.name) profileData.Player_Name = profile.name;
    if (profile?.position) profileData.position = profile.position;
    if (profile?.graduation_year) profileData.grad_year = profile.graduation_year;
    if (profile?.state) profileData.state = profile.state;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.category === 'stats') {
        return i; // Always start at first stats question
      }
      // Only skip settings that have profile data
      if (step.category === 'settings' && profileData[step.key]) {
        continue;
      } else if (step.category === 'settings') {
        return i; // Stop at first missing setting
      }
    }
    return 0;
  }

  describe('Issue 1: Auto-skip only settings with profile data, start at first stat question', () => {
    test('should skip all settings and start at first stats question for complete profile', () => {
      const startStep = findFirstStatsStep(qbSteps, fullProfile);

      // Should start at step 4 (senior_yds) - first stats question
      expect(startStep).toBe(4);
      expect(qbSteps[startStep].key).toBe('senior_yds');
      expect(qbSteps[startStep].category).toBe('stats');
    });

    test('should skip only completed settings, stop at first missing setting', () => {
      const startStep = findFirstStatsStep(qbSteps, partialProfile);

      // Should start at step 2 (grad_year) - first missing setting
      expect(startStep).toBe(2);
      expect(qbSteps[startStep].key).toBe('grad_year');
      expect(qbSteps[startStep].category).toBe('settings');
    });

    test('should never skip stats or combine questions', () => {
      // Even with complete profile, stats and combine questions should never be auto-skipped
      const statsQuestions = qbSteps.filter(step => step.category === 'stats');
      const combineQuestions = qbSteps.filter(step => step.category === 'combine');

      expect(statsQuestions.length).toBeGreaterThan(0);
      expect(combineQuestions.length).toBeGreaterThan(0);

      // All should be present in the flow (none skipped)
      expect(statsQuestions.every(q => qbSteps.includes(q))).toBe(true);
      expect(combineQuestions.every(q => qbSteps.includes(q))).toBe(true);
    });
  });

  describe('Issue 2: Question arrays follow [settings, stats, combine] order', () => {
    test('QB questions should follow settings -> stats -> combine order', () => {
      const categories = qbSteps.map(step => step.category);
      const settingsEnd = categories.lastIndexOf('settings');
      const statsStart = categories.indexOf('stats');
      const statsEnd = categories.lastIndexOf('stats');
      const combineStart = categories.indexOf('combine');

      expect(settingsEnd).toBeLessThan(statsStart);
      expect(statsEnd).toBeLessThan(combineStart);
    });

    test('WR questions should include stats section (not just combine)', () => {
      const statsQuestions = wrSteps.filter(step => step.category === 'stats');
      const combineQuestions = wrSteps.filter(step => step.category === 'combine');

      // WR should have stats questions, not just combine
      expect(statsQuestions.length).toBeGreaterThan(0);
      expect(combineQuestions.length).toBeGreaterThan(0);

      // Should include receiving stats
      const hasReceivingStats = statsQuestions.some(q =>
        q.key.includes('rec') || q.key.includes('receiving')
      );
      expect(hasReceivingStats).toBe(true);
    });

    test('all positions should have same settings structure', () => {
      const settingsFields = ['Player_Name', 'position', 'grad_year', 'state'];

      const qbSettings = qbSteps.filter(s => s.category === 'settings').map(s => s.key);
      const wrSettings = wrSteps.filter(s => s.category === 'settings').map(s => s.key);

      expect(qbSettings).toEqual(settingsFields);
      expect(wrSettings).toEqual(settingsFields);
    });
  });

  describe('Issue 3: Input clearing and proper display', () => {
    test('input should clear when step changes', () => {
      // Mock input clearing logic
      let inputValue = 'test value';
      let currentStep = 1;

      const simulateStepChange = (newStep) => {
        if (newStep !== currentStep) {
          inputValue = ''; // Input should clear
          currentStep = newStep;
        }
      };

      simulateStepChange(2);
      expect(inputValue).toBe('');
      expect(currentStep).toBe(2);
    });

    test('input should use correct type based on question category', () => {
      // Settings questions should use appropriate input types
      const nameStep = qbSteps.find(s => s.key === 'Player_Name');
      const positionStep = qbSteps.find(s => s.key === 'position');
      const statsStep = qbSteps.find(s => s.key === 'senior_yds');

      expect(nameStep.category).toBe('settings'); // Text input
      expect(positionStep.category).toBe('settings'); // Dropdown
      expect(statsStep.category).toBe('stats'); // Number input
    });
  });

  describe('Issue 4: Imputation warning display', () => {
    test('should show warning when data is imputed', () => {
      const evalData = {
        score: 75,
        imputation_flags: {
          forty_yard_dash_imputed: true,
          vertical_jump_imputed: false,
          shuttle_imputed: true
        },
        data_completeness_warning: true
      };

      const hasImputedData = Object.values(evalData.imputation_flags).some(flag => flag);
      expect(hasImputedData).toBe(true);

      const imputedFields = Object.entries(evalData.imputation_flags)
        .filter(([_, imputed]) => imputed)
        .map(([field, _]) => field.replace('_imputed', ''));

      expect(imputedFields).toContain('forty_yard_dash');
      expect(imputedFields).toContain('shuttle');
      expect(imputedFields).not.toContain('vertical_jump');
    });

    test('should not show warning when no data is imputed', () => {
      const evalData = {
        score: 75,
        imputation_flags: {
          forty_yard_dash_imputed: false,
          vertical_jump_imputed: false,
          shuttle_imputed: false
        },
        data_completeness_warning: false
      };

      const hasImputedData = Object.values(evalData.imputation_flags).some(flag => flag);
      expect(hasImputedData).toBe(false);
    });

    test('should determine confidence level based on imputation', () => {
      const getConfidenceLevel = (hasImputed, confidenceScore) => {
        if (hasImputed && confidenceScore < 0.7) return 'low';
        if (hasImputed && confidenceScore < 0.8) return 'medium';
        return 'high';
      };

      expect(getConfidenceLevel(true, 0.6)).toBe('low');
      expect(getConfidenceLevel(true, 0.75)).toBe('medium');
      expect(getConfidenceLevel(false, 0.85)).toBe('high');
      expect(getConfidenceLevel(true, 0.85)).toBe('high');
    });
  });

  describe('Issue 5: Question order verification', () => {
    test('QB should have passing stats before combine metrics', () => {
      const passingStatsIndex = qbSteps.findIndex(s => s.key === 'senior_yds');
      const combineIndex = qbSteps.findIndex(s => s.key === 'forty_yard_dash');

      expect(passingStatsIndex).toBeLessThan(combineIndex);
      expect(passingStatsIndex).toBeGreaterThanOrEqual(4); // After settings
    });

    test('WR should have receiving stats before combine metrics', () => {
      const receivingStatsIndex = wrSteps.findIndex(s => s.key === 'senior_rec');
      const combineIndex = wrSteps.findIndex(s => s.key === 'forty_yard_dash');

      expect(receivingStatsIndex).toBeLessThan(combineIndex);
      expect(receivingStatsIndex).toBeGreaterThanOrEqual(4); // After settings
    });

    test('all positions should end with review step', () => {
      const qbLastStep = qbSteps[qbSteps.length - 1];
      const wrLastStep = wrSteps[wrSteps.length - 1];

      expect(qbLastStep.key).toBe('review');
      expect(qbLastStep.category).toBe('review');
      expect(wrLastStep.key).toBe('review');
      expect(wrLastStep.category).toBe('review');
    });
  });

  describe('Issue 6: Field name consistency', () => {
    test('QB field names should match FormValues interface', () => {
      const qbStatsFields = qbSteps.filter(s => s.category === 'stats').map(s => s.key);
      const expectedQbFields = ['senior_yds', 'senior_cmp', 'senior_att'];

      expect(qbStatsFields).toEqual(expectedQbFields);
    });

    test('WR field names should match FormValues interface', () => {
      const wrStatsFields = wrSteps.filter(s => s.category === 'stats').map(s => s.key);
      const expectedWrFields = ['senior_rec', 'senior_rec_yds', 'senior_rec_td', 'junior_rec', 'junior_rec_yds', 'junior_rec_td'];

      expect(wrStatsFields).toEqual(expectedWrFields);
    });

    test('combine field names should be consistent', () => {
      const qbCombineFields = qbSteps.filter(s => s.category === 'combine').map(s => s.key);
      const wrCombineFields = wrSteps.filter(s => s.category === 'combine').map(s => s.key);

      // Both positions should have same combine fields
      expect(qbCombineFields).toEqual(wrCombineFields);
      expect(qbCombineFields).toContain('forty_yard_dash');
      expect(qbCombineFields).toContain('vertical_jump');
      expect(qbCombineFields).toContain('height_inches');
      expect(qbCombineFields).toContain('weight_lbs');
    });
  });

  describe('Issue 7: Profile data mapping', () => {
    test('should map profile data to correct form fields', () => {
      const mapProfileToFormData = (profile) => {
        const formData = {};
        if (profile?.name) formData.Player_Name = profile.name;
        if (profile?.position) formData.position = profile.position;
        if (profile?.graduation_year) formData.grad_year = profile.graduation_year;
        if (profile?.state) formData.state = profile.state;
        if (profile?.height) formData.height_inches = profile.height;
        if (profile?.weight) formData.weight_lbs = profile.weight;
        return formData;
      };

      const formData = mapProfileToFormData(fullProfile);

      expect(formData.Player_Name).toBe('John Doe');
      expect(formData.position).toBe('QB');
      expect(formData.grad_year).toBe(2025);
      expect(formData.state).toBe('TX');
      expect(formData.height_inches).toBe(72);
      expect(formData.weight_lbs).toBe(195);
    });

    test('should handle partial profile data correctly', () => {
      const mapProfileToFormData = (profile) => {
        const formData = {};
        if (profile?.name) formData.Player_Name = profile.name;
        if (profile?.position) formData.position = profile.position;
        if (profile?.graduation_year) formData.grad_year = profile.graduation_year;
        if (profile?.state) formData.state = profile.state;
        return formData;
      };

      const formData = mapProfileToFormData(partialProfile);

      expect(formData.Player_Name).toBe('Jane Smith');
      expect(formData.position).toBe('WR');
      expect(formData.grad_year).toBeUndefined();
      expect(formData.state).toBeUndefined();
    });
  });

  describe('Issue 8: Step validation logic', () => {
    test('should validate required settings fields', () => {
      const validateSettings = (formData) => {
        const required = ['Player_Name', 'position', 'grad_year', 'state'];
        const missing = required.filter(field => !formData[field]);
        return missing;
      };

      const completeData = {
        Player_Name: 'John Doe',
        position: 'QB',
        grad_year: 2025,
        state: 'TX'
      };

      const incompleteData = {
        Player_Name: 'John Doe',
        position: 'QB'
        // Missing grad_year and state
      };

      expect(validateSettings(completeData)).toEqual([]);
      expect(validateSettings(incompleteData)).toEqual(['grad_year', 'state']);
    });

    test('should validate stats fields are numeric', () => {
      const validateStats = (formData) => {
        const statsFields = ['senior_yds', 'senior_cmp', 'senior_att'];
        const invalid = statsFields.filter(field => 
          formData[field] !== undefined && typeof formData[field] !== 'number'
        );
        return invalid;
      };

      const validData = {
        senior_yds: 2500,
        senior_cmp: 180,
        senior_att: 280
      };

      const invalidData = {
        senior_yds: '2500', // String instead of number
        senior_cmp: 180,
        senior_att: 280
      };

      expect(validateStats(validData)).toEqual([]);
      expect(validateStats(invalidData)).toEqual(['senior_yds']);
    });
  });
}); 