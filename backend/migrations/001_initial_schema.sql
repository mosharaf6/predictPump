-- Initial database schema for PredictionPump

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_account VARCHAR(44) NOT NULL UNIQUE,
    creator_wallet VARCHAR(44) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    resolution_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    total_volume BIGINT DEFAULT 0,
    trader_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active'
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    wallet_address VARCHAR(44) PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    bio TEXT,
    avatar_url VARCHAR(255),
    reputation_score INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
    user_wallet VARCHAR(44) REFERENCES users(wallet_address),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    likes_count INTEGER DEFAULT 0
);

-- Trades table for analytics
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    user_wallet VARCHAR(44) REFERENCES users(wallet_address),
    transaction_signature VARCHAR(88) NOT NULL UNIQUE,
    trade_type VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
    outcome_index INTEGER NOT NULL,
    token_amount BIGINT NOT NULL,
    sol_amount BIGINT NOT NULL,
    price DECIMAL(18,9) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at);
CREATE INDEX IF NOT EXISTS idx_markets_total_volume ON markets(total_volume);
CREATE INDEX IF NOT EXISTS idx_comments_market_id ON comments(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_wallet ON trades(user_wallet);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);