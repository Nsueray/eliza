# ELIZA — Known Issues

Rules:
- Her yeni bug bulunduğunda buraya ekle
- Fix edilince Status: FIXED + commit hash yaz
- claude.md'e de özet ekle
- Aynı bug 2+ kez çıkarsa Root cause mutlaka yaz

---

## [ISSUE-001] Duplicate rows in WhatsApp response
**Status:** FIXED (2026-03-10)
**First seen:** 2026-03-10
**Description:** handler.js hem Sonnet summary hem raw data rows'u aynı anda WhatsApp'a yazıyor. Her büyük refactor'da tekrar ediyor.
**Root cause:** queryEngine response formatı ({answer, data}) handler'da ikisi birden render ediliyor.
**Fix attempted:** 3 kez, her seferinde refactor'da bozuldu.
**Fix:** handler.js'de data rows rendering tamamen kaldırıldı. Sadece Sonnet answer gösteriliyor. totalRows > 5 ise "... ve X sonuç daha" ekleniyor.
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-002] Turkish relative time not recognized
**Status:** FIXED (2026-03-10, commit e34971f)
**First seen:** 2026-03-10
**Description:** "bugün" → CURRENT_DATE çalışmıyordu
**Fix:** router.js normalize() Türkçe→İngilizce time mapping

---

## [ISSUE-003] ELAN EXPO in agent rankings
**Status:** FIXED (2026-03-10, commit 81fbe8d)
**First seen:** 2026-03-10
**Description:** ELAN EXPO internal agent satışçı listesinde görünüyordu
**Fix:** WHERE sales_agent != 'ELAN EXPO' tüm agent sorgularına eklendi
**Rule:** Revenue dahil, count/m²/ranking hariç

---

## [ISSUE-004] "Kaç gün kaldı" 2016-2017 döndürüyordu
**Status:** FIXED (2026-03-10, commit d8771fc)
**First seen:** 2026-03-10
**Fix:** WHERE start_date > CURRENT_DATE filtresi eklendi

---

## [ISSUE-005] "Kaç fuar var" yanlış sayı döndürüyordu
**Status:** FIXED (2026-03-10, commit f5663a8)
**First seen:** 2026-03-10
**Description:** "2026'da kaç fuar var" → "5 fuar" diyordu, gerçekte 20
**Root cause:** generateAnswer() veriyi 5 satıra kırpıyor, Sonnet sadece gördüğü satırları sayıyordu
**Fix:** Kırpılan veriye "Total rows: N" bilgisi eklendi, Sonnet gerçek sayıyı kullanıyor

---

## [ISSUE-006] "Bugün kaç kontrat" tüm ayı döndürüyordu
**Status:** FIXED (2026-03-10, commit 27d29a8)
**First seen:** 2026-03-10
**Description:** revenue_summary SQL'de DATE(contract_date) = CURRENT_DATE filtresi yoktu
**Fix:** period: 'today' entity + SQL branch eklendi

---

## [ISSUE-007] "Son 2 yıl" 2017-2018 döndürüyordu
**Status:** FIXED (2026-03-10, commit 27d29a8)
**First seen:** 2026-03-10
**Description:** relative_years entity ve SQL desteği yoktu
**Fix:** Router'da "son X yıl" extraction + revenue_summary'de interval SQL

---

## [ISSUE-008] "Elif Madesign 2025" Madesign filtresi uygulanmıyordu
**Status:** FIXED (2026-03-10, commit 27d29a8)
**First seen:** 2026-03-10
**Description:** agent_performance SQL'de expo_name entity kullanılmıyordu
**Fix:** expo_name varsa JOIN expos + e.name ILIKE filtresi eklendi

---

## [ISSUE-009] CEO auth hardcoded in .env
**Status:** FIXED (2026-03-11)
**First seen:** 2026-03-11
**Description:** CEO telefon numarası .env'de CEO_WHATSAPP_NUMBER olarak hardcoded. Multi-user system'e geçişte kaldırıldı.
**Fix:** auth.js users tablosundan phone lookup yapacak şekilde yeniden yazıldı. Tüm kullanıcılar users tablosundan yönetiliyor.
**Files:** apps/whatsapp-bot/src/auth.js

---

## [ISSUE-010] message_logs table missing in production
**Status:** FIXED (2026-03-11)
**First seen:** 2026-03-11
**Description:** message_logs tablosu production Render PostgreSQL'de yoktu. WhatsApp bot hata veriyordu: "relation message_logs does not exist"
**Root cause:** Migration dosyası (006_message_logs.sql) hiç oluşturulmamıştı. Tablo muhtemelen local'de elle CREATE TABLE ile yapılmış, production'a taşınmamıştı.
**Fix:** packages/db/migrations/006_message_logs.sql oluşturuldu. tables_used TEXT[] (array) olarak tanımlandı.
**Files:** packages/db/migrations/006_message_logs.sql
