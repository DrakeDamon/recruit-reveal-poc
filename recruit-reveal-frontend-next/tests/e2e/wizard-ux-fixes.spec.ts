import { test, expect } from '@playwright/test';

test.describe('Wizard UX Bug Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API endpoints
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

  test('Bug Fix 1: Auto-fill profile data and skip redundant questions', async ({ page }) => {
    // Navigate to wizard page
    await page.goto('/wizard');

    // Wait for profile data to load
    await page.waitForTimeout(500);

    // Check that welcome message is personalized for logged in user
    await expect(page.locator('text=🏈 Welcome back, John Doe! Ready to evaluate your potential?')).toBeVisible();

    // Verify that basic profile questions are skipped
    // Should not see name input since it's pre-filled
    await expect(page.locator('input[placeholder="Enter your name"]')).not.toBeVisible();

    // Should not see position selector since it's pre-filled
    await expect(page.locator('text=Select position')).not.toBeVisible();

    // Should start from first unanswered question (likely stats)
    // For QB, should see senior year passing yards question
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).toBeVisible();

    // Verify form is pre-filled with profile data
    const nameField = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        const formData = new FormData(form);
        return formData.get('Player_Name');
      }
      return null;
    });
    expect(nameField).toBe('John Doe');
  });

  test('Bug Fix 2: Input bar clears after submission', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Find the first numeric input field
    const input = page.locator('input[type="number"]').first();
    await input.waitFor();

    // Enter a value
    await input.fill('2500');
    expect(await input.inputValue()).toBe('2500');

    // Submit the answer
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Verify the input field is cleared for the next question
    const nextInput = page.locator('input[type="number"]').first();
    await nextInput.waitFor();
    expect(await nextInput.inputValue()).toBe('');
  });

  test('Bug Fix 3: Position-specific questions are correct and isolated', async ({ page }) => {
    // Start with a fresh wizard (no pre-filled position)
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        json: {
          id: 1,
          email: 'test@example.com',
          name: 'Jane Smith',
          profile_complete: false
        }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Select QB position
    await page.click('text=Select position');
    await page.click('text=QB');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Verify QB-specific questions appear
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).toBeVisible();

    // Navigate through a few QB questions
    await page.fill('input[type="number"]', '2800');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await expect(page.locator('text=🎯 How many completions did you rack up')).toBeVisible();

    // Go back and change position to RB
    await page.click('button:has-text("Back")');
    await page.click('button:has-text("Back")');
    await page.click('button:has-text("Back")');

    // Change to RB
    await page.click('text=Select position');
    await page.click('text=RB');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Verify RB-specific questions appear (not QB questions)
    await expect(page.locator('text=🏃‍♂️ Senior year rushing yards')).toBeVisible();
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).not.toBeVisible();

    // Navigate to next RB question
    await page.fill('input[type="number"]', '1500');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await expect(page.locator('text=👐 Total touches')).toBeVisible();
  });

  test('Complete evaluation flow with auto-filled data', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Should start from first unanswered question due to auto-fill
    await expect(page.locator('text=🚀 Let\'s dive into your senior year passing yards')).toBeVisible();

    // Fill in QB stats
    await page.fill('input[type="number"]', '2800');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '180');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '280');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '8');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '25');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '2200');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Fill in combine data
    await page.fill('input[type="number"]', '4.6');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '32');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.fill('input[type="number"]', '4.4');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Height and weight should be pre-filled, so skip to review
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    await page.click('button:has-text("Next")');
    await page.waitForTimeout(300);

    // Should reach review page
    await expect(page.locator('text=🌟 Ready to see your potential?')).toBeVisible();

    // Submit evaluation
    await page.click('button:has-text("Submit Evaluation")');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('Non-logged in user gets generic welcome message', async ({ page }) => {
    // Mock no profile data (not logged in)
    await page.route('/api/profile/get*', async route => {
      await route.fulfill({
        status: 404,
        json: { error: 'User not found' }
      });
    });

    await page.goto('/wizard');
    await page.waitForTimeout(500);

    // Check that welcome message is generic for non-logged in users
    await expect(page.locator('text=🏈 Welcome! Ready to evaluate your potential?')).toBeVisible();

    // Should start from name question
    await expect(page.locator('input[placeholder="Enter your name"]')).toBeVisible();
  });
}); 