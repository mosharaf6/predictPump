import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  describe('Basic Rendering', () => {
    it('renders spinner element', () => {
      render(<LoadingSpinner />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('has default size when no size prop provided', () => {
      render(<LoadingSpinner />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('w-8', 'h-8');
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(<LoadingSpinner size="sm" />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('w-4', 'h-4');
    });

    it('renders medium size correctly', () => {
      render(<LoadingSpinner size="md" />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('w-8', 'h-8');
    });

    it('renders large size correctly', () => {
      render(<LoadingSpinner size="lg" />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('w-12', 'h-12');
    });
  });

  describe('Color Variants', () => {
    it('has default color when no color prop provided', () => {
      render(<LoadingSpinner />);
      
      const svg = document.querySelector('svg');
      expect(svg).toHaveClass('text-blue-500');
    });
  });

  describe('Custom Props', () => {
    it('applies custom className to container', () => {
      render(<LoadingSpinner className="custom-class" />);
      
      const container = document.querySelector('.flex.items-center.justify-center');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Animation', () => {
    it('has spin animation class', () => {
      render(<LoadingSpinner />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('animate-spin');
    });
  });

  describe('Animation', () => {
    it('has spin animation class', () => {
      render(<LoadingSpinner />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('animate-spin');
    });
  });
});