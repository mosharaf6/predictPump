-- Social features extension for PredictionPump

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet VARCHAR(44) REFERENCES users(wallet_address) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    achievement_name VARCHAR(100) NOT NULL,
    description TEXT,
    earned_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- User follows table for social connections
CREATE TABLE IF NOT EXISTS user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_wallet VARCHAR(44) REFERENCES users(wallet_address) ON DELETE CASCADE,
    following_wallet VARCHAR(44) REFERENCES users(wallet_address) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_wallet, following_wallet)
);

-- Comment likes table
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_wallet VARCHAR(44) REFERENCES users(wallet_address) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(comment_id, user_wallet)
);

-- User reputation history table
CREATE TABLE IF NOT EXISTS user_reputation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet VARCHAR(44) REFERENCES users(wallet_address) ON DELETE CASCADE,
    reputation_change INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    related_market_id UUID REFERENCES markets(id),
    related_trade_id UUID REFERENCES trades(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Market predictions table for tracking user predictions
CREATE TABLE IF NOT EXISTS market_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
    user_wallet VARCHAR(44) REFERENCES users(wallet_address) ON DELETE CASCADE,
    predicted_outcome INTEGER NOT NULL,
    confidence_level INTEGER DEFAULT 50, -- 0-100
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(market_id, user_wallet)
);

-- User notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet VARCHAR(44) REFERENCES users(wallet_address) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_market_id UUID REFERENCES markets(id),
    related_user_wallet VARCHAR(44) REFERENCES users(wallet_address),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add additional fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_profit BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_volume BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NOW();

-- Add moderation fields to comments
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet ON user_achievements(user_wallet);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON user_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_wallet);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_wallet);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_wallet);
CREATE INDEX IF NOT EXISTS idx_reputation_history_wallet ON user_reputation_history(user_wallet);
CREATE INDEX IF NOT EXISTS idx_market_predictions_market ON market_predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_market_predictions_user ON market_predictions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_wallet);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON user_notifications(user_wallet, is_read);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_users_reputation ON users(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);