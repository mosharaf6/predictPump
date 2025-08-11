'use client';

import { UserStats } from '@/types/user';
import { formatNumber, formatSOL, formatPercent } from '@/utils/format';

interface ProfileStatsProps {
  stats: UserStats;
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  const statCards = [
    {
      title: 'Total Profit',
      value: formatSOL(stats.totalProfit),
      change: stats.totalProfit >= 0 ? '+' : '',
      changeColor: stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400',
      icon: '💰',
      rank: stats.profitRank ? `#${stats.profitRank}` : null
    },
    {
      title: 'Total Volume',
      value: formatSOL(stats.totalVolume),
      subtitle: `${formatNumber(stats.totalTrades)} trades`,
      icon: '📊',
      rank: stats.volumeRank ? `#${stats.volumeRank}` : null
    },
    {
      title: 'Win Rate',
      value: formatPercent(stats.winRate),
      subtitle: `${stats.settledPositions} settled`,
      changeColor: stats.winRate >= 50 ? 'text-green-400' : 'text-red-400',
      icon: '🎯',
      rank: stats.winRateRank ? `#${stats.winRateRank}` : null
    },
    {
      title: 'Avg Trade Size',
      value: formatSOL(stats.averageTradeSize),
      subtitle: 'per position',
      icon: '⚖️'
    },
    {
      title: 'Best Trade',
      value: formatSOL(stats.bestTrade),
      changeColor: 'text-green-400',
      icon: '🚀'
    },
    {
      title: 'Active Positions',
      value: formatNumber(stats.activePositions),
      subtitle: `${stats.settledPositions} settled`,
      icon: '📈'
    },
    {
      title: 'Reputation Score',
      value: formatNumber(stats.reputationScore),
      changeColor: stats.reputationScore >= 0 ? 'text-blue-400' : 'text-red-400',
      icon: '⭐',
      rank: stats.reputationRank ? `#${stats.reputationRank}` : null
    },
    {
      title: 'Worst Trade',
      value: formatSOL(Math.abs(stats.worstTrade)),
      changeColor: 'text-red-400',
      icon: '📉'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <div key={index} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{stat.icon}</span>
            {stat.rank && (
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                {stat.rank}
              </span>
            )}
          </div>
          
          <div className="space-y-1">
            <p className="text-gray-400 text-sm font-medium">{stat.title}</p>
            <p className={`text-lg font-bold ${stat.changeColor || 'text-white'}`}>
              {stat.change}{stat.value}
            </p>
            {stat.subtitle && (
              <p className="text-gray-500 text-xs">{stat.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}