'use client';

import { useState } from 'react';
import { usePWA } from '@/components/providers/PWAProvider';
import { useOfflineState, OfflineCache } from '@/hooks/useOfflineState';

interface PWASettingsProps {
  onClose?: () => void;
}

export const PWASettings: React.FC<PWASettingsProps> = ({ onClose }) => {
  const {
    isInstalled,
    isInstallable,
    isNotificationSupported,
    notificationPermission,
    pushSubscription,
    installApp,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
  } = usePWA();

  const { isOnline, isOffline } = useOfflineState();
  const [isLoading, setIsLoading] = useState(false);
  const [cacheSize, setCacheSize] = useState(OfflineCache.getSize());

  const handleInstallApp = async () => {
    setIsLoading(true);
    try {
      await installApp();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        await subscribeToPush();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setIsLoading(true);
    try {
      await unsubscribeFromPush();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = () => {
    OfflineCache.clear();
    setCacheSize(0);
  };

  const getNotificationStatus = () => {
    if (!isNotificationSupported) return 'Not supported';
    if (notificationPermission === 'granted' && pushSubscription) return 'Enabled';
    if (notificationPermission === 'granted') return 'Granted but not subscribed';
    if (notificationPermission === 'denied') return 'Blocked';
    return 'Not requested';
  };

  const getInstallStatus = () => {
    if (isInstalled) return 'Installed';
    if (isInstallable) return 'Available';
    return 'Not available';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          PWA Settings
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Connection Status
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        {/* App Installation */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              App Installation
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getInstallStatus()}
            </p>
          </div>
          {isInstallable && !isInstalled && (
            <button
              onClick={handleInstallApp}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>

        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Push Notifications
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getNotificationStatus()}
            </p>
          </div>
          {isNotificationSupported && (
            <div className="flex space-x-2">
              {notificationPermission !== 'granted' || !pushSubscription ? (
                <button
                  onClick={handleEnableNotifications}
                  disabled={isLoading || notificationPermission === 'denied'}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Enabling...' : 'Enable'}
                </button>
              ) : (
                <button
                  onClick={handleDisableNotifications}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Disabling...' : 'Disable'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Offline Cache */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Offline Cache
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {cacheSize} items cached
            </p>
          </div>
          {cacheSize > 0 && (
            <button
              onClick={handleClearCache}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Clear Cache
            </button>
          )}
        </div>

        {/* PWA Features */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            PWA Features
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Offline functionality</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Background sync</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Home screen installation</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Push notifications</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWASettings;