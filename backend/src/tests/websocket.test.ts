import WebSocket from 'ws';
import { WebSocketService } from '../services/WebSocketService';
import { MarketDataService } from '../services/MarketDataService';

describe('WebSocket Service', () => {
  let webSocketService: WebSocketService;
  let mockMarketDataService: jest.Mocked<MarketDataService>;
  let wsPort: number;

  beforeAll(() => {
    wsPort = 8081; // Use different port for testing
    
    // Mock MarketDataService
    mockMarketDataService = {
      getMarketData: jest.fn(),
      broadcastTradeEvent: jest.fn(),
      getWebSocketStats: jest.fn(),
      shutdown: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    webSocketService = new WebSocketService(wsPort, mockMarketDataService);
  });

  afterAll(async () => {
    await webSocketService.shutdown();
  });

  describe('Connection Management', () => {
    test('should accept WebSocket connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should send welcome message on connection', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          expect(message.data).toHaveProperty('clientId');
          expect(message.data).toHaveProperty('serverTime');
          expect(message.data).toHaveProperty('supportedMessageTypes');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Market Subscriptions', () => {
    test('should handle market subscription', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      const marketId = 'test-market-123';
      
      mockMarketDataService.getMarketData.mockResolvedValue({
        marketId,
        programAccount: 'test-account',
        prices: [
          {
            marketId,
            outcomeIndex: 0,
            price: 0.65,
            volume24h: 1000,
            priceChange24h: 0.05,
            timestamp: Date.now()
          }
        ],
        totalVolume: 1000,
        traderCount: 10,
        volatility: 0.1,
        trendScore: 0.8,
        lastUpdated: Date.now()
      });

      let messagesReceived = 0;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messagesReceived++;
        
        if (message.type === 'connection_established') {
          // Send subscription request
          ws.send(JSON.stringify({
            type: 'subscribe',
            marketId: marketId
          }));
        } else if (message.type === 'subscription_confirmed') {
          expect(message.marketId).toBe(marketId);
          expect(message.data).toHaveProperty('subscriptionKey');
        } else if (message.type === 'market_data') {
          expect(message.marketId).toBe(marketId);
          expect(message.data).toHaveProperty('prices');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should handle market unsubscription', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      const marketId = 'test-market-456';
      
      mockMarketDataService.getMarketData.mockResolvedValue({
        marketId,
        programAccount: 'test-account',
        prices: [],
        totalVolume: 0,
        traderCount: 0,
        volatility: 0,
        trendScore: 0,
        lastUpdated: Date.now()
      });

      let subscribed = false;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          // Subscribe first
          ws.send(JSON.stringify({
            type: 'subscribe',
            marketId: marketId
          }));
        } else if (message.type === 'subscription_confirmed' && !subscribed) {
          subscribed = true;
          // Now unsubscribe
          ws.send(JSON.stringify({
            type: 'unsubscribe',
            marketId: marketId
          }));
        } else if (message.type === 'unsubscription_confirmed') {
          expect(message.marketId).toBe(marketId);
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Ping/Pong Heartbeat', () => {
    test('should respond to ping messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      const clientTime = Date.now();
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          // Send ping
          ws.send(JSON.stringify({
            type: 'ping',
            data: { clientTime }
          }));
        } else if (message.type === 'pong') {
          expect(message.data).toHaveProperty('serverTime');
          expect(message.data.clientTime).toBe(clientTime);
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          // Send invalid JSON
          ws.send('invalid json');
        } else if (message.type === 'error') {
          expect(message.data.code).toBe('INVALID_JSON');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should handle unknown message types', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          // Send unknown message type
          ws.send(JSON.stringify({
            type: 'unknown_type',
            data: {}
          }));
        } else if (message.type === 'error') {
          expect(message.data.code).toBe('UNKNOWN_MESSAGE_TYPE');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Broadcasting', () => {
    test('should broadcast market updates to subscribers', (done) => {
      const ws1 = new WebSocket(`ws://localhost:${wsPort}`);
      const ws2 = new WebSocket(`ws://localhost:${wsPort}`);
      const marketId = 'broadcast-test-market';
      
      mockMarketDataService.getMarketData.mockResolvedValue({
        marketId,
        programAccount: 'test-account',
        prices: [],
        totalVolume: 0,
        traderCount: 0,
        volatility: 0,
        trendScore: 0,
        lastUpdated: Date.now()
      });

      let ws1Ready = false;
      let ws2Ready = false;
      let updateReceived = 0;

      const checkReady = () => {
        if (ws1Ready && ws2Ready) {
          // Both clients subscribed, now broadcast update
          const testData = { price: 0.75, volume: 500 };
          webSocketService.broadcastMarketUpdate(marketId, testData);
        }
      };

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          ws1.send(JSON.stringify({ type: 'subscribe', marketId }));
        } else if (message.type === 'subscription_confirmed') {
          ws1Ready = true;
          checkReady();
        } else if (message.type === 'market_update') {
          updateReceived++;
          if (updateReceived === 2) {
            ws1.close();
            ws2.close();
            done();
          }
        }
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          ws2.send(JSON.stringify({ type: 'subscribe', marketId }));
        } else if (message.type === 'subscription_confirmed') {
          ws2Ready = true;
          checkReady();
        } else if (message.type === 'market_update') {
          updateReceived++;
          if (updateReceived === 2) {
            ws1.close();
            ws2.close();
            done();
          }
        }
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });
  });
});