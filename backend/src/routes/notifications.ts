import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { DatabaseService } from '../services/DatabaseService';
import { validateRequest, validationSchemas, sanitizeRequest, rateLimit } from '../middleware/validation';
import winston from 'winston';

export interface NotificationRouterDependencies {
  notificationService: NotificationService;
  databaseService: DatabaseService;
}

export function createNotificationRouter(deps: NotificationRouterDependencies): Router {
  const router = Router();
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console()
    ]
  });

  // Apply middleware
  router.use(sanitizeRequest);
  router.use(rateLimit(100, 60000)); // 100 requests per minute

  /**
   * GET /api/v1/notifications
   * Get user notifications
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const notifications = await deps.notificationService.getUserNotifications(
        userId as string,
        limit,
        offset
      );

      res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            limit,
            offset,
            total: notifications.length
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/notifications/:id/read
   * Mark notification as read
   */
  router.post('/:id/read', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const success = await deps.notificationService.markNotificationAsRead(id, userId);

      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({
        success: true,
        message: 'Notification marked as read'
      });

    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/notifications/read-all
   * Mark all notifications as read for a user
   */
  router.post('/read-all', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const success = await deps.notificationService.markAllNotificationsAsRead(userId);

      res.json({
        success,
        message: success ? 'All notifications marked as read' : 'No notifications to mark as read'
      });

    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/notifications/preferences
   * Get user notification preferences
   */
  router.get('/preferences', async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const preferences = await deps.notificationService.getUserPreferences(userId as string);

      res.json({
        success: true,
        data: preferences
      });

    } catch (error) {
      logger.error('Error fetching notification preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/v1/notifications/preferences
   * Update user notification preferences
   */
  router.put('/preferences', async (req: Request, res: Response) => {
    try {
      const { userId, ...preferences } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      await deps.notificationService.updateUserPreferences(userId, preferences);

      res.json({
        success: true,
        message: 'Notification preferences updated'
      });

    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/notifications/price-alerts
   * Create a price alert
   */
  router.post('/price-alerts', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        marketId,
        outcomeIndex,
        alertType,
        targetPrice,
        changeThreshold
      } = req.body;

      if (!userId || !marketId || outcomeIndex === undefined || !alertType) {
        return res.status(400).json({ 
          error: 'userId, marketId, outcomeIndex, and alertType are required' 
        });
      }

      if (alertType === 'above' || alertType === 'below') {
        if (targetPrice === undefined) {
          return res.status(400).json({ 
            error: 'targetPrice is required for above/below alerts' 
          });
        }
      }

      if (alertType === 'change') {
        if (changeThreshold === undefined) {
          return res.status(400).json({ 
            error: 'changeThreshold is required for change alerts' 
          });
        }
      }

      const alertId = await deps.notificationService.createPriceAlert({
        userId,
        marketId,
        outcomeIndex,
        alertType,
        targetPrice,
        changeThreshold,
        isActive: true
      });

      res.json({
        success: true,
        data: {
          alertId,
          message: 'Price alert created successfully'
        }
      });

    } catch (error) {
      logger.error('Error creating price alert:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/notifications/price-alerts
   * Get user's price alerts
   */
  router.get('/price-alerts', async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const alerts = await deps.notificationService.getUserPriceAlerts(userId as string);

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      logger.error('Error fetching price alerts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/v1/notifications/price-alerts/:id
   * Delete a price alert
   */
  router.delete('/price-alerts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const success = await deps.notificationService.deletePriceAlert(id, userId);

      if (!success) {
        return res.status(404).json({ error: 'Price alert not found' });
      }

      res.json({
        success: true,
        message: 'Price alert deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting price alert:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/notifications/stats
   * Get notification service statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = deps.notificationService.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error fetching notification stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/notifications/test
   * Test notification delivery (development only)
   */
  router.post('/test', async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Test endpoint not available in production' });
      }

      const { userId, type, title, message } = req.body;

      if (!userId || !type || !title || !message) {
        return res.status(400).json({ 
          error: 'userId, type, title, and message are required' 
        });
      }

      const notification = {
        id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type,
        title,
        message,
        data: { test: true },
        isRead: false,
        createdAt: new Date()
      };

      await deps.notificationService.queueNotification(notification);

      res.json({
        success: true,
        message: 'Test notification queued',
        data: notification
      });

    } catch (error) {
      logger.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}