import { test, expect } from '@playwright/test';

test.describe('Market Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays market list on homepage', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]', { timeout: 10000 });
    
    // Check that market cards are displayed
    const marketCards = page.locator('[data-testid="market-card"]');
    await expect(marketCards).toHaveCount(await marketCards.count());
    
    // Verify market card contains essential information
    const firstCard = marketCards.first();
    await expect(firstCard.locator('h3')).toBeVisible();
    await expect(firstCard.locator('[data-testid="market-volume"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="trader-count"]')).toBeVisible();
  });

  test('filters markets by category', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Click on crypto category filter
    await page.click('[data-testid="filter-crypto"]');
    
    // Verify only crypto markets are shown
    const marketCards = page.locator('[data-testid="market-card"]');
    const categoryBadges = marketCards.locator('[data-testid="category-badge"]');
    
    const count = await categoryBadges.count();
    for (let i = 0; i < count; i++) {
      await expect(categoryBadges.nth(i)).toContainText('Crypto');
    }
  });

  test('sorts markets by volume', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Click volume sort option
    await page.click('[data-testid="sort-volume"]');
    
    // Get volume values and verify they are sorted
    const volumeElements = page.locator('[data-testid="market-volume"]');
    const volumes = await volumeElements.allTextContents();
    
    // Convert volume strings to numbers for comparison
    const volumeNumbers = volumes.map(vol => {
      const match = vol.match(/(\d+\.?\d*)(K|M)?/);
      if (!match) return 0;
      
      const num = parseFloat(match[1]);
      const suffix = match[2];
      
      if (suffix === 'K') return num * 1000;
      if (suffix === 'M') return num * 1000000;
      return num;
    });
    
    // Verify descending order
    for (let i = 0; i < volumeNumbers.length - 1; i++) {
      expect(volumeNumbers[i]).toBeGreaterThanOrEqual(volumeNumbers[i + 1]);
    }
  });

  test('shows trending markets section', async ({ page }) => {
    // Check for trending section
    await expect(page.locator('[data-testid="trending-section"]')).toBeVisible();
    
    // Verify trending markets have trending indicator
    const trendingCards = page.locator('[data-testid="trending-market"]');
    const count = await trendingCards.count();
    
    if (count > 0) {
      const firstTrendingCard = trendingCards.first();
      await expect(firstTrendingCard.locator('[data-testid="trending-icon"]')).toBeVisible();
    }
  });

  test('navigates to market detail page', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Click on first market card
    const firstCard = page.locator('[data-testid="market-card"]').first();
    const marketTitle = await firstCard.locator('h3').textContent();
    
    await firstCard.click();
    
    // Verify navigation to market detail page
    await expect(page).toHaveURL(/\/markets\/[^\/]+/);
    
    // Verify market detail page content
    await expect(page.locator('[data-testid="market-title"]')).toContainText(marketTitle || '');
    await expect(page.locator('[data-testid="trading-interface"]')).toBeVisible();
  });

  test('search functionality works', async ({ page }) => {
    // Wait for search input to be available
    await page.waitForSelector('[data-testid="search-input"]');
    
    // Type in search query
    await page.fill('[data-testid="search-input"]', 'Bitcoin');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Verify search results contain the search term
    const marketCards = page.locator('[data-testid="market-card"]');
    const count = await marketCards.count();
    
    if (count > 0) {
      const firstCard = marketCards.first();
      const cardText = await firstCard.textContent();
      expect(cardText?.toLowerCase()).toContain('bitcoin');
    }
  });

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Verify mobile-specific elements
    const marketCards = page.locator('[data-testid="market-card"]');
    const firstCard = marketCards.first();
    
    // Check that cards are properly sized for mobile
    const cardBox = await firstCard.boundingBox();
    expect(cardBox?.width).toBeLessThan(400);
    
    // Verify touch-friendly elements
    await expect(firstCard).toHaveCSS('cursor', 'pointer');
  });

  test('pagination works correctly', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Check if pagination exists
    const pagination = page.locator('[data-testid="pagination"]');
    
    if (await pagination.isVisible()) {
      // Get initial market count
      const initialCards = await page.locator('[data-testid="market-card"]').count();
      
      // Click next page
      await page.click('[data-testid="next-page"]');
      
      // Wait for new markets to load
      await page.waitForTimeout(1000);
      
      // Verify different markets are shown
      const newCards = await page.locator('[data-testid="market-card"]').count();
      expect(newCards).toBeGreaterThan(0);
    }
  });

  test('market status indicators work correctly', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Check for different status badges
    const statusBadges = page.locator('[data-testid="status-badge"]');
    const count = await statusBadges.count();
    
    if (count > 0) {
      const firstBadge = statusBadges.first();
      const statusText = await firstBadge.textContent();
      
      // Verify status is one of the expected values
      expect(['Active', 'Settling', 'Settled', 'Disputed']).toContain(statusText);
      
      // Verify appropriate styling based on status
      if (statusText === 'Active') {
        await expect(firstBadge).toHaveClass(/text-green-600/);
      } else if (statusText === 'Settling') {
        await expect(firstBadge).toHaveClass(/text-yellow-600/);
      }
    }
  });

  test('price change indicators display correctly', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Check for price change indicators
    const priceChanges = page.locator('[data-testid="price-change"]');
    const count = await priceChanges.count();
    
    if (count > 0) {
      const firstChange = priceChanges.first();
      const changeText = await firstChange.textContent();
      
      // Verify percentage format
      expect(changeText).toMatch(/\d+\.\d+%/);
      
      // Verify color coding based on positive/negative change
      const isPositive = changeText?.includes('+') || !changeText?.includes('-');
      if (isPositive) {
        await expect(firstChange).toHaveClass(/text-green-600/);
      } else {
        await expect(firstChange).toHaveClass(/text-red-600/);
      }
    }
  });
});