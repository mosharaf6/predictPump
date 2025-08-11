import { test, expect } from '@playwright/test';

test.describe('Trading Flow End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    // Mock connected wallet state for all trading tests
    await page.addInitScript(() => {
      window.mockWalletConnected = true;
      window.mockPublicKey = '11111111111111111111111111111111';
      window.mockWalletName = 'Phantom';
      
      // Mock trading functions
      window.mockTrade = async (outcome, action, amount) => {
        console.log(`Mock trade: ${action} ${amount} SOL for outcome ${outcome}`);
        return { success: true, signature: 'mock-signature' };
      };
    });
    
    await page.goto('/markets/test-market-1');
  });

  test('complete buy flow from market discovery to trade execution', async ({ page }) => {
    // Start from homepage
    await page.goto('/');
    
    // Find and click on a market
    await page.waitForSelector('[data-testid="market-card"]');
    const firstMarket = page.locator('[data-testid="market-card"]').first();
    await firstMarket.click();
    
    // Verify we're on market detail page
    await expect(page).toHaveURL(/\/markets\/[^\/]+/);
    await expect(page.locator('[data-testid="trading-interface"]')).toBeVisible();
    
    // Select outcome (Yes should be selected by default)
    const yesOutcome = page.locator('[data-testid="outcome-yes"]');
    await expect(yesOutcome).toHaveClass(/border-blue-500/);
    
    // Ensure Buy is selected (should be default)
    const buyButton = page.locator('[data-testid="buy-button"]');
    await expect(buyButton).toHaveClass(/bg-green-600/);
    
    // Enter trade amount
    const amountInput = page.locator('[data-testid="amount-input"]');
    await amountInput.fill('1');
    
    // Verify trade preview appears
    await expect(page.locator('[data-testid="trade-preview"]')).toBeVisible();
    await expect(page.locator('text=Trade Preview')).toBeVisible();
    
    // Check estimated tokens calculation
    await expect(page.locator('[data-testid="estimated-tokens"]')).toBeVisible();
    
    // Check fee calculation
    await expect(page.locator('[data-testid="platform-fee"]')).toBeVisible();
    
    // Execute trade
    const tradeButton = page.locator('[data-testid="execute-trade"]');
    await expect(tradeButton).not.toBeDisabled();
    await expect(tradeButton).toContainText('Buy');
    
    await tradeButton.click();
    
    // Check for loading state
    await expect(page.locator('text=Processing...')).toBeVisible();
    
    // Wait for trade completion
    await page.waitForTimeout(2000);
    
    // Verify trade success (amount should be cleared)
    await expect(amountInput).toHaveValue('');
    
    // Check for success feedback
    await expect(page.locator('[data-testid="trade-success"]')).toBeVisible();
  });

  test('complete sell flow with outcome switching', async ({ page }) => {
    // Select No outcome
    const noOutcome = page.locator('[data-testid="outcome-no"]');
    await noOutcome.click();
    await expect(noOutcome).toHaveClass(/border-blue-500/);
    
    // Switch to Sell
    const sellButton = page.locator('[data-testid="sell-button"]');
    await sellButton.click();
    await expect(sellButton).toHaveClass(/bg-red-600/);
    
    // Enter amount
    const amountInput = page.locator('[data-testid="amount-input"]');
    await amountInput.fill('0.5');
    
    // Verify trade preview updates for sell
    await expect(page.locator('[data-testid="trade-preview"]')).toBeVisible();
    
    // Execute sell trade
    const tradeButton = page.locator('[data-testid="execute-trade"]');
    await expect(tradeButton).toContainText('Sell');
    await tradeButton.click();
    
    // Wait for completion
    await page.waitForTimeout(2000);
    
    // Verify success
    await expect(amountInput).toHaveValue('');
  });

  test('quick amount buttons functionality', async ({ page }) => {
    // Test each quick amount button
    const quickAmounts = ['0.1', '0.5', '1', '5'];
    
    for (const amount of quickAmounts) {
      const quickButton = page.locator(`[data-testid="quick-amount-${amount}"]`);
      await quickButton.click();
      
      const amountInput = page.locator('[data-testid="amount-input"]');
      await expect(amountInput).toHaveValue(amount);
      
      // Verify trade preview updates
      await expect(page.locator('[data-testid="trade-preview"]')).toBeVisible();
      
      // Clear for next test
      await amountInput.fill('');
    }
  });

  test('slippage warning for large trades', async ({ page }) => {
    // Enter large amount
    const amountInput = page.locator('[data-testid="amount-input"]');
    await amountInput.fill('15');
    
    // Check for slippage warning
    await expect(page.locator('[data-testid="slippage-warning"]')).toBeVisible();
    await expect(page.locator('text=Large trades may experience higher slippage')).toBeVisible();
    
    // Enter smaller amount
    await amountInput.fill('1');
    
    // Warning should disappear
    await expect(page.locator('[data-testid="slippage-warning"]')).not.toBeVisible();
  });

  test('trade validation and error handling', async ({ page }) => {
    const tradeButton = page.locator('[data-testid="execute-trade"]');
    const amountInput = page.locator('[data-testid="amount-input"]');
    
    // Test empty amount
    await expect(tradeButton).toBeDisabled();
    
    // Test zero amount
    await amountInput.fill('0');
    await expect(tradeButton).toBeDisabled();
    
    // Test negative amount
    await amountInput.fill('-1');
    await expect(tradeButton).toBeDisabled();
    
    // Test valid amount
    await amountInput.fill('1');
    await expect(tradeButton).not.toBeDisabled();
  });

  test('real-time price updates during trading', async ({ page }) => {
    // Mock price update
    await page.addInitScript(() => {
      window.mockPriceUpdate = (newPrice) => {
        // Simulate price update event
        window.dispatchEvent(new CustomEvent('priceUpdate', {
          detail: { outcome: 0, price: newPrice }
        }));
      };
    });
    
    const amountInput = page.locator('[data-testid="amount-input"]');
    await amountInput.fill('1');
    
    // Get initial estimated tokens
    const initialTokens = await page.locator('[data-testid="estimated-tokens"]').textContent();
    
    // Simulate price change
    await page.evaluate(() => window.mockPriceUpdate(0.7));
    
    // Wait for UI update
    await page.waitForTimeout(1000);
    
    // Verify estimated tokens changed
    const updatedTokens = await page.locator('[data-testid="estimated-tokens"]').textContent();
    expect(updatedTokens).not.toBe(initialTokens);
  });

  test('trading interface responsiveness on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify trading interface is properly sized
    const tradingInterface = page.locator('[data-testid="trading-interface"]');
    await expect(tradingInterface).toBeVisible();
    
    const interfaceBox = await tradingInterface.boundingBox();
    expect(interfaceBox?.width).toBeLessThan(400);
    
    // Test mobile interactions
    const amountInput = page.locator('[data-testid="amount-input"]');
    await amountInput.fill('1');
    
    // Verify mobile-friendly buttons
    const quickButtons = page.locator('[data-testid^="quick-amount-"]');
    const buttonCount = await quickButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = quickButtons.nth(i);
      const buttonBox = await button.boundingBox();
      expect(buttonBox?.height).toBeGreaterThan(40); // Touch-friendly size
    }
  });

  test('multiple outcome market trading', async ({ page }) => {
    // Mock market with multiple outcomes
    await page.addInitScript(() => {
      window.mockMarketOutcomes = [
        { name: 'Yes', price: 0.4 },
        { name: 'No', price: 0.3 },
        { name: 'Maybe', price: 0.3 }
      ];
    });
    
    await page.reload();
    
    // Test trading on third outcome
    const maybeOutcome = page.locator('[data-testid="outcome-maybe"]');
    if (await maybeOutcome.isVisible()) {
      await maybeOutcome.click();
      await expect(maybeOutcome).toHaveClass(/border-blue-500/);
      
      // Enter amount and trade
      const amountInput = page.locator('[data-testid="amount-input"]');
      await amountInput.fill('1');
      
      const tradeButton = page.locator('[data-testid="execute-trade"]');
      await expect(tradeButton).toContainText('Maybe');
      await tradeButton.click();
      
      await page.waitForTimeout(2000);
      await expect(amountInput).toHaveValue('');
    }
  });

  test('trade history and position updates', async ({ page }) => {
    // Execute a trade
    const amountInput = page.locator('[data-testid="amount-input"]');
    await amountInput.fill('1');
    
    const tradeButton = page.locator('[data-testid="execute-trade"]');
    await tradeButton.click();
    
    // Wait for trade completion
    await page.waitForTimeout(2000);
    
    // Check if position is updated
    const userPositions = page.locator('[data-testid="user-positions"]');
    if (await userPositions.isVisible()) {
      await expect(userPositions).toContainText('Yes');
    }
    
    // Check trade history
    const tradeHistory = page.locator('[data-testid="trade-history"]');
    if (await tradeHistory.isVisible()) {
      await expect(tradeHistory).toContainText('Buy');
      await expect(tradeHistory).toContainText('1.00');
    }
  });

  test('keyboard navigation and accessibility', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should focus on amount input
    const amountInput = page.locator('[data-testid="amount-input"]');
    await expect(amountInput).toBeFocused();
    
    // Type amount using keyboard
    await page.keyboard.type('1.5');
    await expect(amountInput).toHaveValue('1.5');
    
    // Navigate to trade button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    const tradeButton = page.locator('[data-testid="execute-trade"]');
    await expect(tradeButton).toBeFocused();
    
    // Execute trade with Enter key
    await page.keyboard.press('Enter');
    
    // Wait for completion
    await page.waitForTimeout(2000);
  });

  test('handles network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.addInitScript(() => {
      window.mockTrade = async () => {
        throw new Error('Network error');
      };
    });
    
    const amountInput = page.locator('[data-testid="amount-input"]');
    await amountInput.fill('1');
    
    const tradeButton = page.locator('[data-testid="execute-trade"]');
    await tradeButton.click();
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // Verify error message appears
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Verify UI returns to normal state
    expect(await amountInput.inputValue()).toBe('1'); // Amount should not be cleared on error
    await expect(tradeButton).not.toBeDisabled();
  });
});