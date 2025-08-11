'use client';

import React from 'react';
import { MarketFilters, MarketCategory, MarketStatus, MarketSortOptions } from '@/types/market';
import { Filter, SortAsc, SortDesc, X } from 'lucide-react';

interface MarketFiltersProps {
  filters: MarketFilters;
  sort: MarketSortOptions;
  onFiltersChange: (filters: MarketFilters) => void;
  onSortChange: (sort: MarketSortOptions) => void;
  onClearFilters: () => void;
}

export function MarketFiltersComponent({ 
  filters, 
  sort, 
  onFiltersChange, 
  onSortChange, 
  onClearFilters 
}: MarketFiltersProps) {
  const categories = Object.values(MarketCategory);
  const statuses = Object.values(MarketStatus);
  const timeRanges = [
    { value: 'all', label: 'All Time' },
    { value: 'day', label: 'Last 24h' },
    { value: 'week', label: 'Last Week' },
    { value: 'month', label: 'Last Month' },
  ];
  
  const sortFields = [
    { value: 'volume', label: 'Volume' },
    { value: 'activity', label: 'Activity' },
    { value: 'created', label: 'Created' },
    { value: 'resolution', label: 'Resolution' },
    { value: 'volatility', label: 'Volatility' },
    { value: 'traders', label: 'Traders' },
  ];

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof MarketFilters];
    return value !== undefined && value !== 'all';
  });

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Filters & Sorting
          </h3>
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <select
            value={filters.category || ''}
            onChange={(e) => onFiltersChange({
              ...filters,
              category: e.target.value ? e.target.value as MarketCategory : undefined
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => onFiltersChange({
              ...filters,
              status: e.target.value ? e.target.value as MarketStatus : undefined
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            {statuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Time Range Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Time Range
          </label>
          <select
            value={filters.timeRange || 'all'}
            onChange={(e) => onFiltersChange({
              ...filters,
              timeRange: e.target.value as 'day' | 'week' | 'month' | 'all'
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {timeRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sort By
          </label>
          <div className="flex gap-2">
            <select
              value={sort.field}
              onChange={(e) => onSortChange({
                ...sort,
                field: e.target.value as MarketSortOptions['field']
              })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortFields.map(field => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => onSortChange({
                ...sort,
                direction: sort.direction === 'asc' ? 'desc' : 'asc'
              })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title={`Sort ${sort.direction === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sort.direction === 'asc' ? (
                <SortAsc className="w-4 h-4" />
              ) : (
                <SortDesc className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Special Filters */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.trending || false}
            onChange={(e) => onFiltersChange({
              ...filters,
              trending: e.target.checked ? true : undefined
            })}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Trending Only</span>
        </label>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.featured || false}
            onChange={(e) => onFiltersChange({
              ...filters,
              featured: e.target.checked ? true : undefined
            })}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Featured Only</span>
        </label>
      </div>
    </div>
  );
}