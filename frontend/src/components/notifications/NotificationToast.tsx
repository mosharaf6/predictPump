'use client';

import React, { useState, useEffect } from 'react';
import { X, Bell, TrendingUp, AlertCircle, MessageSquare, Check } from 'lucide-react';

interface ToastNotification {
  id: string;
  type: 'price_alert' | 'market_settlement' | 'social' | 'trade_confirmation';
  title: string;
  message: string;
  data?: any;
  duration?: number;
}

interface NotificationToastProps {
  notification: ToastNotification;
  onClose: (id: string) => void;
  onAction?: (notification: ToastNotification) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onAction
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto-close after duration
    const duration = notification.duration || 5000;
    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoCloseTimer);
    };
  }, [notification.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300);
  };

  const handleAction = () => {
    if (onAction) {
      onAction(notification);
    }
    handleClose();
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'price_alert':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'market_settlement':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'social':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'trade_confirmation':
        return <Check className="w-5 h-5 text-emerald-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActionText = () => {
    switch (notification.type) {
      case 'price_alert':
        return 'View Market';
      case 'market_settlement':
        return 'Check Results';
      case 'social':
        return 'View Comment';
      case 'trade_confirmation':
        return 'View Trade';
      default:
        return 'View';
    }
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg border border-gray-200
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {notification.title}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {notification.message}
                </p>
                
                {/* Additional data display */}
                {notification.data?.currentPrice && (
                  <p className="text-xs text-green-600 mt-1">
                    Current price: {(notification.data.currentPrice * 100).toFixed(1)}¢
                  </p>
                )}
                
                {notification.data?.userPayout && (
                  <p className="text-xs text-blue-600 mt-1">
                    Your payout: {notification.data.userPayout} SOL
                  </p>
                )}
              </div>
              
              <button
                onClick={handleClose}
                className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Action button */}
            {onAction && (
              <div className="mt-3">
                <button
                  onClick={handleAction}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {getActionText()}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all ease-linear"
          style={{
            animation: `shrink ${notification.duration || 5000}ms linear forwards`
          }}
        />
      </div>
      
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

interface NotificationToastContainerProps {
  notifications: ToastNotification[];
  onClose: (id: string) => void;
  onAction?: (notification: ToastNotification) => void;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  notifications,
  onClose,
  onAction
}) => {
  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2 pointer-events-none">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className="pointer-events-auto"
          style={{
            transform: `translateY(${index * 10}px)`,
            zIndex: 50 - index
          }}
        >
          <NotificationToast
            notification={notification}
            onClose={onClose}
            onAction={onAction}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;