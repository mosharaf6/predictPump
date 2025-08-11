'use client';

import React, { useState, useEffect } from 'react';
import { Market, MarketFilters, MarketSortOptions, PaginationOptions } from '@/types/market';
import { MockMarketService } from '@/services/mockMarketService';
import { MarketCard } from './MarketCard';
import { MarketFiltersComponent } from './MarketFilters';
import { Loader, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface MarketListProps {
  onMarketClick?: (market: Market) => void;
}

export function MarketList({ onMarketClick }: MarketListProps) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarketFilters>({});
  const [sort, setSort] = useState<MarketSortOptions>({
    field: 'volume',
    direction: 'desc'
  });
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    limit: 12,
    total: 0
  });

  const loadMarkets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await MockMarketService.getMarkets(
        filters,
        sort,
        pagination.page,
        pagination.limit
      );
      
      setMarkets(result.markets);
      setPagination(prev => ({ ...prev, total: result.total }));
    } catch (err) {
      setError('Failed to load markets. Please try again.');
      console.error('Error loading markets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarkets();
  }, [filters, sort, pagination.page]);

  const handleFiltersChange = (newFilters: MarketFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleSortChange = (newSort: MarketSortOptions) => {
    setSort(newSort);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleClearFilters = () => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil((pagination.total || 0) / pagination.limit);

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Error Loading Markets
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadMarkets}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters */}
      <MarketFiltersComponent
        filters={filters}
        sort={sort}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        onClearFilters={handleClearFilters}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center">
            <Loader className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Loading markets...</p>
          </div>
        </div>
      )}

      {/* Markets Grid - Mobile optimized */}
      {!loading && markets.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {markets.map(market => (
              <MarketCard
                key={market.id}
                market={market}
                onClick={onMarketClick}
              />
            ))}
          </div>

          {/* Mobile-optimized Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total || 0)} of{' '}
                {pagination.total} markets
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-touch tap-highlight-none"
                >
                  <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Previous</span>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(window.innerWidth < 640 ? 3 : 5, totalPages) }, (_, i) => {
                    let pageNum;
                    const maxPages = window.innerWidth < 640 ? 3 : 5;
                    if (totalPages <= maxPages) {
                      pageNum = i + 1;
                    } else if (pagination.page <= Math.floor(maxPages / 2) + 1) {
                      pageNum = i + 1;
                    } else if (pagination.page >= totalPages - Math.floor(maxPages / 2)) {
                      pageNum = totalPages - maxPages + 1 + i;
                    } else {
                      pageNum = pagination.page - Math.floor(maxPages / 2) + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-md transition-colors btn-touch tap-highlight-none ${
                          pageNum === pagination.page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                  className="flex items-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-touch tap-highlight-none"
                >
                  <span className="hidden xs:inline">Next</span>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && markets.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Markets Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try adjusting your filters to see more markets.
          </p>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}