# ELIZA Finance Module — Architecture Blueprint
## Collections Cockpit / CFO Dashboard
Version: v1.1 | Date: 2026-03-16
Reviewed by: Claude + ChatGPT + CEO

---

## 1. WHY THIS MODULE

ELIZA's north star: WhatsApp-first CEO Operating System.
Core question: "What requires my attention? What risk is emerging? What action should I take?"

Tahsilat (collections) bu sorunun en kritik alt parçası:
- Fuarlar yaklaşırken ödemesi tamamlanmamış firmalar → iptal riski
- Vadesi geçmiş alacaklar → nakit akışı sorunu
- Hiç ödeme yapmamış firmalar → en yüksek risk

**Bugün eksik olan:** Zoho'da tüm veri var ama ELIZA sadece `Grand_Total` sync ediyor. Balance, payment history, due date bilgileri yok.

---

## 2. DATA MODEL (Katman 1)

### 2a. contracts tablosu — YENİ ALANLAR

Mevcut alanlar korunur. Tüm finans alanları EUR suffix ile — currency ambiguity yok.

| Kolon | Tip | Zoho Field | Açıklama |
|-------|-----|------------|----------|
| balance_eur | DECIMAL(12,2) | Balance1 | Kalan bakiye — **authoritative alan** |
| paid_eur | DECIMAL(12,2) | Total_Payment | Toplam yapılan ödeme |
| remaining_payment_eur | DECIMAL(12,2) | Remaining_Payment | Zoho formula — referans (dashboard'da balance_eur kullanılır) |
| due_date | DATE | Due_Date | Vade tarihi |
| payment_done | BOOLEAN | Payment_Done | Ödeme tamamlandı mı |
| payment_method | TEXT | Payment_Method | Ödeme yöntemi |
| validity | TEXT | Validity | Geçerlilik |
| first_payment_eur | DECIMAL(12,2) | st_Payment | 1. ödeme tutarı |
| second_payment_eur | DECIMAL(12,2) | nd_Payment | 2. ödeme tutarı |

**Authoritative balance kuralı:** Dashboard ve AI sorgularında `balance_eur` tek kaynak. `remaining_payment_eur` sadece sync edilir, raporlamada kullanılmaz.

### 2b. contract_payments tablosu — GERÇEKLEŞENler

Zoho'daki `Received_Payment` subform → her ödeme ayrı satır.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| contract_id | INT FK | contracts.id |
| af_number | TEXT | Hızlı lookup için |
| payment_date | DATE | Ödeme tarihi |
| amount_eur | DECIMAL(12,2) | Ödeme tutarı (EUR) |
| note | TEXT | Ödeme notu (ör: "QNB Eur") |
| created_at | TIMESTAMP | |

### 2c. contract_payment_schedule tablosu — PLANLANANlar

Zoho'daki taksit alanlarından (st_Payment, nd_Payment, Date_Amount_Type1..5) parse edilen planlanan ödemeler.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| contract_id | INT FK | contracts.id |
| af_number | TEXT | |
| installment_no | INT | 1, 2, 3... |
| due_date | DATE | Planlanan ödeme tarihi |
| planned_amount_eur | DECIMAL(12,2) | Planlanan tutar |
| payment_type | TEXT | deposit / installment / final |
| note | TEXT | |
| source_field | TEXT | Hangi Zoho field'dan geldi (st_Payment, Date_Amount_Type1 vb.) |
| is_synthetic | BOOLEAN DEFAULT FALSE | Zoho'da plan yoksa fallback kuraldan üretildi mi |
| created_at | TIMESTAMP | |

**Synthetic schedule kuralı:** Zoho'da taksit planı yoksa fallback:
- İmza ayında %30 (deposit)
- Fuardan 1 ay önce kalan %70 (final)
Bu synthetic kayıtlar `is_synthetic = true` ile işaretlenir.

### 2d. SQL Views — Finansal

```sql
CREATE OR REPLACE VIEW outstanding_balances AS
SELECT 
  c.id, c.af_number, c.company_name, c.country,
  c.sales_agent, c.sales_type,
  e.name AS expo_name, e.country AS expo_country, 
  e.start_date AS expo_start_date,
  c.contract_date,
  -- Finans alanları (hepsi EUR)
  c.revenue_eur AS contract_total_eur,
  COALESCE(c.paid_eur, 0) AS paid_eur,
  COALESCE(c.balance_eur, c.revenue_eur - COALESCE(c.paid_eur, 0)) AS balance_eur,
  c.due_date,
  c.payment_done,
  -- Hesaplanan tarih alanları
  CASE WHEN c.due_date < CURRENT_DATE AND COALESCE(c.balance_eur, 0) > 0 THEN true ELSE false END AS is_overdue,
  CASE WHEN c.due_date IS NOT NULL THEN GREATEST(c.due_date - CURRENT_DATE, 0) ELSE NULL END AS days_to_due,
  CASE WHEN c.due_date < CURRENT_DATE THEN CURRENT_DATE - c.due_date ELSE 0 END AS days_overdue,
  CASE WHEN e.start_date IS NOT NULL THEN GREATEST(e.start_date::date - CURRENT_DATE, 0) ELSE NULL END AS days_to_expo,
  -- Ödeme yüzdeleri
  CASE WHEN c.revenue_eur > 0 THEN ROUND((COALESCE(c.paid_eur, 0) / c.revenue_eur * 100)::numeric, 1) ELSE 0 END AS paid_percent,
  -- İlk ve son ödeme tarihleri
  (SELECT MIN(cp.payment_date) FROM contract_payments cp WHERE cp.contract_id = c.id) AS first_payment_date,
  (SELECT MAX(cp.payment_date) FROM contract_payments cp WHERE cp.contract_id = c.id) AS last_payment_date,
  -- Collection stage (simplified: no deposit_missing — merged into no_payment)
  CASE
    WHEN c.payment_done = true THEN 'paid_complete'
    WHEN COALESCE(c.paid_eur, 0) = 0 THEN 'no_payment'
    WHEN c.due_date < CURRENT_DATE AND COALESCE(c.balance_eur, 0) > 0 THEN 'overdue'
    WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 45 AND COALESCE(c.balance_eur, 0) > 0 THEN 'pre_event_balance_open'
    WHEN COALESCE(c.paid_eur, 0) > 0 AND COALESCE(c.balance_eur, 0) > 0 THEN 'partial_paid'
    ELSE 'ok'
  END AS collection_stage,
  -- İki eksenli risk skoru
  -- Axis 1: Collection risk (overdue + tutar + ödeme durumu)
  (
    CASE WHEN COALESCE(c.paid_eur, 0) = 0 THEN 3 ELSE 0 END +
    CASE WHEN c.due_date < CURRENT_DATE THEN LEAST((CURRENT_DATE - c.due_date) / 15, 4) ELSE 0 END +
    CASE WHEN COALESCE(c.balance_eur, 0) > 10000 THEN 2 WHEN COALESCE(c.balance_eur, 0) > 5000 THEN 1 ELSE 0 END
  ) AS collection_risk_score,
  -- Axis 2: Event risk (fuara yakınlık + kontrat büyüklüğü)
  (
    CASE WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 30 THEN 4
         WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 60 THEN 3
         WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 90 THEN 2
         ELSE 0 END +
    CASE WHEN c.revenue_eur > 20000 THEN 2 WHEN c.revenue_eur > 10000 THEN 1 ELSE 0 END
  ) AS event_risk_score
FROM contracts c
JOIN expos e ON c.expo_id = e.id
WHERE c.status IN ('Valid', 'Transferred In')
  AND COALESCE(c.balance_eur, 0) > 0
  AND c.payment_done IS NOT TRUE;
```

**Kombine risk seviyesi:**
```sql
-- collection_risk_score + event_risk_score = total_risk_score
-- 0-2: OK (yeşil)
-- 3-4: WATCH (sarı)
-- 5-7: HIGH (turuncu)
-- 8+: CRITICAL (kırmızı)
```

### 2e. Collection Stage Tanımları

| Stage | Açıklama | Renk |
|-------|----------|------|
| no_payment | Hiç ödeme yapmamış (deposit_missing buraya merge edildi) | Kırmızı |
| overdue | Vadesi geçmiş, bakiye açık (şu an inaktif — due_date Zoho'da NULL) | Turuncu |
| pre_event_balance_open | Fuara <45 gün, bakiye açık | Sarı |
| partial_paid | Kısmen ödenmiş, vade geçmemiş | Mavi |
| paid_complete | Ödeme tamamlanmış | Yeşil |
| ok | Normal durumda | Gri |

**Not:** `deposit_missing` stage kaldırıldı (migration 015). Zoho'daki st_Payment/nd_Payment alanları cancelled — her zaman NULL. `no_payment` stage tüm ödenmemiş kontratları kapsar.
**Not:** `overdue` stage SQL'de korunuyor ama şu an aktif değil — 244 açık kontratın hepsinde due_date = NULL. Zoho'da Due_Date kullanılmaya başlarsa otomatik çalışacak.

---

## 3. DASHBOARD PAGES (Katman 2)

### Sayfa: /finance — Collections Cockpit

Default görünüm: Edition (yaklaşan fuarlar)
Toggle: EDITION | FISCAL (üstte)

#### 3a. KPI Cards (8 kart — 2 rows x 4)

| KPI | Hesaplama | Önem |
|-----|-----------|------|
| Contract Value | SUM(contract_total_eur) | Genel büyüklük |
| Collected | SUM(paid_eur) | Toplam tahsilat |
| Outstanding | SUM(balance_eur) | Toplam alacak |
| **Paid This Month** | **SUM(contract_payments.amount_eur) this month** | **Aylık performans** |
| Due Next 30 Days | SUM(planned_amount_eur) WHERE due_date 0-30 | Yaklaşan |
| **Deposit Rate** | **paid_eur > 0 contracts / total open * 100** | **Tahsilat oranı** |
| **At-Risk Receivable** | overdue + fuara <45 gün açık + no_payment kritik | **Aksiyon odaklı** |
| No Payment | COUNT WHERE paid_eur = 0 | En yüksek risk |

**Deposit Rate** = COUNT(paid_eur > 0) / COUNT(*) * 100 — renk kodu: yeşil >70%, turuncu 40-70%, kırmızı <40%

**At-Risk Receivable** = SUM(balance_eur) WHERE collection_stage IN ('overdue', 'pre_event_balance_open', 'no_payment') AND collection_risk_score + event_risk_score >= 5

#### 3b. Tahsilat Aksiyon Listesi (ANA TABLO)

"Kimden ne istememiz lazım?" — CEO'nun en çok kullanacağı ekran.

Sortable, filterable, per-table export (Copy/CSV/Excel).

| Kolon | Açıklama |
|-------|----------|
| Company | Firma adı |
| Expo | Fuar adı |
| AF Number | Sözleşme no |
| Agent | Satış temsilcisi |
| Contract | Sözleşme bedeli (EUR) |
| Paid | Ödenen (EUR) |
| Balance | Kalan (EUR) |
| Paid % | Ödeme yüzdesi |
| Due Date | Vade tarihi |
| Days Overdue | Gecikme günü (0 = geçmemiş) |
| Days to Expo | Fuara kaç gün |
| Stage | Collection stage badge |
| Risk | Kombine risk skoru → renk |
| Action | Önerilen aksiyon (otomatik) |

Önerilen aksiyonlar:
- `no_payment` + fuara <60 gün: "URGENT — no payment, Xd to expo"
- `no_payment`: "Request deposit"
- `overdue` + >30 gün: "Escalation — Xd overdue"
- `overdue` + <30 gün: "Follow up payment — Xd overdue"
- `pre_event_balance_open`: "Pre-event balance close — Xd to expo"
- `partial_paid` + due_soon: "Installment reminder"
- `ok`: "On track"

Default sıralama: Risk score DESC → Days to Expo ASC

Filtreler: Expo, Agent, Stage, Risk level, Country

#### 3c. A/R Aging (Vade Yaşlandırma)

| Kova | Tanım |
|------|-------|
| Current | Vadesi gelmemiş |
| 1-7 days | 1-7 gün gecikmiş |
| 8-15 days | 8-15 gün |
| 16-30 days | 16-30 gün |
| 31-60 days | 31-60 gün |
| 60+ days | 60+ gün |

Her kova: toplam tutar (EUR) + kontrat sayısı.
Görsel: Horizontal stacked bar chart.

#### 3d. Yaklaşan Tahsilatlar

Önümüzdeki 7/14/30/60 gün içinde due olacak ödemeler.
Kaynak: contract_payment_schedule (planlanan) + contracts.due_date (fallback)
Toggle: 7d | 14d | 30d | 60d
Tablo: Company, Expo, Amount Due, Due Date, Days Left, Stage

#### 3e. Son Hareketler (Finance Activity Feed)

Sadece "son ödemeler" değil — tüm finansal olaylar:
- 💰 Yeni ödeme geldi (contract_payments)
- ⏰ Vade geçti (due_date < today olan yeni kayıtlar)
- ✅ Kontrat fully paid oldu
- 📧 Payment reminder gönderildi (mevcut message_drafts)

Son 20 hareket, tarih sıralı.

#### 3f. Fuar Bazlı Alacak

| Kolon | Açıklama |
|-------|----------|
| Expo | Fuar adı |
| Days to Expo | Kalan gün |
| Contract Value | Toplam kontrat (EUR) |
| Collected | Tahsil edilen (EUR) |
| Outstanding | Kalan (EUR) |
| Collection % | Tahsilat oranı |
| At-Risk | Riskli alacak tutarı |
| Critical Count | deposit_missing + no_payment firma sayısı |
| Risk | Renk kodlu badge |

Edition mode: sadece yaklaşan fuarlar.
Fiscal mode: tüm yıl.

Expo'ya tıklayınca /expos/detail sayfasına git.

#### 3g. Agent Bazlı Alacak

| Kolon | Açıklama |
|-------|----------|
| Agent | Temsilci |
| Contracts | Kontrat sayısı |
| Contract Value | Toplam (EUR) |
| Collected | Tahsil edilen (EUR) |
| Outstanding | Kalan (EUR) |
| Overdue | Gecikmiş (EUR) |
| Collection % | Tahsilat oranı |

---

## 4. WhatsApp INTEGRATION (Katman 3)

### İlk aşama — 3 temel sorgu:
1. "kaç alacağımız var?" → toplam outstanding + at-risk
2. "vadesi geçmiş ödemeler?" → overdue listesi (top 5 + toplam)
3. "SIEMA tahsilat durumu?" → expo bazlı özet

### Morning Brief — Tahsilat Bölümü (sonra):
- "Bugün vadesi dolan: 3 kontrat, €45.000"
- "Vadesi geçmiş: 12 kontrat, €180.000"
- "Hiç ödeme yapmamış: 5 firma (fuarları 30 gün içinde)"

### Aksiyon Döngüsü (sonra):
Tahsilat Aksiyon Listesi → "hatırlatma oluştur" → CEO onayı → gönder
Mevcut `payment_reminder` message template'i kullanılır.

---

## 5. SPRINT PLANI

### Sprint 1A: Veri Katmanı — Sync (BU GECE) — ✅ COMPLETED
- [x] Migration 013: payment fields on contracts + contract_payments + contract_payment_schedule
- [x] Zoho sync: payment fields + Received_Payment subform (2-pass: bulk + individual fetch)
- [x] Date_Amount_Type1..5 parse → contract_payment_schedule (TR/EN/FR month name support)
- [x] Synthetic schedule fallback (plan yoksa %30 deposit + %70 pre-event)
- [x] Full sync + doğrulama: 3525 contracts, 1272 payments, 204 real + 6598 synthetic schedules

### Sprint 1B: Veri Katmanı — Views + API — ✅ COMPLETED
- [x] outstanding_balances view (updated: deposit_missing uses contract_payment_schedule subquery)
- [x] API: GET /api/finance/summary (8 KPIs: contract_value, collected, outstanding, overdue, due_next_30, deposit_rate, at_risk, no_payment_count)
- [x] API: GET /api/finance/action-list (filterable, sortable, paginated, suggested_action)
- [x] API: GET /api/finance/aging (6 buckets: Current, 1-7d, 8-15d, 16-30d, 31-60d, 60+)
- [x] API: GET /api/finance/upcoming (scheduled payments within N days)
- [x] API: GET /api/finance/by-expo (expo-level aggregates)
- [x] API: GET /api/finance/by-agent (agent-level aggregates)
- [x] API: GET /api/finance/contract/:id/detail (single contract with payments + schedule)
- [x] API: GET /api/finance/recent-activity (recent payment events)
- [x] API: GET /api/finance/forecast?weeks=8 (weekly cash forecast from contract_payment_schedule)
- [x] Cancelled fields cleanup: removed st_Payment, nd_Payment, Date_Amount_Type* from sync

### Sprint 2: Dashboard Sayfası — ✅ COMPLETED
- [x] /finance sayfası — 8 KPI cards (2 rows x 4) + collection action list table
- [x] Filter chips: stage (6 options) + risk (4 levels) + search
- [x] Company detail drawer (slide-in 480px, payment schedule + received payments)
- [x] A/R aging chart (Chart.js bar) + upcoming collections table (7d/14d/30d/60d toggle)
- [x] Outstanding by expo + by agent tables (side by side, sortable)
- [x] Expected Collections — Next 8 Weeks table (weekly cash forecast, Copy/CSV/Excel export)
- [x] Recent payments table
- [x] Edition/Fiscal toggle
- [x] Export: Copy/CSV/Excel per-table
- [x] Nav.js: "Finance" link added after "Sales" with permission key
- [x] Dashboard permissions: "finance" module added (CEO+Manager=true, Agent=false)

### Sprint 3: WhatsApp + Aksiyon — 🟡 PARTIALLY DONE
- [x] 3 temel WhatsApp sorgu (collection_summary, collection_expo, collection_no_payment)
- [x] Company collection intent ("pygar firmasının borcu?" → company_collection)
- [ ] Morning brief tahsilat bölümü
- [ ] Aksiyon döngüsü (hatırlatma → onay → gönder)

---

## 6. ÖNEMLİ KURALLAR

1. **Zoho source of truth** — ELIZA read-only, Zoho'ya yazmaz
2. **Tüm tutarlar EUR** — kolon isimleri `_eur` suffix ile. Currency + Exchange_Rate sync edilir, local currency → EUR dönüşümü otomatik.
3. **Authoritative balance** — `balance_eur` tek kaynak. `remaining_payment_eur` referans alanı.
4. **ELAN EXPO internal agent** — finansal raporlarda gelir DAHİL, agent ranking HARİÇ
5. **Default: Edition view** — yaklaşan fuarlar odaklı. Fiscal toggle ile şirket geneli.
6. **Risk iki eksenli** — collection risk (overdue + tutar + ödeme) + event risk (fuara yakınlık + büyüklük)
7. **Deposit Rate** — paid_eur > 0 olan kontrat sayısı / toplam açık kontrat. Collection Rate kaldırıldı (due_date NULL)
8. **Currency conversion** — Zoho Currency + Exchange_Rate kullanılır. contract_payments'ta amount_eur (converted) + amount_local (original) + currency tutulur.
9. **Cancelled Zoho fields** — st_Payment, nd_Payment, Date_Amount_Type1..5 artık kullanılmıyor (2025 öncesi eski). Sync'ten çıkarıldı.
10. **Her yeni finans alanı** → CLAUDE.md'ye ve bu dokümana ekle
