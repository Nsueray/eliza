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

```sql
-- Aynı start_date (±3 gün) + aynı city olan fuarları grupla
SELECT 
  city, country, 
  MIN(start_date) AS cluster_start,
  MAX(end_date) AS cluster_end,
  ARRAY_AGG(id ORDER BY name) AS expo_ids,
  ARRAY_AGG(name ORDER BY name) AS expo_names
FROM expos
WHERE start_date >= CURRENT_DATE
GROUP BY city, country, 
  DATE_TRUNC('week', start_date)  -- aynı hafta = aynı cluster
HAVING COUNT(*) > 1
ORDER BY MIN(start_date);
```

Cluster isimlendirme: "{City} {Month} {Year}" → "Casablanca July 2026"

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

### Sprint 1: Data + API
- [ ] Migration 019: expo_targets, expo_clusters, expos.cluster_id
- [ ] Auto target calculation
- [ ] Cluster auto-detection
- [ ] API endpoints (5)
- [ ] Seed auto targets for 2026

### Sprint 2: Dashboard
- [ ] /targets sayfası
- [ ] KPI cards
- [ ] Cluster grouped table
- [ ] Inline edit (auto/manual)
- [ ] Year selector + Edition/Fiscal toggle
- [ ] Export (Copy/CSV/Excel)
- [ ] Expo click → detail

### Sprint 3: WhatsApp + Push
- [ ] target_progress intent
- [ ] Push mesajlara hedef progress ekleme

---

## 10. ÖNEMLİ KURALLAR

1. **Auto default:** Hedef girilmemişse önceki edition +%15
2. **Manual override:** CEO istediği zaman rakam veya yüzde girebilir
3. **Cluster:** Aynı hafta + aynı şehir = otomatik cluster
4. **ELAN EXPO hariç:** Hedef hesaplamada internal agent hariç
5. **Edition primary:** Default edition bazlı, fiscal toggle ile geçiş
6. **Historical:** Geçmiş yıllar da görülebilir (target vs actual comparison)
