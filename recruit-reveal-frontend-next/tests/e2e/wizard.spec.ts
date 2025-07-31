import { test, expect } from '@playwright/test';

test.describe('Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the wizard page
    await page.goto('/wizard');
  });

  test('should complete RB wizard flow and display dashboard', async ({ page }) => {
    // Intercept the evaluate API call and mock the response
    await page.route('/api/evaluate', async route => {
      const json = {
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
      await route.fulfill({ json });
    });

    // Check initial state
    await expect(page.locator('h2')).toContainText('Recruit Reveal Wizard');
    await expect(page.locator('text=Hi! What\'s your name?')).toBeVisible();

    // Step 1: Enter name
    await page.fill('input[placeholder="Enter your name"]', 'John Smith');
    await page.click('button[type="primary"]:has-text("Next")');

    // Step 2: Select position (RB)
    await page.click('.ant-select-selector');
    await page.click('text=RB');
    
    // Verify position appears in chat thread
    await expect(page.locator('text=RB')).toBeVisible();
    await expect(page.locator('text=What\'s your graduation year?')).toBeVisible();

    // Step 3: Enter graduation year
    await page.fill('input[placeholder="e.g., 2026"]', '2025');
    await page.click('button[type="primary"]:has-text("Next")');

    // Step 4: Select state
    await page.click('.ant-select-selector');
    await page.click('text=TX');
    await page.click('button[type="primary"]:has-text("Next")');

    // Step 5: Fill RB-specific stats (Senior Rushing Yards)
    await expect(page.locator('text=Enter your Senior Rushing Yards.')).toBeVisible();
    await page.fill('input[type="number"]', '1800');
    await page.click('button[type="primary"]:has-text("Next")');

    // Step 6: Senior Touches
    await expect(page.locator('text=Enter your Senior Touches.')).toBeVisible();
    await page.fill('input[type="number"]', '285');
    await page.click('button[type="primary"]:has-text("Next")');

    // Step 7: Senior Average
    await expect(page.locator('text=Enter your Senior Average Yards Per Carry.')).toBeVisible();
    await page.fill('input[type="number"]', '6.3');
    await page.click('button[type="primary"]:has-text("Next")');

    // Skip to combine data (for brevity, just fill a few fields)
    // Continue clicking next through remaining RB stats
    await page.fill('input[type="number"]', '45'); // Receptions
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[type="number"]', '420'); // Reception Yards
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[type="number"]', '22'); // TDs
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[type="number"]', '150'); // Junior YPG
    await page.click('button[type="primary"]:has-text("Next")');

    // Fill combine data
    await page.fill('input[type="number"]', '4.45'); // 40-yard dash
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[type="number"]', '36'); // Vertical
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[type="number"]', '4.2'); // Shuttle
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[type="number"]', '70'); // Height
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[type="number"]', '185'); // Weight
    await page.click('button[type="primary"]:has-text("Next")');

    // Should now be at review step
    await expect(page.locator('text=Review & Submit?')).toBeVisible();
    
    // Submit evaluation
    await page.click('button:has-text("Submit Evaluation")');

    // Wait for dashboard to load with mocked data
    await expect(page.locator('text=FCS')).toBeVisible(); // Predicted tier
    await expect(page.locator('text=69.3')).toBeVisible(); // Score
    await expect(page.locator('text=Balanced profile with good potential')).toBeVisible(); // Notes
  });

  test('should complete QB wizard flow', async ({ page }) => {
    // Similar test but for QB position
    await page.route('/api/evaluate', async route => {
      const json = {
        score: 75.2,
        predicted_tier: 'Power5',
        notes: 'Strong arm talent with good accuracy',
        probability: 0.752,
        performance_score: 0.80,
        combine_score: 0.70,
        upside_score: 0.15,
        underdog_bonus: 0.00,
        goals: ['Work on pocket presence', 'Improve completion percentage'],
        switches: 'Stay at QB position',
        calendar_advice: 'Priority visits during official visit weekends'
      };
      await route.fulfill({ json });
    });

    // Fill name
    await page.fill('input[placeholder="Enter your name"]', 'Mike Johnson');
    await page.click('button[type="primary"]:has-text("Next")');

    // Select QB position
    await page.click('.ant-select-selector');  
    await page.click('text=QB');
    await page.click('button[type="primary"]:has-text("Next")');

    // Fill grad year
    await page.fill('input[placeholder="e.g., 2026"]', '2025');
    await page.click('button[type="primary"]:has-text("Next")');

    // Select state
    await page.click('.ant-select-selector');
    await page.click('text=FL');
    await page.click('button[type="primary"]:has-text("Next")');

    // QB-specific stats
    await expect(page.locator('text=Enter your Senior Passing Yards.')).toBeVisible();
    await page.fill('input[type="number"]', '3500');
    await page.click('button[type="primary"]:has-text("Next")');

    // Skip through remaining QB stats quickly for this test
    const qbStats = ['280', '420', '8', '35', '2800', '220', '350', '6', '28'];
    for (const stat of qbStats) {
      await page.fill('input[type="number"]', stat);
      await page.click('button[type="primary"]:has-text("Next")');
    }

    // Fill combine data
    const combineStats = ['4.6', '32', '4.4', '74', '210'];
    for (const stat of combineStats) {
      await page.fill('input[type="number"]', stat);
      await page.click('button[type="primary"]:has-text("Next")');
    }

    // Submit
    await page.click('button:has-text("Submit Evaluation")');

    // Verify QB-specific results
    await expect(page.locator('text=Power5')).toBeVisible();
    await expect(page.locator('text=75.2')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to proceed without filling name
    await page.click('button[type="primary"]:has-text("Next")');
    
    // Should show validation error
    await expect(page.locator('text=Name is required')).toBeVisible();
    
    // Fill name and proceed
    await page.fill('input[placeholder="Enter your name"]', 'Test User');
    await page.click('button[type="primary"]:has-text("Next")');
    
    // Try to proceed without selecting position
    await page.click('button[type="primary"]:has-text("Next")');
    await expect(page.locator('text=Position is required')).toBeVisible();
  });

  test('should allow navigation using progress pills', async ({ page }) => {
    // Fill first few steps
    await page.fill('input[placeholder="Enter your name"]', 'Nav Test');
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.click('.ant-select-selector');
    await page.click('text=RB');
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[placeholder="e.g., 2026"]', '2025');
    await page.click('button[type="primary"]:has-text("Next")');

    // Click on progress pill to go back to step 1 (name)
    await page.click('[data-testid="progress-pill-0"]').catch(() => {
      // Fallback if data-testid not available
      page.locator('.progress-pill').first().click();
    });
    
    // Should be back at name field
    await expect(page.locator('text=Hi! What\'s your name?')).toBeVisible();
  });

  test('should show appropriate RB-specific questions', async ({ page }) => {
    // Go through initial steps to get to RB questions
    await page.fill('input[placeholder="Enter your name"]', 'RB Test');
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.click('.ant-select-selector');
    await page.click('text=RB');
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.fill('input[placeholder="e.g., 2026"]', '2025');
    await page.click('button[type="primary"]:has-text("Next")');
    
    await page.click('.ant-select-selector');
    await page.click('text=CA');
    await page.click('button[type="primary"]:has-text("Next")');

    // Verify RB-specific questions appear in order
    await expect(page.locator('text=Enter your Senior Rushing Yards.')).toBeVisible();
    await page.fill('input[type="number"]', '1500');
    await page.click('button[type="primary"]:has-text("Next")');
    
    await expect(page.locator('text=Enter your Senior Touches.')).toBeVisible();
    await page.fill('input[type="number"]', '250');
    await page.click('button[type="primary"]:has-text("Next")');
    
    await expect(page.locator('text=Enter your Senior Average Yards Per Carry.')).toBeVisible();
  });
});