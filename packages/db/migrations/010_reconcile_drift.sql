-- Migration 010: Reconcile production drift (schema.sql + 004-024 ile prod farki)
-- ------------------------------------------------------------------
-- Amac: 'kod ELIZA semasini sifirdan kurabilsin'. schema.sql ve mevcut
-- migration'lar DEGISTIRILMEDI. Production'da olup repoda olmayan:
--   (a) mevcut tablolardaki eksik kolonlar (contracts/alerts/expos),
--   (b) 3 production-only tablo (attention_log, expo_metrics, sent_briefings).
-- Hepsi canli pg_dump'tan AYNEN (eliza_schema_2026-06-02.sql).
--
-- NUMARA 010: repoda bos slot (001-003 ve 010 hic yoktu). 009'dan SONRA,
--   013'ten ONCE calisir. 013_payment_fields outstanding_balances view'unu
--   contracts.revenue_eur'a dayanarak kuruyor; o kolon burada eklenir ->
--   013/014/015 artik patlamaz.
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE ... IF NOT EXISTS,
--   PK/FK pg_constraint guard'li DO blogu.
-- ------------------------------------------------------------------

-- (a) contracts eksik kolonlar (013_payment_fields'tan ONCE: revenue_eur vb. gerekli)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS exchange_rate numeric;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS revenue_eur numeric;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
-- (b) alerts eksik kolonlar
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_key character varying(255);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS entity_name character varying(255);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS entity_type character varying(50);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sent boolean DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS title text;
-- (c) expos eksik kolon
ALTER TABLE expos ADD COLUMN IF NOT EXISTS sales_start_date date;


-- === production-only tablo: attention_log ===
--
-- Name: attention_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.attention_log (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    entity_name character varying(255) NOT NULL,
    last_reviewed_at timestamp with time zone,
    review_count integer DEFAULT 0,
    flagged boolean DEFAULT false,
    flag_reason text,
    flag_level character varying(20) DEFAULT 'info'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
--
-- Name: attention_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.attention_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: attention_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attention_log_id_seq OWNED BY public.attention_log.id;
--
-- Name: attention_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attention_log ALTER COLUMN id SET DEFAULT nextval('public.attention_log_id_seq'::regclass);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='attention_log_pkey') THEN
    --
-- Name: attention_log attention_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attention_log
    ADD CONSTRAINT attention_log_pkey PRIMARY KEY (id);
  END IF;
END $$;
--
-- Name: attention_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS attention_log_entity_idx ON public.attention_log USING btree (entity_type, entity_name);

-- === production-only tablo: expo_metrics ===
--
-- Name: expo_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.expo_metrics (
    id integer NOT NULL,
    expo_id integer,
    expo_name text,
    edition_year integer,
    start_date date,
    months_to_event numeric,
    months_passed numeric,
    sales_start_date date,
    contracts integer,
    sold_m2 numeric,
    revenue_eur numeric,
    target_m2 numeric,
    progress_percent numeric,
    velocity_m2_per_month numeric,
    required_velocity numeric,
    velocity_ratio numeric,
    country_count integer,
    agent_count integer,
    risk_score integer,
    risk_level text,
    calculated_at timestamp without time zone DEFAULT now()
);
--
-- Name: expo_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.expo_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: expo_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expo_metrics_id_seq OWNED BY public.expo_metrics.id;
--
-- Name: expo_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_metrics ALTER COLUMN id SET DEFAULT nextval('public.expo_metrics_id_seq'::regclass);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expo_metrics_pkey') THEN
    --
-- Name: expo_metrics expo_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_metrics
    ADD CONSTRAINT expo_metrics_pkey PRIMARY KEY (id);
  END IF;
END $$;
--
-- Name: expo_metrics_expo_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS expo_metrics_expo_id_idx ON public.expo_metrics USING btree (expo_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expo_metrics_expo_id_fkey') THEN
    --
-- Name: expo_metrics expo_metrics_expo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_metrics
    ADD CONSTRAINT expo_metrics_expo_id_fkey FOREIGN KEY (expo_id) REFERENCES public.expos(id);
  END IF;
END $$;

-- === production-only tablo: sent_briefings ===
--
-- Name: sent_briefings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.sent_briefings (
    id integer NOT NULL,
    briefing_date date NOT NULL,
    content text NOT NULL,
    sent_via character varying(50) DEFAULT 'whatsapp'::character varying,
    sent_at timestamp with time zone DEFAULT now()
);
--
-- Name: sent_briefings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.sent_briefings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: sent_briefings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sent_briefings_id_seq OWNED BY public.sent_briefings.id;
--
-- Name: sent_briefings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_briefings ALTER COLUMN id SET DEFAULT nextval('public.sent_briefings_id_seq'::regclass);
--
-- Name: sent_briefings sent_briefings_briefing_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_briefings
    ADD CONSTRAINT sent_briefings_briefing_date_key UNIQUE (briefing_date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sent_briefings_pkey') THEN
    --
-- Name: sent_briefings sent_briefings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_briefings
    ADD CONSTRAINT sent_briefings_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- (d) Production-only index'ler (repoda yoktu; canli dokumden aynen)
-- message_logs index'leri 006'dan sonra; alerts index'leri yukaridaki (b) kolonlarindan sonra.
CREATE INDEX IF NOT EXISTS alerts_key_created_idx ON public.alerts USING btree (alert_key, created_at);
CREATE INDEX IF NOT EXISTS alerts_sent_idx ON public.alerts USING btree (sent, severity);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_date ON public.contracts USING btree (contract_date);
CREATE INDEX IF NOT EXISTS idx_logs_created ON public.message_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_intent ON public.message_logs USING btree (intent);
CREATE INDEX IF NOT EXISTS idx_logs_user ON public.message_logs USING btree (user_phone);

-- (e) Tip uyumu: production'da message_logs.user_phone varchar(30) (repo 006 varchar(50)).
--     Bos DB'de guvenli; prod ile bire bir esitlemek icin (006 DEGISTIRILMEDI).
ALTER TABLE message_logs ALTER COLUMN user_phone TYPE character varying(30);
