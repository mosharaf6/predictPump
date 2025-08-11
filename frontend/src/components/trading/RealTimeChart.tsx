import React, { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMarketSubscription } from '../../hooks/useWebSocketConnection';
import { Activity, TrendingUp } from 'lucide-react';

interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume: number;
  formattedTime: string;
}

interface RealTimeChartProps {
  marketId: string;
  outcomeIndex?: number;
  height?: number;
  timeframe?: '1h' | '4h' | '24h';
  showVolume?: boolean;
  className?: string;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  marketId,
  outcomeIndex = 0,
  height = 300,
  timeframe = '24h',
  showVolume = false,
  className = ''
}) => {
  const { marketData, isSubscribed, connected } = useMarketSubscription(marketId, {
    outcomeIndex,
    autoSubscribe: true,
    autoConnect: true
  });

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Generate initial chart data (in a real app, this would come from an API)
  useEffect(() => {
    const generateInitialData = () => {
      const now = Date.now();
      const points: ChartDataPoint[] = [];
      const intervals = timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : 1440; // minutes
      const pointCount = 50;
      const intervalMs = (intervals * 60 * 1000) / pointCount;

      let basePrice = 0.5;
      
      for (let i = pointCount; i >= 0; i--) {
        const timestamp = now - (i * intervalMs);
        const priceVariation = (Math.random() - 0.5) * 0.1;
        const price = Math.max(0.01, Math.min(0.99, basePrice + priceVariation));
        basePrice = price;

        points.push({
          timestamp,
          price,
          volume: Math.random() * 1000,
          formattedTime: new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      }

      return points;
    };

    setChartData(generateInitialData());
    setIsLoading(false);
  }, [timeframe]);

  // Update chart data when new market data arrives
  useEffect(() => {
    if (marketData && isSubscribed) {
      const currentPrice = marketData.prices?.find(p => p.outcomeIndex === outcomeIndex);
      
      if (currentPrice) {
        const newDataPoint: ChartDataPoint = {
          timestamp: currentPrice.timestamp,
          price: currentPrice.price,
          volume: currentPrice.volume24h,
          formattedTime: new Date(currentPrice.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })
        };

        setChartData(prevData => {
          const updatedData = [...prevData, newDataPoint];
          // Keep only the last 50 points
          return updatedData.slice(-50);
        });
      }
    }
  }, [marketData, isSubscribed, outcomeIndex]);

  const chartStats = useMemo(() => {
    if (chartData.length === 0) return null;

    const prices = chartData.map(d => d.price);
    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2] || currentPrice;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = (priceChange / previousPrice) * 100;

    return {
      currentPrice,
      minPrice,
      maxPrice,
      priceChange,
      priceChangePercent,
      isPositive: priceChange >= 0
    };
  }, [chartData]);

  const formatPrice = (price: number) => {
    return (price * 100).toFixed(1) + '¢';
  };

  const formatTooltipPrice = (value: number) => {
    return formatPrice(value);
  };

  if (!connected) {
    return (
      <div className={`flex items-center justify-center h-${height} bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Connecting to live data...</p>
        </div>
      </div>
    );
  }

  if (isLoading || !isSubscribed) {
    return (
      <div className={`flex items-center justify-center h-${height} bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
          <p className="text-gray-600">Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Chart Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Price Chart
            </h3>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-gray-500">
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          
          {chartStats && (
            <div className="flex items-center space-x-4 text-sm">
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {formatPrice(chartStats.currentPrice)}
                </div>
                <div className={`flex items-center space-x-1 ${
                  chartStats.isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${
                    chartStats.isPositive ? '' : 'rotate-180'
                  }`} />
                  <span>
                    {chartStats.isPositive ? '+' : ''}
                    {chartStats.priceChangePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              
              <div className="text-right text-gray-600">
                <div className="text-xs">Range</div>
                <div className="text-xs">
                  {formatPrice(chartStats.minPrice)} - {formatPrice(chartStats.maxPrice)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="formattedTime"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={['dataMin - 0.01', 'dataMax + 0.01']}
              tickFormatter={formatTooltipPrice}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              formatter={(value: number) => [formatTooltipPrice(value), 'Price']}
              labelFormatter={(label) => `Time: ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Timeframe: {timeframe}</span>
          <span>Data points: {chartData.length}</span>
          <span>Last update: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default RealTimeChart;