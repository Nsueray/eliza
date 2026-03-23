# ELIZA Target System — Architecture Blueprint
## Hedef Belirleme + Tracking
Version: v1.0 | Date: 2026-03-23

---

## 1. WHY TARGETS

CEO şirket geneli ve fuar bazlı hedefleri belirler. ELIZA bu hedefleri izler:
- Her fuar için m² ve revenue hedefi
- Gerçekleşen vs hedef karşılaştırma
- Otomatik hedef (önceki edition +%15)
- Cluster bazlı gruplandırma (aynı tarih+şehir fuarlar)
- WhatsApp ve push mesajlarda hedef progress

---

## 2. DATA MODEL

### 2a. expo_targets tablosu

```sql
CREATE TABLE IF NOT EXISTS expo_targets (
  id SERIAL PRIMARY KEY,
  expo_id INTEGER REFERENCES expos(id),
  target_m2 DECIMAL(10,2),
  target_revenue DECIMAL(12,2),
  source VARCHAR(20) DEFAULT 'auto',  -- 'auto' | 'manual'
  auto_base_expo_id INTEGER,           -- hangi edition'dan hesaplandı
  auto_percentage DECIMAL(5,2) DEFAULT 15.0, -- +%15 default
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(expo_id)
);
```

source = 'auto': Önceki edition'ın gerçekleşen değeri × (1 + auto_percentage/100)
source = 'manual': CEO manuel girmiş

### 2b. expo_clusters tablosu

Aynı tarih + aynı şehirde olan fuarlar bir cluster.

```sql
CREATE TABLE IF NOT EXISTS expo_clusters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,        -- "Casablanca July 2026"
  city VARCHAR(100),
  country VARCHAR(100),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- expos tablosuna cluster_id ekle
ALTER TABLE expos ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES expo_clusters(id);
```

Cluster örnekleri:
- "Casablanca July 2026": Madesign, Mega Ceramica, SIEMA, Lighting, Horeca Morocco
- "Lagos May 2026": Mega Clima Nigeria, Mega Water Nigeria, Build Expo, Coren
- "Nairobi Sep 2026": Mega Clima Kenya, Mega Water Kenya

Cluster detection: aynı start_date (veya ±3 gün) + aynı city → otomatik grupla.

### 2c. Otomatik Hedef Hesaplama

```
Yeni edition hedefi = Önceki edition gerçekleşen × (1 + yüzde/100)

Örnek:
SIEMA 2025: 1800 m², €450.000 gerçekleşen
SIEMA 2026 auto target: 1800 × 1.15 = 2070 m², €450.000 × 1.15 = €517.500

Önceki edition yoksa: hedef = 0 (manuel girilmeli)
```

---

## 3. DASHBOARD PAGE: /targets

### 3a. Sayfa Yapısı

```
┌─────────────────────────────────────────────────────────┐
│ ELIZA. TARGETS                                          │
│ Nav: ... | Targets | Finance | ...                      │
├─────────────────────────────────────────────────────────┤
│ CONTROL BAR                                             │
│ [EDITION | FISCAL] [2026 ▼] [COPY SUMMARY] [EXCEL ALL] │
├─────────────────────────────────────────────────────────┤
│ SUMMARY KPI CARDS (4)                                   │
│ [Total Target m²] [Actual m²] [Target Revenue] [Actual] │
├─────────────────────────────────────────────────────────┤
│ CLUSTER VIEW (grouped expos)                            │
│ ┌─ Casablanca July 2026 ──────────────────────────────┐ │
│ │ SIEMA          | target 2000m² | actual 1600m² | 80%│ │
│ │ Madesign       | target 800m²  | actual 200m²  | 25%│ │
│ │ Mega Ceramica  | target 500m²  | actual 300m²  | 60%│ │
│ │ CLUSTER TOTAL  | 3300m²        | 2100m²        | 64%│ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Lagos May 2026 ────────────────────────────────────┐ │
│ │ Mega Clima     | target 1200m² | actual 630m²  | 53%│ │
│ │ Mega Water     | target 800m²  | actual 207m²  | 26%│ │
│ │ CLUSTER TOTAL  | 2000m²        | 837m²         | 42%│ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Standalone Expos ──────────────────────────────────┐ │
│ │ Electricity Algeria | target 500m² | actual 234m²   │ │
│ │ Best5 Algeria       | target 300m² | actual 180m²   │ │
│ └──────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ COMPANY TOTAL                                           │
│ Target: 8,500 m² / €2,100,000                          │
│ Actual: 5,200 m² / €1,300,000                          │
│ Progress: 61% m² / 62% revenue                         │
└─────────────────────────────────────────────────────────┘
```

### 3b. KPI Cards (4)

| KPI | Hesaplama |
|-----|-----------|
| Target m² | SUM(target_m2) tüm aktif fuarlar |
| Actual m² | SUM(sold_m2) tüm aktif fuarlar |
| Target Revenue | SUM(target_revenue) |
| Actual Revenue | SUM(revenue_eur) |

Her kartta:
- Büyük rakam: hedef veya gerçekleşen
- Alt bilgi: progress % + bar
- Renk: >80% yeşil, 50-80% sarı, <50% kırmızı

### 3c. Cluster Tablosu

Her cluster bir grup — içindeki fuarlar satır, altta CLUSTER TOTAL.

Kolonlar:
| Expo | Target m² | Actual m² | m² % | Target € | Actual € | € % | Contracts | Edit |
|------|-----------|-----------|------|----------|----------|-----|-----------|------|

**Sıralama:** Cluster start_date ASC (en yakın fuar önce)

**CLUSTER TOTAL satırı:** Bold, arka plan farklı renk. Cluster içindeki tüm expoların toplamı.

**Standalone expos:** Cluster'a ait olmayan fuarlar ayrı "Other Expos" grubunda.

**COMPANY TOTAL:** En altta tüm fuarların grand total'u.

### 3d. Edit Butonu — Inline Editing

Her expo satırında "EDIT" butonu. Tıklayınca:

```
┌─ Edit Target: SIEMA 2026 ──────────────┐
│                                          │
│ Previous edition: SIEMA 2025             │
│ Actual: 1,800 m² / €450,000             │
│                                          │
│ Method: [Auto +15% ▼] [Manual ▼]        │
│                                          │
│ If Auto:                                 │
│ Percentage: [+15] %                      │
│ Result: 2,070 m² / €517,500             │
│                                          │
│ If Manual:                               │
│ Target m²: [2000]                        │
│ Target Revenue: [500000]                 │
│                                          │
│ [SAVE] [CANCEL]                          │
└──────────────────────────────────────────┘
```

Auto mode: yüzde gir → hedef otomatik hesaplanır
Manual mode: rakam gir

Yüzde negatif de olabilir: -10% = önceki edition'ın %90'ı

### 3e. Expo'ya Tıklama → Katılımcı Listesi

Expo adına tıklayınca → /expos/detail?name=X&year=Y sayfasına git (mevcut)
VEYA sağdan drawer aç — katılımcı listesi + kısa özet

### 3f. Fiscal Mode

FISCAL toggle aktif olduğunda:
- Cluster yerine düz liste (tüm fuarlar)
- Fiscal year bazlı toplam
- Önceki fiscal year ile karşılaştırma

### 3g. Year Selector

Default: 2026
Dropdown: 2024, 2025, 2026, 2027
Geçmiş yıllar: hedef vs gerçekleşen (historical comparison)

---

## 4. AUTO TARGET LOGIC

```javascript
async function calculateAutoTarget(expoId, percentage = 15) {
  // 1. Bu fuarın bilgilerini al
  const expo = await getExpo(expoId);
  
  // 2. Önceki edition'ı bul (aynı isim, bir önceki yıl)
  const prevEdition = await query(`
    SELECT e.id, 
      COALESCE(SUM(c.m2), 0) AS actual_m2,
      COALESCE(SUM(c.revenue_eur), 0) AS actual_revenue
    FROM expos e
    LEFT JOIN contracts c ON c.expo_id = e.id 
      AND c.status IN ('Valid', 'Transferred In')
      AND c.sales_agent != 'ELAN EXPO'
    WHERE e.name ILIKE $1
      AND EXTRACT(YEAR FROM e.start_date) < EXTRACT(YEAR FROM $2::date)
    GROUP BY e.id
    ORDER BY e.start_date DESC
    LIMIT 1
  `, [expo.name_pattern, expo.start_date]);
  
  if (!prevEdition) return { target_m2: 0, target_revenue: 0, source: 'no_prev' };
  
  const multiplier = 1 + (percentage / 100);
  return {
    target_m2: Math.round(prevEdition.actual_m2 * multiplier),
    target_revenue: Math.round(prevEdition.actual_revenue * multiplier * 100) / 100,
    source: 'auto',
    auto_base_expo_id: prevEdition.id,
    auto_percentage: percentage,
  };
}
```

**Expo name matching:** "Mega Clima Nigeria 2026" → önceki "Mega Clima Nigeria 2025" bul.
Pattern: expo adından yılı çıkar, ILIKE ile eşleştir.

---

## 5. CLUSTER AUTO-DETECTION

**V2 (current):** JavaScript-based grouping by inferred country + month.

```javascript
// 1. Fetch all expos for the year
// 2. inferCountry(city, country, name) resolves NULL country:
//    - country field if present
//    - CITY_COUNTRY map: lagos→Nigeria, algiers/alger→Algeria, casablanca→Morocco, etc.
//    - NAME_COUNTRY_KEYWORDS: search expo name for country keywords
// 3. Group by inferred_country + month (0-based)
// 4. Keep groups with 2+ expos
// 5. Calculate cluster_start (min) and cluster_end (max) dates
```

Cluster isimlendirme: "{Country} {Month} {Year}" → "Morocco July 2026"

**Neden city+week yerine country+month:**
- Bazı fuarların country alanı NULL (Zoho'dan gelmemiş)
- Aynı şehirde farklı yazımlar var (Alger vs Algiers)
- Aynı ülkede aynı ayda olan fuarlar business olarak cluster

---

## 6. API ENDPOINTS

### GET /api/targets?year=2026&mode=edition|fiscal
Tüm fuarlar + hedefler + gerçekleşen + cluster gruplandırma

### PUT /api/targets/:expo_id
Hedef güncelle (manual veya auto percentage)
```json
{
  "method": "manual",
  "target_m2": 2000,
  "target_revenue": 500000
}
// veya
{
  "method": "auto",
  "percentage": 20
}
```

### POST /api/targets/auto-generate?year=2026
Tüm fuarlar için otomatik hedef oluştur (önceki edition +%15)

### GET /api/targets/clusters?year=2026
Cluster listesi + expo mapping

### GET /api/targets/summary?year=2026
KPI toplamları (target vs actual, m² ve revenue)

---

## 7. WHATSAPP INTEGRATION

Yeni intent: target_progress
- "hedefimiz ne kadar?" → toplam target vs actual
- "SIEMA hedefi?" → SIEMA target vs actual
- "bu yıl hedef durumu?" → fiscal year summary

Push mesajlara hedef ekleme:
- Morning Brief: "Target progress: 61% m², 62% revenue"
- Weekly Report: "This week +3% toward target (58% → 61%)"

---

## 8. EXPORT

- Copy Summary: text format hedef vs gerçekleşen
- Excel: cluster bazlı sheet'ler
- PDF: branded rapor

---

## 9. SPRINT PLAN

### Sprint 1: Data + API — DONE
- [x] Migration 019: expo_targets, expo_clusters, expos.cluster_id
- [x] Auto target calculation (prev edition × growth%)
- [x] Cluster auto-detection (country+month grouping with inferCountry)
- [x] API endpoints (5): GET targets, PUT target, POST seed, GET clusters, GET previous
- [x] Seed auto targets for 2026

### Sprint 2: Dashboard — DONE
- [x] /targets sayfası
- [x] KPI cards (Target m², Actual m², Target Revenue, Actual Revenue)
- [x] SVG semi-circle gauge charts (Area Progress m² + Revenue Progress €)
- [x] Cluster grouped collapsible table with expand/collapse chevron animation
- [x] Cluster total rows (bold) + GAP rows (remaining to target)
- [x] Company grand total at bottom with remaining
- [x] Edit modal (auto/manual) with previous edition info
- [x] Year selector + Edition/Fiscal toggle
- [x] Export (Copy Summary/Excel All)
- [x] Expo click → detail
- [x] Seed Auto Targets button with confirm modal
- [x] No-targets banner with generate button
- [x] Dashboard permissions: "targets" module
- [x] Nav: "Targets" after "Finance"

### Sprint 3: WhatsApp + Push — PENDING
- [ ] target_progress intent
- [ ] Push mesajlara hedef progress ekleme

---

## 10. ÖNEMLİ KURALLAR

1. **Auto default:** Hedef girilmemişse önceki edition +%15
2. **Manual override:** CEO istediği zaman rakam veya yüzde girebilir
3. **Cluster:** Aynı ülke + aynı ay = otomatik cluster (inferCountry ile NULL country çözülür)
4. **ELAN EXPO hariç:** Hedef hesaplamada internal agent hariç
5. **Edition primary:** Default edition bazlı, fiscal toggle ile geçiş
6. **Historical:** Geçmiş yıllar da görülebilir (target vs actual comparison)

---

## 11. USER/TEAM OPERATIONAL TARGETS (ChatGPT önerisi)

Expo hedeflerinin yanı sıra kullanıcı/team bazlı operasyonel hedefler:

### user_targets tablosu

```sql
CREATE TABLE IF NOT EXISTS user_targets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  target_type VARCHAR(50),       -- contracts, revenue, collections, sqm, no_payment_limit, deposit_rate
  scope VARCHAR(10),             -- own, team, all
  period_type VARCHAR(20),       -- daily, weekly, monthly, expo_cycle
  target_value NUMERIC(14,2),
  expo_id INTEGER,               -- NULL = genel, set = fuar bazlı
  starts_at DATE,
  ends_at DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Örnekler:
- Elif: weekly contracts target = 5, scope = own
- Elif: monthly collections target = €40.000, scope = team
- CEO: no_payment_limit = 20, scope = all (20'yi geçerse uyar)
- CEO: outstanding_risk = €500.000, scope = all (threshold)

---

## 12. TARGET vs THRESHOLD AYRIMI

İkisi farklı kavram:

**Target (Hedef):** Ulaşılmak istenen değer
- "Bu hafta 5 sözleşme yap"
- "Bu ay €40.000 tahsilat"
- "SIEMA 2026 hedef: 2.000 m²"

**Threshold (Eşik/Alarm):** Aşılmaması gereken limit
- "No-payment firma sayısı 20'yi geçerse uyar"
- "Outstanding €500K'yı geçerse alarm"
- "Deposit rate %30'un altına düşerse uyar"

user_targets tablosunda target_type ile ayrılır:
- target_type: 'contracts_weekly' → TARGET
- target_type: 'no_payment_limit' → THRESHOLD
- target_type: 'outstanding_risk' → THRESHOLD

---

## 13. PUSH + TARGET ENTEGRASYONU

Push mesajlar raw veri + target karşılaştırmasıyla üretilir:

```javascript
const data = await gatherPushData(user, messageType, scope);
const targets = await gatherTargets(user, period);
const insights = compareDataToTargets(data, targets);
const message = formatPushMessage(user, messageType, data, targets, insights);
```

Mesaj örnekleri:

Morning Brief (target bağlı):
```
☀️ Good morning

📊 Status Report — March 23

This week: 3/5 contracts target (60%)
Collections: €8,500 / €20,000 target (42%)
⚠️ Pace is low — need €4,000 today to stay on track

No-payment: 25 companies (limit: 20) ⚠️ OVER THRESHOLD
Outstanding: €777,941

📊 https://eliza.elanfairs.com/targets
```

Daily Wrap (target bağlı):
```
🌙 End of Day

Today: 1 contract (€9,380), 2 payments (€6,421)
Weekly target: 4/5 contracts — 1 more to go
Collections: €14,921 / €20,000 — 75% ✓

📊 https://eliza.elanfairs.com/targets
```

Weekly Report (target bağlı):
```
📊 Weekly Report — 17-21 March

Contracts: 6/8 target (75%)
Collections: €48,137 / €50,000 target (96%) ✓
Strongest: SIEMA — 5 new contracts
Weakest: No-payment follow-up — 25 firms (limit 20) ⚠️
```

