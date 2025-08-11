'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, DollarSign, Target, Users, Star } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export interface LeaderboardUser {
  walletAddress: string;
  username?: string;
  avatarUrl?: string;
  reputationScore: number;
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  totalVolume: number;
  isVerified: boolean;
  rank?: number;
}

interface LeaderboardProps {
  sortBy?: 'reputation' | 'profit' | 'volume' | 'winRate';
  limit?: number;
  showRankings?: boolean;
  className?: string;
}

export function Leaderboard({ 
  sortBy = 'reputation', 
  limit = 50, 
  showRankings = true,
  className = '' 
}: LeaderboardProps) {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState(sortBy);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedSort, limit]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/social/leaderboard?sortBy=${selectedSort}&limit=${limit}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch leaderboard');
      }

      // Add rank to users
      const usersWithRank = data.data.map((user: LeaderboardUser, index: number) => ({
        ...user,
        rank: index + 1
      }));

      setUsers(usersWithRank);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const formatVolume = (volume: number) => {
    // Volume is in lamports, convert to SOL
    const sol = volume / 1000000000;
    if (sol >= 1000) {
      return `${(sol / 1000).toFixed(1)}K SOL`;
    }
    return `${sol.toFixed(2)} SOL`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
    }
  };

  const getSortIcon = (sort: string) => {
    switch (sort) {
      case 'reputation':
        return <Star className="w-4 h-4" />;
      case 'profit':
        return <DollarSign className="w-4 h-4" />;
      case 'volume':
        return <TrendingUp className="w-4 h-4" />;
      case 'winRate':
        return <Target className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getSortLabel = (sort: string) => {
    switch (sort) {
      case 'reputation':
        return 'Reputation';
      case 'profit':
        return 'Total Profit';
      case 'volume':
        return 'Trading Volume';
      case 'winRate':
        return 'Win Rate';
      default:
        return 'Reputation';
    }
  };

  const getSortValue = (user: LeaderboardUser, sort: string) => {
    switch (sort) {
      case 'reputation':
        return user.reputationScore.toLocaleString();
      case 'profit':
        return formatCurrency(user.totalProfit);
      case 'volume':
        return formatVolume(user.totalVolume);
      case 'winRate':
        return `${user.winRate.toFixed(1)}%`;
      default:
        return user.reputationScore.toLocaleString();
    }
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${className}`}>
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Leaderboard
          </h2>
        </div>

        {/* Sort Options */}
        <div className="flex flex-wrap gap-2">
          {(['reputation', 'profit', 'volume', 'winRate'] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSelectedSort(sort)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSort === sort
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {getSortIcon(sort)}
              {getSortLabel(sort)}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Users Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Be the first to start trading and appear on the leaderboard!
            </p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.walletAddress}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  {showRankings && (
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(user.rank || 0)}
                    </div>
                  )}

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.username || 'User'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">
                        {(user.username || user.walletAddress).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* User Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {user.username || formatWalletAddress(user.walletAddress)}
                      </span>
                      {user.isVerified && (
                        <Star className="w-4 h-4 text-blue-500 fill-current" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {user.totalTrades} trades • {user.winRate.toFixed(1)}% win rate
                    </div>
                  </div>
                </div>

                {/* Primary Metric */}
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {getSortValue(user, selectedSort)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {getSortLabel(selectedSort)}
                  </div>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Reputation:</span>
                  <span className="ml-1 font-medium text-gray-900 dark:text-white">
                    {user.reputationScore.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Profit:</span>
                  <span className={`ml-1 font-medium ${
                    user.totalProfit >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(user.totalProfit)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Volume:</span>
                  <span className="ml-1 font-medium text-gray-900 dark:text-white">
                    {formatVolume(user.totalVolume)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}