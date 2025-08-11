-- Blockchain synchronization state tracking

-- Table to track last processed slot for each program
CREATE TABLE IF NOT EXISTS blockchain_sync_state (
    program_id VARCHAR(44) PRIMARY KEY,
    last_processed_slot BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table to store blockchain events for audit and recovery
CREATE TABLE IF NOT EXISTS market_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id VARCHAR(44) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    transaction_signature VARCHAR(88) NOT NULL UNIQUE,
    slot_number BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table to track failed events for retry
CREATE TABLE IF NOT EXISTS failed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blockchain_sync_program ON blockchain_sync_state(program_id);
CREATE INDEX IF NOT EXISTS idx_market_events_market_id ON market_events(market_id);
CREATE INDEX IF NOT EXISTS idx_market_events_type ON market_events(event_type);
CREATE INDEX IF NOT EXISTS idx_market_events_signature ON market_events(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_market_events_created_at ON market_events(created_at);
CREATE INDEX IF NOT EXISTS idx_failed_events_retry ON failed_events(next_retry_at) WHERE retry_count < max_retries;

-- Add blockchain event tracking to existing trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS slot_number BIGINT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS block_time TIMESTAMP;

-- Create index on slot number for trades
CREATE INDEX IF NOT EXISTS idx_trades_slot_number ON trades(slot_number);

-- Function to update blockchain sync state
CREATE OR REPLACE FUNCTION update_blockchain_sync_state(
    p_program_id VARCHAR(44),
    p_slot_number BIGINT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO blockchain_sync_state (program_id, last_processed_slot, updated_at)
    VALUES (p_program_id, p_slot_number, NOW())
    ON CONFLICT (program_id) 
    DO UPDATE SET 
        last_processed_slot = GREATEST(blockchain_sync_state.last_processed_slot, p_slot_number),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old events (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_events() RETURNS VOID AS $$
BEGIN
    -- Clean up old market events
    DELETE FROM market_events 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Clean up old failed events that have exceeded max retries
    DELETE FROM failed_events 
    WHERE retry_count >= max_retries 
    AND created_at < NOW() - INTERVAL '7 days';
    
    -- Log cleanup
    RAISE NOTICE 'Cleaned up old blockchain events';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-blockchain-events', '0 2 * * *', 'SELECT cleanup_old_events();');