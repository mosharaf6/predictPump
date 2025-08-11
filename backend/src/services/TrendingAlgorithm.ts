import winston from 'winston';
import { MarketData } from './MarketDataService';

export interface TrendingMetrics {
  volumeScore: number;
  volatilityScore: number;
  momentumScore: number;
  socialScore: number;
  overallTrendScore: number;
}

export interface TrendingMarket extends MarketData {
  trendingMetrics: TrendingMetrics;
  rank: number;
}

export class TrendingAlgorithm {
  private logger: winston.Logger;
  private volumeWeight: number = 0.3;
  private volatilityWeight: number = 0.25;
  private momentumWeight: number = 0.25;
  private socialWeight: number = 0.2;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'trending-algorithm.log' })
      ]
    });
  }

  /**
   * Calculate trending score for a single market
   */
  calculateTrendingScore(marketData: MarketData, historicalData?: any): TrendingMetrics {
    try {
      const volumeScore = this.calculateVolumeScore(marketData);
      const volatilityScore = this.calculateVolatilityScore(marketData);
      const momentumScore = this.calculateMomentumScore(marketData, historicalData);
      const socialScore = this.calculateSocialScore(marketData);

      const overallTrendScore = 
        (volumeScore * this.volumeWeight) +
        (volatilityScore * this.volatilityWeight) +
        (momentumScore * this.momentumWeight) +
        (socialScore * this.socialWeight);

      return {
        volumeScore,
        volatilityScore,
        momentumScore,
        socialScore,
        overallTrendScore: Math.min(Math.max(overallTrendScore, 0), 1) // Clamp between 0 and 1
      };

    } catch (error) {
      this.logger.error(`Error calculating trending score for market ${marketData.marketId}:`, error);
      return {
        volumeScore: 0,
        volatilityScore: 0,
        momentumScore: 0,
        socialScore: 0,
        overallTrendScore: 0
      };
    }
  }

  /**
   * Calculate volume score based on 24h volume relative to market size and platform average
   */
  private calculateVolumeScore(marketData: MarketData): number {
    try {
      const volume24h = marketData.prices.reduce((sum, price) => sum + price.volume24h, 0);
      
      // Normalize volume based on market age and size
      const marketAgeHours = (Date.now() - (marketData.lastUpdated - 24 * 60 * 60 * 1000)) / (1000 * 60 * 60);
      const ageAdjustedVolume = volume24h / Math.max(marketAgeHours, 1);
      
      // Use logarithmic scaling to prevent extremely high volume markets from dominating
      const logVolume = Math.log10(ageAdjustedVolume + 1);
      
      // Normalize to 0-1 scale (assuming max log volume of 6 = 1M volume)
      return Math.min(logVolume / 6, 1);

    } catch (error) {
      this.logger.error('Error calculating volume score:', error);
      return 0;
    }
  }

  /**
   * Calculate volatility score based on price movements and trading activity
   */
  private calculateVolatilityScore(marketData: MarketData): number {
    try {
      if (marketData.prices.length === 0) return 0;

      // Calculate price volatility across all outcomes
      let totalVolatility = 0;
      let validPrices = 0;

      for (const price of marketData.prices) {
        if (Math.abs(price.priceChange24h) > 0) {
          totalVolatility += Math.abs(price.priceChange24h);
          validPrices++;
        }
      }

      if (validPrices === 0) return 0;

      const avgVolatility = totalVolatility / validPrices;
      
      // Normalize volatility (assuming max meaningful volatility of 0.5 = 50% change)
      const normalizedVolatility = Math.min(avgVolatility / 0.5, 1);
      
      // Apply curve to favor moderate volatility over extreme volatility
      return Math.pow(normalizedVolatility, 0.7);

    } catch (error) {
      this.logger.error('Error calculating volatility score:', error);
      return 0;
    }
  }

  /**
   * Calculate momentum score based on recent price trends and acceleration
   */
  private calculateMomentumScore(marketData: MarketData, historicalData?: any): number {
    try {
      if (marketData.prices.length === 0) return 0;

      // Calculate momentum based on recent price changes
      let totalMomentum = 0;
      let validPrices = 0;

      for (const price of marketData.prices) {
        if (price.priceChange24h !== 0) {
          // Favor consistent directional movement
          const momentum = Math.abs(price.priceChange24h) * Math.sign(price.priceChange24h);
          totalMomentum += momentum;
          validPrices++;
        }
      }

      if (validPrices === 0) return 0;

      const avgMomentum = totalMomentum / validPrices;
      
      // Normalize momentum (assuming max meaningful momentum of 0.3 = 30% change)
      return Math.min(Math.abs(avgMomentum) / 0.3, 1);

    } catch (error) {
      this.logger.error('Error calculating momentum score:', error);
      return 0;
    }
  }

  /**
   * Calculate social score based on trader count, comments, and engagement
   */
  private calculateSocialScore(marketData: MarketData): number {
    try {
      // Trader count component (normalized to 0-1, assuming max of 1000 traders)
      const traderScore = Math.min(marketData.traderCount / 1000, 1);
      
      // Time-based decay for social activity (newer activity weighted higher)
      const timeSinceUpdate = Date.now() - marketData.lastUpdated;
      const timeDecay = Math.exp(-timeSinceUpdate / (6 * 60 * 60 * 1000)); // 6 hour half-life
      
      // Combine trader activity with time decay
      return traderScore * timeDecay;

    } catch (error) {
      this.logger.error('Error calculating social score:', error);
      return 0;
    }
  }

  /**
   * Rank markets by trending score and return sorted list
   */
  rankMarkets(markets: MarketData[], historicalData?: Map<string, any>): TrendingMarket[] {
    try {
      const trendingMarkets: TrendingMarket[] = markets.map(market => {
        const historical = historicalData?.get(market.marketId);
        const trendingMetrics = this.calculateTrendingScore(market, historical);
        
        return {
          ...market,
          trendingMetrics,
          rank: 0 // Will be set after sorting
        };
      });

      // Sort by overall trend score (descending)
      trendingMarkets.sort((a, b) => b.trendingMetrics.overallTrendScore - a.trendingMetrics.overallTrendScore);

      // Assign ranks
      trendingMarkets.forEach((market, index) => {
        market.rank = index + 1;
      });

      this.logger.info(`Ranked ${trendingMarkets.length} markets by trending score`);
      
      return trendingMarkets;

    } catch (error) {
      this.logger.error('Error ranking markets:', error);
      return [];
    }
  }

  /**
   * Get markets that are "pumping now" - high momentum and volatility
   */
  getPumpingMarkets(markets: MarketData[], threshold: number = 0.7): TrendingMarket[] {
    try {
      const trendingMarkets = this.rankMarkets(markets);
      
      // Filter for markets with high momentum and volatility
      const pumpingMarkets = trendingMarkets.filter(market => {
        const metrics = market.trendingMetrics;
        return (
          metrics.momentumScore > threshold &&
          metrics.volatilityScore > threshold * 0.8 &&
          metrics.overallTrendScore > threshold
        );
      });

      this.logger.info(`Found ${pumpingMarkets.length} pumping markets`);
      
      return pumpingMarkets;

    } catch (error) {
      this.logger.error('Error getting pumping markets:', error);
      return [];
    }
  }

  /**
   * Update algorithm weights based on performance feedback
   */
  updateWeights(volumeWeight: number, volatilityWeight: number, momentumWeight: number, socialWeight: number): void {
    // Ensure weights sum to 1
    const totalWeight = volumeWeight + volatilityWeight + momentumWeight + socialWeight;
    
    if (Math.abs(totalWeight - 1) > 0.01) {
      this.logger.warn(`Weight sum ${totalWeight} is not 1.0, normalizing weights`);
      
      this.volumeWeight = volumeWeight / totalWeight;
      this.volatilityWeight = volatilityWeight / totalWeight;
      this.momentumWeight = momentumWeight / totalWeight;
      this.socialWeight = socialWeight / totalWeight;
    } else {
      this.volumeWeight = volumeWeight;
      this.volatilityWeight = volatilityWeight;
      this.momentumWeight = momentumWeight;
      this.socialWeight = socialWeight;
    }

    this.logger.info('Updated trending algorithm weights:', {
      volume: this.volumeWeight,
      volatility: this.volatilityWeight,
      momentum: this.momentumWeight,
      social: this.socialWeight
    });
  }

  /**
   * Get current algorithm configuration
   */
  getConfiguration(): { volumeWeight: number; volatilityWeight: number; momentumWeight: number; socialWeight: number } {
    return {
      volumeWeight: this.volumeWeight,
      volatilityWeight: this.volatilityWeight,
      momentumWeight: this.momentumWeight,
      socialWeight: this.socialWeight
    };
  }

  /**
   * Calculate market health score (separate from trending)
   */
  calculateMarketHealth(marketData: MarketData): number {
    try {
      // Factors for market health:
      // 1. Liquidity depth
      // 2. Bid-ask spread
      // 3. Trading activity consistency
      // 4. Time to resolution

      const liquidityScore = Math.min(marketData.totalVolume / 10000, 1); // Normalize to 10k volume
      const activityScore = Math.min(marketData.traderCount / 100, 1); // Normalize to 100 traders
      
      // Simple health score - could be expanded
      const healthScore = (liquidityScore * 0.6) + (activityScore * 0.4);
      
      return Math.min(Math.max(healthScore, 0), 1);

    } catch (error) {
      this.logger.error('Error calculating market health:', error);
      return 0;
    }
  }
}