/**
 * Format a number with appropriate suffixes (K, M, B)
 */
export function formatNumber(num: number): string {
  if (num === 0) return '0';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1e9) {
    return sign + (absNum / 1e9).toFixed(1) + 'B';
  }
  if (absNum >= 1e6) {
    return sign + (absNum / 1e6).toFixed(1) + 'M';
  }
  if (absNum >= 1e3) {
    return sign + (absNum / 1e3).toFixed(1) + 'K';
  }
  
  return sign + absNum.toLocaleString();
}

/**
 * Format SOL amount (lamports to SOL)
 */
export function formatSOL(lamports: number): string {
  const sol = lamports / 1e9;
  
  if (sol === 0) return '0 SOL';
  
  if (Math.abs(sol) >= 1000) {
    return formatNumber(sol) + ' SOL';
  }
  
  if (Math.abs(sol) >= 1) {
    return sol.toFixed(2) + ' SOL';
  }
  
  if (Math.abs(sol) >= 0.01) {
    return sol.toFixed(3) + ' SOL';
  }
  
  return sol.toFixed(6) + ' SOL';
}

/**
 * Format percentage
 */
export function formatPercent(percent: number): string {
  if (percent === 0) return '0%';
  
  if (Math.abs(percent) >= 100) {
    return percent.toFixed(0) + '%';
  }
  
  if (Math.abs(percent) >= 10) {
    return percent.toFixed(1) + '%';
  }
  
  return percent.toFixed(2) + '%';
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate Solana address
 */
export function truncateAddress(address: string, startChars: number = 4, endChars: number = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format time ago
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

/**
 * Format currency with appropriate precision
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount < 1 ? 4 : 2,
    maximumFractionDigits: amount < 1 ? 6 : 2,
  }).format(amount);
}

/**
 * Format large numbers with full precision when needed
 */
export function formatPreciseNumber(num: number, maxDecimals: number = 6): string {
  if (num === 0) return '0';
  
  // For very small numbers, show more precision
  if (Math.abs(num) < 0.000001) {
    return num.toExponential(2);
  }
  
  // For small numbers, show appropriate decimals
  if (Math.abs(num) < 1) {
    const decimals = Math.min(maxDecimals, 6);
    return parseFloat(num.toFixed(decimals)).toString();
  }
  
  // For larger numbers, use standard formatting
  return formatNumber(num);
}

/**
 * Format market cap or volume
 */
export function formatMarketCap(value: number): string {
  if (value === 0) return '$0';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1e12) {
    return sign + '$' + (absValue / 1e12).toFixed(2) + 'T';
  }
  if (absValue >= 1e9) {
    return sign + '$' + (absValue / 1e9).toFixed(2) + 'B';
  }
  if (absValue >= 1e6) {
    return sign + '$' + (absValue / 1e6).toFixed(2) + 'M';
  }
  if (absValue >= 1e3) {
    return sign + '$' + (absValue / 1e3).toFixed(2) + 'K';
  }
  
  return sign + '$' + absValue.toFixed(2);
}