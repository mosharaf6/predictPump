'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserPosition } from '@/types/user';
import { formatNumber, formatSOL, formatPercent, truncateText } from '@/utils/format';

interface PositionsTableProps {
  positions: UserPosition[];
  showAll: boolean;
}

type SortField = 'marketTitle' | 'unrealizedPnl' | 'unrealizedPnlPercent' | 'tokenAmount' | 'createdAt' | 'marketResolutionDate';
type SortDirection = 'asc' | 'desc';

export function PositionsTable({ positions, showAll }: PositionsTableProps) {
  const [sortField, setSortField] = useState<SortField>('unrealizedPnl');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<'all' | 'active' | 'settled'>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedPositions = positions
    .filter(position => {
      if (filter === 'all') return true;
      if (filter === 'active') return position.marketStatus === 'active';
      if (filter === 'settled') return position.marketStatus === 'settled';
      return true;
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'createdAt' || sortField === 'marketResolutionDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-500">↕️</span>;
    }
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'settled': return 'text-gray-400';
      case 'settling': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-400';
    if (pnl < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No positions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showAll && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-gray-700 rounded-lg p-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'settled', label: 'Settled' }
            ].map((filterOption) => (
              <button
                key={filterOption.key}
                onClick={() => setFilter(filterOption.key as any)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filter === filterOption.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

          <div className="text-sm text-gray-400">
            {filteredAndSortedPositions.length} position{filteredAndSortedPositions.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th 
                className="text-left py-3 px-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('marketTitle')}
              >
                <div className="flex items-center gap-1">
                  Market
                  <SortIcon field="marketTitle" />
                </div>
              </th>
              <th className="text-left py-3 px-2">Outcome</th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('tokenAmount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Position
                  <SortIcon field="tokenAmount" />
                </div>
              </th>
              <th className="text-right py-3 px-2">Entry Price</th>
              <th className="text-right py-3 px-2">Current Price</th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('unrealizedPnl')}
              >
                <div className="flex items-center justify-end gap-1">
                  P&L
                  <SortIcon field="unrealizedPnl" />
                </div>
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('unrealizedPnlPercent')}
              >
                <div className="flex items-center justify-end gap-1">
                  P&L %
                  <SortIcon field="unrealizedPnlPercent" />
                </div>
              </th>
              <th className="text-center py-3 px-2">Status</th>
              {showAll && (
                <th 
                  className="text-right py-3 px-2 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Date
                    <SortIcon field="createdAt" />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPositions.map((position) => (
              <tr key={position.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="py-3 px-2">
                  <Link 
                    href={`/markets/${position.marketId}`}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {truncateText(position.marketTitle, 40)}
                  </Link>
                </td>
                <td className="py-3 px-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-700 text-white">
                    {position.outcomeName}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  {formatNumber(position.tokenAmount)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-gray-400">
                  {formatSOL(position.entryPrice)}
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  {formatSOL(position.currentPrice)}
                </td>
                <td className={`py-3 px-2 text-right font-mono font-bold ${getPnlColor(position.unrealizedPnl)}`}>
                  {position.unrealizedPnl >= 0 ? '+' : ''}{formatSOL(position.unrealizedPnl)}
                </td>
                <td className={`py-3 px-2 text-right font-mono font-bold ${getPnlColor(position.unrealizedPnlPercent)}`}>
                  {position.unrealizedPnlPercent >= 0 ? '+' : ''}{formatPercent(position.unrealizedPnlPercent)}
                </td>
                <td className="py-3 px-2 text-center">
                  <span className={`capitalize ${getStatusColor(position.marketStatus)}`}>
                    {position.marketStatus}
                  </span>
                </td>
                {showAll && (
                  <td className="py-3 px-2 text-right text-gray-400 text-xs">
                    {new Date(position.createdAt).toLocaleDateString()}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedPositions.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p>No positions match the current filter</p>
        </div>
      )}
    </div>
  );
}