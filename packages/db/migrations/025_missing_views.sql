-- Migration 025: Production-only views (edition_contracts, fiscal_contracts)
-- ------------------------------------------------------------------
-- Bu 2 view repoda hic yoktu (outstanding_balances 013/014/015'te var).
-- Ikisi de SADECE contracts'tan okuyor (status/revenue_eur/currency ...
-- bunlar 010'da eklendi). Bu yuzden TUM tablolar+kolonlardan SONRA,
-- en sonda (024'ten sonra) olusturuluyor. CREATE OR REPLACE = idempotent.
-- Kaynak: canli pg_dump, AYNEN.
-- ------------------------------------------------------------------

CREATE OR REPLACE VIEW public.edition_contracts AS
 SELECT id,
    af_number,
    expo_id,
    company_name,
    country,
    sales_agent,
    m2,
    revenue,
    contract_date,
    sales_type,
    pavilion_flag,
    currency,
    exchange_rate,
    revenue_eur,
    status
   FROM public.contracts
  WHERE (status = ANY (ARRAY['Valid'::text, 'Transferred In'::text]));

CREATE OR REPLACE VIEW public.fiscal_contracts AS
 SELECT id,
    af_number,
    expo_id,
    company_name,
    country,
    sales_agent,
    m2,
    revenue,
    contract_date,
    sales_type,
    pavilion_flag,
    currency,
    exchange_rate,
    revenue_eur,
    status
   FROM public.contracts
  WHERE (status = ANY (ARRAY['Valid'::text, 'Transferred Out'::text]));
