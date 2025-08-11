'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { useWebSocketConnection } from './useWebSocketConnection';

interface Notification {
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

interface NotificationPreferences {
  userId: string;
  priceAlerts: boolean;
  marketSettlements: boolean;
  socialNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  priceAlertThreshold: number;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { wallet, publicKey } = useWallet();
  const { connected } = useWebSocketConnection();

  const userId = publicKey?.toString();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/v1/notifications?userId=${userId}&limit=50`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      if (data.success) {
        setNotifications(data.data.notifications.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/v1/notifications/preferences?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const data = await response.json();
      if (data.success) {
        setPreferences(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
    }
  }, [userId]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/v1/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [userId]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true }))
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [userId]);

  // Update notification preferences
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!userId) return;

    try {
      const response = await fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, ...updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      // Update local state
      setPreferences(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error('Failed to update notification preferences:', err);
    }
  }, [userId]);

  // Handle real-time notifications via WebSocket
  useEffect(() => {
    if (!connected || !userId) return;

    const handleNotification = (data: any) => {
      if (data.type === 'notification' && data.data) {
        const notification = {
          ...data.data,
          createdAt: new Date(data.data.createdAt),
          expiresAt: data.data.expiresAt ? new Date(data.data.expiresAt) : undefined
        };

        setNotifications(prev => [notification, ...prev]);

        // Show PWA notification if service worker is available
        if ('serviceWorker' in navigator && 'Notification' in window) {
          navigator.serviceWorker.ready.then((registration) => {
            if (Notification.permission === 'granted') {
              const notificationOptions = {
                body: notification.message,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                tag: notification.id,
                data: notification.data,
                requireInteraction: notification.type === 'price_alert' || notification.type === 'market_settlement',
                actions: [
                  {
                    action: 'view',
                    title: 'View',
                    icon: '/icons/icon-72x72.png'
                  },
                  {
                    action: 'dismiss',
                    title: 'Dismiss'
                  }
                ]
              };
              
              registration.showNotification(notification.title, notificationOptions as any);
            }
          }).catch((error) => {
            console.error('Failed to show PWA notification:', error);
            // Fallback to regular browser notification
            if (Notification.permission === 'granted') {
              new Notification(notification.title, {
                body: notification.message,
                icon: '/icons/icon-192x192.png',
                tag: notification.id
              });
            }
          });
        } else if ('Notification' in window && Notification.permission === 'granted') {
          // Fallback to regular browser notification
          new Notification(notification.title, {
            body: notification.message,
            icon: '/icons/icon-192x192.png',
            tag: notification.id
          });
        }
      }
    };

    // TODO: Implement WebSocket notification handling through the WebSocket store
    console.log('Ready to receive notifications for user:', userId);
  }, [connected, userId]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Initialize data
  useEffect(() => {
    if (userId) {
      fetchNotifications();
      fetchPreferences();
      requestNotificationPermission();
    }
  }, [userId, fetchNotifications, fetchPreferences, requestNotificationPermission]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    preferences,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    updatePreferences,
    fetchNotifications,
    requestNotificationPermission
  };
};