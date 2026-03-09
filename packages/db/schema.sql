-- ELIZA PostgreSQL Schema
-- CEO Decision Support System for Elan Expo

-- expos: Exhibition brands with their yearly edition details
CREATE TABLE expos (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    city TEXT,
    edition_year INTEGER,
    start_date DATE,
    end_date DATE,
    cluster TEXT,
    target_m2 INTEGER
);

-- contracts: Sales agreements synced from Zoho CRM
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    af_number TEXT UNIQUE NOT NULL,
    expo_id INTEGER REFERENCES expos(id),
    company_name TEXT,
    country TEXT,
    sales_agent TEXT,
    m2 NUMERIC,
    revenue NUMERIC,
    contract_date DATE,
    sales_type TEXT,
    pavilion_flag BOOLEAN DEFAULT FALSE
);

-- exhibitors: Companies participating in exhibitions
CREATE TABLE exhibitors (
    id SERIAL PRIMARY KEY,
    company_name TEXT,
    country TEXT,
    industry TEXT
);

-- expenses: Costs associated with running each expo
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    expo_id INTEGER REFERENCES expos(id),
    category TEXT,
    amount NUMERIC,
    currency TEXT,
    source TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- sales_agents: Individual sellers or agencies responsible for contracts
CREATE TABLE sales_agents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    office TEXT,
    phone_number TEXT UNIQUE,
    role TEXT
);

-- alerts: Risk and event notifications for CEO oversight
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    description TEXT,
    expo_id INTEGER REFERENCES expos(id),
    severity TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- whatsapp_messages: Inbound messages from the WhatsApp bot interface
CREATE TABLE whatsapp_messages (
    id SERIAL PRIMARY KEY,
    sender_phone TEXT,
    message_text TEXT,
    parsed_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes

CREATE INDEX idx_contracts_expo_id ON contracts(expo_id);
CREATE INDEX idx_contracts_sales_agent ON contracts(sales_agent);
CREATE INDEX idx_contracts_af_number ON contracts(af_number);

CREATE INDEX idx_expenses_expo_id ON expenses(expo_id);

CREATE INDEX idx_alerts_expo_id ON alerts(expo_id);
CREATE INDEX idx_alerts_alert_type ON alerts(alert_type);

CREATE INDEX idx_whatsapp_messages_sender_phone ON whatsapp_messages(sender_phone);
