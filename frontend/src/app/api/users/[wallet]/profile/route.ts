import { NextRequest, NextResponse } from 'next/server';

// Mock data for development - replace with actual database calls
const mockUserProfile = {
  walletAddress: '',
  username: 'CryptoTrader',
  bio: 'Passionate about prediction markets and DeFi. Always looking for the next big opportunity!',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=crypto',
  reputationScore: 1250,
  totalTrades: 87,
  winRate: 68.5,
  followersCount: 234,
  followingCount: 156,
  totalProfit: 15750000000, // 15.75 SOL in lamports
  totalVolume: 125000000000, // 125 SOL in lamports
  achievementsCount: 12,
  isVerified: true,
  lastActiveAt: new Date(),
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date()
};

const mockUserStats = {
  totalTrades: 87,
  totalVolume: 125000000000,
  totalProfit: 15750000000,
  winRate: 68.5,
  averageTradeSize: 1437356321, // ~1.44 SOL
  bestTrade: 8500000000, // 8.5 SOL
  worstTrade: -3200000000, // -3.2 SOL
  activePositions: 12,
  settledPositions: 75,
  reputationScore: 1250,
  reputationRank: 23,
  profitRank: 15,
  volumeRank: 31,
  winRateRank: 8
};

const mockPositions = [
  {
    id: '1',
    marketId: 'market-1',
    marketTitle: 'Will Bitcoin reach $100k by end of 2024?',
    outcomeIndex: 0,
    outcomeName: 'Yes',
    tokenAmount: 150,
    entryPrice: 650000000, // 0.65 SOL
    currentPrice: 720000000, // 0.72 SOL
    unrealizedPnl: 10500000000, // 10.5 SOL
    unrealizedPnlPercent: 16.15,
    createdAt: new Date('2024-02-01'),
    marketStatus: 'active',
    marketResolutionDate: new Date('2024-12-31')
  },
  {
    id: '2',
    marketId: 'market-2',
    marketTitle: 'Will Solana price exceed $200 in Q2 2024?',
    outcomeIndex: 1,
    outcomeName: 'No',
    tokenAmount: 200,
    entryPrice: 450000000, // 0.45 SOL
    currentPrice: 380000000, // 0.38 SOL
    unrealizedPnl: -14000000000, // -14 SOL
    unrealizedPnlPercent: -15.56,
    createdAt: new Date('2024-01-20'),
    marketStatus: 'active',
    marketResolutionDate: new Date('2024-06-30')
  }
];

const mockTrades = [
  {
    id: '1',
    marketId: 'market-1',
    marketTitle: 'Will Bitcoin reach $100k by end of 2024?',
    tradeType: 'buy' as const,
    outcomeIndex: 0,
    outcomeName: 'Yes',
    tokenAmount: 150,
    price: 650000000,
    totalCost: 97500000000,
    fee: 975000000,
    timestamp: new Date('2024-02-01T10:30:00Z'),
    blockHash: 'block123',
    signature: 'sig123abc'
  },
  {
    id: '2',
    marketId: 'market-2',
    marketTitle: 'Will Solana price exceed $200 in Q2 2024?',
    tradeType: 'buy' as const,
    outcomeIndex: 1,
    outcomeName: 'No',
    tokenAmount: 200,
    price: 450000000,
    totalCost: 90000000000,
    fee: 900000000,
    timestamp: new Date('2024-01-20T14:15:00Z'),
    blockHash: 'block456',
    signature: 'sig456def'
  }
];

const mockAchievements = [
  {
    id: '1',
    achievementType: 'first_trade',
    achievementName: 'First Steps',
    description: 'Made your first trade on PredictionPump',
    earnedAt: new Date('2024-01-15T09:00:00Z'),
    metadata: { tradeAmount: 1000000000 },
    rarity: 'common' as const
  },
  {
    id: '2',
    achievementType: 'profitable',
    achievementName: 'In the Green',
    description: 'Achieved positive total profit',
    earnedAt: new Date('2024-01-25T16:45:00Z'),
    metadata: { profit: 5000000000 },
    rarity: 'rare' as const
  },
  {
    id: '3',
    achievementType: 'accurate_predictor',
    achievementName: 'Oracle',
    description: 'Achieved 70% win rate with 20+ trades',
    earnedAt: new Date('2024-02-10T11:20:00Z'),
    metadata: { winRate: 70.5, totalTrades: 25 },
    rarity: 'epic' as const
  }
];

const mockPortfolioHistory = [
  { timestamp: new Date('2024-01-15'), totalValue: 0, unrealizedPnl: 0, realizedPnl: 0 },
  { timestamp: new Date('2024-01-20'), totalValue: 5000000000, unrealizedPnl: 2000000000, realizedPnl: 3000000000 },
  { timestamp: new Date('2024-01-25'), totalValue: 8500000000, unrealizedPnl: 4000000000, realizedPnl: 4500000000 },
  { timestamp: new Date('2024-02-01'), totalValue: 12000000000, unrealizedPnl: 6500000000, realizedPnl: 5500000000 },
  { timestamp: new Date('2024-02-10'), totalValue: 15750000000, unrealizedPnl: 8750000000, realizedPnl: 7000000000 },
];

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const walletAddress = params.wallet;

    // In a real implementation, you would:
    // 1. Validate the wallet address
    // 2. Fetch user profile from database
    // 3. Calculate stats from trading history
    // 4. Get positions and trades from database
    // 5. Fetch achievements
    // 6. Generate portfolio history

    const profile = { ...mockUserProfile, walletAddress };

    return NextResponse.json({
      profile,
      stats: mockUserStats,
      positions: mockPositions,
      recentTrades: mockTrades,
      achievements: mockAchievements,
      portfolioHistory: mockPortfolioHistory
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const walletAddress = params.wallet;
    const body = await request.json();

    // In a real implementation, you would:
    // 1. Validate the wallet address and user authentication
    // 2. Validate the input data
    // 3. Update the user profile in the database
    // 4. Return the updated profile

    const { username, bio, avatarUrl } = body;

    // Mock update - in real implementation, update database
    const updatedProfile = {
      ...mockUserProfile,
      walletAddress,
      username: username || mockUserProfile.username,
      bio: bio || mockUserProfile.bio,
      avatarUrl: avatarUrl || mockUserProfile.avatarUrl,
      updatedAt: new Date()
    };

    return NextResponse.json({
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}