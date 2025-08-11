-- Migration 004: Add notification system tables
-- This migration adds tables for notifications, price alerts, and user preferences

-- Price alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(44) NOT NULL,
    market_id VARCHAR(255) NOT NULL,
    outcome_index INTEGER NOT NULL,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('above', 'below', 'change')),
    target_price DECIMAL(10, 6),
    change_threshold DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(44) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('price_alert', 'market_settlement', 'social', 'trade_confirmation')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id VARCHAR(44) PRIMARY KEY,
    price_alerts BOOLEAN DEFAULT true,
    market_settlements BOOLEAN DEFAULT true,
    social_notifications BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    push_notifications BOOLEAN DEFAULT true,
    price_alert_threshold DECIMAL(5, 2) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add email column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_market_id ON price_alerts(market_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Add foreign key constraints (if the referenced tables exist)
-- Note: These will only be added if the referenced tables exist
DO $$
BEGIN
    -- Add foreign key for price_alerts -> users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE price_alerts 
        ADD CONSTRAINT fk_price_alerts_user_id 
        FOREIGN KEY (user_id) REFERENCES users(wallet_address) 
        ON DELETE CASCADE;
    END IF;

    -- Add foreign key for notifications -> users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE notifications 
        ADD CONSTRAINT fk_notifications_user_id 
        FOREIGN KEY (user_id) REFERENCES users(wallet_address) 
        ON DELETE CASCADE;
    END IF;

    -- Add foreign key for notification_preferences -> users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE notification_preferences 
        ADD CONSTRAINT fk_notification_preferences_user_id 
        FOREIGN KEY (user_id) REFERENCES users(wallet_address) 
        ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Foreign key already exists, ignore
        NULL;
END $$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_price_alerts_updated_at ON price_alerts;
CREATE TRIGGER update_price_alerts_updated_at 
    BEFORE UPDATE ON price_alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT wallet_address 
FROM users 
WHERE wallet_address NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;