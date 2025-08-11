'use client';

import { useState } from 'react';
import { UserProfile } from '@/types/user';
import { formatNumber, formatSOL, truncateAddress } from '@/utils/format';
import { EditProfileModal } from './EditProfileModal';

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  onProfileUpdate: () => void;
}

export function ProfileHeader({ profile, isOwnProfile, onProfileUpdate }: ProfileHeaderProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const handleFollow = async () => {
    if (!profile.walletAddress) return;
    
    try {
      setFollowLoading(true);
      const response = await fetch(`/api/users/${profile.walletAddress}/follow`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const { isFollowing: newFollowState } = await response.json();
        setIsFollowing(newFollowState);
        onProfileUpdate();
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const getReputationColor = (score: number) => {
    if (score >= 1000) return 'text-yellow-400';
    if (score >= 500) return 'text-purple-400';
    if (score >= 100) return 'text-blue-400';
    if (score >= 0) return 'text-green-400';
    return 'text-red-400';
  };

  const getReputationBadge = (score: number) => {
    if (score >= 1000) return { label: 'Legend', color: 'bg-yellow-500' };
    if (score >= 500) return { label: 'Expert', color: 'bg-purple-500' };
    if (score >= 100) return { label: 'Skilled', color: 'bg-blue-500' };
    if (score >= 0) return { label: 'Novice', color: 'bg-green-500' };
    return { label: 'Learning', color: 'bg-red-500' };
  };

  const reputationBadge = getReputationBadge(profile.reputationScore);

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
              {profile.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.username || 'Profile'} 
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <span>{(profile.username || profile.walletAddress).charAt(0).toUpperCase()}</span>
              )}
            </div>
            {profile.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold">
                  {profile.username || truncateAddress(profile.walletAddress)}
                </h1>
                <p className="text-gray-400 text-sm">
                  {truncateAddress(profile.walletAddress)}
                </p>
              </div>

              {/* Reputation Badge */}
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${reputationBadge.color} text-white`}>
                <span className="mr-1">⭐</span>
                {reputationBadge.label}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-300 mb-4 max-w-2xl">{profile.bio}</p>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Reputation:</span>
                <span className={`font-bold ${getReputationColor(profile.reputationScore)}`}>
                  {formatNumber(profile.reputationScore)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Win Rate:</span>
                <span className="font-bold text-green-400">
                  {profile.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Total Trades:</span>
                <span className="font-bold text-blue-400">
                  {formatNumber(profile.totalTrades)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Volume:</span>
                <span className="font-bold text-purple-400">
                  {formatSOL(profile.totalVolume)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Followers:</span>
                <span className="font-bold text-white">
                  {formatNumber(profile.followersCount)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Following:</span>
                <span className="font-bold text-white">
                  {formatNumber(profile.followingCount)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {isOwnProfile ? (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Edit Profile
              </button>
            ) : (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isFollowing
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } disabled:opacity-50`}
              >
                {followLoading ? 'Loading...' : isFollowing ? 'Unfollow' : 'Follow'}
              </button>
            )}
            
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
              Share
            </button>
          </div>
        </div>

        {/* Join Date */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-gray-400 text-sm">
            Joined {new Date(profile.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
            {profile.lastActiveAt && (
              <span className="ml-4">
                Last active {new Date(profile.lastActiveAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onUpdate={onProfileUpdate}
        />
      )}
    </>
  );
}