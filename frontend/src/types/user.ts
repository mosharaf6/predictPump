export interface UserProfile {
  walletAddress: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  reputationScore: number;
  totalTrades: number;
  winRate: number;
  followersCount: number;
  followingCount: number;
  totalProfit: number;
  totalVolume: number;
  achievementsCount: number;
  isVerified: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPosition {
  id: string;
  marketId: string;
  marketTitle: string;
  outcomeIndex: number;
  outcomeName: string;
  tokenAmount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  createdAt: Date;
  marketStatus: string;
  marketResolutionDate: Date;
}

export interface UserTrade {
  id: string;
  marketId: string;
  marketTitle: string;
  tradeType: 'buy' | 'sell';
  outcomeIndex: number;
  outcomeName: string;
  tokenAmount: number;
  price: number;
  totalCost: number;
  fee: number;
  timestamp: Date;
  blockHash: string;
  signature: string;
}

export interface Achievement {
  id: string;
  achievementType: string;
  achievementName: string;
  description: string;
  earnedAt: Date;
  metadata: Record<string, any>;
  iconUrl?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserStats {
  totalTrades: number;
  totalVolume: number;
  totalProfit: number;
  winRate: number;
  averageTradeSize: number;
  bestTrade: number;
  worstTrade: number;
  activePositions: number;
  settledPositions: number;
  reputationScore: number;
  reputationRank: number;
  profitRank: number;
  volumeRank: number;
  winRateRank: number;
}

export interface PortfolioValue {
  timestamp: Date;
  totalValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface UserPerformanceMetrics {
  dailyPnl: PortfolioValue[];
  weeklyPnl: PortfolioValue[];
  monthlyPnl: PortfolioValue[];
  allTimePnl: PortfolioValue[];
  bestPerformingMarkets: {
    marketId: string;
    marketTitle: string;
    profit: number;
    profitPercent: number;
  }[];
  worstPerformingMarkets: {
    marketId: string;
    marketTitle: string;
    loss: number;
    lossPercent: number;
  }[];
}