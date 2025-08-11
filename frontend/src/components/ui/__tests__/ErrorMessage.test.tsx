import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorMessage } from '../ErrorMessage';

describe('ErrorMessage', () => {
  const defaultProps = {
    message: 'Test error message',
  };

  describe('Basic Rendering', () => {
    it('renders error message', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders error icon', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('renders fixed title', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('has proper error styling', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      const container = screen.getByText('Test error message').closest('div');
      expect(container).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'p-8', 'text-center');
    });
  });

  describe('Message Display', () => {
    it('displays the provided message', () => {
      render(<ErrorMessage message="Custom error message" />);
      
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('displays the fixed title', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('renders retry button when onRetry provided', () => {
      const mockRetry = jest.fn();
      render(<ErrorMessage {...defaultProps} onRetry={mockRetry} />);
      
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('calls onRetry when retry button clicked', () => {
      const mockRetry = jest.fn();
      render(<ErrorMessage {...defaultProps} onRetry={mockRetry} />);
      
      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);
      
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render retry button when onRetry not provided', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });
  });

  describe('Button Styling', () => {
    it('applies proper button styling', () => {
      const mockRetry = jest.fn();
      render(<ErrorMessage {...defaultProps} onRetry={mockRetry} />);
      
      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toHaveClass('px-4', 'py-2', 'bg-blue-600', 'hover:bg-blue-700', 'text-white', 'rounded-lg');
    });
  });

  describe('Text Styling', () => {
    it('applies proper text styling', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      const title = screen.getByText('Something went wrong');
      expect(title).toHaveClass('text-lg', 'font-semibold', 'text-white', 'mb-2');
      
      const message = screen.getByText('Test error message');
      expect(message).toHaveClass('text-gray-400', 'mb-4', 'max-w-md');
    });
  });

  describe('Container Styling', () => {
    it('applies proper container padding', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      const container = screen.getByText('Test error message').closest('div');
      expect(container).toHaveClass('p-8');
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      render(<ErrorMessage {...defaultProps} className="custom-error" />);
      
      const container = screen.getByText('Test error message').closest('div');
      expect(container).toHaveClass('custom-error');
    });
  });

  describe('Message Types', () => {
    it('handles string messages', () => {
      render(<ErrorMessage message="String error message" />);
      
      expect(screen.getByText('String error message')).toBeInTheDocument();
    });

    it('handles empty messages', () => {
      render(<ErrorMessage message="" />);
      
      // Should still render the component structure
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper button accessibility for retry', () => {
      const mockRetry = jest.fn();
      render(<ErrorMessage {...defaultProps} onRetry={mockRetry} />);
      
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      expect(retryButton).toBeInTheDocument();
    });

    it('has semantic heading structure', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Something went wrong');
    });
  });

  describe('Icon Display', () => {
    it('displays warning emoji icon', () => {
      render(<ErrorMessage {...defaultProps} />);
      
      const icon = screen.getByText('⚠️');
      expect(icon).toHaveClass('text-red-400', 'text-4xl', 'mb-4');
    });
  });
});