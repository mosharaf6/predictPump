'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ServiceWorkerManager, PushNotificationPayload } from '@/utils/serviceWorker';

interface PWAContextType {
  isInstalled: boolean;
  isInstallable: boolean;
  isNotificationSupported: boolean;
  notificationPermission: NotificationPermission;
  pushSubscription: PushSubscription | null;
  installApp: () => Promise<boolean>;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<PushSubscription | null>;
  unsubscribeFromPush: () => Promise<boolean>;
  showNotification: (payload: PushNotificationPayload) => Promise<void>;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};

interface PWAProviderProps {
  children: ReactNode;
}

export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isNotificationSupported, setIsNotificationSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [swManager] = useState(() => ServiceWorkerManager.getInstance());

  useEffect(() => {
    const initializePWA = async () => {
      // Check if app is installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isInWebAppiOS);

      // Check notification support
      setIsNotificationSupported('Notification' in window && 'serviceWorker' in navigator);
      
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }

      // Register service worker
      await swManager.register();

      // Check if app is installable
      const installPrompt = await swManager.getInstallPrompt();
      setIsInstallable(!!installPrompt);

      // Get existing push subscription
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setPushSubscription(subscription);
        } catch (error) {
          console.error('Failed to get push subscription:', error);
        }
      }
    };

    initializePWA();

    // Listen for app install events
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for beforeinstallprompt events
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [swManager]);

  const installApp = async (): Promise<boolean> => {
    const success = await swManager.promptInstall();
    if (success) {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    return success;
  };

  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    const permission = await swManager.requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  };

  const subscribeToPush = async (): Promise<PushSubscription | null> => {
    const subscription = await swManager.subscribeToPushNotifications();
    setPushSubscription(subscription);
    return subscription;
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    const success = await swManager.unsubscribeFromPushNotifications();
    if (success) {
      setPushSubscription(null);
    }
    return success;
  };

  const showNotification = async (payload: PushNotificationPayload): Promise<void> => {
    await swManager.showNotification(payload);
  };

  const contextValue: PWAContextType = {
    isInstalled,
    isInstallable,
    isNotificationSupported,
    notificationPermission,
    pushSubscription,
    installApp,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    showNotification,
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
    </PWAContext.Provider>
  );
};

export default PWAProvider;