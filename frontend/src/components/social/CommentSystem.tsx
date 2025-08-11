'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Heart, Reply, Flag, Send, Star, Clock } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useWallet } from '@/hooks/useWallet';

export interface Comment {
  id: string;
  marketId: string;
  userWallet: string;
  content: string;
  likesCount: number;
  replyCount: number;
  parentCommentId?: string;
  isFlagged: boolean;
  isHidden: boolean;
  createdAt: Date;
  user?: {
    walletAddress: string;
    username?: string;
    avatarUrl?: string;
    reputationScore: number;
    isVerified: boolean;
  };
  replies?: Comment[];
  isLiked?: boolean;
}

interface CommentSystemProps {
  marketId: string;
  marketTitle: string;
  className?: string;
}

export function CommentSystem({ marketId, marketTitle, className = '' }: CommentSystemProps) {
  const { wallet, publicKey } = useWallet();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [marketId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/social/markets/${marketId}/comments?includeReplies=true`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch comments');
      }

      setComments(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (content: string, parentCommentId?: string) => {
    if (!publicKey || !content.trim()) return;

    try {
      setSubmitting(true);

      const response = await fetch(`/api/v1/social/markets/${marketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicKey?.toString()}` // In real app, use proper auth
        },
        body: JSON.stringify({
          content: content.trim(),
          parentCommentId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post comment');
      }

      // Refresh comments to show the new one
      await fetchComments();

      // Clear form
      if (parentCommentId) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (commentId: string) => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/v1/social/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicKey?.toString()}` // In real app, use proper auth
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to toggle like');
      }

      // Update local state
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            isLiked: data.data.isLiked,
            likesCount: comment.likesCount + (data.data.isLiked ? 1 : -1)
          };
        }
        // Also check replies
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(reply => {
              if (reply.id === commentId) {
                return {
                  ...reply,
                  isLiked: data.data.isLiked,
                  likesCount: reply.likesCount + (data.data.isLiked ? 1 : -1)
                };
              }
              return reply;
            })
          };
        }
        return comment;
      }));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => {
    return (
      <div key={comment.id} className={`${isReply ? 'ml-12 mt-4' : 'mb-6'}`}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            {comment.user?.avatarUrl ? (
              <img
                src={comment.user.avatarUrl}
                alt={comment.user.username || 'User'}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-xs">
                {(comment.user?.username || comment.userWallet).charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 dark:text-white text-sm">
                {comment.user?.username || formatWalletAddress(comment.userWallet)}
              </span>
              {comment.user?.isVerified && (
                <Star className="w-3 h-3 text-blue-500 fill-current" />
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(comment.createdAt)}
              </span>
              {comment.user?.reputationScore && (
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {comment.user.reputationScore} rep
                </span>
              )}
            </div>

            {/* Content */}
            <p className="text-gray-900 dark:text-white text-sm mb-3 whitespace-pre-wrap">
              {comment.content}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={() => toggleLike(comment.id)}
                disabled={!publicKey}
                className={`flex items-center gap-1 transition-colors ${
                  comment.isLiked
                    ? 'text-red-600 hover:text-red-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-red-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Heart className={`w-3 h-3 ${comment.isLiked ? 'fill-current' : ''}`} />
                {comment.likesCount}
              </button>

              {!isReply && (
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  disabled={!publicKey}
                  className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
              )}

              <button className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors">
                <Flag className="w-3 h-3" />
                Report
              </button>
            </div>

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                  rows={2}
                  maxLength={1000}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {replyText.length}/1000
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                      className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => submitComment(replyText, comment.id)}
                      disabled={!replyText.trim() || submitting}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Posting...' : 'Reply'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Discussion ({comments.length})
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Share your thoughts on "{marketTitle}"
        </p>
      </div>

      {/* New Comment Form */}
      {publicKey ? (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">
                {publicKey?.toString().charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts on this market..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                rows={3}
                maxLength={1000}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {newComment.length}/1000
                </span>
                <button
                  onClick={() => submitComment(newComment)}
                  disabled={!newComment.trim() || submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to join the discussion
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <ErrorMessage message={error} />
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No comments yet
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Be the first to share your thoughts on this market!
            </p>
          </div>
        ) : (
          <div>
            {comments.map(comment => renderComment(comment))}
          </div>
        )}
      </div>
    </div>
  );
}