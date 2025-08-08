-- Production scaling migration for AI Arena
-- Adds tables and indexes for 10,000+ player support

-- Create world pools table for managing Convex deployments
CREATE TABLE IF NOT EXISTS world_pools (
    deployment_id VARCHAR(255) PRIMARY KEY,
    region VARCHAR(50) NOT NULL,
    total_worlds INTEGER NOT NULL DEFAULT 334,
    used_worlds INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    convex_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT world_pools_status_check CHECK (status IN ('ACTIVE', 'SCALING', 'DRAINING', 'OFFLINE'))
);

-- Add region and scaling metadata to channels
ALTER TABLE "ChannelMetadata"
ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'us-west-2',
ADD COLUMN IF NOT EXISTS auto_scaled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pool_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for region-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_region_status 
ON "ChannelMetadata"(region, status) 
WHERE status = 'ACTIVE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_load 
ON "ChannelMetadata"((current_bots::float / NULLIF(max_bots, 0))) 
WHERE status = 'ACTIVE';

-- Create partitioned activity logs table for scale
CREATE TABLE IF NOT EXISTS bot_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bot_id UUID NOT NULL,
    channel VARCHAR(64) NOT NULL,
    region VARCHAR(50) NOT NULL,
    activity_type VARCHAR(32) NOT NULL,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for the next 12 months
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'bot_activity_logs_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF bot_activity_logs
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );
        
        -- Create index on each partition
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I (bot_id, created_at)',
            'idx_' || partition_name || '_bot_time',
            partition_name
        );
        
        start_date := end_date;
    END LOOP;
END $$;

-- Create metrics table for monitoring
CREATE TABLE IF NOT EXISTS channel_metrics (
    id SERIAL PRIMARY KEY,
    channel VARCHAR(64) NOT NULL,
    region VARCHAR(50) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    value NUMERIC NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_channel_time 
ON channel_metrics(channel, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_region_type 
ON channel_metrics(region, metric_type, timestamp DESC);

-- Create table for tracking channel scaling events
CREATE TABLE IF NOT EXISTS scaling_events (
    id SERIAL PRIMARY KEY,
    region VARCHAR(50) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    channels_affected INTEGER,
    old_capacity INTEGER,
    new_capacity INTEGER,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT scaling_event_type_check CHECK (event_type IN ('SCALE_UP', 'SCALE_DOWN', 'REBALANCE'))
);

-- Add composite indexes for bot queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_channel_active 
ON "Bot"(channel, is_active) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_creator_active 
ON "Bot"(creator_id, is_active) 
WHERE is_active = true;

-- Add indexes for tournament matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_personality_channel 
ON "Bot"(personality, channel) 
WHERE is_active = true;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to world_pools
CREATE TRIGGER update_world_pools_updated_at 
BEFORE UPDATE ON world_pools 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate channel utilization
CREATE OR REPLACE FUNCTION get_channel_utilization(p_region VARCHAR DEFAULT NULL)
RETURNS TABLE (
    region VARCHAR,
    total_channels INTEGER,
    active_channels INTEGER,
    total_capacity INTEGER,
    current_load INTEGER,
    utilization_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.region,
        COUNT(*)::INTEGER as total_channels,
        COUNT(CASE WHEN cm.current_bots > 0 THEN 1 END)::INTEGER as active_channels,
        SUM(cm.max_bots)::INTEGER as total_capacity,
        SUM(cm.current_bots)::INTEGER as current_load,
        ROUND((SUM(cm.current_bots)::NUMERIC / NULLIF(SUM(cm.max_bots), 0)) * 100, 2) as utilization_percentage
    FROM "ChannelMetadata" cm
    WHERE cm.status = 'ACTIVE'
      AND (p_region IS NULL OR cm.region = p_region)
    GROUP BY cm.region;
END;
$$ LANGUAGE plpgsql;

-- Function to find optimal channel for bot placement
CREATE OR REPLACE FUNCTION find_optimal_channel(
    p_region VARCHAR DEFAULT 'us-west-2',
    p_channel_type VARCHAR DEFAULT 'MAIN',
    p_personality VARCHAR DEFAULT NULL
)
RETURNS VARCHAR AS $$
DECLARE
    v_channel VARCHAR;
BEGIN
    -- Find channel with lowest utilization in region
    SELECT channel INTO v_channel
    FROM "ChannelMetadata"
    WHERE status = 'ACTIVE'
      AND channel_type = p_channel_type
      AND region = p_region
      AND current_bots < max_bots * 0.8  -- Under 80% capacity
    ORDER BY 
        current_bots::FLOAT / NULLIF(max_bots, 1) ASC,  -- Lowest utilization first
        created_at DESC  -- Newest channels if tied
    LIMIT 1;
    
    -- If no channel found, return main as fallback
    IF v_channel IS NULL THEN
        v_channel := 'main';
    END IF;
    
    RETURN v_channel;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE world_pools IS 'Manages Convex deployment pools for horizontal scaling';
COMMENT ON TABLE bot_activity_logs IS 'Partitioned table for high-volume bot activity logging';
COMMENT ON TABLE channel_metrics IS 'Time-series metrics for channel monitoring and auto-scaling';
COMMENT ON TABLE scaling_events IS 'Audit log of all scaling events for analysis';
COMMENT ON FUNCTION get_channel_utilization IS 'Returns utilization metrics by region for monitoring';
COMMENT ON FUNCTION find_optimal_channel IS 'Finds the best channel for bot placement based on load';