import { Market, MarketStatus, MarketCategory, MarketFilters, MarketSortOptions } from '@/types/market';

// Mock market data for development
const mockMarkets: Market[] = [
  {
    id: '1',
    programAccount: '11111111111111111111111111111111',
    creator: '22222222222222222222222222222222',
    title: 'Will Bitcoin reach $100,000 by end of 2024?',
    description: 'Prediction market for Bitcoin price reaching $100,000 USD by December 31, 2024.',
    category: MarketCategory.CRYPTO,
    resolutionDate: new Date('2024-12-31'),
    createdAt: new Date('2024-01-15'),
    totalVolume: 125000,
    traderCount: 342,
    status: MarketStatus.ACTIVE,
    outcomes: [
      { index: 0, name: 'Yes', tokenMint: 'yes1111111111111111111111111111111', currentPrice: 0.65, totalSupply: 50000, holders: 180 },
      { index: 1, name: 'No', tokenMint: 'no11111111111111111111111111111111', currentPrice: 0.35, totalSupply: 30000, holders: 162 }
    ],
    currentPrices: [0.65, 0.35],
    priceChange24h: [0.05, -0.05],
    volatility: 0.12,
    trending: true,
    featured: true,
  },
  {
    id: '2',
    programAccount: '33333333333333333333333333333333',
    creator: '44444444444444444444444444444444',
    title: 'Who will win the 2024 NBA Championship?',
    description: 'Prediction market for the 2024 NBA Championship winner.',
    category: MarketCategory.SPORTS,
    resolutionDate: new Date('2024-06-30'),
    createdAt: new Date('2024-02-01'),
    totalVolume: 89000,
    traderCount: 256,
    status: MarketStatus.ACTIVE,
    outcomes: [
      { index: 0, name: 'Lakers', tokenMint: 'lak1111111111111111111111111111111', currentPrice: 0.25, totalSupply: 20000, holders: 85 },
      { index: 1, name: 'Celtics', tokenMint: 'cel1111111111111111111111111111111', currentPrice: 0.30, totalSupply: 25000, holders: 92 },
      { index: 2, name: 'Warriors', tokenMint: 'war1111111111111111111111111111111', currentPrice: 0.20, totalSupply: 18000, holders: 79 },
      { index: 3, name: 'Other', tokenMint: 'oth1111111111111111111111111111111', currentPrice: 0.25, totalSupply: 22000, holders: 88 }
    ],
    currentPrices: [0.25, 0.30, 0.20, 0.25],
    priceChange24h: [0.02, -0.01, 0.03, -0.04],
    volatility: 0.08,
    trending: false,
    featured: false,
  },
  {
    id: '3',
    programAccount: '55555555555555555555555555555555',
    creator: '66666666666666666666666666666666',
    title: 'Will AI achieve AGI by 2030?',
    description: 'Will artificial general intelligence be achieved by any organization before 2030?',
    category: MarketCategory.TECHNOLOGY,
    resolutionDate: new Date('2030-01-01'),
    createdAt: new Date('2024-03-10'),
    totalVolume: 67000,
    traderCount: 189,
    status: MarketStatus.ACTIVE,
    outcomes: [
      { index: 0, name: 'Yes', tokenMint: 'agi1111111111111111111111111111111', currentPrice: 0.42, totalSupply: 35000, holders: 95 },
      { index: 1, name: 'No', tokenMint: 'nag1111111111111111111111111111111', currentPrice: 0.58, totalSupply: 45000, holders: 94 }
    ],
    currentPrices: [0.42, 0.58],
    priceChange24h: [0.08, -0.08],
    volatility: 0.15,
    trending: true,
    featured: false,
  },
  {
    id: '4',
    programAccount: '77777777777777777777777777777777',
    creator: '88888888888888888888888888888888',
    title: 'US Presidential Election 2024',
    description: 'Who will win the 2024 United States Presidential Election?',
    category: MarketCategory.POLITICS,
    resolutionDate: new Date('2024-11-05'),
    createdAt: new Date('2024-01-01'),
    totalVolume: 234000,
    traderCount: 567,
    status: MarketStatus.ACTIVE,
    outcomes: [
      { index: 0, name: 'Democrat', tokenMint: 'dem1111111111111111111111111111111', currentPrice: 0.52, totalSupply: 60000, holders: 285 },
      { index: 1, name: 'Republican', tokenMint: 'rep1111111111111111111111111111111', currentPrice: 0.48, totalSupply: 55000, holders: 282 }
    ],
    currentPrices: [0.52, 0.48],
    priceChange24h: [-0.02, 0.02],
    volatility: 0.06,
    trending: true,
    featured: true,
  },
  {
    id: '5',
    programAccount: '99999999999999999999999999999999',
    creator: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    title: 'Will it rain in NYC tomorrow?',
    description: 'Weather prediction for rainfall in New York City tomorrow.',
    category: MarketCategory.WEATHER,
    resolutionDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    createdAt: new Date(),
    totalVolume: 12000,
    traderCount: 45,
    status: MarketStatus.ACTIVE,
    outcomes: [
      { index: 0, name: 'Rain', tokenMint: 'rai1111111111111111111111111111111', currentPrice: 0.73, totalSupply: 8000, holders: 28 },
      { index: 1, name: 'No Rain', tokenMint: 'nor1111111111111111111111111111111', currentPrice: 0.27, totalSupply: 3000, holders: 17 }
    ],
    currentPrices: [0.73, 0.27],
    priceChange24h: [0.15, -0.15],
    volatility: 0.22,
    trending: false,
    featured: false,
  },
];

export class MockMarketService {
  static async getMarkets(
    filters?: MarketFilters,
    sort?: MarketSortOptions,
    page: number = 1,
    limit: number = 20
  ): Promise<{ markets: Market[]; total: number }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredMarkets = [...mockMarkets];

    // Apply filters
    if (filters) {
      if (filters.category) {
        filteredMarkets = filteredMarkets.filter(m => m.category === filters.category);
      }
      if (filters.status) {
        filteredMarkets = filteredMarkets.filter(m => m.status === filters.status);
      }
      if (filters.trending !== undefined) {
        filteredMarkets = filteredMarkets.filter(m => m.trending === filters.trending);
      }
      if (filters.featured !== undefined) {
        filteredMarkets = filteredMarkets.filter(m => m.featured === filters.featured);
      }
      if (filters.minVolume !== undefined) {
        filteredMarkets = filteredMarkets.filter(m => m.totalVolume >= filters.minVolume!);
      }
      if (filters.maxVolume !== undefined) {
        filteredMarkets = filteredMarkets.filter(m => m.totalVolume <= filters.maxVolume!);
      }
      if (filters.timeRange) {
        const now = new Date();
        const cutoff = new Date();
        switch (filters.timeRange) {
          case 'day':
            cutoff.setDate(now.getDate() - 1);
            break;
          case 'week':
            cutoff.setDate(now.getDate() - 7);
            break;
          case 'month':
            cutoff.setMonth(now.getMonth() - 1);
            break;
        }
        if (filters.timeRange !== 'all') {
          filteredMarkets = filteredMarkets.filter(m => m.createdAt >= cutoff);
        }
      }
    }

    // Apply sorting
    if (sort) {
      filteredMarkets.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        switch (sort.field) {
          case 'volume':
            aValue = a.totalVolume;
            bValue = b.totalVolume;
            break;
          case 'activity':
            aValue = a.traderCount;
            bValue = b.traderCount;
            break;
          case 'created':
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
            break;
          case 'resolution':
            aValue = a.resolutionDate.getTime();
            bValue = b.resolutionDate.getTime();
            break;
          case 'volatility':
            aValue = a.volatility;
            bValue = b.volatility;
            break;
          case 'traders':
            aValue = a.traderCount;
            bValue = b.traderCount;
            break;
          default:
            aValue = a.totalVolume;
            bValue = b.totalVolume;
        }

        return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMarkets = filteredMarkets.slice(startIndex, endIndex);

    return {
      markets: paginatedMarkets,
      total: filteredMarkets.length,
    };
  }

  static async getTrendingMarkets(limit: number = 10): Promise<Market[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockMarkets
      .filter(m => m.trending)
      .sort((a, b) => b.volatility - a.volatility)
      .slice(0, limit);
  }

  static async getFeaturedMarkets(limit: number = 5): Promise<Market[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockMarkets
      .filter(m => m.featured)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);
  }
}