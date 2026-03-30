# ELL Platform Roadmap
## ELIZA + LİFFY + LEENA — Zoho'dan Bağımsızlaşma Stratejisi

**Versiyon:** v1.1  
**Tarih:** 2026-03-30  
**Sahibi:** Elan Expo / Suer Ay  
**Değişiklikler:** ChatGPT ve Gemini eleştirileri doğrultusunda güncellendi — faz sırası, çift yazma stratejisi, arşivleme, onay matrisi

---

## 1. Vizyon

Elan Expo bugün Zoho CRM'e bağımlı bir şirkettir. Tüm satış verileri, sözleşmeler, fuar bilgileri ve ödeme kayıtları Zoho'da yaşar. ELIZA bu veriye senkronizasyonla erişir — gerçek zamanlı değil, dolaylı, kırılgan.

**Hedef:** 2027 sonuna kadar Zoho'yu tüm operasyonel süreçlerden devre dışı bırakmak ve ELL platformuna tam geçiş yapmak.

ELL = **E**LIZA + **L**İFFY + **L**EENA

Üç sistem tek bir veritabanı etrafında birleşir. Zoho ortadan kalkar. ELIZA CEO'nun gözü olur, LİFFY satışın beyni olur, LEENA operasyonun eli olur.

---

## 2. Sistem Rolleri

### ELIZA — CEO Karar Destek Sistemi
**Ne yapar:** Okur, analiz eder, önerir. Asla yazmaz.
- WhatsApp üzerinden doğal dil sorguları
- War Room dashboard (satış, finans, operasyon)
- Risk tespiti, anomali uyarıları
- Sabah brifingi, otomatik push mesajlar
- LİFFY ve LEENA'dan okur, hiçbirine yazmaz

**Zoho karşılığı:** Zoho Analytics + Zoho CRM raporlama → tamamen ELL'e taşınır

---

### LİFFY — CRM ve Satış Zinciri
**Ne yapar:** Satışın tüm döngüsüne sahip olur.

```
Lead → Contact → Quote → Contract → Invoice → Payment → Revenue
```

**Modüller:**
- Lead yönetimi (kaynak takibi, yeni potansiyel müşteriler)
- İletişim takibi (firmalar, kişiler, geçmiş etkileşimler)
- Teklif oluşturma (m², fiyat, pavyon tipi, özel koşullar)
- Sözleşme oluşturma ve AF numarası atama
- Fatura ve ödeme takibi (Balance, Received, Remaining)
- Rebooking akışı (bir sonraki edisyon için otomatik hatırlatma)
- Sales agent yönetimi (komisyon, hedef, performans)

**Zoho karşılığı:** Zoho CRM (Sales Orders, Accounts, Contacts, Leads) → tamamen LİFFY'e taşınır

**Mevcut durum:** Temel veri modeli ELIZA DB'de var (contracts, exhibitors, sales_agents, contract_payments). UI ve input akışı henüz yok.

---

### LEENA — Fuar Operasyon Sistemi
**Ne yapar:** Fuarın saha gerçekliğini dijitalleştirir.

**Modüller (öncelik sırasıyla):**
- Fuar oluşturma ve yönetimi — **Kritik (LİFFY'nin bağımlı olduğu master data)**
- Gider takibi (venue, lojistik, taşeron, pazarlama)
- Kat planı yönetimi (stand numaraları, boyutlar, yerleşim)
- Post-show raporu (gerçekleşen vs hedef)
- Katalog oluşturma — *Sonraki faz*
- Fuar websitesi oluşturma — *Sonraki faz*
- Personel ve görev yönetimi — *Sonraki faz*

**Zoho karşılığı:** Zoho CRM (Vendors/Expos module, Expensess module) → tamamen LEENA'ya taşınır

**Mevcut durum:** Fuar verisi ELIZA DB'de var (expos, expenses, expo_targets). UI ve operasyon akışı henüz yok.

---

## 3. Mevcut Durum Analizi

### Nerede duruyoruz?

| Bileşen | Veri Modeli | API | UI | Zoho'dan Bağımsız? |
|---------|------------|-----|----|--------------------|
| ELIZA | ✅ Tam | ✅ Tam | ✅ Tam | ⚠️ Hayır — Zoho sync'e bağımlı |
| LİFFY | ⚠️ Kısmi | ❌ Yok | ❌ Yok | ❌ Hayır |
| LEENA | ⚠️ Kısmi | ❌ Yok | ❌ Yok | ❌ Hayır |

### Zoho'da hala ne var?

**Aktif olarak kullanılan Zoho modülleri (kritiklik sırasıyla):**
1. **Sales_Orders** → contracts (AF numarası, m², gelir, statü, ödeme) — **En kritik**
2. **Accounts** → exhibitors (firma bilgileri) — **Kritik**
3. **Vendors** → expos (fuar listesi, tarihler)
4. **Expensess** → expenses (gider kayıtları)
5. **Sales_Agents** → sales_agents (satış ekibi)

**Zoho'nun yapabileceği ama ELL'in henüz yapamadığı:**
- Sözleşme girişi (form, onay akışı, AF numarası atama)
- Ödeme kaydı (Balance, Received_Payment subform)
- Fatura oluşturma
- Email entegrasyonu (sözleşme gönderimi)

---

## 4. Geçiş Stratejisi

### Temel Prensip: Kritiklik Sırasına Göre, CDC ile

Zoho bir günde kapatılmaz. Her modül ayrı ayrı ELL'e taşınır.
Bir modül ELL'e taşındığında Zoho'daki karşılığı salt-okunur (read-only) hale gelir.
Tüm modüller geçince Zoho aboneliği iptal edilir.

**Faz sırası değişikliği (v1.0 → v1.1):**

v1.0'da LEENA önce, LİFFY sonra önerilmişti. ChatGPT'nin eleştirisi doğru: Zoho bağımlılığının gerçek kalbi Sales_Orders + Accounts. Bu nedenle:

- **Faz 1: LİFFY çekirdeği** — Firma, kişi, sözleşme, ödeme (en kritik Zoho modülleri)
- **Faz 2: LEENA çekirdeği** — Fuar yönetimi, giderler (Yaprak ile daha düşük riskli pilot)
- **Faz 3: ELIZA source switch** — Zoho sync yerine ELL DB
- **Faz 4: Zoho kapatma**

> **Önemli bağımlılık:** LEENA'nın fuar master data'sı (expos tablosu) LİFFY'nin sözleşme formunun temelini oluşturur. Bu nedenle Faz 0'da LEENA fuar CRUD API'si (UI olmadan) önce hazırlanır, LİFFY bu temele oturur.

### Çift Yazma Stratejisi: CDC/Webhook (Manuel Değil)

v1.0'da "3 ay paralel çalıştır, çift yazma" önerilmişti. **Bu revize edildi.**

Manuel çift yazma kullanılmayacak. Sebep: insan eliyle iki sisteme aynı kalitede veri girmek sürdürülemez, veri sapması (data drift) kaçınılmaz.

**CDC (Change Data Capture) yaklaşımı:**

```
Satış ekibi → Zoho'ya giriş yapmaya DEVAM eder (geçiş dönemi)
      ↓
Zoho Webhook + Deluge script tetiklenir
      ↓
LİFFY API'sine otomatik POST
      ↓
LİFFY DB güncellenir (arka planda, sessizce)
      ↓
Gölge mod: LİFFY hesaplamaları = Zoho hesaplamaları?
      ↓
Doğrulandıktan sonra: Zoho read-only, LİFFY tek giriş noktası
```

**Geçiş süreci adımları:**
1. Zoho Webhook → LİFFY otomatik sync kurulur (4-6 hafta)
2. Gölge mod doğrulama: LİFFY çıktısı Zoho ile karşılaştırılır
3. 1-2 pilot kullanıcı LİFFY'den giriş başlar
4. Kademeli genişleme → tüm satış ekibi
5. Hard Cutover: Zoho read-only moda alınır

---

## 5. Aşamalar

### Faz 0 — Temel Hazırlık (Q2 2026, ~2 ay)
*Şu an yapılması gereken altyapı işleri*

**Hedef:** ELL'in veri sahipliğine hazır olması

- [ ] Monorepo'ya LİFFY ve LEENA workspace'leri ekle (Turborepo)
- [ ] Ortak auth sistemi (tek kullanıcı tablosu, rol bazlı erişim)
- [ ] ELL launchpad — üç sisteme giriş noktası (HTML, hazır)
- [ ] Render servis audit — hangi servisler paid plana geçmeli?
- [ ] UptimeRobot veya Render paid plan ile scheduler güvenilirliği
- [ ] Twilio Content Template (WhatsApp 24 saat kuralı aşımı)
- [ ] **LEENA fuar CRUD API** — expos tablosu UI olmadan API düzeyinde hazır (LİFFY Faz 1 bağımlılığı)
- [ ] Monorepo kararı verildi: **LİFFY + LEENA aynı monorepo**

---

### Faz 1 — LİFFY MVP (Q3 2026, ~3 ay)
*Zoho'nun kalbini devre dışı bırak*

**Hedef:** Zoho Sales_Orders ve Accounts modüllerini devre dışı bırak

**LİFFY 1.1 — Firma ve Kişi Yönetimi**
- Firma profili (isim, ülke, sektör, geçmiş katılımlar)
- Kişi yönetimi (ad, ünvan, telefon, email)
- Zoho Accounts → LİFFY migrasyon scripti
- Tekrar eden firma araması (duplicate detection)

**LİFFY 1.2 — Sözleşme Girişi**
- Yeni sözleşme formu (firma seç, fuar seç, m², fiyat, tip)
- AF numarası: Valid statüsüne geçince PostgreSQL SEQUENCE ile otomatik atama
- Statü yönetimi (Valid, Cancelled, Transferred In/Out, On Hold)
- Sözleşme PDF oluşturma + email gönderimi
- Zoho → LİFFY CDC webhook (geçiş dönemi otomatik sync)

**LİFFY 1.3 — Sözleşme Onay Matrisi**

| Sözleşme tipi | Oluşturan | Onaylayan | Akış |
|--------------|-----------|-----------|------|
| Standart fiyat, indirimsiz | Sales agent | Otomatik (sistem) | Direkt Valid |
| %10'a kadar indirim | Sales agent | Satış yöneticisi | WhatsApp bildirimi |
| %10 üzeri indirim | Sales agent | CEO | ELIZA'dan onay |
| 100m²+ veya pavilion | Sales agent | CEO | ELIZA'dan onay |

- CEO onayı ELIZA WhatsApp'tan: "Onayla" / "Reddet"
- Onay tamamlanmadan sözleşme PDF'i gönderilemez
- AF numarası onay sonrası atanır

**LİFFY 1.4 — Ödeme Takibi**
- Ödeme planı (deposit %30 + pre-event %70)
- Ödeme kaydı (received, balance, currency — NGN/MAD → EUR)
- Zoho Received_Payment subform → LİFFY'e taşınır
- WhatsApp ödeme hatırlatıcıları (ELIZA üzerinden)

**Zoho modülleri kapatılır:** Sales_Orders, Accounts  
**API etkisi:** Contracts + payments sync kesilir → ~92.000 kredi/gün tasarruf

---

### Faz 2 — LEENA MVP (Q4 2026, ~2 ay)
*Operasyonu dijitalleştir*

**Hedef:** Zoho Vendors ve Expensess modüllerini devre dışı bırak

**LEENA 2.1 — Fuar Yönetimi UI**
- Fuar oluşturma/düzenleme formu (Faz 0 API'nin üstüne UI)
- Fuar listesi, filtrele, export
- Cluster yönetimi (Casablanca, Lagos vb.)
- Zoho Vendors sync → kesilir

**LEENA 2.2 — Gider Yönetimi**
- Gider girişi UI (WhatsApp'tan mevcut, web UI eksik)
- Kategori yönetimi (venue, lojistik, pazarlama, taşeron)
- Gider onay akışı (CEO WhatsApp'tan)
- Zoho Expensess sync → kesilir

**LEENA 2.3 — Kat Planı (temel)**
- Stand listesi (numara, m², tip, statü: boş/satılmış/rezerve)
- LİFFY sözleşmesiyle stand eşleştirmesi
- PDF export

**Zoho modülleri kapatılır:** Vendors, Expensess  
**Sonraki faza bırakılanlar:** Katalog oluşturma, website builder, post-show rapor, personel yönetimi

---

### Faz 3 — ELIZA Intelligence Upgrade (Q1 2027, ~2 ay)
*Zoho sync'i kes, ELL DB'den beslen*

**Hedef:** ELIZA'nın veri kaynağını Zoho sync'ten ELL DB'ye geçir

**ELIZA 3.1 — Veri Kaynağı Geçişi**
- Tüm ELIZA sorguları artık doğrudan ELL DB'den
- `packages/zoho-sync` kaldırılır
- Real-time veri (sync gecikmesi: 0)

**ELIZA 3.2 — Çapraz Sistem Intelligence**
- LİFFY + LEENA verisiyle zenginleştirilmiş analizler
- "SIEMA 2026 giderleri vs geliri" — LEENA + LİFFY birlikte
- Sales agent performansı + fuar gideri = net marj
- Kat planı doluluk oranı + sözleşme sayısı = fuar hazırlık skoru

**ELIZA 3.3 — Proaktif Intelligence**
- Rebooking alert: "SIEMA 2025'ten 40 firma henüz rebooking yapmadı"
- Ödeme riski: "Bu hafta vadesi gelen 12 firma — €85.000"
- Satış hızı anomalisi: "Madesign bu ay geçen yıla göre %40 yavaş"

---

### Faz 4 — Zoho Kapatma (Q2 2027, ~1 ay)

- [ ] Tüm aktif Zoho kullanıcıları ELL'e geçmiş
- [ ] Tarihi veri arşivi tamamlanmış (bkz. Bölüm 7)
- [ ] Zoho API kredileri → 0
- [ ] Aylık Zoho maliyeti → 0
- [ ] ELL tek kaynak

---

## 6. Teknik Mimari

### Veri Modeli

```
ELL Database (PostgreSQL)
├── Ortak
│   ├── users (auth, roller, izinler)
│   ├── companies (firmalar — LİFFY ve LEENA paylaşır)
│   └── contacts (kişiler)
│
├── LİFFY tabloları
│   ├── leads
│   ├── quotes
│   ├── contracts (mevcut, genişletilecek)
│   ├── contract_payments (mevcut)
│   └── invoices
│
├── LEENA tabloları
│   ├── expos (mevcut, genişletilecek)
│   ├── expo_stands (yeni)
│   ├── expenses (mevcut)
│   └── catalogs (sonraki faz)
│
├── ELIZA tabloları
│   ├── edition_contracts (view)
│   ├── fiscal_contracts (view)
│   ├── expo_metrics (mevcut)
│   ├── message_logs (mevcut)
│   └── alerts (mevcut)
│
└── Arşiv (read-only)
    └── legacy_contracts (2014-2022, sorgulanabilir ama yazma kapalı)
```

### Servis Mimarisi

```
ELL Monorepo (Turborepo)
├── packages/
│   ├── db/          — Ortak PostgreSQL + migrations
│   ├── auth/        — Ortak JWT auth
│   ├── ai/          — ELIZA query engine
│   ├── zoho-sync/   — GEÇİCİ — Faz 3'te kaldırılır
│   └── shared/      — Ortak types, utils
│
├── apps/
│   ├── eliza-dashboard/   — War Room, Sales, Finance, Targets
│   ├── eliza-bot/         — WhatsApp bot
│   ├── eliza-api/         — ELIZA API + Scheduler
│   ├── liffy/             — CRM UI (Faz 1'de başlar)
│   ├── leena/             — Ops UI (Faz 2'de başlar)
│   └── launchpad/         — ELL giriş noktası (mevcut)
│
└── Render Servisleri
    ├── eliza-dashboard    — eliza.elanfairs.com (Starter paid)
    ├── eliza-api          — Scheduler kritik (Starter paid)
    ├── eliza-bot          — WhatsApp webhook (Starter paid)
    ├── liffy              — liffy.elanfairs.com
    ├── leena              — leena.app
    └── PostgreSQL         — Render managed (paid, PITR açık)
```

---

## 7. Tarihi Veri Arşivleme Stratejisi

**Sorun:** 2014-2026 arası ~3.500 sözleşme. Zoho kapanınca ne olacak?

**Karar: Çift katmanlı arşivleme (Tiered Storage)**

### Aktif Katman (Hot — LİFFY DB'de)
- Son 3 yıl (2023-2026): aktif, rebooking potansiyeli olan sözleşmeler
- Ödemesi devam eden tüm firmalar
- Günlük operasyonda kullanılan canlı kayıtlar

### Arşiv Katmanı (Cold — ELL içinde read-only)
- 2014-2022: kapanmış, bakiyesi sıfırlanmış sözleşmeler
- ELL DB'de `legacy_contracts` tablosu olarak tutulur
- ELIZA üzerinden sorgulanabilir: "2019 SIEMA'da kaç firma vardı?"
- Yazma kapalı, sadece okuma
- Yasal saklama yükümlülüğü karşılanır (10 yıl)

**Zoho kapanmadan önce:** Tüm modüller CSV + attachment olarak tam export, güvenli depolamaya yüklenir.

---

## 8. Riskler ve Azaltma Stratejileri

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| Sözleşme girişi geçişinde veri kaybı | Orta | Çok Yüksek | CDC webhook (manuel değil), gölge mod doğrulama |
| Satış ekibinin LİFFY adaptasyonu | Yüksek | Yüksek | Pilot → kademeli → hard cutover |
| AF numarası tutarsızlığı | Düşük | Yüksek | PostgreSQL SEQUENCE, Valid statüsünde atama |
| LEENA fuar data'sı LİFFY'den önce hazır olmaması | Orta | Yüksek | Faz 0'da expos CRUD API önce tamamlanır |
| Zoho veri migrasyonu eksiklikleri | Orta | Orta | Tam export + doğrulama scripti |
| Render free tier güvenilirliği | Yüksek | Orta | 3 kritik servis Starter paid plana geçer |
| Monorepo deploy karmaşıklığı | Düşük | Orta | Turborepo affected mantığı, Render build filters |

---

## 9. Başarı Kriterleri

### Faz 1 tamamlandığında
- Satış ekibi yeni sözleşmeler için Zoho'ya girmiyor
- LİFFY'den sözleşme PDF oluşturulup müşteriye gönderilebiliyor
- AF numarası otomatik atanıyor
- CEO onayı ELIZA WhatsApp'tan yapılabiliyor
- Contracts + payments Zoho sync kesilmiş

### Faz 2 tamamlandığında
- Yaprak yeni fuar oluşturmak için Zoho'ya girmiyor
- Tüm giderler LEENA'dan giriliyor
- Vendors + Expensess Zoho sync kesilmiş

### Faz 3 tamamlandığında
- ELIZA veri kaynağı tamamen ELL DB
- zoho-sync paketi kaldırılmış
- Sync gecikmesi: 0

### Faz 4 tamamlandığında
- Zoho aboneliği iptal
- Tüm çalışanlar ELL sistemlerini kullanıyor
- Aylık Zoho maliyeti: €0

---

## 10. Satış Ekibi Adaptasyon Stratejisi

**Model: Kademeli Zorunluluk**

1. **Pilot** (Faz 1 başı, 2-3 hafta): 1-2 gönüllü agent LİFFY'den giriş yapar
2. **Yeni sözleşmeler LİFFY'den** (Faz 1 ortası): Eski kayıtlar Zoho'da görünür, yeniler LİFFY'den
3. **Zoho read-only** (Faz 1 sonu): Sadece geçmiş kayıt arama
4. **Hard cutover**: Zoho yazma yetkisi tamamen kaldırılır

**Zorunluluk kuralı:** War Room toplantıları, prim hesapları, performans değerlendirmeleri sadece LİFFY verisine dayanır. "LİFFY'de yoksa yapılmamıştır."

**LİFFY UX öncelikleri:**
- Firma arama → 1 tıkla seç
- Fuar seç → LEENA'dan otomatik liste
- m² ve fiyat gir → PDF otomatik oluşsun
- Ödeme hatırlatıcısı → ELIZA otomatik atsın

---

## 11. Açık Kararlar (v1.1'de yanıtlandı)

| Soru | Karar | Gerekçe |
|------|-------|---------|
| Monorepo mu, çoklu repo mu? | **Monorepo (Turborepo)** | Ortak DB, auth, types — koordinasyon kritik |
| Çift yazma dönemi? | **CDC webhook, manuel değil** | İnsan eliyle çift giriş veri sapması üretir |
| Sözleşme onay akışı? | **Eşik bazlı hiyerarşik** | CEO sadece %10+ indirim ve 100m²+ onaylar |
| Tarihi veri? | **ELL içinde read-only arşiv** | Sorgulanabilir olmalı, aktif DB'den ayrı |
| Faz sıralaması? | **LİFFY önce, LEENA sonra** | Zoho'nun kalbi Sales_Orders + Accounts |
| Render yeterli mi? | **Şimdilik evet, kritikler paid** | Platform bilgisi var, önce mimariyi kur |
| Satış ekibi adaptasyonu? | **Kademeli → zorunlu** | Pilot → yeni girişler → hard cutover |

---

## 12. Zaman Çizelgesi Özeti

| Faz | Dönem | Süre | Zoho'da Kapanan |
|-----|-------|------|-----------------|
| Faz 0 — Hazırlık | Q2 2026 | 2 ay | — |
| Faz 1 — LİFFY MVP | Q3 2026 | 3 ay | Sales_Orders, Accounts |
| Faz 2 — LEENA MVP | Q4 2026 | 2 ay | Vendors, Expensess |
| Faz 3 — ELIZA Upgrade | Q1 2027 | 2 ay | Sync engine |
| Faz 4 — Zoho Kapatma | Q2 2027 | 1 ay | Tüm modüller |

**Toplam süre:** ~12 ay  
**Hedef:** Haziran 2027'de Zoho aboneliği iptal

---

*v1.1 — ChatGPT ve Gemini eleştirileri doğrultusunda güncellendi. Faz sırası LİFFY öncelikli olarak değiştirildi. Manuel çift yazma CDC webhook ile değiştirildi. Tiered arşivleme ve onay matrisi eklendi.*
