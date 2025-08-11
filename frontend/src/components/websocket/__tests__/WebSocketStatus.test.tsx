import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSocketStatus } from '../WebSocketStatus';
import { useWebSocket } from '../../../stores/websocketStore';

// Mock the WebSocket store
jest.mock('../../../stores/websocketStore');

const mockUseWebSocket = useWebSocket as jest.MockedFunction<typeof useWebSocket>;

describe('WebSocketStatus', () => {
  const defaultMockState = {
    connected: false,
    connecting: false,
    reconnecting: false,
    reconnectAttempts: 0,
    lastError: null,
    connectionId: null,
    subscriptions: [],
    connect: jest.fn(),
    disconnect: jest.fn(),
    destroy: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWebSocket.mockReturnValue(defaultMockState);
  });

  describe('Basic Status Display', () => {
    test('shows disconnected status by default', () => {
      render(<WebSocketStatus />);
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    test('shows connected status when connected', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connected: true,
        connectionId: 'test-client-123'
      });

      render(<WebSocketStatus />);
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    test('shows connecting status when connecting', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connecting: true
      });

      render(<WebSocketStatus />);
      
      expect(screen.getByText('Connecting')).toBeInTheDocument();
    });

    test('shows reconnecting status with attempt count', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        reconnecting: true,
        reconnectAttempts: 3
      });

      render(<WebSocketStatus />);
      
      expect(screen.getByText('Reconnecting (3)')).toBeInTheDocument();
    });
  });

  describe('Detailed Status Display', () => {
    test('shows detailed information when showDetails is true', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connected: true,
        connectionId: 'test-client-123',
        subscriptions: ['market1:all:all', 'market2:0:price']
      });

      render(<WebSocketStatus showDetails={true} />);
      
      expect(screen.getByText('WebSocket Status')).toBeInTheDocument();
      expect(screen.getByText('Connection ID:')).toBeInTheDocument();
      expect(screen.getByText('test-client-123')).toBeInTheDocument();
      expect(screen.getByText('Subscriptions:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    test('shows error message when there is an error', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        lastError: 'Connection failed'
      });

      render(<WebSocketStatus showDetails={true} />);
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    test('shows reconnect attempts when greater than 0', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        reconnectAttempts: 2
      });

      render(<WebSocketStatus showDetails={true} />);
      
      expect(screen.getByText('Reconnect Attempts:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    test('shows active subscriptions list', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connected: true,
        subscriptions: ['market1:all:all', 'market2:0:price']
      });

      render(<WebSocketStatus showDetails={true} />);
      
      expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('market1:all:all')).toBeInTheDocument();
      expect(screen.getByText('market2:0:price')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('calls connect when reconnect button is clicked', async () => {
      const mockConnect = jest.fn().mockResolvedValue(undefined);
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connect: mockConnect
      });

      render(<WebSocketStatus showDetails={true} />);
      
      const reconnectButton = screen.getByText('Reconnect');
      fireEvent.click(reconnectButton);

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledTimes(1);
      });
    });

    test('calls disconnect when disconnect button is clicked', () => {
      const mockDisconnect = jest.fn();
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connected: true,
        disconnect: mockDisconnect
      });

      render(<WebSocketStatus showDetails={true} />);
      
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    test('shows reconnect button only when disconnected and not connecting', () => {
      render(<WebSocketStatus showDetails={true} />);
      
      expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });

    test('shows disconnect button only when connected', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connected: true
      });

      render(<WebSocketStatus showDetails={true} />);
      
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    test('does not show reconnect button when connecting', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connecting: true
      });

      render(<WebSocketStatus showDetails={true} />);
      
      expect(screen.queryByText('Reconnect')).not.toBeInTheDocument();
    });
  });

  describe('Status Colors and Icons', () => {
    test('applies correct color classes for different states', () => {
      const { rerender } = render(<WebSocketStatus />);
      
      // Disconnected state
      expect(screen.getByText('Disconnected')).toHaveClass('text-red-500');

      // Connected state
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connected: true
      });
      rerender(<WebSocketStatus />);
      expect(screen.getByText('Connected')).toHaveClass('text-green-500');

      // Connecting state
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connecting: true
      });
      rerender(<WebSocketStatus />);
      expect(screen.getByText('Connecting')).toHaveClass('text-yellow-500');
    });
  });

  describe('Error Handling', () => {
    test('handles connect error gracefully', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockUseWebSocket.mockReturnValue({
        ...defaultMockState,
        connect: mockConnect
      });

      render(<WebSocketStatus showDetails={true} />);
      
      const reconnectButton = screen.getByText('Reconnect');
      fireEvent.click(reconnectButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Manual reconnection failed:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});