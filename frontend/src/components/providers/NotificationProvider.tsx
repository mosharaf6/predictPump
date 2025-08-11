'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { NotificationToastContainer } from '../notifications/NotificationToast';
import { useRouter } from 'next/navigation';

interface ToastNotification {
  id: string;
  type: 'price_alert' | 'market_settlement' | 'social' | 'trade_confirmation';
  title: string;
  message: string;
  data?: any;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (notification: Omit<ToastNotification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationToasts = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationToasts must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const router = useRouter();

  const showNotification = useCallback((notification: Omit<ToastNotification, 'id'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: ToastNotification = {
      ...notification,
      id,
      duration: notification.duration || 5000
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration + animation time
    setTimeout(() => {
      removeNotification(id);
    }, (newNotification.duration || 5000) + 500);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleNotificationAction = useCallback((notification: ToastNotification) => {
    // Handle different notification actions
    switch (notification.type) {
      case 'price_alert':
      case 'market_settlement':
        if (notification.data?.marketId) {
          router.push(`/markets/${notification.data.marketId}`);
        }
        break;
      case 'social':
        if (notification.data?.marketId) {
          router.push(`/markets/${notification.data.marketId}#comments`);
        }
        break;
      case 'trade_confirmation':
        if (notification.data?.marketId) {
          router.push(`/markets/${notification.data.marketId}#positions`);
        }
        break;
      default:
        break;
    }
  }, [router]);

  // Limit the number of visible notifications
  const visibleNotifications = notifications.slice(-3); // Show only last 3 notifications

  const contextValue: NotificationContextType = {
    showNotification,
    removeNotification,
    clearAllNotifications
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationToastContainer
        notifications={visibleNotifications}
        onClose={removeNotification}
        onAction={handleNotificationAction}
      />
    </NotificationContext.Provider>
  );
};