'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';

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

interface CreatePriceAlertData {
  marketId: string;
  outcomeIndex: number;
  alertType: 'above' | 'below' | 'change';
  targetPrice?: number;
  changeThreshold?: number;
}

export const usePriceAlerts = (marketId?: string) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { wallet, publicKey } = useWallet();

  const userId = publicKey?.toString();

  // Fetch price alerts
  const fetchAlerts = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/notifications/price-alerts?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch price alerts');
      }

      const data = await response.json();
      if (data.success) {
        let alertsData = data.data.map((alert: any) => ({
          ...alert,
          createdAt: new Date(alert.createdAt)
        }));

        // Filter by market if specified
        if (marketId) {
          alertsData = alertsData.filter((alert: PriceAlert) => alert.marketId === marketId);
        }

        setAlerts(alertsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price alerts');
    } finally {
      setLoading(false);
    }
  }, [userId, marketId]);

  // Create price alert
  const createAlert = useCallback(async (alertData: CreatePriceAlertData) => {
    if (!userId) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/notifications/price-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...alertData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create price alert');
      }

      const data = await response.json();
      if (data.success) {
        // Refresh alerts list
        await fetchAlerts();
        return data.data.alertId;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create price alert';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchAlerts]);

  // Delete price alert
  const deleteAlert = useCallback(async (alertId: string) => {
    if (!userId) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/notifications/price-alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete price alert');
      }

      // Remove from local state
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete price alert';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initialize data
  useEffect(() => {
    if (userId) {
      fetchAlerts();
    }
  }, [userId, fetchAlerts]);

  return {
    alerts,
    loading,
    error,
    createAlert,
    deleteAlert,
    fetchAlerts
  };
};