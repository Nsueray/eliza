-- Migration 019: Target system — expo targets + clusters

-- Expo clusters (same city + same week = cluster)
CREATE TABLE IF NOT EXISTS expo_clusters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  city VARCHAR(100),
  country VARCHAR(100),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cluster ID on expos
ALTER TABLE expos ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES expo_clusters(id);

-- Expo targets
CREATE TABLE IF NOT EXISTS expo_targets (
  id SERIAL PRIMARY KEY,
  expo_id INTEGER REFERENCES expos(id) UNIQUE,
  target_m2 DECIMAL(10,2),
  target_revenue DECIMAL(12,2),
  source VARCHAR(20) DEFAULT 'auto',
  auto_base_expo_id INTEGER,
  auto_percentage DECIMAL(5,2) DEFAULT 15.0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expo_targets_expo ON expo_targets(expo_id);
CREATE INDEX IF NOT EXISTS idx_expos_cluster ON expos(cluster_id);
