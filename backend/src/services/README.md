# Market Data Service

This directory contains the implementation of the real-time market data service for PredictionPump, which provides WebSocket-based price feeds, historical data storage, and trending algorithms.

## Services Overview

### MarketDataService
The core service that provides real-time market data and WebSocket functionality.

**Features:**
- WebSocket server for real-time price updates
- Market data caching with Redis
- Price feed subscriptions and broadcasting
- Chart data generation
- Integration with blockchain events

**WebSocket API:**
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080');

// Subscribe to market updates
ws.send(JSON.stringify({
  type: 'subscribe',
  marketId: 'market_123'
}));

// Get current market data
ws.send(JSON.stringify({
  type: 'get_market_data',
  marketId: 'market_123'
}));

// Unsubscribe from market
ws.send(JSON.stringify({
  type: 'unsubscribe',
  marketId: 'market_123'
}));
```

### BlockchainEventListener
Listens to Solana program events and processes trade/market events in real-time.

**Features:**
- Program account change monitoring
- Transaction log parsing
- Event extraction and processing
- Real-time data synchronization

**Event Types:**
- `tradeEvent`: Buy/sell transactions
- `marketEvent`: Market creation, settlement, disputes

### TrendingAlgorithm
Calculates trending scores for markets based on multiple factors.

**Scoring Factors:**
- **Volume Score (30%)**: 24h trading volume relative to market size
- **Volatility Score (25%)**: Price movement and trading activity
- **Momentum Score (25%)**: Recent price trends and acceleration
- **Social Score (20%)**: Trader count and engagement metrics

**Methods:**
- `calculateTrendingScore()`: Calculate metrics for a single market
- `rankMarkets()`: Sort markets by trending score
- `getPumpingMarkets()`: Find high-momentum markets
- `updateWeights()`: Adjust algorithm parameters

### DatabaseService
Handles historical data storage and retrieval from PostgreSQL.

**Features:**
- Trade event storage
- Market statistics calculation
- Historical chart data generation
- User trading history
- Trending market queries

## API Endpoints

### Market Data Routes (`/api/v1/market-data`)

#### GET `/:marketId`
Get real-time market data for a specific market.

**Response:**
```json
{
  "success": true,
  "data": {
    "marketId": "market_123",
    "programAccount": "program_account_key",
    "prices": [
      {
        "marketId": "market_123",
        "outcomeIndex": 0,
        "price": 0.65,
        "volume24h": 1000,
        "priceChange24h": 0.05,
        "timestamp": 1691234567890
      }
    ],
    "totalVolume": 1800,
    "traderCount": 25,
    "volatility": 0.15,
    "trendScore": 0.75,
    "lastUpdated": 1691234567890,
    "trendingMetrics": {
      "volumeScore": 0.8,
      "volatilityScore": 0.6,
      "momentumScore": 0.7,
      "socialScore": 0.5,
      "overallTrendScore": 0.75
    }
  }
}
```

#### GET `/:marketId/chart`
Get chart data for market visualization.

**Query Parameters:**
- `outcomeIndex`: Outcome to get chart for (default: 0)
- `timeframe`: Time range (1h, 24h, 7d, 30d)

#### GET `/:marketId/trades`
Get recent trades for a market.

**Query Parameters:**
- `limit`: Number of trades to return (default: 50)
- `offset`: Pagination offset (default: 0)

#### GET `/trending`
Get trending markets ranked by algorithm.

**Query Parameters:**
- `limit`: Number of markets to return (default: 10)

#### GET `/pumping`
Get markets that are "pumping now" (high momentum + volatility).

**Query Parameters:**
- `threshold`: Minimum trend score threshold (default: 0.7)

#### GET `/overview`
Get platform-wide statistics.

## Configuration

### Environment Variables
```bash
# Server Configuration
PORT=3001
WS_PORT=8080

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/prediction_pump

# Redis
REDIS_URL=redis://localhost:6379

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=YourProgramIdHere
```

### Algorithm Weights
The trending algorithm weights can be adjusted via API:

```bash
POST /api/v1/market-data/algorithm/weights
{
  "volumeWeight": 0.3,
  "volatilityWeight": 0.25,
  "momentumWeight": 0.25,
  "socialWeight": 0.2
}
```

## Usage Example

```typescript
import { MarketDataService } from './services/MarketDataService';
import { TrendingAlgorithm } from './services/TrendingAlgorithm';
import { DatabaseService } from './services/DatabaseService';

// Initialize services
const marketDataService = new MarketDataService(
  'https://api.devnet.solana.com',
  'redis://localhost:6379',
  8080
);

const trendingAlgorithm = new TrendingAlgorithm();
const databaseService = new DatabaseService('postgresql://...');

// Initialize all services
await marketDataService.initialize();
await databaseService.initialize();

// Get trending markets
const trending = await marketDataService.getTrendingMarkets(10);
const ranked = trendingAlgorithm.rankMarkets(trending);

console.log('Top trending markets:', ranked.slice(0, 5));
```

## Testing

Run the test suite:
```bash
npm test -- --testPathPattern=marketData.test.ts
```

The tests cover:
- Trending algorithm calculations
- Market ranking logic
- Pumping market detection
- Algorithm weight updates
- Service integration

## Performance Considerations

1. **Caching**: Market data is cached in Redis with 5-second TTL
2. **WebSocket Scaling**: Each market maintains its own subscriber set
3. **Database Indexing**: Proper indexes on trades table for performance
4. **Rate Limiting**: Consider implementing rate limiting for API endpoints
5. **Connection Pooling**: PostgreSQL connection pool configured for 20 connections

## Monitoring

The service includes comprehensive logging:
- Winston logger with JSON format
- Separate log files for different services
- Error tracking and performance metrics
- Health check endpoint at `/health`

## Future Enhancements

1. **Horizontal Scaling**: Add Redis pub/sub for multi-instance WebSocket
2. **Advanced Analytics**: More sophisticated trending algorithms
3. **Oracle Integration**: Real oracle data for market settlement
4. **Performance Optimization**: Query optimization and caching strategies
5. **Monitoring**: Add Prometheus metrics and Grafana dashboards