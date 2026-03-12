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

---

## [ISSUE-011] response_text logged before wrapForCeo
**Status:** FIXED (2026-03-11)
**First seen:** 2026-03-11
**Description:** logMessage() handler.js'te wrapForCeo çağrısından önce çalışıyordu. response_text olarak raw AI answer loglanıyordu, CEO kişiliği (Selam Baba / Hi Dad) ve "more results" hint'i dahil edilmiyordu.
**Fix:** logMessage çağrısı wrapForCeo ve moreHint eklendikten sonraya taşındı. Artık final response loglanıyor.
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-012] Dashboard admin pages in Turkish
**Status:** FIXED (2026-03-11)
**First seen:** 2026-03-11
**Description:** Admin panel, logs, user forms tüm UI metinleri Türkçe idi. Dashboard dili İngilizce olmalı.
**Fix:** Tüm admin sayfalarındaki (logs.js, index.js, users/new.js, users/[id].js) Türkçe metinler İngilizce'ye çevrildi.
**Files:** apps/dashboard/pages/admin/logs.js, apps/dashboard/pages/admin/index.js, apps/dashboard/pages/admin/users/new.js, apps/dashboard/pages/admin/users/[id].js

---

## [ISSUE-013] Language detection returns French for accent-less Turkish
**Status:** FIXED (2026-03-11)
**First seen:** 2026-03-11
**Description:** "Madesign 2026 kac m2" → Fransızca cevap. İki root cause:
1. detectLang trWords listesinde "kaç" var ama accent-less "kac" yok — TR skor 0
2. `lower.includes("des")` → "madesign" içinde "des" bulunuyor — FR skor 1 (false positive)
**Root cause:** detectLang'da (a) accent normalization yoktu, (b) substring match kullanılıyordu (word boundary yerine)
**Fix:** (1) router.js ile aynı ACCENT_MAP kullanarak input normalize edildi (ç→c, ş→s, ü→u, ı→i, ö→o, ğ→g), (2) trWords accent-normalized hale getirildi, (3) `lower.includes(w)` → `words.includes(w)` (word boundary match)
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-014] "bu ay" queries return all years
**Status:** FIXED (2026-03-12)
**First seen:** 2026-03-12
**Description:** "elif bu ay kaç m2 satmış?" → 53 sözleşme döndürüyordu, gerçek: 2 sözleşme. Mart ayını tüm yıllardan topluyordu.
**Root cause:** Router/Haiku month entity çıkarıyor (month=3) ama year entity set etmiyor. SQL'de `($2::int IS NULL OR EXTRACT(YEAR FROM contract_date) = $2)` year=NULL olunca tüm yılları döndürüyor.
**Fix:** queryEngine.js run() fonksiyonunda: entities.month var ve entities.year yok → year = currentYear olarak default set edildi. Tüm intent'ler için geçerli.
**Files:** packages/ai/queryEngine.js

---

## [ISSUE-015] Phone field mismatch — conversation memory never fires
**Status:** FIXED (2026-03-12)
**First seen:** 2026-03-12
**Description:** Conversation memory (getHistory + rewriteQuestion) production'da hiç çalışmıyordu. Follow-up sorular hep orijinal haliyle engine'e gidiyordu.
**Root cause:** auth.js `user.phone` döndürüyor ama handler.js `user.whatsapp_phone` kullanıyordu → undefined → logMessage `user_phone=null` kaydediyordu → getHistory(null) hep boş dönüyordu → rewrite hiç tetiklenmiyordu.
**Fix:** handler.js'te 4 yerde `user?.whatsapp_phone || user?.phone_number` → `user?.phone || user?.whatsapp_phone` olarak düzeltildi.
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-016] Team scope query fails — "column sa.sales_group does not exist"
**Status:** FIXED (2026-03-12)
**First seen:** 2026-03-12
**Description:** Elif (data_scope=team) ilk mesajı attı, hata aldı. applyScope() team filtresi `sales_agents` tablosunda `sales_group` kolonu arıyordu ama bu kolon `users` tablosunda.
**Root cause:** applyScope subquery: `SELECT sa.name FROM sales_agents sa WHERE sa.sales_group = $N` — sales_agents tablosunda sales_group yok.
**Fix:** Subquery `users` tablosunu kullanacak şekilde değiştirildi: `SELECT sales_agent_name FROM users WHERE sales_group = $N AND is_active = true`
**Files:** packages/ai/queryEngine.js

---

## [ISSUE-017] Dashboard link points to localhost
**Status:** FIXED (2026-03-12)
**First seen:** 2026-03-12
**Description:** WhatsApp'ta "... ve X sonuç daha" mesajıyla gelen dashboard linki localhost:3000'e gidiyordu.
**Fix:** `DASHBOARD_BASE = 'http://localhost:3000'` → `'https://eliza.elanfairs.com'`
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-018] Elif expo-based queries blocked by agent scope
**Status:** FIXED (2026-03-12)
**First seen:** 2026-03-12
**Description:** Elif (data_scope=team) expo bazlı sorgularda veri göremiyordu. expo_progress, expo_agent_breakdown, country_count gibi genel expo sorguları agent/team filtresinden geçiriliyordu.
**Root cause:** NO_AGENT_FILTER_INTENTS sadece expo_list içeriyordu. Expo bazlı intent'ler de agent filtresi alıyordu.
**Fix:** NO_AGENT_FILTER_INTENTS genişletildi: expo_progress, expo_list, expo_agent_breakdown, expo_company_list, country_count, exhibitors_by_country, cluster_performance, rebooking_rate, payment_status, company_search
**Files:** packages/ai/queryEngine.js

---

## [ISSUE-019] Hybrid SQL bypasses data scope for non-CEO users
**Status:** FIXED (2026-03-12)
**First seen:** 2026-03-12
**Description:** generateSQL() çıktısı applyScope()'tan geçmiyordu. Manager/agent kullanıcı hybrid SQL'e düşerse tüm veriyi filtresiz görüyordu.
**Root cause:** Hybrid SQL path'inde applyScope() çağrısı yoktu. applyScope'un regex-based alias detection'ı Sonnet'in ürettiği SQL'de farklı alias kullanabileceği için güvenilir değildi.
**Fix:** Hybrid SQL sadece CEO (data_scope=all) için çalışacak şekilde kısıtlandı. Non-CEO kullanıcılar normal template path'e düşer.
**Files:** packages/ai/queryEngine.js
