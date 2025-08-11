'use client';

import { Achievement } from '@/types/user';
import { SocialShare } from '@/components/social/SocialShare';

interface AchievementsBadgesProps {
  achievements: Achievement[];
  showAll: boolean;
}

export function AchievementsBadges({ achievements, showAll }: AchievementsBadgesProps) {
  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-orange-500';
      case 'epic': return 'from-purple-400 to-pink-500';
      case 'rare': return 'from-blue-400 to-cyan-500';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityIcon = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary': return '👑';
      case 'epic': return '💎';
      case 'rare': return '⭐';
      default: return '🏅';
    }
  };

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'first_trade': return '🎯';
      case 'trader_10': return '📈';
      case 'trader_100': return '🚀';
      case 'profitable': return '💰';
      case 'high_roller': return '🎰';
      case 'accurate_predictor': return '🔮';
      case 'social_butterfly': return '🦋';
      case 'market_maker': return '🏭';
      case 'early_adopter': return '🌟';
      case 'streak_master': return '🔥';
      default: return '🏆';
    }
  };

  if (achievements.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-2">🏆</div>
        <p>No achievements yet</p>
        <p className="text-sm mt-1">Start trading to earn your first badge!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Achievement Grid */}
      <div className={`grid gap-4 ${showAll ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`relative group cursor-pointer transition-all duration-300 hover:scale-105 ${
              showAll ? 'p-4' : 'p-3'
            }`}
          >
            {/* Achievement Card */}
            <div className={`bg-gradient-to-br ${getRarityColor(achievement.rarity)} p-0.5 rounded-lg`}>
              <div className="bg-gray-800 rounded-lg p-4 h-full">
                <div className="flex flex-col items-center text-center space-y-2">
                  {/* Icon */}
                  <div className="relative">
                    <div className="text-3xl">
                      {achievement.iconUrl ? (
                        <img 
                          src={achievement.iconUrl} 
                          alt={achievement.achievementName}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        getAchievementIcon(achievement.achievementType)
                      )}
                    </div>
                    <div className="absolute -top-1 -right-1 text-sm">
                      {getRarityIcon(achievement.rarity)}
                    </div>
                  </div>

                  {/* Name */}
                  <h4 className="font-bold text-sm text-white">
                    {achievement.achievementName}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-gray-400 leading-tight">
                    {achievement.description}
                  </p>

                  {/* Date */}
                  <p className="text-xs text-gray-500">
                    {new Date(achievement.earnedAt).toLocaleDateString()}
                  </p>

                  {/* Rarity Badge */}
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getRarityColor(achievement.rarity)} text-white`}>
                    {achievement.rarity}
                  </div>

                  {/* Share Button */}
                  {showAll && (
                    <div className="mt-2">
                      <SocialShare
                        content={{
                          type: 'achievement',
                          title: `Achievement Unlocked: ${achievement.achievementName}`,
                          description: achievement.description,
                          metadata: {
                            achievementName: achievement.achievementName
                          }
                        }}
                        size="sm"
                        showLabel={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
              <div className="font-medium">{achievement.achievementName}</div>
              <div className="text-gray-400 text-xs">{achievement.description}</div>
              {achievement.metadata && Object.keys(achievement.metadata).length > 0 && (
                <div className="text-gray-500 text-xs mt-1">
                  {Object.entries(achievement.metadata).map(([key, value]) => (
                    <div key={key}>
                      {key}: {typeof value === 'number' ? value.toLocaleString() : value}
                    </div>
                  ))}
                </div>
              )}
              {/* Arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Achievement Stats */}
      {showAll && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-bold mb-3">Achievement Progress</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-1">🏆</div>
              <div className="font-bold text-white">{achievements.length}</div>
              <div className="text-gray-400">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">👑</div>
              <div className="font-bold text-yellow-400">
                {achievements.filter(a => a.rarity === 'legendary').length}
              </div>
              <div className="text-gray-400">Legendary</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">💎</div>
              <div className="font-bold text-purple-400">
                {achievements.filter(a => a.rarity === 'epic').length}
              </div>
              <div className="text-gray-400">Epic</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">⭐</div>
              <div className="font-bold text-blue-400">
                {achievements.filter(a => a.rarity === 'rare').length}
              </div>
              <div className="text-gray-400">Rare</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}