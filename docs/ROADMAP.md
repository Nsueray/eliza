# ELIZA — Roadmap & Yapilacaklar

## ✅ Tamamlanan
- Phase 1: PostgreSQL schema, Zoho sync
- Phase 2: War Room Dashboard (port 3000)
- Phase 3: AI Query Engine + Intent Router
- Phase 3b: Risk Engine
- Phase 4: Attention Engine
- Phase 5: Alert Generator + Morning Brief
- Phase 6: Message Generator (TR/EN/FR)
- Phase 8a: WhatsApp Bot (Twilio)
- Benchmark: 50 soru, %98 pass rate
- Zoho Sync Scheduler (her 15 dk)
- KNOWN_ISSUES tracking
- Multi-user system (users + user_permissions tabloları, roller: ceo/manager/agent)
- Admin Panel (localhost:3000/admin — kullanıcı CRUD, rol/izin yönetimi)
- WhatsApp auth: users tablosundan phone lookup (hardcoded .env kaldırıldı)
- Phase 11: Deploy (Render — 3 servis + PostgreSQL cloud)

## Production URLs
- Dashboard: https://eliza.elanfairs.com (custom domain, eliza-dashboard.onrender.com)
- API: https://eliza-api-8tkr.onrender.com
- Bot: https://eliza-bot-r1vx.onrender.com

## 🔄 Devam Eden
- Bug fixes (KNOWN_ISSUES.md)

## ⬜ Siradaki (oncelik sirasi)

### Once — Production Stabilization
1. Twilio sandbox → verified business number
2. Zoho sync production'da test
3. WhatsApp webhook URL güncelle (Bot URL)

### Sonra — Feature Expansion
4. Office Performance (Sales Group bazli sorgular)
5. Expo Velocity Comparison (2025 vs 2026 karsilastirma)
6. Exhibitor Relationship Tracking (Atha Makina durumu)
7. Phase 7: Risk Engine Expansion (unpaid contracts signal)
8. Phase 9: Memory Layer (pattern detection)
9. .expense komutu (WhatsApp'tan gider kaydi)
10. .week komutu (haftalik ozet)

### Gelecek (Post-Deploy)
- Telegram bot
- Leena EMS entegrasyonu
- Liffy leads entegrasyonu
- Planner Agent
- Strategy Engine
- Event Bus mimarisi

## Known Issues
→ docs/KNOWN_ISSUES.md

## Benchmark
→ node packages/ai/benchmark.js
→ Hedef: >= 90% PASS
