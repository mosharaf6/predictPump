'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Leaderboard } from '@/components/social/Leaderboard';
import { SocialFeed } from '@/components/social/SocialFeed';
import { Trophy, TrendingUp, Users, Star } from 'lucide-react';

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'feed'>('leaderboard');

  const tabs = [
    {
      id: 'leaderboard' as const,
      name: 'Leaderboard',
      icon: Trophy,
      description: 'Top traders and predictors'
    },
    {
      id: 'feed' as const,
      name: 'Social Feed',
      icon: Users,
      description: 'Latest community activity'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Community Hub
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Discover top traders and connect with the PredictionPump community
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">1,247</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active Traders</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">$2.4M</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Volume</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">73.2%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Win Rate</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">156</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Achievements</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'leaderboard' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Main Leaderboard */}
              <div className="xl:col-span-2">
                <Leaderboard />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Top Achievers */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Recent Achievements
                  </h3>
                  <div className="space-y-4">
                    {[
                      { user: 'CryptoMaster', achievement: 'Oracle', time: '2h ago' },
                      { user: 'TradeWiz', achievement: 'High Roller', time: '4h ago' },
                      { user: 'PredictorPro', achievement: 'Veteran Trader', time: '6h ago' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{item.user}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{item.achievement}</div>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{item.time}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Stats
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Markets Today</span>
                      <span className="font-medium text-gray-900 dark:text-white">23</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Volume 24h</span>
                      <span className="font-medium text-gray-900 dark:text-white">$127K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">New Users</span>
                      <span className="font-medium text-gray-900 dark:text-white">45</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Active Now</span>
                      <span className="font-medium text-green-600 dark:text-green-400">89</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Social Feed */}
              <div className="xl:col-span-2">
                <SocialFeed />
              </div>

              {/* Trending Users */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Trending Users
                  </h3>
                  <div className="space-y-4">
                    {[
                      { user: 'MarketMaven', followers: '1.2K', change: '+12%' },
                      { user: 'CryptoSage', followers: '987', change: '+8%' },
                      { user: 'PredictorX', followers: '756', change: '+15%' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {item.user.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{item.user}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{item.followers} followers</div>
                          </div>
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400">{item.change}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Popular Topics */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Popular Topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {['#Bitcoin', '#Elections2024', '#AI', '#Sports', '#Crypto', '#Tech'].map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}