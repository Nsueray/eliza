# ELIZA v2 — CEO Operating System
## Master TODO & Roadmap

Kaynak: CEO_Operating_System_v4.pdf  
Versiyon: v2.0  
Tarih: Mart 2026

---

## Tamamlanan (v1'den devralındı)

- ✅ Phase 1 — Data Infrastructure (PostgreSQL schema, Zoho Sync)
- ✅ Phase 2 — Analytics (War Room, Expo Radar, Sales Leaderboard)
- ✅ Phase 3 — AI Query Engine (POST /api/ai/query)
- ✅ Phase 3b — Risk Engine (velocity model, risk scoring, War Room panel)
- ✅ Phase 4 — Attention Engine (CEO dikkat takibi)
- ✅ Phase 5 — Alert Generator + Morning Brief (payment watch, dedup, scheduler)
- ✅ Phase 8a — WhatsApp Bot temel (Twilio webhook, auth, AI query, CEO kişiliği)
- ✅ Phase 6 — Message Generator (4 şablon, 3 dil, .msg komutu, human-in-the-loop)

---

## v1 vs v2 Temel Farklar

| Konu | v1 | v2 (Yeni) |
|---|---|---|
| Veri kaynakları | Zoho only | Zoho + Leena EMS + Liffy |
| Mimari | 3 katman | 5 intelligence layer |
| Arayüz | Dashboard primary | WhatsApp primary |
| AI modu | Soru-cevap | Proaktif + Planner Agent |
| Dil | Tek dil | TR / EN / FR otomatik |
| Hafıza | Yok | Memory Layer (notlar + pattern) |
| Eylem | Yok | Action Layer (öneri + mesaj üret) |
| Risk açıklama | Yok | Explainable AI zorunlu |
| Dikkat takibi | Yok | Attention Engine |
| Çalışan bilgisi | Açık | Shadow Mode (Year 1 gizli) |

---

## 5 Intelligence Layer (Yeni Mimari)

```
Data Layer      → Zoho + Leena EMS + Liffy + PostgreSQL
Insight Layer   → KPI'lar, Expo progress, Leaderboard (War Room)
Attention Layer → CEO'nun gözden kaçırdıkları
Action Layer    → Öneri + hazır mesaj üretimi
Memory Layer    → Notlar, örüntüler, davranış hafızası
```

---

## PHASE 4 — Attention Engine
**Hedef:** CEO'nun son zamanlarda incelemediği şeyleri tespit et ve push et.

**Durum:** ✅ Tamamlandı

### Görevler

**Veritabanı:**
- [ ] `attention_log` tablosu oluştur
  - `entity_type` (expo / office / agent / exhibitor)
  - `entity_id`
  - `last_reviewed_at`
  - `review_count`
  - `flagged` boolean
- [ ] CEO'nun sorgu geçmişinden `last_reviewed_at` otomatik güncelle

**Engine:**
- [ ] `packages/attention` modülü oluştur
- [ ] Attention skorlama kuralları:
  - [ ] Expo: son 14 günde sorgulanmadıysa → flag
  - [ ] Office: son 30 günde incelenmemişse → flag
  - [ ] Agent: son 21 günde satış yoksa + sorgulanmadıysa → flag
  - [ ] Rebooking: önceki edisyon katılımcısı, yeni kontrat yoksa → flag
- [ ] Threshold güncelle: expo 21 gün, office 30 gün, agent 30 gün
- [ ] `GET /api/attention/items` endpoint → flagged items listesi
- [ ] Öncelik sıralaması: Critical > Warning > Info

**Kabul kriterleri:**
- "What requires my attention?" sorusuna yanıt veriyor
- "Nigeria office 62 days ago" gibi açıklayıcı çıktı üretiyor
- Sabah brifingine besleniyor

---

## PHASE 5 — Alert Generator & Morning Brief
**Hedef:** Sistem CEO'ya geliyor. Proaktif push.

**Durum:** ✅ Tamamlandı

### Alert Generator

- [ ] `packages/alerts` modülü genişlet
- [ ] Alert severity seviyeleri: `info` / `warning` / `critical`
- [ ] Alert deduplication: aynı alert 24 saatte bir kez gönderilir
- [ ] Critical alertler 24 saat throttle'ı bypass etsin (anında iletilsin)
- [ ] Alert fatigue önleme: günde max 5 push alert
- [ ] Alert kaynakları:
  - [ ] Risk Engine → HIGH risk expo
  - [ ] Payment Watch → vadesi yaklaşan ödemeler (−60 / −42 / −21 gün)
  - [ ] Attention Engine → uzun süredir incelenmeyen
  - [ ] Sales velocity → pace düştüyse
  - [ ] Rebooking → geçen yıl katılan, bu yıl yok

**Payment Watch thresholds:**
- [ ] Etkinlik − 60 gün → `warning`
- [ ] Etkinlik − 42 gün → `risk`
- [ ] Etkinlik − 21 gün → `critical`

### Morning Brief

- [ ] `packages/briefing` modülü oluştur
- [ ] Scheduler: her sabah 08:00 TR saati (cron)
- [ ] Brifing yapısı (kısa, aksiyonable, Türkçe):
  ```
  ELIZA Sabah Brifing — [tarih]
  
  🔴 3 konu dikkat gerektiriyor:
  • Madesign hedefin gerisinde (velocity düşük)
  • SIEMA ödenmemiş kontratlar: €42K
  • Nigeria ofisi 62 gündür incelenmedi
  
  📊 Dün: 3 yeni kontrat / 45m² / €12,400
  ```
- [ ] Brifing WhatsApp üzerinden iletilir
- [ ] `sent_briefings` tablosu → tekrar gönderimini önle

**Kabul kriterleri:**
- Her sabah 08:00'de gelir
- Maksimum 5 madde, okunabilir
- Explainable: her uyarı neden geldiğini açıklıyor

---

## PHASE 6 — Message Generator
**Hedef:** ELIZA, CEO adına hazır mesajlar üretir.

**Durum:** ✅ Tamamlandı

- [x] `packages/messages` modülü oluştur
- [x] Mesaj şablonları:
  - [x] Agent aktivasyon mesajı ("Elif, Madesign geride, bu hafta önceliklendir")
  - [x] Exhibitor rebooking mesajı ("Samsung SIEMA'ya davet")
  - [x] Ödeme hatırlatma mesajı
  - [x] Toplantı öncesi özet
- [x] Çok dil desteği:
  - [x] Kullanıcı/alıcıya göre dil otomatik seçilir
  - [x] Elif → Türkçe / Meriem → Fransızca / diğerleri → İngilizce
  - [x] `sales_agents` tablosuna `preferred_language` alanı eklendi
- [x] Human-in-the-loop: ELIZA önerir, CEO onaylar (10 dk expiry)
- [x] WhatsApp'tan: `.msg [kişi] [konu]` → taslak üret → CEO "gönder"/"iptal" → Twilio ile ilet
- [x] API endpoints: GET /api/messages/templates, POST /api/messages/generate, POST /api/messages/send
- [x] Bağlam entegrasyonu: expo_metrics + edition_contracts verisiyle kişiselleştirilmiş mesaj

**Kabul kriterleri:**
- 3 dilde mesaj üretebiliyor
- CEO onaylamadan gönderilmiyor
- Bağlama uygun (expo adı, rakam, alıcı ismi içeriyor)

---

## PHASE 7 — Risk Engine Expansion + Explainable AI ← CURRENT
**Hedef:** Risk açıklamalı olsun, daha fazla sinyal kullansın.

**Durum:** ⬜ Pending

**Mevcut Risk Engine'e eklenecekler:**

- [ ] Explainable AI zorunlu hale getir:
  ```
  Risk: HIGH
  Sebep: Satış hızı %40 düştü ve ödenmemiş kontratlar €30K'yı aşıyor.
  ```
- [ ] Payment Watch sinyali → risk skoruna ekle
- [ ] Attention gap sinyali → uzun süredir incelenmeyen expo risk puanı artar
- [ ] Rebooking missing → risk artışı
- [ ] Unpaid contracts sinyali → risk skoruna ekle
- [ ] `Balance1` field Zoho'dan çek → ödenmemiş tutar
- [ ] Kritik eşik: ödenmemiş kontrat €30K üzeri → HIGH risk
- [ ] `GET /api/expos/risk` response'una `explanation` alanı ekle
- [ ] Risk Engine sonuçlarını War Room'da açıklama ile göster

**Velocity Engine güncelleme:**
- [ ] "Current pace: 180 m²/month / Required: 300 m²/month" formatında çıktı
- [ ] Velocity trend: son 30 gün vs önceki 30 gün karşılaştırması

---

## PHASE 8 — WhatsApp Interface + Planner Agent
**Hedef:** WhatsApp primary interface, compound komutlar destekli.

**Durum:** ✅ Phase 8a tamamlandı — 🟡 Phase 8b pending (Planner Agent)

### Temel WhatsApp Bot

- [x] Twilio WhatsApp API entegrasyonu (`apps/whatsapp-bot`)
- [x] Gelen mesaj → AI Query Engine → yanıt
- [x] Dil otomatik algılama (TR / EN / FR)
- [x] Telefon numarası bazlı kimlik doğrulama
- [x] CEO için tam erişim, diğerleri kısıtlı
- [x] CEO kişiliği (Selam Baba / Hi Dad / Bonjour Papa)
- [x] Dot-commands: .brief, .risk, .attention, .help
- [x] Türkçe veri formatlama (tarih, para, yüzde)

### Planner Agent (Yeni)

Compound komutları destekler:

- [ ] "SIEMA durumunu gönder ve Nigeria ofisini radar'a ekle"
  → [expo_status(SIEMA)] + [attention_add(Nigeria)]
- [ ] Araç listesi (tools):
  - `query_data` → AI Query Engine
  - `get_attention` → Attention Engine
  - `get_risk` → Risk Engine
  - `generate_message` → Message Generator
  - `add_note` → Memory Layer
  - `get_briefing` → Morning Brief özeti
- [ ] Max 3 araç tek komutta
- [ ] Planner önce planı gösterir, CEO onayla derse çalıştırır (kritik eylemler için)
- [ ] Rate limit: max 1 mesaj/saniye (Twilio sandbox limiti)

### Konuşma Hafızası

- [ ] `conversations` tablosu → son 20 mesaj bağlam olarak taşınır
- [ ] `.today met Meriem via Zoom` → `memory` tablosuna yaz
- [ ] `.note Samsung SIEMA için geliyor` → kalıcı not
- [ ] Bağlam: "Peki Elif bu expoda ne sattı?" → önceki expo'yu hatırlıyor

### Komut Formatları

- [ ] `.today [not]` → günlük not kaydet
- [ ] `.note [not]` → kalıcı hafızaya ekle
- [ ] `.brief` → sabah brifingini şimdi iste
- [ ] `.risk [expo]` → expo risk raporu
- [ ] `.msg [kişi] [konu]` → mesaj taslağı oluştur

**Kabul kriterleri:**
- Compound komut: "SIEMA durumu ve Elif performansı" tek mesajla çalışıyor
- Dil otomatik algılanıyor
- `.today` notu kaydediliyor ve sorgulanabiliyor
- Tanımsız numara erişim alamıyor

---

## PHASE 9 — Memory Layer & Pattern Detection
**Hedef:** ELIZA organizasyonel hafızayı tutar, davranış örüntülerini öğrenir.

**Durum:** ⬜ Pending

- [ ] `memory` tablosu:
  - `type` (note / pattern / exhibitor_behavior / meeting)
  - `entity` (şirket / kişi / expo adı)
  - `content`
  - `source` (whatsapp / auto-detected)
  - `created_at`
- [ ] Exhibitor davranış takibi:
  - [ ] "Samsung her edisyona katılıyor" → otomatik pattern tespiti
  - [ ] "Daikin genellikle geç kitler" → rebooking tahmin girdisi
  - [ ] "Fas expoları geç satar" → risk modelinde kullanılır
- [ ] Memory sorgulanabilir: "Samsung hakkında ne biliyoruz?"
- [ ] Pattern Detection engine:
  - [ ] Son 3 edisyon verisiyle davranış analizi
  - [ ] Otomatik pattern kayıt (yeterli veri varsa)
- [ ] Team Monitoring:
  - [ ] Ofis bazlı performans karşılaştırması
  - [ ] "Kenya ofisi Nigeria'dan yavaş" tespiti

---

## PHASE 10 — Yeni Veri Kaynakları
**Hedef:** Leena EMS ve Liffy entegrasyonu.

**Durum:** ⬜ Pending (bağımlılık: API erişimi)

- [ ] Leena EMS entegrasyonu araştır → operasyonel etkinlik verisi
- [ ] Liffy entegrasyonu → lead generation verisi
- [ ] Ziyaretçi kayıt verisi → Data Layer'a ekle
- [ ] Web analytics → expo ilgi takibi
- [ ] Her kaynak için ayrı sync modülü

---

## PHASE 11 — Deploy & Production
**Durum:** ⬜ Pending

- [ ] Render yapılandırması
- [ ] PostgreSQL production instance
- [ ] Zoho webhook → anlık sync
- [ ] Twilio production number
- [ ] Uptime monitoring
- [ ] Günlük backup
- [ ] Hata durumunda CEO'ya WhatsApp bildirimi

---

## Shadow Mode Notları

Year 1: Sadece CEO kullanıyor. Ekip sistemin varlığından haberdar değil.
Year 2: Ülke müdürlerine kademeli açılış planlanabilir.
Yasal not: Çalışan izleme yasaları için hukuki inceleme önerilir.

---

## Öneri: Başlangıç Sırası

```
Phase 4 (Attention Engine)     → 2-3 gün
Phase 5 (Alert + Morning Brief) → 3-4 gün
Phase 8a (WhatsApp temel)      → 2-3 gün  ← kullanılabilir sistem!
Phase 6 (Message Generator)    → 2-3 gün
Phase 7 (Risk expansion)       → 1-2 gün
Phase 8b (Planner Agent)       → 3-4 gün
Phase 9 (Memory + Pattern)     → 4-5 gün
Phase 10 (Leena + Liffy)       → bağımlı
Phase 11 (Deploy)              → 2-3 gün
```

**İlk kullanılabilir milestone:** Phase 4 + 5 + 8a tamamlandı ✅
WhatsApp'tan soru sorabilir + sabah brifing alabilirsin.
Sıradaki: Phase 7 (Risk Engine Expansion)

---

## Benchmark — AI Query Engine Kalite Testi

- [x] 50 soru benchmark suite oluşturuldu (docs/benchmark/questions.json)
- [x] Otomatik runner: node packages/ai/benchmark.js
- [x] Intent synonym mapping (tolerance)
- [ ] Pass rate %70 → %90 çıkar
- [ ] Answer length enforcement (max 300 char)
- [ ] Yeni intents: expo_ranking, agent_pricing, attention_items

---

## Gelecek (Post-Phase 11)

- [ ] Ülke müdürlerine kademeli erişim açılışı (Year 2)
- [ ] Exhibitor self-service portal
- [ ] Otomatik rebooking kampanya motoru
- [ ] Predictive analytics: gelecek edisyon satış tahmini
- [ ] Multi-tenant: birden fazla şirket desteği

---

*ELIZA — CEO'nun her zaman doğru bilgiye sahip olmasını sağlar.*
