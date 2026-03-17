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

---

## [ISSUE-020] Year filter missing — expo and agent queries return all-time data
**Status:** FIXED (2026-03-12)
**First seen:** 2026-03-12
**Description:** "SIEMA'ya en çok kim satmış?" → Elif AY €1.287.539 döndürüyordu, gerçek 2026 değeri €300.738. "En iyi satışçı kim?" → Elif AY €5.239.118 (tüm yıllar) döndürüyordu, gerçek 2026 değeri €122.076. Expo ve agent sorgularında year entity olmadığında SQL'deki `($2::int IS NULL OR ...)` koşulu tüm yılları döndürüyordu.
**Root cause:** buildQuery() SQL template'lerinde year parametresi NULL olduğunda filtre devre dışı kalıyordu. Kullanıcı yıl belirtmezse entities.year = null → SQL tüm edition'ları topluyordu. 8 farklı intent'te aynı pattern mevcut.
**Fix:** queryEngine.js run() fonksiyonunda year default logic genişletildi: (1) expo_name olan expo intent'lerinde year=currentYear, (2) top_agents/agent_performance'da period/relative_days yoksa year=currentYear. SQL template'leri değiştirilmedi — run() seviyesinde çözüm.
**Files:** packages/ai/queryEngine.js

---

## [ISSUE-021] Dashboard links hardcoded 2026, only 5 expo intents
**Status:** FIXED (2026-03-13)
**First seen:** 2026-03-13
**Description:** getDashboardLink() hardcoded year=2026 ve sadece 5 expo intent'i destekliyordu. Diğer intent'ler için link üretmiyordu.
**Fix:** getDashboardLink(intent, entities) → entities.year || currentYear dinamik, 11 expo intent + 7 sales intent mapped, deep linking (expo_name, country query params)
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-022] "entities is not defined" crash in normal flow
**Status:** FIXED (2026-03-14)
**First seen:** 2026-03-14
**Description:** "En iyi 3 satışçı kim?" ve "Morocco fuarlarında kaç ülke var?" sorguları production'da crash veriyordu: "entities is not defined". getDashboardLink(intent, entities) çağrısı var ama entities destructure edilmemişti.
**Root cause:** handler.js line 328'de `const { intent, answer, data, _usage } = result;` — entities missing. queryEngine.run() entities döndürüyor ama handler destructure'da yoktu.
**Fix:** Destructure'a entities eklendi: `const { intent, entities, answer, data, _usage } = result;`
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-021] Dashboard links hardcoded year and missing for most intents
**Status:** FIXED (2026-03-14)
**First seen:** 2026-03-14
**Description:** getDashboardLink() had year hardcoded as 2026 and only mapped 5 expo intents. Agent/sales intents (top_agents, agent_performance, revenue_summary etc.) returned no link. 12 of 19 intents had no dashboard link — "... ve X sonuç daha" messages appeared without a URL.
**Fix:** getDashboardLink(intent, entities) — accepts entities, uses entities.year dynamically (fallback: currentYear). 11 expo intents → /expos?year=YYYY, 7 sales intents → / (War Room). All 18 data intents now have links.
**Files:** apps/whatsapp-bot/src/handler.js

---

## [ISSUE-023] Multi-turn clarification — 5 bugs (loop, order, resolve, morocco, hepsi)
**Status:** FIXED (2026-03-15)
**First seen:** 2026-03-15
**Description:** Multi-turn clarification had 5 production bugs:
1. "hepsi"/"tümü"/"all" not recognized in year slot → same question repeated
2. Year resolved but expo/metric not asked → direct answer (flags lost between turns)
3. Metric asked before expo in some cases (order wrong)
4. Expo selection caused infinite loop (DB expo name not in EXPO_BRANDS → missing_expo re-set)
5. Morocco/SIEMA expos missing from 2026 list (query used start_date >= CURRENT_DATE instead of year filter)
**Root cause:** (1) No "Tüm yıllar" option or keyword mapping. (2,3,4) Handler rebuilt question and re-ran queryEngine from scratch — router couldn't extract DB expo names (not in EXPO_BRANDS), so missing_expo was set again causing loop or fallthrough. (5) Context clarification query and expo query used date-range filter instead of year-based filter, excluding past-date expos in current year. LIMIT 10 too low.
**Fix:**
- queryEngine.run() accepts 5th parameter `resolvedEntities` — merges resolved slots directly into entities after extraction, preventing flag loss and expo name mismatch
- Year clarification adds "Tüm yıllar" / "All years" / "Toutes les années" as last option
- Handler maps "hepsi"/"tümü"/"all"/"toplam"/"hep" to "Tüm yıllar"; year='all' → no year filter
- Handler passes resolvedSlots to queryEngine.run() — expo names from DB recognized without EXPO_BRANDS match
- Expo query changed from `start_date >= CURRENT_DATE` to `EXTRACT(YEAR FROM e.start_date) = $1`, LIMIT increased to 15
- Context clarification query also changed to year-based filter
**Files:** packages/ai/queryEngine.js, apps/whatsapp-bot/src/handler.js

---

## [ISSUE-024] Clarification bugs + PDF export CDN failure
**Status:** FIXED (2026-03-16)
**First seen:** 2026-03-16
**Description:** 5 production bugs:
1. Second "en çok kim satmış?" (independent question) gets year/expo injected from conversation memory by rewriteQuestion
2. "cancel"/"iptal" during pending clarification goes to message draft handler instead of clearing clarification
3. Follow-up "bu sözleşmeler hangi firmalar?" returns English + wrong year from rewrite context injection
4. SIEMA 2026 not appearing in clarification expo list (LIMIT 15 too low)
5. PDF/Excel export fails on all dashboard pages (CDN scripts blocked/unreachable)
**Root cause:**
- (1,3) REWRITE_PROMPT lacked explicit rule for general/ranking business questions; Haiku injected previous expo/year context into independent questions
- (2) handler.js CEO message approval check (lines 167-177) ran BEFORE clarification pending check (lines 199+), so "iptal" matched handleApproval(false) first
- (4) LIMIT 15 in queryEngine.js expo clarification SQL and handler.js context ambiguity query excluded expos beyond position 15
- (5) CDN loadScript for jsPDF/SheetJS blocked by CSP, network issues, or CORS on production
**Fix:**
- (1,3) Strengthened REWRITE_PROMPT: added explicit rule that general/ranking questions are ALWAYS independent; added 3 new examples showing ranking questions returning unchanged
- (2) Moved clarification pending cancel check BEFORE CEO message approval check in handler.js
- (4) Increased LIMIT from 15 to 30 in queryEngine.js (both all-years and year-filtered queries) and handler.js context ambiguity query
- (5) Replaced CDN loadScript with npm packages (jspdf, jspdf-autotable, xlsx) using dynamic imports across all 3 dashboard pages (sales.js, expos.js, detail.js); removed loadScript functions
**Files:** packages/ai/conversationMemory.js, apps/whatsapp-bot/src/handler.js, packages/ai/queryEngine.js, apps/dashboard/pages/sales.js, apps/dashboard/pages/expos.js, apps/dashboard/pages/expos/detail.js, apps/dashboard/package.json


---

## [ISSUE-025] Answer quality: fuzzy expo, country aliases, unnecessary clarification, language detection, rewrite
**Status:** FIXED (2026-03-16)
**First seen:** 2026-03-16
**Description:** 6 WhatsApp bot answer quality bugs:
1. Expo name fuzzy matching: "megaclima" doesn't match "Mega Clima" in DB (ILIKE '%megaclima%' fails)
2. Country name normalization: "İtalyan"/"İtalya"/"Fransız" not recognized — only 7 countries mapped
3. "cancel"/"iptal" during clarification goes to message draft handler (duplicate of ISSUE-024 fix verification)
4. "bugün kaç sözleşme var?" triggers unnecessary expo clarification instead of answering directly
5. Turkish follow-up questions ("bunlar hangi firmalar?") get English responses — missing words in detectLang
6. Second "en çok kim satmış?" still gets context injected from conversation memory despite ISSUE-024 fix
**Root cause:**
- (1) buildQuery uses `ILIKE '%expo_name%'` but "megaclima" ≠ "Mega Clima" — no space normalization
- (2) COUNTRY_KEYWORDS only had 7 countries; no demonym suffix stripping ("İtalyan" → "Italy")
- (3) Already fixed in ISSUE-024 — verified working
- (4) EXPO_CLARIFICATION_INTENTS triggered even when time-based entities (period, relative_days, month) present
- (5) detectLang trWords missing: 'sozlesme', 'bunlar', 'listele', 'peki', etc.
- (6) rewriteQuestion LLM still injected context for general questions despite REWRITE_PROMPT rules — needed pre-check bypass
**Fix:**
- (1) Added fuzzyExpoPattern() in queryEngine.js: normalizes compound expo names ("megaclima" → "%mega%clima%"); applied to all ILIKE patterns
- (2) Expanded COUNTRY_KEYWORDS from 7 to 30+ countries with Turkish/French/English aliases; added resolveCountry() with demonym suffix stripping; normalize() removes U+0307 combining dot
- (3) Verified — clarification cancel check runs before CEO approval check
- (4) Added hasTimeFilter check before expo clarification — skips when period/relative_days/month present
- (5) Added 15+ Turkish words to detectLang trWords array
- (6) Added ALWAYS_INDEPENDENT regex pre-check in rewriteQuestion() — bypasses LLM entirely for ranking/general patterns
**Files:** packages/ai/router.js, packages/ai/queryEngine.js, apps/whatsapp-bot/src/handler.js, packages/ai/conversationMemory.js

---

## [ISSUE-026] Clarification: Tüm yıllar loop, bugün clarification, iptal no pending
**Status:** FIXED (2026-03-16)
**First seen:** 2026-03-16
**Description:** 3 clarification bugs after deploy:
1. "Tüm yıllar" selection causes infinite loop — year clarification re-triggers
2. "bugün kaç sözleşme var?" still triggers expo/context clarification
3. "iptal" with no pending returns "Bekleyen mesaj taslağı yok." instead of friendly message
**Root cause:**
- (1) queryEngine.run() merges year='all' by deleting entities.year and entities.missing_year, but the detection block at line 1317 re-triggers missing_year because both are gone and resolvedEntities isn't checked
- (2) revenue_summary is in handler.js CONTEXT_AMBIGUOUS_INTENTS — context clarification fires even when period='today' is present
- (3) CEO "iptal" handler always calls handleApproval(false) which returns "Bekleyen mesaj taslağı yok." when no draft exists
**Fix:**
- (1) Added `yearAlreadyResolved` and `expoAlreadyResolved` guards — if resolvedEntities already has year or expo, detection blocks skip
- (2) Added `hasTimeScope` check to context ambiguity block — skip when period/relative_days/month present
- (3) CEO "iptal" now checks for pending draft first; if nothing pending, returns "İptal edilecek bir şey yok. Sormak istediğin bir şey var mı?"
**Files:** packages/ai/queryEngine.js, apps/whatsapp-bot/src/handler.js

---

## [ISSUE-027] Compound expo queries lose expo filter
**Status:** FIXED (2026-03-16)
**First seen:** 2026-03-16
**Description:** "madesign 2026 fuarına toplam kaç sözleşme, kaç m2 var ve geliri ne kadar?" returns 136 contracts (all 2026 fiscal) instead of 9 (Madesign only). Expo filter lost.
**Root cause:** Haiku FRAME_PROMPT classifies multi-metric expo questions as "compound" (because of "ve") instead of "expo_progress". expo_progress already returns all metrics (m², revenue, contracts). When compound sub-queries run, parent entities (expo_name, year) aren't passed through.
**Fix:**
- Added explicit COMPOUND vs SINGLE INTENT rule to FRAME_PROMPT and INTENT_PROMPT: same entity + multiple metrics = single intent (expo_progress), NOT compound
- Added 3 few-shot examples showing multi-metric expo questions → expo_progress
- Router: added multi-metric patterns to expo_progress (e.g., ['kac sozlesme', 'm2'], ['kac kontrat', 'gelir'])
- Safety net: compound handling now inherits parent entities (expo_name, year, agent_name, country) into sub-queries
**Files:** packages/ai/queryEngine.js, packages/ai/router.js

---

## [ISSUE-028] Edition vs Fiscal inconsistency — expo-specific revenue uses fiscal view
**Status:** FIXED (2026-03-16)
**First seen:** 2026-03-16
**Description:** "SIEMA 2026 toplam gelir ve kontrat sayisi?" returns fiscal data (149 contracts) instead of edition data (51 contracts). The query matches revenue_summary intent which uses fiscal_contracts view, but expo-specific questions should use edition_contracts view (expo_progress intent).
**Root cause:** revenue_summary intent always queries fiscal_contracts. When an expo_name entity is present, the user is asking about expo performance (edition view), not company sales performance (fiscal view). No intent redirection logic existed.
**Fix:** Added intent redirection in queryEngine.js run(): `if (intent === 'revenue_summary' && entities.expo_name) intent = 'expo_progress';`
**Files:** packages/ai/queryEngine.js

---

## [ISSUE-029] Finance sticky header not working + WhatsApp collection intents missing
**Status:** FIXED (2026-03-17)
**First seen:** 2026-03-17
**Description:** 
1. Finance page action list table header disappears when scrolling — sticky CSS not taking effect.
2. No WhatsApp intents for collection/receivables queries (tahsilat sorguları).
**Root cause:** 
1. `<style jsx>` scoped styles prevented sticky positioning from applying. z-index was too low (2). `position: relative` on wrapper interfered.
2. Collection queries via outstanding_balances view were only available on dashboard, not through WhatsApp AI query engine.
**Fix:**
1. Changed `<style jsx>` → `<style jsx global>`, removed `position: relative` from wrapper, set z-index to 10, used opaque hex backgrounds instead of CSS variables for thead.
2. Added 3 new intents: collection_summary, collection_no_payment, collection_expo. Router rules (before payment_status), buildQuery cases (outstanding_balances view), getDashboardLink → /finance, Sonnet prompt rule 16 for collection context.
**Files:** apps/dashboard/pages/finance.js, packages/ai/router.js, packages/ai/queryEngine.js, apps/whatsapp-bot/src/handler.js

---

## [ISSUE-030] WhatsApp collection intents — SIEMA filter broken + summary numbers mismatch
**Status:** FIXED (2026-03-17)
**First seen:** 2026-03-17
**Description:**
1. "SIEMA tahsilat durumu?" returns all 247 contracts instead of filtering to SIEMA.
2. "kaç alacağımız var?" returns wrong numbers (244 contracts €1.3M) vs dashboard (110 contracts €722k).
3. "alacağımız" keyword not matched — normalize() converts ğ→g making "alacagimiz" which doesn't contain "alacak".
**Root cause:**
1. "tahsilat durumu" matches collection_summary (has `['tahsilat', 'durum']`) before collection_expo. Intent redirect missing.
2. collection_summary SQL had no upcoming expo filter — dashboard uses edition mode (expo_start_date >= CURRENT_DATE).
3. Turkish ğ→g accent normalization changes word stem — `['alacak']` doesn't match "alacagimiz".
**Fix:**
1. Added intent redirect: `collection_summary + expo_name → collection_expo` in queryEngine.js run().
2. Added `WHERE expo_start_date >= CURRENT_DATE` to collection_summary, collection_expo (no-expo), collection_no_payment (no-expo) SQL.
3. Added `['alacag']` keyword to collection_summary router rule (matches normalized stem).
**Files:** packages/ai/queryEngine.js, packages/ai/router.js
