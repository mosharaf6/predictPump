'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserTrade } from '@/types/user';
import { formatNumber, formatSOL, truncateText, truncateAddress } from '@/utils/format';

interface TradeHistoryProps {
  trades: UserTrade[];
  showAll: boolean;
}

type SortField = 'timestamp' | 'totalCost' | 'tokenAmount' | 'price';
type SortDirection = 'asc' | 'desc';

export function TradeHistory({ trades, showAll }: TradeHistoryProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedTrades = trades
    .filter(trade => {
      if (filter === 'all') return true;
      return trade.tradeType === filter;
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'timestamp') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
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

  const getTradeTypeColor = (type: 'buy' | 'sell') => {
    return type === 'buy' ? 'text-green-400' : 'text-red-400';
  };

  const getTradeTypeIcon = (type: 'buy' | 'sell') => {
    return type === 'buy' ? '📈' : '📉';
  };

  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No trades found</p>
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
              { key: 'buy', label: 'Buys' },
              { key: 'sell', label: 'Sells' }
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
            {filteredAndSortedTrades.length} trade{filteredAndSortedTrades.length !== 1 ? 's' : ''}
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
                onClick={() => handleSort('timestamp')}
              >
                <div className="flex items-center gap-1">
                  Time
                  <SortIcon field="timestamp" />
                </div>
              </th>
              <th className="text-left py-3 px-2">Market</th>
              <th className="text-center py-3 px-2">Type</th>
              <th className="text-left py-3 px-2">Outcome</th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('tokenAmount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Amount
                  <SortIcon field="tokenAmount" />
                </div>
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center justify-end gap-1">
                  Price
                  <SortIcon field="price" />
                </div>
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('totalCost')}
              >
                <div className="flex items-center justify-end gap-1">
                  Total
                  <SortIcon field="totalCost" />
                </div>
              </th>
              <th className="text-right py-3 px-2">Fee</th>
              {showAll && <th className="text-center py-3 px-2">Tx</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTrades.map((trade) => (
              <tr key={trade.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="py-3 px-2 text-gray-400 text-xs">
                  <div>
                    {new Date(trade.timestamp).toLocaleDateString()}
                  </div>
                  <div>
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <Link 
                    href={`/markets/${trade.marketId}`}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {truncateText(trade.marketTitle, 30)}
                  </Link>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>{getTradeTypeIcon(trade.tradeType)}</span>
                    <span className={`font-medium capitalize ${getTradeTypeColor(trade.tradeType)}`}>
                      {trade.tradeType}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-700 text-white">
                    {trade.outcomeName}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  {formatNumber(trade.tokenAmount)}
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  {formatSOL(trade.price)}
                </td>
                <td className={`py-3 px-2 text-right font-mono font-bold ${getTradeTypeColor(trade.tradeType)}`}>
                  {formatSOL(trade.totalCost)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-gray-400">
                  {formatSOL(trade.fee)}
                </td>
                {showAll && (
                  <td className="py-3 px-2 text-center">
                    <a
                      href={`https://explorer.solana.com/tx/${trade.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors text-xs"
                      title={trade.signature}
                    >
                      {truncateAddress(trade.signature)}
                    </a>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedTrades.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p>No trades match the current filter</p>
        </div>
      )}
    </div>
  );
}