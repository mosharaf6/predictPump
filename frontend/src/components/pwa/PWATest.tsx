'use client';

import { useState } from 'react';
import { usePWA } from '@/components/providers/PWAProvider';
import { useOfflineState, OfflineCache } from '@/hooks/useOfflineState';

export const PWATest: React.FC = () => {
  const {
    isInstalled,
    isInstallable,
    isNotificationSupported,
    notificationPermission,
    pushSubscription,
    installApp,
    requestNotificationPermission,
    subscribeToPush,
    showNotification,
  } = usePWA();

  const { isOnline, isOffline } = useOfflineState();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testOfflineCache = () => {
    // Test cache functionality
    const testData = { message: 'Hello PWA!', timestamp: Date.now() };
    OfflineCache.set('test-key', testData);
    
    const retrieved = OfflineCache.get('test-key');
    if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testData)) {
      addResult('✅ Offline cache working correctly');
    } else {
      addResult('❌ Offline cache failed');
    }
  };

  const testNotification = async () => {
    try {
      await showNotification({
        title: 'PWA Test Notification',
        body: 'This is a test notification from PredictionPump PWA',
        tag: 'pwa-test',
        data: { test: true },
      });
      addResult('✅ Notification sent successfully');
    } catch (error) {
      addResult(`❌ Notification failed: ${error}`);
    }
  };

  const testInstallPrompt = async () => {
    try {
      const success = await installApp();
      if (success) {
        addResult('✅ App installation prompted successfully');
      } else {
        addResult('⚠️ App installation not available or cancelled');
      }
    } catch (error) {
      addResult(`❌ Install prompt failed: ${error}`);
    }
  };

  const testPushSubscription = async () => {
    try {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        const subscription = await subscribeToPush();
        if (subscription) {
          addResult('✅ Push subscription successful');
        } else {
          addResult('❌ Push subscription failed');
        }
      } else {
        addResult('⚠️ Notification permission denied');
      }
    } catch (error) {
      addResult(`❌ Push subscription error: ${error}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        PWA Functionality Test
      </h2>

      {/* Status Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Status</h3>
          <div className="space-y-1 text-sm">
            <div className={`flex items-center ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className={`flex items-center ${isInstalled ? 'text-green-600' : 'text-gray-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${isInstalled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              {isInstalled ? 'Installed' : 'Not Installed'}
            </div>
            <div className={`flex items-center ${isInstallable ? 'text-blue-600' : 'text-gray-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${isInstallable ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
              {isInstallable ? 'Installable' : 'Not Installable'}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Notifications</h3>
          <div className="space-y-1 text-sm">
            <div className={`flex items-center ${isNotificationSupported ? 'text-green-600' : 'text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${isNotificationSupported ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {isNotificationSupported ? 'Supported' : 'Not Supported'}
            </div>
            <div className={`flex items-center ${notificationPermission === 'granted' ? 'text-green-600' : 'text-gray-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${notificationPermission === 'granted' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              Permission: {notificationPermission}
            </div>
            <div className={`flex items-center ${pushSubscription ? 'text-green-600' : 'text-gray-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${pushSubscription ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              {pushSubscription ? 'Subscribed' : 'Not Subscribed'}
            </div>
          </div>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={testOfflineCache}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Test Offline Cache
        </button>
        
        <button
          onClick={testNotification}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          disabled={!isNotificationSupported}
        >
          Test Notification
        </button>
        
        <button
          onClick={testInstallPrompt}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          disabled={!isInstallable}
        >
          Test Install Prompt
        </button>
        
        <button
          onClick={testPushSubscription}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          disabled={!isNotificationSupported}
        >
          Test Push Subscription
        </button>
      </div>

      {/* Test Results */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Test Results</h3>
        <div className="max-h-40 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No tests run yet</p>
          ) : (
            <div className="space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
        {testResults.length > 0 && (
          <button
            onClick={() => setTestResults([])}
            className="mt-2 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Clear Results
          </button>
        )}
      </div>
    </div>
  );
};

export default PWATest;