'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { usePriceAlerts } from '../../hooks/usePriceAlerts';

interface PriceAlert {
  id: string;
  userId: string;
  marketId: string;
  outcomeIndex: number;
  alertType: 'above' | 'below' | 'change';
  targetPrice?: number;
  changeThreshold?: number;
  isActive: boolean;
  createdAt: Date;
}

interface PriceAlertManagerProps {
  marketId: string;
  marketTitle: string;
  outcomeOptions: string[];
  currentPrices: number[];
}

export const PriceAlertManager: React.FC<PriceAlertManagerProps> = ({
  marketId,
  marketTitle,
  outcomeOptions,
  currentPrices
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    outcomeIndex: 0,
    alertType: 'above' as 'above' | 'below' | 'change',
    targetPrice: '',
    changeThreshold: ''
  });

  const {
    alerts,
    createAlert,
    deleteAlert,
    loading,
    error
  } = usePriceAlerts(marketId);

  const handleCreateAlert = async () => {
    try {
      const alertData: any = {
        marketId,
        outcomeIndex: newAlert.outcomeIndex,
        alertType: newAlert.alertType
      };

      if (newAlert.alertType === 'above' || newAlert.alertType === 'below') {
        if (!newAlert.targetPrice) {
          alert('Please enter a target price');
          return;
        }
        alertData.targetPrice = parseFloat(newAlert.targetPrice) / 100; // Convert cents to decimal
      } else if (newAlert.alertType === 'change') {
        if (!newAlert.changeThreshold) {
          alert('Please enter a change threshold');
          return;
        }
        alertData.changeThreshold = parseFloat(newAlert.changeThreshold);
      }

      await createAlert(alertData);
      
      // Reset form
      setNewAlert({
        outcomeIndex: 0,
        alertType: 'above',
        targetPrice: '',
        changeThreshold: ''
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create price alert:', error);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (confirm('Are you sure you want to delete this price alert?')) {
      await deleteAlert(alertId);
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'above':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'below':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'change':
        return <Activity className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatAlertDescription = (alert: PriceAlert) => {
    const outcome = outcomeOptions[alert.outcomeIndex] || `Outcome ${alert.outcomeIndex}`;
    
    switch (alert.alertType) {
      case 'above':
        return `${outcome} reaches ${(alert.targetPrice! * 100).toFixed(1)}¢ or higher`;
      case 'below':
        return `${outcome} drops to ${(alert.targetPrice! * 100).toFixed(1)}¢ or lower`;
      case 'change':
        return `${outcome} changes by ${alert.changeThreshold}% or more`;
      default:
        return 'Unknown alert type';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Price Alerts</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Alert</span>
        </button>
      </div>

      {/* Create Alert Form */}
      {isOpen && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-3">Create New Alert</h4>
          
          <div className="space-y-4">
            {/* Outcome Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outcome
              </label>
              <select
                value={newAlert.outcomeIndex}
                onChange={(e) => setNewAlert({ ...newAlert, outcomeIndex: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {outcomeOptions.map((option, index) => (
                  <option key={index} value={index}>
                    {option} (Current: {(currentPrices[index] * 100).toFixed(1)}¢)
                  </option>
                ))}
              </select>
            </div>

            {/* Alert Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alert Type
              </label>
              <select
                value={newAlert.alertType}
                onChange={(e) => setNewAlert({ 
                  ...newAlert, 
                  alertType: e.target.value as 'above' | 'below' | 'change',
                  targetPrice: '',
                  changeThreshold: ''
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="above">Price goes above</option>
                <option value="below">Price goes below</option>
                <option value="change">Price changes by</option>
              </select>
            </div>

            {/* Target Price or Change Threshold */}
            {(newAlert.alertType === 'above' || newAlert.alertType === 'below') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Price (¢)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={newAlert.targetPrice}
                  onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                  placeholder="Enter price in cents"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {newAlert.alertType === 'change' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Change Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={newAlert.changeThreshold}
                  onChange={(e) => setNewAlert({ ...newAlert, changeThreshold: e.target.value })}
                  placeholder="Enter percentage change"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCreateAlert}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Alerts */}
      <div className="space-y-3">
        {loading && alerts.length === 0 ? (
          <div className="text-center py-4 text-gray-500">Loading alerts...</div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">Error loading alerts</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No price alerts set for this market
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {getAlertIcon(alert.alertType)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatAlertDescription(alert)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created {new Date(alert.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteAlert(alert.id)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};