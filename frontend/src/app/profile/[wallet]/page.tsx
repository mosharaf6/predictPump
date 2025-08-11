'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { UserProfile, UserStats, UserPosition, UserTrade, Achievement, PortfolioValue } from '@/types/user';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { PortfolioChart } from '@/components/profile/PortfolioChart';
import { PositionsTable } from '@/components/profile/PositionsTable';
import { TradeHistory } from '@/components/profile/TradeHistory';
import { AchievementsBadges } from '@/components/profile/AchievementsBadges';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface ProfileData {
  profile: UserProfile;
  stats: UserStats;
  positions: UserPosition[];
  recentTrades: UserTrade[];
  achievements: Achievement[];
  portfolioHistory: PortfolioValue[];
}

export default function ProfilePage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const walletAddress = params.wallet as string;
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'history' | 'achievements'>('overview');

  const isOwnProfile = publicKey?.toString() === walletAddress;

  useEffect(() => {
    fetchProfileData();
  }, [walletAddress]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/${walletAddress}/profile`);
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }

      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <ErrorMessage message={error || 'Profile not found'} />
      </div>
    );
  }

  const { profile, stats, positions, recentTrades, achievements, portfolioHistory } = profileData;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <ProfileHeader 
          profile={profile} 
          isOwnProfile={isOwnProfile}
          onProfileUpdate={fetchProfileData}
        />

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 mb-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'positions', label: `Positions (${positions.length})` },
            { key: 'history', label: 'Trade History' },
            { key: 'achievements', label: `Achievements (${achievements.length})` }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <ProfileStats stats={stats} />
            
            {/* Portfolio Chart */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Portfolio Performance</h3>
              <PortfolioChart data={portfolioHistory} />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">Active Positions</h3>
                <PositionsTable 
                  positions={positions.filter(p => p.marketStatus === 'active').slice(0, 5)} 
                  showAll={false}
                />
                {positions.filter(p => p.marketStatus === 'active').length > 5 && (
                  <button
                    onClick={() => setActiveTab('positions')}
                    className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View all positions →
                  </button>
                )}
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">Recent Trades</h3>
                <TradeHistory trades={recentTrades.slice(0, 5)} showAll={false} />
                {recentTrades.length > 5 && (
                  <button
                    onClick={() => setActiveTab('history')}
                    className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View all trades →
                  </button>
                )}
              </div>
            </div>

            {/* Recent Achievements */}
            {achievements.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">Recent Achievements</h3>
                <AchievementsBadges 
                  achievements={achievements.slice(0, 6)} 
                  showAll={false}
                />
                {achievements.length > 6 && (
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View all achievements →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">All Positions</h3>
            <PositionsTable positions={positions} showAll={true} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Trade History</h3>
            <TradeHistory trades={recentTrades} showAll={true} />
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">All Achievements</h3>
            <AchievementsBadges achievements={achievements} showAll={true} />
          </div>
        )}
      </div>
    </div>
  );
}