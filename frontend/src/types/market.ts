import { PublicKey } from '@solana/web3.js';

export interface Market {
  id: string;
  programAccount: string;
  creator: string;
  title: string;
  description: string;
  category: string;
  resolutionDate: Date;
  createdAt: Date;
  totalVolume: number;
  traderCount: number;
  status: MarketStatus;
  outcomes: MarketOutcome[];
  currentPrices: number[];
  priceChange24h: number[];
  volatility: number;
  trending: boolean;
  featured: boolean;
}

export interface MarketOutcome {
  index: number;
  name: string;
  tokenMint: string;
  currentPrice: number;
  totalSupply: number;
  holders: number;
}

export enum MarketStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SETTLING = 'settling',
  SETTLED = 'settled',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum MarketCategory {
  SPORTS = 'sports',
  POLITICS = 'politics',
  CRYPTO = 'crypto',
  ENTERTAINMENT = 'entertainment',
  TECHNOLOGY = 'technology',
  ECONOMICS = 'economics',
  WEATHER = 'weather',
  OTHER = 'other',
}

export interface MarketFilters {
  category?: MarketCategory;
  status?: MarketStatus;
  timeRange?: 'day' | 'week' | 'month' | 'all';
  minVolume?: number;
  maxVolume?: number;
  trending?: boolean;
  featured?: boolean;
}

export interface MarketSortOptions {
  field: 'volume' | 'activity' | 'created' | 'resolution' | 'volatility' | 'traders';
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
  total?: number;
}