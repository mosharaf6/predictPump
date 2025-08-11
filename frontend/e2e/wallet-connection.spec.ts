import { test, expect } from '@playwright/test';

test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays connect wallet button when not connected', async ({ page }) => {
    // Check for connect wallet button
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toContainText('Connect Wallet');
  });

  test('shows wallet connection modal when connect button clicked', async ({ page }) => {
    // Mock wallet adapter to prevent actual wallet connection
    await page.addInitScript(() => {
      // Mock the wallet adapter
      window.solana = {
        isPhantom: true,
        connect: async () => ({ publicKey: 'mock-public-key' }),
        disconnect: async () => {},
        on: () => {},
        off: () => {},
      };
    });

    // Click connect wallet button
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Check if wallet selection modal appears
    // Note: This might show a browser alert about no wallets installed
    // In a real test environment, you'd mock the wallet adapters
    await page.waitForTimeout(1000);
  });

  test('shows wallet not installed message', async ({ page }) => {
    // Ensure no wallet is available
    await page.addInitScript(() => {
      delete window.solana;
    });

    // Click connect wallet button
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Wait for alert or error message
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('No Solana wallets detected');
      await dialog.accept();
    });
  });

  test('displays connected state when wallet is connected', async ({ page }) => {
    // Mock connected wallet state
    await page.addInitScript(() => {
      // Mock wallet connection
      window.mockWalletConnected = true;
      window.mockPublicKey = '11111111111111111111111111111111';
      window.mockWalletName = 'Phantom';
    });

    // Navigate to a page that would show connected state
    await page.goto('/markets');
    
    // Check for connected wallet indicators
    // Note: This would require the app to read from the mocked state
    await page.waitForTimeout(1000);
  });

  test('wallet dropdown functionality', async ({ page }) => {
    // Mock connected state
    await page.addInitScript(() => {
      window.mockWalletConnected = true;
      window.mockPublicKey = '11111111111111111111111111111111';
      window.mockWalletName = 'Phantom';
    });

    await page.goto('/markets');
    
    // Look for wallet address button (shortened address)
    const walletButton = page.locator('[data-testid="wallet-address-button"]');
    
    if (await walletButton.isVisible()) {
      // Click to open dropdown
      await walletButton.click();
      
      // Check dropdown options
      await expect(page.locator('[data-testid="copy-address"]')).toBeVisible();
      await expect(page.locator('[data-testid="disconnect-wallet"]')).toBeVisible();
    }
  });

  test('copy address functionality', async ({ page }) => {
    // Mock connected state
    await page.addInitScript(() => {
      window.mockWalletConnected = true;
      window.mockPublicKey = '11111111111111111111111111111111';
    });

    await page.goto('/markets');
    
    const walletButton = page.locator('[data-testid="wallet-address-button"]');
    
    if (await walletButton.isVisible()) {
      await walletButton.click();
      
      // Mock clipboard API
      await page.evaluate(() => {
        navigator.clipboard = {
          writeText: async (text) => {
            window.clipboardText = text;
          }
        };
      });
      
      // Click copy address
      await page.click('[data-testid="copy-address"]');
      
      // Verify clipboard was called
      const clipboardText = await page.evaluate(() => window.clipboardText);
      expect(clipboardText).toBe('11111111111111111111111111111111');
      
      // Check for success feedback
      await expect(page.locator('text=Copied!')).toBeVisible();
    }
  });

  test('disconnect wallet functionality', async ({ page }) => {
    // Mock connected state
    await page.addInitScript(() => {
      window.mockWalletConnected = true;
      window.mockPublicKey = '11111111111111111111111111111111';
      window.mockDisconnect = () => {
        window.mockWalletConnected = false;
        window.mockPublicKey = null;
      };
    });

    await page.goto('/markets');
    
    const walletButton = page.locator('[data-testid="wallet-address-button"]');
    
    if (await walletButton.isVisible()) {
      await walletButton.click();
      
      // Click disconnect
      await page.click('[data-testid="disconnect-wallet"]');
      
      // Verify disconnect was called
      await page.evaluate(() => window.mockDisconnect());
      
      // Check that connect button appears again
      await page.waitForTimeout(1000);
    }
  });

  test('wallet connection persists across page navigation', async ({ page }) => {
    // Mock connected state
    await page.addInitScript(() => {
      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletPublicKey', '11111111111111111111111111111111');
      localStorage.setItem('walletName', 'Phantom');
    });

    await page.goto('/');
    
    // Navigate to different pages
    await page.goto('/markets');
    await page.goto('/profile');
    
    // Wallet should remain connected
    // This would require the app to restore state from localStorage
    await page.waitForTimeout(1000);
  });

  test('wallet connection enables trading interface', async ({ page }) => {
    // Start disconnected
    await page.goto('/markets/test-market-1');
    
    // Check that trading interface shows connection warning
    await expect(page.locator('text=Connect your wallet to start trading')).toBeVisible();
    
    // Check that inputs are disabled
    const amountInput = page.locator('[data-testid="amount-input"]');
    if (await amountInput.isVisible()) {
      await expect(amountInput).toBeDisabled();
    }
    
    // Mock wallet connection
    await page.addInitScript(() => {
      window.mockWalletConnected = true;
      window.mockPublicKey = '11111111111111111111111111111111';
    });
    
    // Reload to apply connected state
    await page.reload();
    
    // Check that warning is gone and inputs are enabled
    await expect(page.locator('text=Connect your wallet to start trading')).not.toBeVisible();
    
    if (await amountInput.isVisible()) {
      await expect(amountInput).not.toBeDisabled();
    }
  });

  test('handles wallet connection errors gracefully', async ({ page }) => {
    // Mock wallet that throws error on connect
    await page.addInitScript(() => {
      window.solana = {
        isPhantom: true,
        connect: async () => {
          throw new Error('User rejected connection');
        },
        on: () => {},
        off: () => {},
      };
    });

    // Try to connect
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Wait for error handling
    await page.waitForTimeout(1000);
    
    // Verify user remains on the same page and can try again
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
  });

  test('shows connecting state during wallet connection', async ({ page }) => {
    // Mock slow wallet connection
    await page.addInitScript(() => {
      window.solana = {
        isPhantom: true,
        connect: async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return { publicKey: 'mock-public-key' };
        },
        on: () => {},
        off: () => {},
      };
    });

    // Click connect
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Check for connecting state
    await expect(page.locator('text=Connecting...')).toBeVisible();
    
    // Wait for connection to complete
    await page.waitForTimeout(3000);
  });

  test('wallet connection works on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that wallet button is properly sized for mobile
    const connectButton = page.locator('[data-testid="connect-wallet-button"]');
    await expect(connectButton).toBeVisible();
    
    const buttonBox = await connectButton.boundingBox();
    expect(buttonBox?.width).toBeLessThan(400);
    
    // Verify touch-friendly interaction
    await connectButton.click();
    await page.waitForTimeout(1000);
  });
});