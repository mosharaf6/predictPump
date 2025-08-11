'use client';

import { useOfflineState } from '@/hooks/useOfflineState';

export const OfflineIndicator: React.FC = () => {
  const { isOffline, wasOffline, isOnline } = useOfflineState();

  if (!wasOffline && isOnline) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isOffline
          ? 'bg-red-500 text-white'
          : 'bg-green-500 text-white'
      }`}
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center space-x-2">
          {isOffline ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728"
                />
              </svg>
              <span className="text-sm font-medium">
                You're offline. Some features may be limited.
              </span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm font-medium">
                Connection restored. Syncing data...
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;