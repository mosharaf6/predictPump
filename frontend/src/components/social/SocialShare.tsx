'use client';

import React, { useState } from 'react';
import { Share2, Twitter, Facebook, Link, Copy, Trophy, TrendingUp, MessageCircle } from 'lucide-react';

export interface ShareableContent {
  type: 'prediction' | 'achievement' | 'trade' | 'market';
  title: string;
  description: string;
  url?: string;
  imageUrl?: string;
  metadata?: {
    marketTitle?: string;
    outcome?: string;
    amount?: number;
    achievementName?: string;
    winRate?: number;
    profit?: number;
  };
}

interface SocialShareProps {
  content: ShareableContent;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SocialShare({ 
  content, 
  className = '', 
  showLabel = true,
  size = 'md' 
}: SocialShareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    return content.url || window.location.href;
  };

  const getShareText = () => {
    const baseText = `${content.title} - ${content.description}`;
    
    switch (content.type) {
      case 'prediction':
        return `🔮 ${baseText} on ${content.metadata?.marketTitle} - ${content.metadata?.outcome}! Check it out on PredictionPump 🚀`;
      
      case 'achievement':
        return `🏆 Just earned "${content.metadata?.achievementName}" on PredictionPump! ${baseText} 🎉`;
      
      case 'trade':
        return `💰 ${baseText} - Traded ${content.metadata?.amount} SOL on "${content.metadata?.marketTitle}"! Join me on PredictionPump 📈`;
      
      case 'market':
        return `🎯 ${baseText} - What do you think will happen? Trade on PredictionPump! 🔥`;
      
      default:
        return `${baseText} - Check it out on PredictionPump!`;
    }
  };

  const getHashtags = () => {
    const baseTags = ['PredictionPump', 'PredictionMarkets', 'Solana'];
    
    switch (content.type) {
      case 'prediction':
        return [...baseTags, 'Predictions', 'Trading'].join(',');
      case 'achievement':
        return [...baseTags, 'Achievement', 'Milestone'].join(',');
      case 'trade':
        return [...baseTags, 'Trading', 'Crypto'].join(',');
      case 'market':
        return [...baseTags, 'Markets', 'Betting'].join(',');
      default:
        return baseTags.join(',');
    }
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(getShareText());
    const url = encodeURIComponent(getShareUrl());
    const hashtags = encodeURIComponent(getHashtags());
    
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=${hashtags}`,
      '_blank',
      'width=550,height=420'
    );
  };

  const shareToFacebook = () => {
    const url = encodeURIComponent(getShareUrl());
    const quote = encodeURIComponent(getShareText());
    
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`,
      '_blank',
      'width=550,height=420'
    );
  };

  const copyToClipboard = async () => {
    try {
      const shareText = `${getShareText()}\n\n${getShareUrl()}`;
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const shareNatively = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: content.title,
          text: getShareText(),
          url: getShareUrl()
        });
      } catch (err) {
        console.error('Native sharing failed:', err);
      }
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'sm':
        return 'p-1.5';
      case 'lg':
        return 'p-3';
      default:
        return 'p-2';
    }
  };

  const getContentIcon = () => {
    switch (content.type) {
      case 'prediction':
        return <MessageCircle className={getIconSize()} />;
      case 'achievement':
        return <Trophy className={getIconSize()} />;
      case 'trade':
        return <TrendingUp className={getIconSize()} />;
      default:
        return <Share2 className={getIconSize()} />;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${getButtonSize()}`}
        title="Share"
      >
        {getContentIcon()}
        {showLabel && size !== 'sm' && (
          <span className="text-sm font-medium">Share</span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Share Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            <div className="p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                {getContentIcon()}
                Share {content.type}
              </h4>
              
              <div className="space-y-2">
                {/* Native Share (if supported) */}
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    onClick={shareNatively}
                    className="w-full flex items-center gap-3 p-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share...
                  </button>
                )}

                {/* Twitter */}
                <button
                  onClick={shareToTwitter}
                  className="w-full flex items-center gap-3 p-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Twitter className="w-4 h-4 text-blue-500" />
                  Share on Twitter
                </button>

                {/* Facebook */}
                <button
                  onClick={shareToFacebook}
                  className="w-full flex items-center gap-3 p-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Facebook className="w-4 h-4 text-blue-600" />
                  Share on Facebook
                </button>

                {/* Copy Link */}
                <button
                  onClick={copyToClipboard}
                  className="w-full flex items-center gap-3 p-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Copy className="w-4 h-4 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>

              {/* Preview */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Preview:</div>
                <div className="text-sm text-gray-900 dark:text-white line-clamp-3">
                  {getShareText()}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Utility component for quick sharing buttons
interface QuickShareProps {
  content: ShareableContent;
  className?: string;
}

export function QuickShare({ content, className = '' }: QuickShareProps) {
  const [copied, setCopied] = useState(false);

  const shareToTwitter = () => {
    const text = encodeURIComponent(`${content.title} - ${content.description}`);
    const url = encodeURIComponent(content.url || window.location.href);
    
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'width=550,height=420'
    );
  };

  const copyToClipboard = async () => {
    try {
      const shareText = `${content.title} - ${content.description}\n\n${content.url || window.location.href}`;
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={shareToTwitter}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        title="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
      </button>
      
      <button
        onClick={copyToClipboard}
        className={`p-2 rounded-lg transition-colors ${
          copied
            ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title={copied ? 'Copied!' : 'Copy link'}
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}