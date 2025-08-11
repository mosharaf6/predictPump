import { NotificationService } from '../services/NotificationService';
import { DatabaseService } from '../services/DatabaseService';
import { WebSocketService } from '../services/WebSocketService';
import { EventEmitter } from 'events';

// Mock WebSocketService
class MockWebSocketService extends EventEmitter {
  public broadcastToUser = jest.fn();
  public initialize = jest.fn().mockResolvedValue(undefined);
  public shutdown = jest.fn().mockResolvedValue(undefined);
}

// Mock DatabaseService
class MockDatabaseService {
  public storePriceAlert = jest.fn().mockResolvedValue(undefined);
  public deletePriceAlert = jest.fn().mockResolvedValue(undefined);
  public storeNotification = jest.fn().mockResolvedValue(undefined);
  public getUserNotificationPreferences = jest.fn().mockResolvedValue({
    userId: 'test-user',
    priceAlerts: true,
    marketSettlements: true,
    socialNotifications: true,
    emailNotifications: false,
    pushNotifications: true,
    priceAlertThreshold: 5
  });
  public updateUserNotificationPreferences = jest.fn().mockResolvedValue(undefined);
  public getUserEmail = jest.fn().mockResolvedValue('test@example.com');
  public getUserNotifications = jest.fn().mockResolvedValue([]);
  public markNotificationAsRead = jest.fn().mockResolvedValue(true);
  public markAllNotificationsAsRead = jest.fn().mockResolvedValue(true);
  public getMarketParticipants = jest.fn().mockResolvedValue([
    { userId: 'test-user', payout: 1.5 }
  ]);
}

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockDatabaseService: MockDatabaseService;
  let mockWebSocketService: MockWebSocketService;

  beforeEach(() => {
    mockDatabaseService = new MockDatabaseService();
    mockWebSocketService = new MockWebSocketService();
    notificationService = new NotificationService(
      mockDatabaseService as any,
      mockWebSocketService as any
    );
  });

  afterEach(async () => {
    await notificationService.shutdown();
  });

  describe('Price Alerts', () => {
    it('should create a price alert', async () => {
      const alertData = {
        userId: 'test-user',
        marketId: 'test-market',
        outcomeIndex: 0,
        alertType: 'above' as const,
        targetPrice: 0.75,
        isActive: true
      };

      const alertId = await notificationService.createPriceAlert(alertData);

      expect(alertId).toBeDefined();
      expect(mockDatabaseService.storePriceAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...alertData,
          id: alertId,
          createdAt: expect.any(Date)
        })
      );
    });

    it('should delete a price alert', async () => {
      // First create an alert
      const alertData = {
        userId: 'test-user',
        marketId: 'test-market',
        outcomeIndex: 0,
        alertType: 'above' as const,
        targetPrice: 0.75,
        isActive: true
      };

      const alertId = await notificationService.createPriceAlert(alertData);
      
      // Then delete it
      const result = await notificationService.deletePriceAlert(alertId, 'test-user');

      expect(result).toBe(true);
      expect(mockDatabaseService.deletePriceAlert).toHaveBeenCalledWith(alertId);
    });

    it('should not delete alert for wrong user', async () => {
      // First create an alert
      const alertData = {
        userId: 'test-user',
        marketId: 'test-market',
        outcomeIndex: 0,
        alertType: 'above' as const,
        targetPrice: 0.75,
        isActive: true
      };

      const alertId = await notificationService.createPriceAlert(alertData);
      
      // Try to delete with wrong user
      const result = await notificationService.deletePriceAlert(alertId, 'wrong-user');

      expect(result).toBe(false);
      expect(mockDatabaseService.deletePriceAlert).not.toHaveBeenCalled();
    });

    it('should trigger price alert when threshold is met', async () => {
      // Create an alert
      const alertData = {
        userId: 'test-user',
        marketId: 'test-market',
        outcomeIndex: 0,
        alertType: 'above' as const,
        targetPrice: 0.75,
        isActive: true
      };

      await notificationService.createPriceAlert(alertData);

      // Simulate market update that triggers the alert
      const marketUpdateData = {
        marketId: 'test-market',
        marketData: {
          prices: [
            { outcomeIndex: 0, price: 0.80, priceChange24h: 0.05 }
          ]
        }
      };

      notificationService.emit('market_update', marketUpdateData);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDatabaseService.storeNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          type: 'price_alert',
          title: 'Price Alert Triggered'
        })
      );
    });
  });

  describe('Notifications', () => {
    it('should queue and process notifications', async () => {
      const notification = {
        id: 'test-notification',
        userId: 'test-user',
        type: 'price_alert' as const,
        title: 'Test Notification',
        message: 'This is a test notification',
        isRead: false,
        createdAt: new Date()
      };

      await notificationService.queueNotification(notification);

      expect(mockDatabaseService.storeNotification).toHaveBeenCalledWith(notification);
    });

    it('should handle trade events', async () => {
      const tradeEvent = {
        trader: 'test-user',
        marketId: 'test-market',
        tradeType: 'buy',
        amount: 100,
        price: 0.75,
        signature: 'test-signature'
      };

      notificationService.emit('trade_event', tradeEvent);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDatabaseService.storeNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          type: 'trade_confirmation',
          title: 'Trade Executed'
        })
      );
    });

    it('should handle market settlement events', async () => {
      const settlementEvent = {
        marketId: 'test-market',
        marketTitle: 'Test Market',
        winningOutcome: 'Yes'
      };

      notificationService.emit('market_settlement', settlementEvent);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDatabaseService.storeNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          type: 'market_settlement',
          title: 'Market Settled'
        })
      );
    });

    it('should handle social events', async () => {
      const socialEvent = {
        eventType: 'comment',
        targetUserId: 'test-user',
        username: 'commenter',
        marketId: 'test-market',
        commentId: 'test-comment'
      };

      notificationService.emit('social_event', socialEvent);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDatabaseService.storeNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          type: 'social',
          title: 'New Comment'
        })
      );
    });
  });

  describe('User Preferences', () => {
    it('should get user preferences', async () => {
      const preferences = await notificationService.getUserPreferences('test-user');

      expect(preferences).toEqual({
        userId: 'test-user',
        priceAlerts: true,
        marketSettlements: true,
        socialNotifications: true,
        emailNotifications: false,
        pushNotifications: true,
        priceAlertThreshold: 5
      });
    });

    it('should update user preferences', async () => {
      const updates = {
        emailNotifications: true,
        priceAlertThreshold: 10
      };

      await notificationService.updateUserPreferences('test-user', updates);

      expect(mockDatabaseService.updateUserNotificationPreferences).toHaveBeenCalledWith(
        'test-user',
        expect.objectContaining(updates)
      );
    });

    it('should return default preferences for new user', async () => {
      mockDatabaseService.getUserNotificationPreferences.mockResolvedValueOnce(null);

      const preferences = await notificationService.getUserPreferences('new-user');

      expect(preferences).toEqual({
        userId: 'new-user',
        priceAlerts: true,
        marketSettlements: true,
        socialNotifications: true,
        emailNotifications: false,
        pushNotifications: true,
        priceAlertThreshold: 5
      });
    });
  });

  describe('Statistics', () => {
    it('should return service statistics', () => {
      const stats = notificationService.getStats();

      expect(stats).toEqual({
        activeAlerts: 0,
        queuedNotifications: 0,
        queuedEmails: 0,
        cachedPreferences: 0
      });
    });
  });
});