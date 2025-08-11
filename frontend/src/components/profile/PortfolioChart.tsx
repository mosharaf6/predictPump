'use client';

import { useState, useMemo } from 'react';
import { PortfolioValue } from '@/types/user';
import { formatSOL } from '@/utils/format';

interface PortfolioChartProps {
  data: PortfolioValue[];
}

type TimeRange = '24h' | '7d' | '30d' | 'all';

export function PortfolioChart({ data }: PortfolioChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [showUnrealized, setShowUnrealized] = useState(true);
  const [showRealized, setShowRealized] = useState(true);

  const filteredData = useMemo(() => {
    if (!data.length) return [];

    const now = new Date();
    let cutoffDate: Date;

    switch (timeRange) {
      case '24h':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return data;
    }

    return data.filter(point => new Date(point.timestamp) >= cutoffDate);
  }, [data, timeRange]);

  const chartStats = useMemo(() => {
    if (!filteredData.length) return null;

    const latest = filteredData[filteredData.length - 1];
    const earliest = filteredData[0];
    
    const totalChange = latest.totalValue - earliest.totalValue;
    const totalChangePercent = earliest.totalValue !== 0 
      ? (totalChange / Math.abs(earliest.totalValue)) * 100 
      : 0;

    return {
      currentValue: latest.totalValue,
      totalChange,
      totalChangePercent,
      unrealizedPnl: latest.unrealizedPnl,
      realizedPnl: latest.realizedPnl
    };
  }, [filteredData]);

  const maxValue = useMemo(() => {
    if (!filteredData.length) return 0;
    return Math.max(...filteredData.map(d => Math.max(d.totalValue, d.unrealizedPnl, d.realizedPnl)));
  }, [filteredData]);

  const minValue = useMemo(() => {
    if (!filteredData.length) return 0;
    return Math.min(...filteredData.map(d => Math.min(d.totalValue, d.unrealizedPnl, d.realizedPnl)));
  }, [filteredData]);

  const getYPosition = (value: number) => {
    if (maxValue === minValue) return 50;
    return 100 - ((value - minValue) / (maxValue - minValue)) * 100;
  };

  const getXPosition = (index: number) => {
    if (filteredData.length <= 1) return 0;
    return (index / (filteredData.length - 1)) * 100;
  };

  const createPath = (values: number[]) => {
    if (values.length === 0) return '';
    
    const points = values.map((value, index) => 
      `${index === 0 ? 'M' : 'L'} ${getXPosition(index)} ${getYPosition(value)}`
    ).join(' ');
    
    return points;
  };

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        <p>No portfolio data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Time Range Selector */}
        <div className="flex bg-gray-700 rounded-lg p-1">
          {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRealized}
              onChange={(e) => setShowRealized(e.target.checked)}
              className="rounded"
            />
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              Realized P&L
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnrealized}
              onChange={(e) => setShowUnrealized(e.target.checked)}
              className="rounded"
            />
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Unrealized P&L
            </span>
          </label>
        </div>
      </div>

      {/* Stats */}
      {chartStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Portfolio Value</p>
            <p className="text-lg font-bold">{formatSOL(chartStats.currentValue)}</p>
          </div>
          <div>
            <p className="text-gray-400">Total Change</p>
            <p className={`text-lg font-bold ${chartStats.totalChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {chartStats.totalChange >= 0 ? '+' : ''}{formatSOL(chartStats.totalChange)}
              <span className="text-sm ml-1">
                ({chartStats.totalChangePercent >= 0 ? '+' : ''}{chartStats.totalChangePercent.toFixed(2)}%)
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-400">Unrealized P&L</p>
            <p className={`text-lg font-bold ${chartStats.unrealizedPnl >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {chartStats.unrealizedPnl >= 0 ? '+' : ''}{formatSOL(chartStats.unrealizedPnl)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Realized P&L</p>
            <p className={`text-lg font-bold ${chartStats.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {chartStats.realizedPnl >= 0 ? '+' : ''}{formatSOL(chartStats.realizedPnl)}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative h-64 bg-gray-900 rounded-lg p-4">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#374151" strokeWidth="0.1"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />

          {/* Zero line */}
          {minValue < 0 && maxValue > 0 && (
            <line
              x1="0"
              y1={getYPosition(0)}
              x2="100"
              y2={getYPosition(0)}
              stroke="#6B7280"
              strokeWidth="0.2"
              strokeDasharray="1,1"
            />
          )}

          {/* Realized P&L Line */}
          {showRealized && (
            <path
              d={createPath(filteredData.map(d => d.realizedPnl))}
              fill="none"
              stroke="#10B981"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Unrealized P&L Line */}
          {showUnrealized && (
            <path
              d={createPath(filteredData.map(d => d.unrealizedPnl))}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Data points */}
          {filteredData.map((point, index) => (
            <g key={index}>
              {showRealized && (
                <circle
                  cx={getXPosition(index)}
                  cy={getYPosition(point.realizedPnl)}
                  r="0.5"
                  fill="#10B981"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {showUnrealized && (
                <circle
                  cx={getXPosition(index)}
                  cy={getYPosition(point.unrealizedPnl)}
                  r="0.5"
                  fill="#3B82F6"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          ))}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 -ml-16">
          <span>{formatSOL(maxValue)}</span>
          {minValue < 0 && maxValue > 0 && <span>0</span>}
          <span>{formatSOL(minValue)}</span>
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-gray-400 -mb-6">
          {filteredData.length > 0 && (
            <>
              <span>
                {new Date(filteredData[0].timestamp).toLocaleDateString()}
              </span>
              <span>
                {new Date(filteredData[filteredData.length - 1].timestamp).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}