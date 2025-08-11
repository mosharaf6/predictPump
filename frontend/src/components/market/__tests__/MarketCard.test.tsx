import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MarketCard } from '../MarketCard';
import { Market, MarketStatus } from '@/types/market';

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('MarketCard', () => {
  const mockMarket: Market = {
    id: 'test-market-1',
    programAccount: 'test-program-account',
    creator: 'test-creator',
    title: 'Will Bitcoin reach $100k by end of 2024?',
    description: 'A prediction market about Bitcoin price reaching $100,000 by December 31, 2024',
    category: 'crypto',
    resolutionDate: new Date('2024-12-31'),
    createdAt: new Date('2024-01-01'),
    totalVolume: 50000,
    traderCount: 150,
    status: MarketStatus.ACTIVE,
    outcomes: [
      {
        index: 0,
        name: 'Yes',
        tokenMint: 'yes-token-mint',
        currentPrice: 0.65,
        totalSupply: 10000,
        holders: 75,
      },
      {
        index: 1,
        name: 'No',
        tokenMint: 'no-token-mint',
        currentPrice: 0.35,
        totalSupply: 8000,
        holders: 60,
      },
    ],
    currentPrices: [0.65, 0.35],
    priceChange24h: [0.05, -0.05],
    volatility: 0.15,
    trending: true,
    featured: false,
  };

  beforeEach(() => {
    mockLocation.href = '';
  });

  describe('Basic Rendering', () => {
    it('renders market title and description', () => {
      render(<MarketCard market={mockMarket} />);
      
      expect(screen.getByText(mockMarket.title)).toBeInTheDocument();
      expect(screen.getByText(mockMarket.description)).toBeInTheDocument();
    });

    it('displays market category and status badges', () => {
      render(<MarketCard market={mockMarket} />);
      
      expect(screen.getByText('Crypto')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows trending indicator when market is trending', () => {
      render(<MarketCard market={mockMarket} />);
      
      const trendingIcon = document.querySelector('.lucide-flame');
      expect(trendingIcon).toBeInTheDocument();
    });

    it('shows featured indicator when market is featured', () => {
      const featuredMarket = { ...mockMarket, featured: true };
      render(<MarketCard market={featuredMarket} />);
      
      const starIcon = document.querySelector('.lucide-star');
      expect(starIcon).toBeInTheDocument();
    });
  });

  describe('Outcome Display', () => {
    it('displays outcome names and prices', () => {
      render(<MarketCard market={mockMarket} />);
      
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
      expect(screen.getByText('$0.65')).toBeInTheDocument();
      expect(screen.getByText('$0.35')).toBeInTheDocument();
    });

    it('shows price change indicators with correct colors', () => {
      render(<MarketCard market={mockMarket} />);
      
      // Check for trending up/down icons
      const trendingUpIcon = document.querySelector('.lucide-trending-up');
      const trendingDownIcon = document.querySelector('.lucide-trending-down');
      expect(trendingUpIcon).toBeInTheDocument();
      expect(trendingDownIcon).toBeInTheDocument();
      
      // Check for percentage changes (they exist but may be hidden on small screens)
      const percentageElements = screen.getAllByText(/5\.0%/);
      expect(percentageElements.length).toBeGreaterThan(0);
    });

    it('limits displayed outcomes to 2 and shows count for additional', () => {
      const multiOutcomeMarket = {
        ...mockMarket,
        outcomes: [
          ...mockMarket.outcomes,
          {
            index: 2,
            name: 'Maybe',
            tokenMint: 'maybe-token-mint',
            currentPrice: 0.1,
            totalSupply: 1000,
            holders: 10,
          },
        ],
        currentPrices: [0.65, 0.35, 0.1],
        priceChange24h: [0.05, -0.05, 0.02],
      };

      render(<MarketCard market={multiOutcomeMarket} />);
      
      expect(screen.getByText('+1 more outcomes')).toBeInTheDocument();
    });
  });

  describe('Market Statistics', () => {
    it('displays formatted volume', () => {
      render(<MarketCard market={mockMarket} />);
      
      expect(screen.getByText('$50.0K')).toBeInTheDocument();
    });

    it('displays trader count', () => {
      render(<MarketCard market={mockMarket} />);
      
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('formats large volumes correctly', () => {
      const highVolumeMarket = { ...mockMarket, totalVolume: 1500000 };
      render(<MarketCard market={highVolumeMarket} />);
      
      expect(screen.getByText('$1.5M')).toBeInTheDocument();
    });

    it('displays small volumes without formatting', () => {
      const lowVolumeMarket = { ...mockMarket, totalVolume: 500 };
      render(<MarketCard market={lowVolumeMarket} />);
      
      expect(screen.getByText('$500')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('shows "Today" for today\'s resolution date', () => {
      const today = new Date();
      const todayMarket = { ...mockMarket, resolutionDate: today };
      render(<MarketCard market={todayMarket} />);
      
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('shows "Tomorrow" for tomorrow\'s resolution date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowMarket = { ...mockMarket, resolutionDate: tomorrow };
      render(<MarketCard market={tomorrowMarket} />);
      
      expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    });

    it('shows "Expired" for past resolution dates', () => {
      const pastDate = new Date('2023-01-01');
      const expiredMarket = { ...mockMarket, resolutionDate: pastDate };
      render(<MarketCard market={expiredMarket} />);
      
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('shows day count for near future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const futureMarket = { ...mockMarket, resolutionDate: futureDate };
      render(<MarketCard market={futureMarket} />);
      
      expect(screen.getByText('3 days')).toBeInTheDocument();
    });
  });

  describe('Status Colors', () => {
    it('applies correct color classes for active status', () => {
      render(<MarketCard market={mockMarket} />);
      
      const statusBadge = screen.getByText('Active');
      expect(statusBadge).toHaveClass('text-green-600');
    });

    it('applies correct color classes for settling status', () => {
      const settlingMarket = { ...mockMarket, status: MarketStatus.SETTLING };
      render(<MarketCard market={settlingMarket} />);
      
      const statusBadge = screen.getByText('Settling');
      expect(statusBadge).toHaveClass('text-yellow-600');
    });

    it('applies correct color classes for settled status', () => {
      const settledMarket = { ...mockMarket, status: MarketStatus.SETTLED };
      render(<MarketCard market={settledMarket} />);
      
      const statusBadge = screen.getByText('Settled');
      expect(statusBadge).toHaveClass('text-gray-600');
    });

    it('applies correct color classes for disputed status', () => {
      const disputedMarket = { ...mockMarket, status: MarketStatus.DISPUTED };
      render(<MarketCard market={disputedMarket} />);
      
      const statusBadge = screen.getByText('Disputed');
      expect(statusBadge).toHaveClass('text-red-600');
    });
  });

  describe('Category Colors', () => {
    it('applies correct color for crypto category', () => {
      render(<MarketCard market={mockMarket} />);
      
      const categoryBadge = screen.getByText('Crypto');
      expect(categoryBadge).toHaveClass('text-orange-600');
    });

    it('applies correct color for sports category', () => {
      const sportsMarket = { ...mockMarket, category: 'sports' };
      render(<MarketCard market={sportsMarket} />);
      
      const categoryBadge = screen.getByText('Sports');
      expect(categoryBadge).toHaveClass('text-blue-600');
    });
  });

  describe('User Interactions', () => {
    it('calls onClick handler when provided', () => {
      const mockOnClick = jest.fn();
      render(<MarketCard market={mockMarket} onClick={mockOnClick} />);
      
      const card = screen.getByText(mockMarket.title).closest('div');
      fireEvent.click(card!);
      
      expect(mockOnClick).toHaveBeenCalledWith(mockMarket);
    });

    it('navigates to market detail page when no onClick handler provided', () => {
      render(<MarketCard market={mockMarket} />);
      
      const card = screen.getByText(mockMarket.title).closest('div');
      fireEvent.click(card!);
      
      expect(mockLocation.href).toBe(`/markets/${mockMarket.id}`);
    });

    it('has proper cursor and hover styles', () => {
      render(<MarketCard market={mockMarket} />);
      
      const card = screen.getByText(mockMarket.title).closest('div');
      expect(card).toHaveClass('cursor-pointer');
      expect(card).toHaveClass('hover:shadow-lg');
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive classes for mobile optimization', () => {
      render(<MarketCard market={mockMarket} />);
      
      const card = screen.getByText(mockMarket.title).closest('div');
      expect(card).toHaveClass('tap-highlight-none');
      expect(card).toHaveClass('touch-manipulation');
    });

    it('has responsive padding classes', () => {
      render(<MarketCard market={mockMarket} />);
      
      const card = screen.getByText(mockMarket.title).closest('div');
      expect(card).toHaveClass('p-4');
      expect(card).toHaveClass('sm:p-6');
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<MarketCard market={mockMarket} />);
      
      // Check for heading
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toHaveTextContent(mockMarket.title);
    });

    it('provides meaningful text content for screen readers', () => {
      render(<MarketCard market={mockMarket} />);
      
      // All important information should be accessible as text
      expect(screen.getByText(mockMarket.title)).toBeInTheDocument();
      expect(screen.getByText(mockMarket.description)).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // trader count
      expect(screen.getByText('$50.0K')).toBeInTheDocument(); // volume
    });
  });
});