'use client';

import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, TrendingUp, Trophy, Star, Clock, Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useWallet } from '@/hooks/useWallet';

export interface SocialFeedItem {
  id: string;
  type: 'trade' | 'achievement' | 'prediction' | 'follow';
  userWallet: string;
  username?: string;
  avatarUrl?: string;
  isVerified: boolean;
  timestamp: Date;
  content: {
    marketId?: string;
    marketTitle?: string;
    tradeAmount?: number;
    outcome?: string;
    achievementName?: string;
    achievementDescription?: string;
    predictionText?: string;
    followedUser?: string;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    isLiked?: boolean;
  };
}

interface SocialFeedProps {
  userWallet?: string; // If provided, shows feed for specific user
  following?: boolean; // If true, shows only followed users' activities
  className?: string;
}

export function SocialFeed({ userWallet, following = false, className = '' }: SocialFeedProps) {
  const { wallet, publicKey } = useWallet();
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchFeed(1);
  }, [userWallet, following]);

  const fetchFeed = async (pageNum: number = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        setError(null);
      }

      // Mock data for now - in real implementation, this would be an API call
      const mockFeedItems: SocialFeedItem[] = [
        {
          id: '1',
          type: 'trade',
          userWallet: 'ABC123...XYZ789',
          username: 'CryptoTrader',
          avatarUrl: undefined,
          isVerified: true,
          timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
          content: {
            marketId: 'market-1',
            marketTitle: 'Will Bitcoin reach $100K by end of 2024?',
            tradeAmount: 50,
            outcome: 'Yes'
          },
          engagement: {
            likes: 12,
            comments: 3,
            shares: 2,
            isLiked: false
          }
        },
        {
          id: '2',
          type: 'achievement',
          userWallet: 'DEF456...ABC123',
          username: 'PredictionMaster',
          avatarUrl: undefined,
          isVerified: false,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          content: {
            achievementName: 'Oracle',
            achievementDescription: 'Achieved 70% win rate with 20+ trades'
          },
          engagement: {
            likes: 25,
            comments: 8,
            shares: 5,
            isLiked: true
          }
        },
        {
          id: '3',
          type: 'prediction',
          userWallet: 'GHI789...DEF456',
          username: 'MarketAnalyst',
          avatarUrl: undefined,
          isVerified: true,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
          content: {
            marketId: 'market-2',
            marketTitle: 'Will Tesla stock hit $300 this quarter?',
            predictionText: 'Strong bullish signals with upcoming earnings. Going all in on YES! 🚀'
          },
          engagement: {
            likes: 18,
            comments: 12,
            shares: 7,
            isLiked: false
          }
        }
      ];

      if (pageNum === 1) {
        setFeedItems(mockFeedItems);
      } else {
        setFeedItems(prev => [...prev, ...mockFeedItems]);
      }

      setHasMore(pageNum < 3); // Mock pagination
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load social feed');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (itemId: string) => {
    if (!publicKey) return;

    try {
      // Mock like toggle
      setFeedItems(prev => prev.map(item => {
        if (item.id === itemId) {
          const isLiked = !item.engagement.isLiked;
          return {
            ...item,
            engagement: {
              ...item.engagement,
              isLiked,
              likes: item.engagement.likes + (isLiked ? 1 : -1)
            }
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleShare = async (item: SocialFeedItem) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'PredictionPump Activity',
          text: getShareText(item),
          url: window.location.href
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(getShareText(item));
        alert('Copied to clipboard!');
      }
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  const getShareText = (item: SocialFeedItem) => {
    switch (item.type) {
      case 'trade':
        return `${item.username || 'User'} just traded ${item.content.tradeAmount} SOL on "${item.content.marketTitle}" - ${item.content.outcome}!`;
      case 'achievement':
        return `${item.username || 'User'} earned the "${item.content.achievementName}" achievement: ${item.content.achievementDescription}`;
      case 'prediction':
        return `${item.username || 'User'} made a prediction on "${item.content.marketTitle}": ${item.content.predictionText}`;
      default:
        return `Check out this activity on PredictionPump!`;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'trade':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'achievement':
        return <Trophy className="w-5 h-5 text-yellow-600" />;
      case 'prediction':
        return <MessageCircle className="w-5 h-5 text-blue-600" />;
      case 'follow':
        return <Users className="w-5 h-5 text-purple-600" />;
      default:
        return <Star className="w-5 h-5 text-gray-600" />;
    }
  };

  const renderFeedItem = (item: SocialFeedItem) => {
    return (
      <div key={item.id} className="p-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt={item.username || 'User'}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-sm">
                {(item.username || item.userWallet).charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                {item.username || formatWalletAddress(item.userWallet)}
              </span>
              {item.isVerified && (
                <Star className="w-4 h-4 text-blue-500 fill-current" />
              )}
              {getActivityIcon(item.type)}
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(item.timestamp)}
              </span>
            </div>

            {/* Content */}
            <div className="mb-4">
              {item.type === 'trade' && (
                <div>
                  <p className="text-gray-900 dark:text-white mb-2">
                    Traded <span className="font-bold text-green-600">{item.content.tradeAmount} SOL</span> on{' '}
                    <span className="font-semibold">"{item.content.marketTitle}"</span> - {item.content.outcome}
                  </p>
                </div>
              )}

              {item.type === 'achievement' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="font-bold text-yellow-800 dark:text-yellow-200">
                      {item.content.achievementName}
                    </span>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    {item.content.achievementDescription}
                  </p>
                </div>
              )}

              {item.type === 'prediction' && (
                <div>
                  <p className="text-gray-900 dark:text-white mb-2">
                    Made a prediction on <span className="font-semibold">"{item.content.marketTitle}"</span>
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-blue-800 dark:text-blue-200">
                      {item.content.predictionText}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Engagement */}
            <div className="flex items-center gap-6 text-sm">
              <button
                onClick={() => handleLike(item.id)}
                className={`flex items-center gap-1 transition-colors ${
                  item.engagement.isLiked
                    ? 'text-red-600 hover:text-red-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-red-600'
                }`}
              >
                <Heart className={`w-4 h-4 ${item.engagement.isLiked ? 'fill-current' : ''}`} />
                {item.engagement.likes}
              </button>

              <button className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors">
                <MessageCircle className="w-4 h-4" />
                {item.engagement.comments}
              </button>

              <button
                onClick={() => handleShare(item)}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-green-600 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                {item.engagement.shares}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && feedItems.length === 0) {
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {following ? 'Following Feed' : userWallet ? 'User Activity' : 'Social Feed'}
        </h2>
      </div>

      {/* Feed Items */}
      <div>
        {feedItems.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Activity Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {following 
                ? 'Follow some users to see their activity here!'
                : 'Start trading and engaging to see social activity!'}
            </p>
          </div>
        ) : (
          <>
            {feedItems.map(renderFeedItem)}
            
            {/* Load More */}
            {hasMore && (
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchFeed(nextPage);
                  }}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}