'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Market } from '@/types/market';
import { TrendingUp, BarChart3, Activity, Wifi, WifiOff } from 'lucide-react';
import { useMarketSubscription } from '../../hooks/useWebSocketConnection';

interface PriceChartProps {
  market: Market;
}

interface ChartDataPoint {
  timestamp: string;
  time: string;
  [key: string]: string | number; // Dynamic keys for outcome prices
}

export function PriceChart({ market }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  
  // Use WebSocket for real-time data
  const { marketData, isSubscribed, connected } = useMarketSubscription(market.id, {
    autoSubscribe: true,
    autoConnect: true
  });

  // Generate initial mock historical data
  useEffect(() => {
    const generateMockData = () => {
      const now = new Date();
      const dataPoints: ChartDataPoint[] = [];
      
      let intervals: number;
      let intervalMs: number;
      
      switch (timeRange) {
        case '1h':
          intervals = 60;
          intervalMs = 60 * 1000; // 1 minute
          break;
        case '24h':
          intervals = 144;
          intervalMs = 10 * 60 * 1000; // 10 minutes
          break;
        case '7d':
          intervals = 168;
          intervalMs = 60 * 60 * 1000; // 1 hour
          break;
        case '30d':
          intervals = 120;
          intervalMs = 6 * 60 * 60 * 1000; // 6 hours
          break;
      }

      for (let i = intervals; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - (i * intervalMs));
        const dataPoint: ChartDataPoint = {
          timestamp: timestamp.toISOString(),
          time: timestamp.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            ...(timeRange === '7d' || timeRange === '30d' ? { 
              month: 'short', 
              day: 'numeric' 
            } : {})
          }),
        };

        // Generate price data for each outcome with some volatility
        market.outcomes.forEach((outcome, index) => {
          const basePrice = outcome.currentPrice;
          const volatility = market.volatility;
          const randomWalk = (Math.random() - 0.5) * volatility * 0.1;
          const timeDecay = Math.sin((i / intervals) * Math.PI) * volatility * 0.05;
          
          let price = basePrice + randomWalk + timeDecay;
          price = Math.max(0.01, Math.min(0.99, price)); // Keep prices between 0.01 and 0.99
          
          dataPoint[outcome.name] = parseFloat(price.toFixed(3));
        });

        dataPoints.push(dataPoint);
      }

      setChartData(dataPoints);
    };

    generateMockData();
  }, [market, timeRange]);

  // Update chart with real-time WebSocket data
  useEffect(() => {
    if (marketData && isSubscribed) {
      const now = new Date();
      const newDataPoint: ChartDataPoint = {
        timestamp: now.toISOString(),
        time: now.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          ...(timeRange === '7d' || timeRange === '30d' ? { 
            month: 'short', 
            day: 'numeric' 
          } : {})
        }),
      };

      // Add real-time price data for each outcome
      marketData.prices.forEach((priceData, index) => {
        if (index < market.outcomes.length) {
          newDataPoint[market.outcomes[index].name] = parseFloat(priceData.price.toFixed(3));
        }
      });

      setChartData(prevData => {
        const updatedData = [...prevData, newDataPoint];
        // Keep only the last 200 points to prevent memory issues
        return updatedData.slice(-200);
      });
    }
  }, [marketData, isSubscribed, market.outcomes, timeRange]);

  const colors = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#F97316', // Orange
  ];

  const formatTooltipValue = (value: number) => `$${value.toFixed(3)}`;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Price Chart
          </h3>
          {/* Real-time connection indicator */}
          <div className="flex items-center gap-1 ml-2">
            {connected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-600 font-medium">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-600 font-medium">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(['1h', '24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              domain={['dataMin - 0.01', 'dataMax + 0.01']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
              formatter={(value: number, name: string) => [formatTooltipValue(value), name]}
              labelStyle={{ color: '#D1D5DB' }}
            />
            <Legend />
            
            {market.outcomes.map((outcome, index) => (
              <Line
                key={outcome.name}
                type="monotone"
                dataKey={outcome.name}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: colors[index % colors.length], strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Current Prices Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {market.outcomes.map((outcome, index) => {
            // Use real-time data if available, otherwise fall back to market data
            const realTimePrice = marketData?.prices?.find(p => p.outcomeIndex === index);
            const currentPrice = realTimePrice ? realTimePrice.price : outcome.currentPrice;
            const priceChange = realTimePrice ? realTimePrice.priceChange24h : market.priceChange24h[index];
            const isPositive = priceChange >= 0;
            
            return (
              <div key={outcome.name} className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {outcome.name}
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  ${currentPrice.toFixed(3)}
                  {realTimePrice && (
                    <span className="ml-1 text-xs text-green-500">●</span>
                  )}
                </div>
                <div className={`flex items-center justify-center gap-1 text-sm ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${!isPositive ? 'rotate-180' : ''}`} />
                  {Math.abs(priceChange * 100).toFixed(1)}%
                </div>
                {realTimePrice && (
                  <div className="text-xs text-gray-500 mt-1">
                    Vol: {realTimePrice.volume24h.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}