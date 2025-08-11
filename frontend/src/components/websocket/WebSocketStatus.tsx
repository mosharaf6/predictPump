import React from 'react';
import { useWebSocket } from '../../stores/websocketStore';
import { Wifi, WifiOff, RotateCcw, AlertCircle } from 'lucide-react';

interface WebSocketStatusProps {
  showDetails?: boolean;
  className?: string;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const { 
    connected, 
    connecting, 
    reconnecting, 
    reconnectAttempts, 
    lastError,
    connectionId,
    subscriptions,
    connect,
    disconnect
  } = useWebSocket();

  const getStatusColor = () => {
    if (connected) return 'text-green-500';
    if (connecting || reconnecting) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusIcon = () => {
    if (connected) return <Wifi className="w-4 h-4" />;
    if (connecting || reconnecting) return <RotateCcw className="w-4 h-4 animate-spin" />;
    return <WifiOff className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (connected) return 'Connected';
    if (reconnecting) return `Reconnecting (${reconnectAttempts})`;
    if (connecting) return 'Connecting';
    return 'Disconnected';
  };

  const handleReconnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Manual reconnection failed:', error);
    }
  };

  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={getStatusColor()}>
          {getStatusIcon()}
        </div>
        <span className={`text-sm ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">WebSocket Status</h3>
        <div className={`flex items-center space-x-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Connection ID:</span>
          <span className="font-mono text-xs">
            {connectionId || 'N/A'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Subscriptions:</span>
          <span className="font-semibold">
            {subscriptions.length}
          </span>
        </div>

        {reconnectAttempts > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Reconnect Attempts:</span>
            <span className="font-semibold text-yellow-600">
              {reconnectAttempts}
            </span>
          </div>
        )}

        {lastError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Error</span>
            </div>
            <p className="text-xs text-red-600 mt-1">{lastError}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex space-x-2">
        {!connected && !connecting && (
          <button
            onClick={handleReconnect}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Reconnect
          </button>
        )}
        
        {connected && (
          <button
            onClick={disconnect}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {subscriptions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Active Subscriptions</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {subscriptions.map((subscription, index) => (
              <div key={index} className="text-xs font-mono bg-gray-50 px-2 py-1 rounded">
                {subscription}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WebSocketStatus;