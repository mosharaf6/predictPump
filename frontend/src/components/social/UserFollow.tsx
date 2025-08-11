'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Users, Star, TrendingUp } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

interface UserFollowProps {
  targetWallet: string;
  targetUsername?: string;
  targetAvatarUrl?: string;
  isVerified?: boolean;
  showStats?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserFollow({ 
  targetWallet, 
  targetUsername,
  targetAvatarUrl,
  isVerified = false,
  showStats = false,
  size = 'md',
  className = '' 
}: UserFollowProps) {
  const { wallet, publicKey } = useWallet();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (publicKey && targetWallet) {
      checkFollowStatus();
      if (showStats) {
        fetchUserStats();
      }
    }
  }, [publicKey, targetWallet]);

  const checkFollowStatus = async () => {
    if (!publicKey) return;

    try {
      // Mock check - in real implementation, this would be an API call
      // For now, we'll assume not following
      setIsFollowing(false);
    } catch (err) {
      console.error('Failed to check follow status:', err);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`/api/v1/social/users/${targetWallet}`);
      const data = await response.json();

      if (response.ok) {
        setFollowersCount(data.data.followersCount || 0);
        setFollowingCount(data.data.followingCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    }
  };

  const toggleFollow = async () => {
    if (!publicKey || targetWallet === publicKey.toString()) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/v1/social/users/${targetWallet}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicKey?.toString()}` // In real app, use proper auth
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to toggle follow');
      }

      setIsFollowing(data.data.isFollowing);
      
      // Update followers count
      setFollowersCount(prev => prev + (data.data.isFollowing ? 1 : -1));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle follow');
    } finally {
      setLoading(false);
    }
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getButtonSize = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-4 h-4';
    }
  };

  // Don't show follow button for own profile
  if (publicKey?.toString() === targetWallet) {
    return showStats ? (
      <div className={`flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{followersCount} followers</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          <span>{followingCount} following</span>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* User Info (if showing stats) */}
      {showStats && (
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            {targetAvatarUrl ? (
              <img
                src={targetAvatarUrl}
                alt={targetUsername || 'User'}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-sm">
                {(targetUsername || targetWallet).charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name and Stats */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                {targetUsername || formatWalletAddress(targetWallet)}
              </span>
              {isVerified && (
                <Star className="w-4 h-4 text-blue-500 fill-current" />
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{followersCount} followers</span>
              <span>{followingCount} following</span>
            </div>
          </div>
        </div>
      )}

      {/* Follow Button */}
      {publicKey ? (
        <button
          onClick={toggleFollow}
          disabled={loading}
          className={`flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getButtonSize()} ${
            isFollowing
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${getIconSize()}`} />
          ) : isFollowing ? (
            <UserMinus className={getIconSize()} />
          ) : (
            <UserPlus className={getIconSize()} />
          )}
          {loading ? 'Loading...' : isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      ) : (
        <div className={`text-gray-500 dark:text-gray-400 text-sm ${getButtonSize()}`}>
          Connect wallet to follow
        </div>
      )}
    </div>
  );
}

// Component for displaying follower/following lists
interface UserListProps {
  users: Array<{
    walletAddress: string;
    username?: string;
    avatarUrl?: string;
    isVerified: boolean;
    reputationScore: number;
    totalTrades: number;
  }>;
  title: string;
  emptyMessage: string;
  className?: string;
}

export function UserList({ users, title, emptyMessage, className = '' }: UserListProps) {
  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5" />
          {title} ({users.length})
        </h3>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{emptyMessage}</p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.walletAddress} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
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
                      {user.reputationScore} reputation • {user.totalTrades} trades
                    </div>
                  </div>
                </div>

                {/* Follow Button */}
                <UserFollow
                  targetWallet={user.walletAddress}
                  targetUsername={user.username}
                  targetAvatarUrl={user.avatarUrl}
                  isVerified={user.isVerified}
                  size="sm"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}