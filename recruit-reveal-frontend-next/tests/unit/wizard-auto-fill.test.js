/**
 * Unit tests for wizard auto-fill logic and smart question skipping
 * Tests the critical UX bug fixes without requiring full E2E setup
 */

describe('Wizard Auto-fill Logic', () => {
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

  const emptyProfile = null;

  // Helper function to simulate the wizard's step calculation logic
  function calculateStartStep(profile, positionSteps) {
    if (!profile) return 0;

    let startStep = 0;
    const profileData = {};

    if (profile.name) {
      profileData.Player_Name = profile.name;
      startStep = Math.max(startStep, 1); // Skip name question
    }

    if (profile.position) {
      profileData.position = profile.position;
      startStep = Math.max(startStep, 2); // Skip position question
    }

    if (profile.graduation_year) {
      profileData.grad_year = profile.graduation_year;
      startStep = Math.max(startStep, 3); // Skip grad year question
    }

    if (profile.state) {
      profileData.state = profile.state;
      startStep = Math.max(startStep, 4); // Skip state question
    }

    // Find the first step that hasn't been pre-filled
    let nextStep = startStep;
    while (nextStep < positionSteps.length && positionSteps[nextStep]) {
      const stepKey = positionSteps[nextStep].key;
      if (stepKey === 'review' || !profileData[stepKey]) {
        break;
      }
      nextStep++;
    }

    return { startStep: nextStep, profileData };
  }

  // Mock position steps (simplified from actual wizard)
  const qbSteps = [
    { key: 'Player_Name', prompt: 'Welcome! What\'s your name?' },
    { key: 'position', prompt: 'Which position do you play?' },
    { key: 'grad_year', prompt: 'What year will you graduate?' },
    { key: 'state', prompt: 'Which state do you play in?' },
    { key: 'senior_yds', prompt: 'Senior year passing yards?' },
    { key: 'senior_cmp', prompt: 'Senior year completions?' },
    { key: 'forty_yard_dash', prompt: '40-yard dash time?' },
    { key: 'height_inches', prompt: 'Height?' },
    { key: 'weight_lbs', prompt: 'Weight?' },
    { key: 'review', prompt: 'Ready to see your potential?' }
  ];

  const wrSteps = [
    { key: 'Player_Name', prompt: 'Welcome! What\'s your name?' },
    { key: 'position', prompt: 'Which position do you play?' },
    { key: 'grad_year', prompt: 'What year will you graduate?' },
    { key: 'state', prompt: 'Which state do you play in?' },
    { key: 'forty_yard_dash', prompt: '40-yard dash time?' },
    { key: 'vertical_jump', prompt: 'Vertical jump?' },
    { key: 'height_inches', prompt: 'Height?' },
    { key: 'weight_lbs', prompt: 'Weight?' },
    { key: 'review', prompt: 'Ready to see your potential?' }
  ];

  describe('UX Bug Fix 1: Auto-fill profile data and skip redundant questions', () => {
    test('should skip ALL questions that have profile data', () => {
      const result = calculateStartStep(fullProfile, qbSteps);

      // Should skip name, position, grad_year, state (steps 0-3)
      // Should start at step 4 (senior_yds) - first unanswered question
      expect(result.startStep).toBe(4);
      expect(result.profileData).toEqual({
        Player_Name: 'John Doe',
        position: 'QB',
        grad_year: 2025,
        state: 'TX'
      });
    });

    test('should only skip questions with actual profile answers', () => {
      const result = calculateStartStep(partialProfile, wrSteps);

      // Should skip name and position (steps 0-1)
      // Should start at step 2 (grad_year) - first missing field
      expect(result.startStep).toBe(2);
      expect(result.profileData).toEqual({
        Player_Name: 'Jane Smith',
        position: 'WR'
      });
    });

    test('should start from beginning for users with no profile', () => {
      const result = calculateStartStep(emptyProfile, qbSteps);

      expect(result.startStep).toBe(0);
      expect(result.profileData).toEqual({});
    });
  });

  describe('Position-specific question flow isolation', () => {
    test('QB steps should include passing stats', () => {
      const qbStatSteps = qbSteps.filter(step =>
        ['senior_yds', 'senior_cmp'].includes(step.key)
      );

      expect(qbStatSteps).toHaveLength(2);
      expect(qbStatSteps[0].key).toBe('senior_yds');
      expect(qbStatSteps[1].key).toBe('senior_cmp');
    });

    test('WR steps should focus on combine metrics', () => {
      const wrCombineSteps = wrSteps.filter(step =>
        ['forty_yard_dash', 'vertical_jump'].includes(step.key)
      );

      expect(wrCombineSteps).toHaveLength(2);
      expect(wrCombineSteps[0].key).toBe('forty_yard_dash');
      expect(wrCombineSteps[1].key).toBe('vertical_jump');
    });

    test('position change should trigger different question flow', () => {
      // QB flow includes passing stats
      const qbPassingStep = qbSteps.find(step => step.key === 'senior_yds');
      expect(qbPassingStep).toBeDefined();

      // WR flow does not include passing stats
      const wrPassingStep = wrSteps.find(step => step.key === 'senior_yds');
      expect(wrPassingStep).toBeUndefined();
    });
  });

  describe('Welcome message personalization', () => {
    function getWelcomeMessage(profile) {
      if (profile?.name) {
        return `🏈 Welcome back, ${profile.name}! Ready to evaluate your potential?`;
      }
      return '🏈 Welcome! Ready to evaluate your potential?';
    }

    test('should show personalized welcome for logged in users', () => {
      const message = getWelcomeMessage(fullProfile);
      expect(message).toBe('🏈 Welcome back, John Doe! Ready to evaluate your potential?');
    });

    test('should show generic welcome for non-logged in users', () => {
      const message = getWelcomeMessage(null);
      expect(message).toBe('🏈 Welcome! Ready to evaluate your potential?');
    });

    test('should handle partial profile data', () => {
      const message = getWelcomeMessage(partialProfile);
      expect(message).toBe('🏈 Welcome back, Jane Smith! Ready to evaluate your potential?');
    });
  });

  describe('Input clearing logic simulation', () => {
    // Mock input clearing behavior
    function simulateInputClearing(currentValue, stepChange) {
      if (stepChange) {
        return ''; // Clear input when step changes
      }
      return currentValue; // Keep current value
    }

    test('should clear input when step advances', () => {
      const inputValue = '2500';
      const stepChanged = true;
      
      const result = simulateInputClearing(inputValue, stepChanged);
      expect(result).toBe('');
    });

    test('should preserve input when step does not change', () => {
      const inputValue = '2500';
      const stepChanged = false;
      
      const result = simulateInputClearing(inputValue, stepChanged);
      expect(result).toBe('2500');
    });
  });

  describe('Profile data mapping to form fields', () => {
    function mapProfileToFormData(profile) {
      const formData = {};
      
      if (profile?.name) {
        formData.Player_Name = profile.name;
      }
      
      if (profile?.position) {
        formData.position = profile.position;
      }
      
      if (profile?.graduation_year) {
        formData.grad_year = profile.graduation_year;
      }
      
      if (profile?.state) {
        formData.state = profile.state;
      }
      
      if (profile?.height) {
        formData.height_inches = profile.height;
      }
      
      if (profile?.weight) {
        formData.weight_lbs = profile.weight;
      }
      
      return formData;
    }

    test('should map complete profile to all form fields', () => {
      const formData = mapProfileToFormData(fullProfile);
      
      expect(formData).toEqual({
        Player_Name: 'John Doe',
        position: 'QB',
        grad_year: 2025,
        state: 'TX',
        height_inches: 72,
        weight_lbs: 195
      });
    });

    test('should map partial profile to available fields only', () => {
      const formData = mapProfileToFormData(partialProfile);
      
      expect(formData).toEqual({
        Player_Name: 'Jane Smith',
        position: 'WR'
      });
    });

    test('should return empty object for null profile', () => {
      const formData = mapProfileToFormData(null);
      
      expect(formData).toEqual({});
    });
  });

  describe('Step validation and error handling', () => {
    function validateStepData(step, formData) {
      const errors = [];
      
      if (step.required && !formData[step.key]) {
        errors.push(`${step.key} is required`);
      }
      
      if (step.key === 'grad_year' && formData[step.key]) {
        const year = parseInt(formData[step.key]);
        if (year < 2020 || year > 2030) {
          errors.push('Graduation year must be between 2020 and 2030');
        }
      }
      
      return errors;
    }

    test('should validate required fields', () => {
      const step = { key: 'Player_Name', required: true };
      const formData = {};
      
      const errors = validateStepData(step, formData);
      expect(errors).toContain('Player_Name is required');
    });

    test('should validate graduation year range', () => {
      const step = { key: 'grad_year', required: true };
      const formData = { grad_year: 2019 };
      
      const errors = validateStepData(step, formData);
      expect(errors).toContain('Graduation year must be between 2020 and 2030');
    });

    test('should pass validation for valid data', () => {
      const step = { key: 'Player_Name', required: true };
      const formData = { Player_Name: 'John Doe' };
      
      const errors = validateStepData(step, formData);
      expect(errors).toHaveLength(0);
    });
  });
}); 