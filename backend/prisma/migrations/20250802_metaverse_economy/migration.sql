-- Create enum types for the economy system
CREATE TYPE equipment_type AS ENUM ('weapon', 'armor', 'tool', 'accessory');
CREATE TYPE item_rarity AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');
CREATE TYPE furniture_type AS ENUM ('decoration', 'functional', 'defensive', 'trophy');

-- Bot equipment table
CREATE TABLE bot_equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  equipment_type equipment_type NOT NULL,
  rarity item_rarity NOT NULL,
  power_bonus INT NOT NULL DEFAULT 0,
  defense_bonus INT NOT NULL DEFAULT 0,
  equipped BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bot houses table
CREATE TABLE bot_houses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE UNIQUE,
  house_score INT NOT NULL DEFAULT 100,
  defense_level INT NOT NULL DEFAULT 1,
  last_robbed TIMESTAMP WITH TIME ZONE,
  robbery_cooldown TIMESTAMP WITH TIME ZONE,
  world_position JSONB DEFAULT '{"x": 0, "y": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Furniture table
CREATE TABLE furniture (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES bot_houses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  furniture_type furniture_type NOT NULL,
  rarity item_rarity NOT NULL,
  score_bonus INT NOT NULL DEFAULT 0,
  defense_bonus INT NOT NULL DEFAULT 0,
  position JSONB DEFAULT '{"x": 0, "y": 0, "rotation": 0}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Robbery logs table
CREATE TABLE robbery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robber_bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  victim_bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  power_used INT NOT NULL,
  defense_faced INT NOT NULL,
  loot_value INT DEFAULT 0,
  items_stolen JSONB DEFAULT '[]',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bot activity scores table (for house score calculation)
CREATE TABLE bot_activity_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  matches_played INT NOT NULL DEFAULT 0,
  lootboxes_opened INT NOT NULL DEFAULT 0,
  social_interactions INT NOT NULL DEFAULT 0,
  successful_robberies INT NOT NULL DEFAULT 0,
  defense_successes INT NOT NULL DEFAULT 0,
  trades_completed INT NOT NULL DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lootbox rewards table (links match rewards to items)
CREATE TABLE lootbox_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  lootbox_rarity item_rarity NOT NULL,
  equipment_rewards JSONB DEFAULT '[]',
  furniture_rewards JSONB DEFAULT '[]',
  currency_reward INT DEFAULT 0,
  opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trading table
CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  initiator_bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  receiver_bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  offered_items JSONB NOT NULL DEFAULT '[]',
  requested_items JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_bot_equipment_bot_id ON bot_equipment(bot_id);
CREATE INDEX idx_bot_equipment_equipped ON bot_equipment(equipped);
CREATE INDEX idx_bot_houses_bot_id ON bot_houses(bot_id);
CREATE INDEX idx_furniture_house_id ON furniture(house_id);
CREATE INDEX idx_robbery_logs_robber ON robbery_logs(robber_bot_id);
CREATE INDEX idx_robbery_logs_victim ON robbery_logs(victim_bot_id);
CREATE INDEX idx_robbery_logs_timestamp ON robbery_logs(timestamp);
CREATE INDEX idx_bot_activity_bot_id ON bot_activity_scores(bot_id);
CREATE INDEX idx_lootbox_rewards_bot_id ON lootbox_rewards(bot_id);
CREATE INDEX idx_lootbox_rewards_match_id ON lootbox_rewards(match_id);
CREATE INDEX idx_trades_initiator ON trades(initiator_bot_id);
CREATE INDEX idx_trades_receiver ON trades(receiver_bot_id);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bot_equipment_updated_at BEFORE UPDATE ON bot_equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_houses_updated_at BEFORE UPDATE ON bot_houses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_activity_scores_updated_at BEFORE UPDATE ON bot_activity_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();