-- Phase 6: Message Generator schema additions

-- Add preferred_language to sales_agents
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- Set known agent languages
UPDATE sales_agents SET preferred_language = 'tr' WHERE name ILIKE '%Elif%';
UPDATE sales_agents SET preferred_language = 'fr' WHERE name ILIKE '%Meriem%';

-- Message drafts table: stores generated messages pending CEO approval
CREATE TABLE IF NOT EXISTS message_drafts (
    id SERIAL PRIMARY KEY,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT,
    template_type TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    subject TEXT,
    body TEXT NOT NULL,
    context_data JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    created_by TEXT NOT NULL DEFAULT 'ceo',
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    sent_at TIMESTAMP,
    expired_at TIMESTAMP
);

-- Index for quick lookup of pending drafts
CREATE INDEX IF NOT EXISTS idx_message_drafts_status ON message_drafts(status);
