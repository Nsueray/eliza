# ELIZA Push Messages — Architecture Blueprint
## Proactive Intelligence / Scheduled Notifications
Version: v1.0 | Date: 2026-03-22

---

## 1. WHY PUSH MESSAGES

ELIZA şu an tamamen "pull" — kullanıcı sorarsa cevap verir. Ama gerçek bir CEO Operating System "push" yapmalı — dikkat gereken şeyleri proaktif olarak söylemeli.

Push mesajlar 3 hedef:
1. **Alışkanlık yaratma** — Elif ve Yaprak ELIZA'yı kullanmıyor çünkü sorma alışkanlığı yok. Push mesajlar günde 2-3 kez ELIZA'yı hatırlatır.
2. **Dikkat yönlendirme** — CEO'ya "bugün neye bakmalısın?" sorusunu cevaplar.
3. **Operasyonel görünürlük** — herkes kendi alanındaki durumu görsün.

---

## 2. TASARIM PRENSİPLERİ

### Permission-based, role-based DEĞİL
- Mesaj yetkileri kullanıcı bazlı ayarlanır, role bağlı değil
- CEO isterse Elif'e CEO briefi açabilir veya kapatabilir
- Roller değişebilir (Yaprak satışa geçer, Jude müdürlükten ayrılır)
- Her kullanıcı hangi mesajları alacağını admin panelden ayarlanır

### Scope bazlı (own / team / all)
- **own**: Sadece kendi verileri (Elif → Elif'in satışları)
- **team**: Kendi grubu (Elif → International ekip)
- **all**: Tüm şirket (CEO perspective)
- Her mesaj tipi için scope ayrı ayarlanabilir

### Zamanlama esnek
- Saat ayarlanabilir (default'lar var ama değiştirilebilir)
- Gün seçimi (her gün, hafta içi, pazartesi, cuma)
- Timezone: Europe/Istanbul (default, kullanıcı bazlı değiştirilebilir)

---

## 3. MESAJ TİPLERİ

### 3a. Morning Brief (08:00)
**Amacı:** "Bugün neye dikkat etmeliyim?"

**Scope: ALL (CEO default)**
```
Günaydın patron ☀️

📊 Durum — 22 Mart Pazartesi

Dünden bugüne:
• 1 yeni sözleşme: Opak Makine (SIEMA) €9.380
• 2 ödeme geldi: €6.421

Dikkat:
• 25 firma hiç ödeme yapmamış
• Mega Horeca Nigeria — 0 gün kaldı, 5 firma deposit eksik
• At-risk alacak: €70.274

Bu hafta beklenen tahsilat: €45.854

📊 https://eliza.elanfairs.com/finance
```

**Scope: OWN (Agent default)**
```
Günaydın Elif 👋

📊 Senin durumun — 22 Mart

Portföyün:
• 24 açık kontrat, €418.421 outstanding
• 8 firma hiç ödeme yapmamış
• Bu hafta beklenen: €12.300

Dün:
• 0 yeni sözleşme
• 1 ödeme geldi: Alp Pompa €4.076

📊 https://eliza.elanfairs.com/finance
```

**Scope: TEAM (Manager default)**
```
Günaydın Elif 👋

📊 International Ekip — 22 Mart

Ekip toplam:
• 42 açık kontrat, €520.000 outstanding
• Deposit rate: %52

Dün:
• 1 yeni sözleşme (senden)
• 3 ödeme: €8.500

En yakın fuar: Electricity Algeria — 245 gün
```

### 3b. Midday Pulse (14:00)
**Amacı:** "Bugün ne oldu şu ana kadar?"

Sadece CEO (default). Kısa, 3-4 satır.

```
🕐 Öğle raporu

Bugün: 0 sözleşme, 1 ödeme €4.076
Bu hafta: 3 sözleşme, €37.858
Outstanding: €777.941 (değişmedi)
```

### 3c. Daily Wrap (17:00)
**Amacı:** "Gün bitti, ne değişti?"

CEO + Sales Managers (default).

**Scope: ALL (CEO)**
```
🌙 Gün sonu — 22 Mart

Bugün:
• 2 sözleşme: €15.200 (Elif 1, Joanna 1)
• 3 ödeme: €8.421

Bu hafta toplamı:
• 5 sözleşme, €53.058
• 7 ödeme, €23.342

Yarın dikkat:
• 2 vade yaklaşan ödeme (€8.500)
• Mega Horeca Nigeria başlıyor
```

**Scope: OWN (Agent)**
```
🌙 Gün sonun — 22 Mart

Bugün senin: 1 sözleşme (€9.380), 0 ödeme
Bu hafta senin: 2 sözleşme (€16.580)
Portföy: 24 kontrat, €418.421 outstanding
```

### 3d. Weekly Report (Pazartesi 08:00)
**Amacı:** "Geçen hafta nasıl geçti?"

Herkese (scope bazlı). Morning Brief yerine gönderilir (ikisi birden DEĞİL).

**Scope: ALL (CEO)**
```
📊 Haftalık Rapor — 15-21 Mart

Satış:
• 8 sözleşme, €72.400, 180 m²
• Geçen hafta: 5 sözleşme, €45.000 (↑ %60)

Tahsilat:
• 12 ödeme, €48.137
• Outstanding: €777.941 → €729.804 (↓ €48K)

Fuarlar:
• Mega Horeca Nigeria — 0 gün (bu hafta!)
• Mega Clima Nigeria — 61 gün
• SIEMA — 183 gün

Top agent: Elif AY — 3 sözleşme, €28.000
Top expo: SIEMA — 5 yeni sözleşme
```

### 3e. Weekly Close (Cuma 17:00)
**Amacı:** "Haftayı kapatalım, gelecek hafta ne var?"

Sadece CEO (default).

```
📊 Hafta sonu — 22 Mart

Bu hafta:
• 5 sözleşme, €53.058
• 7 ödeme, €23.342
• 2 iptal

Gelecek hafta:
• 4 beklenen tahsilat (€18.500)
• Mega Horeca Nigeria başlıyor (25 Mart)
• 3 firma deposit deadline

Risk takip:
• 25 firma hiç ödeme yapmamış
• En kritik: LG Electronics (€25.185, Mega Clima Nigeria, 61 gün)
```

---

## 4. VERİ MODELİ

### users tablosu — Yeni alan

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_settings JSONB DEFAULT '{}';
```

push_settings yapısı:
```json
{
  "enabled": true,
  "timezone": "Europe/Istanbul",
  "messages": {
    "morning_brief": {
      "enabled": true,
      "time": "08:00",
      "scope": "all",
      "days": ["mon", "tue", "wed", "thu", "fri"]
    },
    "midday_pulse": {
      "enabled": false,
      "time": "14:00",
      "scope": "all",
      "days": ["mon", "tue", "wed", "thu", "fri"]
    },
    "daily_wrap": {
      "enabled": true,
      "time": "17:00",
      "scope": "all",
      "days": ["mon", "tue", "wed", "thu", "fri"]
    },
    "weekly_report": {
      "enabled": true,
      "time": "08:00",
      "scope": "all",
      "days": ["mon"]
    },
    "weekly_close": {
      "enabled": false,
      "time": "17:00",
      "scope": "all",
      "days": ["fri"]
    }
  }
}
```

### Varsayılan ayarlar (role bazlı, ama değiştirilebilir)

**CEO defaults:**
```json
{
  "morning_brief": { "enabled": true, "scope": "all" },
  "midday_pulse": { "enabled": true, "scope": "all" },
  "daily_wrap": { "enabled": true, "scope": "all" },
  "weekly_report": { "enabled": true, "scope": "all" },
  "weekly_close": { "enabled": true, "scope": "all" }
}
```

**Manager defaults (Elif):**
```json
{
  "morning_brief": { "enabled": true, "scope": "team" },
  "midday_pulse": { "enabled": false },
  "daily_wrap": { "enabled": true, "scope": "own" },
  "weekly_report": { "enabled": true, "scope": "team" },
  "weekly_close": { "enabled": false }
}
```

**Agent defaults (Yaprak, Jude):**
```json
{
  "morning_brief": { "enabled": true, "scope": "own" },
  "midday_pulse": { "enabled": false },
  "daily_wrap": { "enabled": false },
  "weekly_report": { "enabled": true, "scope": "own" },
  "weekly_close": { "enabled": false }
}
```

CEO admin panelden herkesin ayarlarını değiştirebilir:
- Elif'e CEO brief aç → scope: "all"
- Yaprak'a daily wrap aç → scope: "own"
- Jude'a midday pulse aç → scope: "team" (Nigeria)

---

## 5. ADMIN UI — PUSH SETTINGS

### /admin/users/[id] sayfasına yeni bölüm: PUSH NOTIFICATIONS

```
PUSH NOTIFICATIONS
─────────────────────────────────

[ ✓ ] Push messages enabled

Timezone: [Europe/Istanbul ▼]

┌──────────────────┬─────────┬────────┬───────────────────┐
│ Message          │ Enabled │ Time   │ Scope             │
├──────────────────┼─────────┼────────┼───────────────────┤
│ Morning Brief    │ [✓]     │ [08:00]│ [All ▼]           │
│ Midday Pulse     │ [✓]     │ [14:00]│ [All ▼]           │
│ Daily Wrap       │ [✓]     │ [17:00]│ [All ▼]           │
│ Weekly Report    │ [✓]     │ [08:00]│ [All ▼] Mon only  │
│ Weekly Close     │ [✓]     │ [17:00]│ [All ▼] Fri only  │
└──────────────────┴─────────┴────────┴───────────────────┘

Scope options: Own data | Team data | All company
```

---

## 6. TEKNİK MİMARİ

### Scheduler (cron jobs)

eliza-bot veya eliza-api servisinde node-cron:

```javascript
// Her dakika çalış, uygun mesajları gönder
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  const dayOfWeek = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];
  
  // push_settings'i olan tüm aktif kullanıcıları çek
  const users = await query(`
    SELECT * FROM users 
    WHERE is_active = true 
      AND push_settings->>'enabled' = 'true'
      AND whatsapp_phone IS NOT NULL
  `);
  
  for (const user of users.rows) {
    const settings = user.push_settings?.messages || {};
    for (const [msgType, config] of Object.entries(settings)) {
      if (config.enabled && config.time === currentTime && config.days?.includes(dayOfWeek)) {
        // Pazartesi sabah: weekly_report gönder, morning_brief gönderme
        if (dayOfWeek === 'mon' && currentTime === '08:00' && msgType === 'morning_brief') continue;
        
        await sendPushMessage(user, msgType, config.scope);
      }
    }
  }
});
```

### sendPushMessage fonksiyonu

```javascript
async function sendPushMessage(user, messageType, scope) {
  // 1. Veriyi çek (scope bazlı)
  const data = await gatherPushData(user, messageType, scope);
  
  // 2. Mesaj metnini oluştur (Sonnet ile veya template)
  const message = await formatPushMessage(user, messageType, data);
  
  // 3. WhatsApp'tan gönder (Twilio)
  await sendWhatsApp(user.whatsapp_phone, message);
  
  // 4. Logla
  await logPushMessage(user.id, messageType, scope);
}
```

### gatherPushData — scope bazlı veri

```javascript
async function gatherPushData(user, messageType, scope) {
  // scope filter
  const agentFilter = scope === 'own' ? `AND c.sales_agent = '${user.sales_agent_name}'` 
    : scope === 'team' ? `AND c.sales_agent IN (SELECT sales_agent_name FROM users WHERE sales_group = '${user.sales_group}')` 
    : ''; // all = no filter
  
  switch (messageType) {
    case 'morning_brief':
      return {
        yesterday_contracts: await getYesterdayContracts(agentFilter),
        yesterday_payments: await getYesterdayPayments(agentFilter),
        outstanding: await getOutstandingSummary(agentFilter),
        no_payment_count: await getNoPaymentCount(agentFilter),
        upcoming_expos: await getUpcomingExpos(agentFilter),
        at_risk: await getAtRiskAmount(agentFilter),
        expected_this_week: await getExpectedThisWeek(agentFilter),
      };
    case 'midday_pulse':
      return {
        today_contracts: await getTodayContracts(agentFilter),
        today_payments: await getTodayPayments(agentFilter),
        week_contracts: await getWeekContracts(agentFilter),
        week_payments: await getWeekPayments(agentFilter),
        outstanding: await getOutstandingSummary(agentFilter),
      };
    case 'daily_wrap':
      return {
        today_contracts: await getTodayContracts(agentFilter),
        today_payments: await getTodayPayments(agentFilter),
        week_total: await getWeekContracts(agentFilter),
        week_payments: await getWeekPayments(agentFilter),
        tomorrow_attention: await getTomorrowAttention(agentFilter),
      };
    case 'weekly_report':
      return {
        week_contracts: await getLastWeekContracts(agentFilter),
        prev_week_contracts: await getPrevWeekContracts(agentFilter),
        week_payments: await getLastWeekPayments(agentFilter),
        outstanding_change: await getOutstandingChange(agentFilter),
        upcoming_expos: await getUpcomingExpos(agentFilter),
        top_agent: scope !== 'own' ? await getTopAgent(agentFilter) : null,
        top_expo: await getTopExpo(agentFilter),
      };
    case 'weekly_close':
      return {
        week_contracts: await getThisWeekContracts(agentFilter),
        next_week_expected: await getNextWeekExpected(agentFilter),
        upcoming_events: await getNextWeekEvents(agentFilter),
        risk_watch: await getRiskWatch(agentFilter),
      };
  }
}
```

### Mesaj formatı — Template mi LLM mi?

**V1: Template yaklaşımı (basit, güvenilir)**
- Her mesaj tipi için sabit template
- Veri değişkenleri insert edilir
- Dil: kullanıcı diline göre (TR/EN/FR)
- Avantaj: hızlı, ucuz, tutarlı

**V2: Sonnet ile doğal dil (gelecekte)**
- Template yerine Sonnet'e veri + context ver
- Daha doğal, insight ağırlıklı
- Dezavantaj: yavaş, pahalı, tutarsız olabilir

V1'de template kullan.

---

## 7. PUSH LOG TABLOSU

```sql
CREATE TABLE IF NOT EXISTS push_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  message_type VARCHAR(30),
  scope VARCHAR(10),
  sent_at TIMESTAMP DEFAULT NOW(),
  message_text TEXT,
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT
);
```

Dashboard'da /admin/system'e "Push History" bölümü eklenebilir.

---

## 8. SPRINT PLANI

### Sprint 1: Infrastructure
- [ ] Migration: push_settings JSONB on users, push_log table
- [ ] Admin UI: Push Notifications bölümü user edit'te
- [ ] Default settings by role (CEO/Manager/Agent)
- [ ] Scheduler (node-cron, her dakika kontrol)

### Sprint 2: Morning Brief
- [ ] gatherPushData — morning_brief
- [ ] Template: TR/EN/FR
- [ ] Scope filtering (own/team/all)
- [ ] Twilio gönderim
- [ ] Test: CEO sabah mesajı

### Sprint 3: Midday + Daily Wrap
- [ ] gatherPushData — midday_pulse, daily_wrap
- [ ] Templates
- [ ] Test

### Sprint 4: Weekly Report + Close
- [ ] gatherPushData — weekly_report, weekly_close
- [ ] Pazartesi/Cuma özel logic
- [ ] Test

---

## 9. ÖNEMLİ KURALLAR

1. **Permission-based** — role değil, kullanıcı bazlı ayarlar. CEO istediği zaman değiştirebilir.
2. **Scope esnek** — own/team/all her mesaj tipi için ayrı ayarlanabilir.
3. **Timezone** — Europe/Istanbul default, kullanıcı bazlı değiştirilebilir.
4. **Duplicate prevention** — aynı mesaj aynı gün 2 kez gönderilmez (push_log kontrol).
5. **Pazartesi kuralı** — Ptesi sabah weekly_report gönderilir, morning_brief gönderilmez.
6. **Template-first** — V1'de LLM kullanma, template ile formatla. V2'de Sonnet.
7. **Dil** — kullanıcının dil ayarına göre (users.language veya detectLang default).
8. **WhatsApp limit** — Twilio rate limit'lerine dikkat. Toplu gönderimde 1 saniye ara.
9. **Opt-out** — Kullanıcı .stop komutuyla push'ları durdurabilir.
10. **Admin override** — CEO admin panelden herkesin push ayarlarını değiştirebilir.
