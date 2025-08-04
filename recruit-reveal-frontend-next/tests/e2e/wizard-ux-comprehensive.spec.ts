import { test, expect } from '@playwright/test';

test.describe('Wizard UX Bug Fixes - Comprehensive Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Default logged-in user with complete profile
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        json: {
          id: 1,
          email: 'test@example.com',
          name: 'John Doe',
          position: 'QB',
          graduation_year: 2025,
          state: 'TX',
          height: 72,
          weight: 195,
          profile_complete: true
        }
      });
    });

    await page.route('/api/evaluate', async route => {
      await route.fulfill({
        json: {
          score: 73.5,
          predicted_tier: 'FCS',
          predicted_division: 'FCS',
          confidence_score: 0.735,
          probability: 0.735,
          performance_score: 0.78,
          combine_score: 0.72,
          upside_score: 0.15,
          goals: ['Improve 40-yard dash', 'Increase completion percentage'],
          switches: 'Consider WR for better fit',
          calendar_advice: 'Schedule visits in spring',
          imputation_flags: {
            forty_yard_dash_imputed: false,
            vertical_jump_imputed: false,
            shuttle_imputed: false,
            broad_jump_imputed: false,
            bench_press_imputed: false
          },
          data_completeness_warning: false
        }
      });
    });
  });

  test('BUG FIX 1A: Complete profile auto-fill - Skip ALL answered questions', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // ✅ Personalized welcome for logged in users
    await expect(page.locator('text=🏈 Welcome back, John Doe! Ready to evaluate your potential?')).toBeVisible();

    // ✅ Should skip ALL profile questions since they're answered
    await expect(page.locator('input[placeholder="Enter your name"]')).not.toBeVisible();
    await expect(page.locator('text=Select position')).not.toBeVisible();
    await expect(page.locator('input[placeholder="e.g., 2026"]')).not.toBeVisible();
    await expect(page.locator('text=Select state')).not.toBeVisible();

    // ✅ Should jump directly to position-specific questions (QB stats)
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).toBeVisible();
  });

  test('BUG FIX 1B: Partial profile - Only skip answered questions', async ({ page }) => {
    // Mock partial profile - missing state and position
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        json: {
          id: 1,
          email: 'test@example.com',
          name: 'Partial User',
          graduation_year: 2025,
          // Missing: position, state, height, weight
          profile_complete: false
        }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // ✅ Should skip name and grad_year (answered in profile)
    await expect(page.locator('input[placeholder="Enter your name"]')).not.toBeVisible();

    // ✅ Should start with position since it's NOT in profile
    await expect(page.locator('text=🎯 Awesome! Which position do you play?')).toBeVisible();
    await expect(page.locator('text=Select position')).toBeVisible();

    // Select position and continue
    await page.click('text=Select position');
    await page.click('text=WR');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // ✅ Should skip grad_year since it's in profile, go to state
    await expect(page.locator('text=🗺️ Which state do you play in?')).toBeVisible();
    await expect(page.locator('text=Select state')).toBeVisible();
  });

  test('BUG FIX 1C: No profile - Ask all questions', async ({ page }) => {
    // Mock no user logged in
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        status: 404,
        json: { error: 'User not found' }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // ✅ Generic welcome for non-logged users
    await expect(page.locator('text=🏈 Welcome! Ready to evaluate your potential?')).toBeVisible();

    // ✅ Should start from first question (name)
    await expect(page.locator('input[placeholder="Enter your name"]')).toBeVisible();
  });

  test('BUG FIX 2A: Input clearing after Next button', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForTimeout(500);

    const input = page.locator('input[type="number"]').first();
    await input.waitFor();

    // ✅ Enter value and click Next
    await input.fill('2500');
    expect(await input.inputValue()).toBe('2500');

    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // ✅ Next input should be empty
    const nextInput = page.locator('input[type="number"]').first();
    await nextInput.waitFor();
    expect(await nextInput.inputValue()).toBe('');
  });

  test('BUG FIX 2B: Input clearing after Enter key', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForTimeout(500);

    const input = page.locator('input[type="number"]').first();
    await input.waitFor();

    // ✅ Enter value and press Enter
    await input.fill('3000');
    expect(await input.inputValue()).toBe('3000');

    await input.press('Enter');
    await page.waitForTimeout(300);

    // ✅ Next input should be empty
    const nextInput = page.locator('input[type="number"]').first();
    await nextInput.waitFor();
    expect(await nextInput.inputValue()).toBe('');
  });

  test('BUG FIX 3A: QB position has correct question sequence', async ({ page }) => {
    // Start fresh to test position flow
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        json: {
          id: 1,
          email: 'test@example.com',
          name: 'QB Player',
          profile_complete: false
        }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Fill name and select QB
    await page.fill('input[placeholder="Enter your name"]', 'QB Player');
    await page.click('button:has-text("Next")');

    await page.click('text=Select position');
    await page.click('text=QB');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Fill remaining basic info
    await page.fill('input[type="number"]', '2025');
    await page.click('button:has-text("Next")');

    await page.click('text=Select state');
    await page.click('text=TX');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // ✅ Should see QB-specific questions in correct order
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).toBeVisible();

    await page.fill('input[type="number"]', '2800');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await expect(page.locator('text=🎯 How many completions did you rack up')).toBeVisible();
  });

  test('BUG FIX 3B: RB position has correct question sequence', async ({ page }) => {
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        json: {
          id: 1,
          email: 'test@example.com',
          name: 'RB Player',
          profile_complete: false
        }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Fill basic info and select RB
    await page.fill('input[placeholder="Enter your name"]', 'RB Player');
    await page.click('button:has-text("Next")');

    await page.click('text=Select position');
    await page.click('text=RB');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '2025');
    await page.click('button:has-text("Next")');

    await page.click('text=Select state');
    await page.click('text=FL');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // ✅ Should see RB-specific questions, NOT QB questions
    await expect(page.locator('text=🏃‍♂️ Senior year rushing yards')).toBeVisible();
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).not.toBeVisible();

    await page.fill('input[type="number"]', '1500');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await expect(page.locator('text=👐 Total touches')).toBeVisible();
  });

  test('BUG FIX 3C: WR position has correct question sequence', async ({ page }) => {
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        json: {
          id: 1,
          email: 'test@example.com',
          name: 'WR Player',
          profile_complete: false
        }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Fill basic info and select WR
    await page.fill('input[placeholder="Enter your name"]', 'WR Player');
    await page.click('button:has-text("Next")');

    await page.click('text=Select position');
    await page.click('text=WR');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '2025');
    await page.click('button:has-text("Next")');

    await page.click('text=Select state');
    await page.click('text=CA');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // ✅ WR should start with combine metrics, NOT stats from other positions
    await expect(page.locator('text=💨 40-yard dash time')).toBeVisible();
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).not.toBeVisible();
    await expect(page.locator('text=🏃‍♂️ Senior year rushing yards')).not.toBeVisible();
  });

  test('BUG FIX 3D: Position switching updates question flow correctly', async ({ page }) => {
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        json: {
          id: 1,
          email: 'test@example.com',
          name: 'Switch Player',
          profile_complete: false
        }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Fill basic info
    await page.fill('input[placeholder="Enter your name"]', 'Switch Player');
    await page.click('button:has-text("Next")');

    // Start with QB
    await page.click('text=Select position');
    await page.click('text=QB');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Continue through basic info
    await page.fill('input[type="number"]', '2025');
    await page.click('button:has-text("Next")');

    await page.click('text=Select state');
    await page.click('text=TX');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Should see QB question
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).toBeVisible();

    // ✅ Go back and change position to RB
    await page.click('button:has-text("Back")');
    await page.click('button:has-text("Back")');
    await page.click('button:has-text("Back")');

    await page.click('text=Select position');
    await page.click('text=RB');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Skip basic info again
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // ✅ Should now see RB questions, NOT QB questions
    await expect(page.locator('text=🏃‍♂️ Senior year rushing yards')).toBeVisible();
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).not.toBeVisible();
  });

  test('End-to-end evaluation with proper auto-fill and input clearing', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // ✅ Should start from QB stats due to auto-fill
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).toBeVisible();

    // Fill QB stats - each input should clear after submission
    const statValues = ['2800', '180', '280', '8', '25', '2200'];

    for (let i = 0; i < statValues.length; i++) {
      const input = page.locator('input[type="number"]').first();
      await input.waitFor();

      // Input should be empty from previous step
      if (i > 0) {
        expect(await input.inputValue()).toBe('');
      }

      await input.fill(statValues[i]);
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(200);
    }

    // Fill combine data
    const combineValues = ['4.6', '32', '4.4'];

    for (let i = 0; i < combineValues.length; i++) {
      const input = page.locator('input[type="number"]').first();
      await input.waitFor();

      // Input should be empty
      expect(await input.inputValue()).toBe('');

      await input.fill(combineValues[i]);
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(200);
    }

    // Physical measurements are pre-filled, so advance to review
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // ✅ Should reach review
    await expect(page.locator('text=🌟 Ready to see your potential?')).toBeVisible();

    // Submit evaluation
    await page.click('button:has-text("Submit Evaluation")');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });
}); 