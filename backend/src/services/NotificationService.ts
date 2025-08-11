import { EventEmitter } from 'events';
import winston from 'winston';
import { DatabaseService } from './DatabaseService';
import { WebSocketService } from './WebSocketService';

export interface NotificationPreferences {
  userId: string;
  priceAlerts: boolean;
  marketSettlements: boolean;
  socialNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  priceAlertThreshold: number; // percentage change threshold
}

export interface PriceAlert {
  id: string;
  userId: string;
  marketId: string;
  outcomeIndex: number;
  alertType: 'above' | 'below' | 'change';
  targetPrice?: number;
  changeThreshold?: number; // percentage
  isActive: boolean;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'price_alert' | 'market_settlement' | 'social' | 'trade_confirmation';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface EmailNotification {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  templateId?: string;
  templateData?: any;
}

export class NotificationService extends EventEmitter {
  private logger: winston.Logger;
  private databaseService: DatabaseService;
  private webSocketService: WebSocketService;
  private priceAlerts: Map<string, PriceAlert> = new Map();
  private userPreferences: Map<string, NotificationPreferences> = new Map();
  private notificationQueue: Notification[] = [];
  private emailQueue: EmailNotification[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(databaseService: DatabaseService, webSocketService: WebSocketService) {
    super();
    
    this.databaseService = databaseService;
    this.webSocketService = webSocketService;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'notifications.log' })
      ]
    });

    this.startProcessing();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for market data updates to check price alerts
    this.on('market_update', (data) => {
      this.checkPriceAlerts(data.marketId, data.marketData);
    });

    // Listen for trade events
    this.on('trade_event', (data) => {
      this.handleTradeEvent(data);
    });

    // Listen for market settlement events
    this.on('market_settlement', (data) => {
      this.handleMarketSettlement(data);
    });

    // Listen for social events
    this.on('social_event', (data) => {
      this.handleSocialEvent(data);
    });
  }

  private startProcessing(): void {
    // Process notification queue every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processNotificationQueue();
      this.processEmailQueue();
    }, 5000);
  }

  // Price Alert Management
  public async createPriceAlert(alert: Omit<PriceAlert, 'id' | 'createdAt'>): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const priceAlert: PriceAlert = {
      ...alert,
      id: alertId,
      createdAt: new Date()
    };

    this.priceAlerts.set(alertId, priceAlert);
    
    // Store in database
    try {
      await this.databaseService.storePriceAlert(priceAlert);
      this.logger.info(`Price alert created: ${alertId}`, { alert: priceAlert });
    } catch (error) {
      this.logger.error('Failed to store price alert:', error);
    }

    return alertId;
  }

  public async deletePriceAlert(alertId: string, userId: string): Promise<boolean> {
    const alert = this.priceAlerts.get(alertId);
    if (!alert || alert.userId !== userId) {
      return false;
    }

    this.priceAlerts.delete(alertId);
    
    try {
      await this.databaseService.deletePriceAlert(alertId);
      this.logger.info(`Price alert deleted: ${alertId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete price alert:', error);
      return false;
    }
  }

  public async getUserPriceAlerts(userId: string): Promise<PriceAlert[]> {
    const userAlerts = Array.from(this.priceAlerts.values())
      .filter(alert => alert.userId === userId && alert.isActive);
    
    return userAlerts;
  }

  private async checkPriceAlerts(marketId: string, marketData: any): Promise<void> {
    const relevantAlerts = Array.from(this.priceAlerts.values())
      .filter(alert => alert.marketId === marketId && alert.isActive);

    for (const alert of relevantAlerts) {
      const priceData = marketData.prices?.find((p: any) => p.outcomeIndex === alert.outcomeIndex);
      if (!priceData) continue;

      let shouldTrigger = false;
      let alertMessage = '';

      switch (alert.alertType) {
        case 'above':
          if (alert.targetPrice && priceData.price >= alert.targetPrice) {
            shouldTrigger = true;
            alertMessage = `Price reached ${(alert.targetPrice * 100).toFixed(1)}¢`;
          }
          break;
        case 'below':
          if (alert.targetPrice && priceData.price <= alert.targetPrice) {
            shouldTrigger = true;
            alertMessage = `Price dropped to ${(alert.targetPrice * 100).toFixed(1)}¢`;
          }
          break;
        case 'change':
          if (alert.changeThreshold && Math.abs(priceData.priceChange24h) >= alert.changeThreshold / 100) {
            shouldTrigger = true;
            const direction = priceData.priceChange24h > 0 ? 'increased' : 'decreased';
            alertMessage = `Price ${direction} by ${Math.abs(priceData.priceChange24h * 100).toFixed(1)}%`;
          }
          break;
      }

      if (shouldTrigger) {
        await this.triggerPriceAlert(alert, priceData, alertMessage);
      }
    }
  }

  private async triggerPriceAlert(alert: PriceAlert, priceData: any, message: string): Promise<void> {
    // Deactivate the alert to prevent spam
    alert.isActive = false;
    this.priceAlerts.set(alert.id, alert);

    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: alert.userId,
      type: 'price_alert',
      title: 'Price Alert Triggered',
      message,
      data: {
        marketId: alert.marketId,
        outcomeIndex: alert.outcomeIndex,
        currentPrice: priceData.price,
        alertId: alert.id
      },
      isRead: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    await this.queueNotification(notification);
    this.logger.info(`Price alert triggered: ${alert.id}`, { notification });
  }

  // Notification Management
  public async queueNotification(notification: Notification): Promise<void> {
    this.notificationQueue.push(notification);
    
    // Store in database immediately
    try {
      await this.databaseService.storeNotification(notification);
    } catch (error) {
      this.logger.error('Failed to store notification:', error);
    }
  }

  private async processNotificationQueue(): Promise<void> {
    if (this.notificationQueue.length === 0) return;

    const notifications = this.notificationQueue.splice(0, 10); // Process up to 10 at a time

    for (const notification of notifications) {
      try {
        await this.deliverNotification(notification);
      } catch (error) {
        this.logger.error('Failed to deliver notification:', error);
        // Re-queue failed notifications (with limit to prevent infinite loops)
        if (!notification.data?.retryCount || notification.data.retryCount < 3) {
          notification.data = { ...notification.data, retryCount: (notification.data?.retryCount || 0) + 1 };
          this.notificationQueue.push(notification);
        }
      }
    }
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    const preferences = await this.getUserPreferences(notification.userId);

    // Send push notification via WebSocket
    if (preferences.pushNotifications) {
      this.webSocketService.broadcastToUser(notification.userId, {
        type: 'notification',
        data: notification
      });
    }

    // Queue email notification if enabled
    if (preferences.emailNotifications) {
      await this.queueEmailNotification(notification);
    }

    this.logger.info(`Notification delivered: ${notification.id}`);
  }

  // Email Notification Management
  private async queueEmailNotification(notification: Notification): Promise<void> {
    const userEmail = await this.getUserEmail(notification.userId);
    if (!userEmail) return;

    const emailNotification: EmailNotification = {
      to: userEmail,
      subject: notification.title,
      htmlContent: this.generateEmailHTML(notification),
      textContent: this.generateEmailText(notification)
    };

    this.emailQueue.push(emailNotification);
  }

  private async processEmailQueue(): Promise<void> {
    if (this.emailQueue.length === 0) return;

    const emails = this.emailQueue.splice(0, 5); // Process up to 5 emails at a time

    for (const email of emails) {
      try {
        await this.sendEmail(email);
        this.logger.info(`Email sent to: ${email.to}`);
      } catch (error) {
        this.logger.error('Failed to send email:', error);
      }
    }
  }

  private async sendEmail(email: EmailNotification): Promise<void> {
    // In a real implementation, this would integrate with an email service like SendGrid, AWS SES, etc.
    // For now, we'll just log the email
    this.logger.info('Email would be sent:', {
      to: email.to,
      subject: email.subject,
      content: email.textContent
    });
  }

  private generateEmailHTML(notification: Notification): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 16px;">${notification.title}</h2>
            <p style="color: #666; line-height: 1.5;">${notification.message}</p>
            <div style="margin-top: 20px; padding: 16px; background-color: white; border-radius: 4px;">
              <p style="margin: 0; color: #888; font-size: 12px;">
                Received at ${notification.createdAt.toLocaleString()}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateEmailText(notification: Notification): string {
    return `
${notification.title}

${notification.message}

Received at ${notification.createdAt.toLocaleString()}
    `.trim();
  }

  // Event Handlers
  private async handleTradeEvent(data: any): Promise<void> {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.trader,
      type: 'trade_confirmation',
      title: 'Trade Executed',
      message: `Your ${data.tradeType} order for ${data.amount} tokens was executed at ${(data.price * 100).toFixed(1)}¢`,
      data: {
        marketId: data.marketId,
        tradeType: data.tradeType,
        amount: data.amount,
        price: data.price,
        signature: data.signature
      },
      isRead: false,
      createdAt: new Date()
    };

    await this.queueNotification(notification);
  }

  private async handleMarketSettlement(data: any): Promise<void> {
    // Get all users who have positions in this market
    const marketParticipants = await this.databaseService.getMarketParticipants(data.marketId);

    for (const participant of marketParticipants) {
      const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: participant.userId,
        type: 'market_settlement',
        title: 'Market Settled',
        message: `The market "${data.marketTitle}" has been settled. ${data.winningOutcome ? 'Check your winnings!' : 'Settlement complete.'}`,
        data: {
          marketId: data.marketId,
          winningOutcome: data.winningOutcome,
          userPayout: participant.payout
        },
        isRead: false,
        createdAt: new Date()
      };

      await this.queueNotification(notification);
    }
  }

  private async handleSocialEvent(data: any): Promise<void> {
    let notification: Notification;

    switch (data.eventType) {
      case 'comment':
        notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: data.targetUserId,
          type: 'social',
          title: 'New Comment',
          message: `${data.username} commented on a market you're following`,
          data: {
            marketId: data.marketId,
            commentId: data.commentId,
            username: data.username
          },
          isRead: false,
          createdAt: new Date()
        };
        break;
      case 'follow':
        notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: data.targetUserId,
          type: 'social',
          title: 'New Follower',
          message: `${data.username} started following you`,
          data: {
            followerId: data.followerId,
            username: data.username
          },
          isRead: false,
          createdAt: new Date()
        };
        break;
      default:
        return;
    }

    await this.queueNotification(notification);
  }

  // User Preferences Management
  public async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    if (this.userPreferences.has(userId)) {
      return this.userPreferences.get(userId)!;
    }

    try {
      const preferences = await this.databaseService.getUserNotificationPreferences(userId);
      if (preferences) {
        this.userPreferences.set(userId, preferences);
        return preferences;
      }
    } catch (error) {
      this.logger.error('Failed to get user preferences:', error);
    }

    // Return default preferences
    const defaultPreferences: NotificationPreferences = {
      userId,
      priceAlerts: true,
      marketSettlements: true,
      socialNotifications: true,
      emailNotifications: false,
      pushNotifications: true,
      priceAlertThreshold: 5 // 5% change threshold
    };

    this.userPreferences.set(userId, defaultPreferences);
    return defaultPreferences;
  }

  public async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    const currentPreferences = await this.getUserPreferences(userId);
    const updatedPreferences = { ...currentPreferences, ...preferences };

    this.userPreferences.set(userId, updatedPreferences);

    try {
      await this.databaseService.updateUserNotificationPreferences(userId, updatedPreferences);
      this.logger.info(`Updated notification preferences for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to update user preferences:', error);
    }
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      return await this.databaseService.getUserEmail(userId);
    } catch (error) {
      this.logger.error('Failed to get user email:', error);
      return null;
    }
  }

  // Public API Methods
  public async getUserNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    try {
      return await this.databaseService.getUserNotifications(userId, limit, offset);
    } catch (error) {
      this.logger.error('Failed to get user notifications:', error);
      return [];
    }
  }

  public async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      return await this.databaseService.markNotificationAsRead(notificationId, userId);
    } catch (error) {
      this.logger.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  public async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      return await this.databaseService.markAllNotificationsAsRead(userId);
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  public getStats(): any {
    return {
      activeAlerts: this.priceAlerts.size,
      queuedNotifications: this.notificationQueue.length,
      queuedEmails: this.emailQueue.length,
      cachedPreferences: this.userPreferences.size
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down notification service...');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process remaining notifications
    await this.processNotificationQueue();
    await this.processEmailQueue();

    this.logger.info('Notification service shutdown complete');
  }
}