// setup-fresh-db.js  (ELIZA)
// LEENA'daki setup-fresh-db.js'in ELIZA'ya uyarlanmis, guard'li surumu.
//
// AMAC: Bos bir veritabanina schema.sql + migrations/*.sql'i dogru sirada
// uygulayarak ELIZA semasini SIFIRDAN kurmak. Kurulu/production bir DB'ye
// ASLA dokunmamak.
//
// ELIZA NOTU: schema.sql DROP icermez (LEENA'nin initial.sql'inin aksine),
// yani bugun yikici risk yok. Guard yine de eklendi ki ILERIDE DROP'lu bir
// sey girerse koruma hazir olsun + iki sistemde tutarli davranis olsun.
//
//   GUARD 1: acik `--fresh` flag'i yoksa  -> reddet, baglanma.
//   GUARD 2: hedef DB'de cekirdek tablolar (contracts/expos) ZATEN varsa
//            -> reddet (semayi uygulamadan, herhangi bir yazma olmadan).
//
// BAGLANTI: yalnizca process.env.DATABASE_URL kullanilir.
//   .claude/settings.local.json'daki DATABASE_URL_PROD ASLA okunmaz; prod
//   URL'i default alinmaz. Hedef DB'yi calistiran kisi DATABASE_URL ile verir.
//
// Kullanim:  DATABASE_URL=postgresql://localhost/eliza_fresh node packages/db/setup-fresh-db.js --fresh
//
// NOT: schema.sql ve mevcut migration'lar degistirilmedi. Bu sadece yeni bir arac.

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Client } = require('pg');

const FRESH = process.argv.includes('--fresh');
const CORE_TABLES = ['contracts', 'expos']; // varsa = kurulu/dolu DB

function refuse(msg) {
  console.error('🛑 REDDEDILDI: ' + msg);
  console.error('   Hicbir sey yapilmadi (schema.sql / migration calismadi).');
  process.exit(1);
}

// DATABASE_URL_PROD'u bilerek OKUMUYORUZ — yalniz DATABASE_URL.
const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('❌ DATABASE_URL tanimli degil. (Prod URL default ALINMAZ; hedefi DATABASE_URL ile verin.)');
  process.exit(1);
}

// GUARD 1 — acik niyet flag'i
if (!FRESH) {
  refuse("'--fresh' flag'i verilmedi. Bu script bos bir DB'yi sifirdan kurar; "
       + "yanlislikla calistirmayi onlemek icin acik onay gerekir.");
}

// Lokal (test) baglantilarda SSL kapali; uzak (Render) baglantilarda acik.
const isLocal = /@?(localhost|127\.0\.0\.1)/.test(conn) || !/@/.test(conn);
const client = new Client({
  connectionString: conn,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

(async () => {
  await client.connect();
  try {
    // GUARD 2 — cekirdek tablo var mi? (sema uygulamadan ONCE, salt-okuma)
    const checks = CORE_TABLES.map(t => `to_regclass('public.${t}') IS NOT NULL`).join(' OR ');
    const { rows } = await client.query(`SELECT (${checks}) AS has_core`);
    if (rows[0].has_core) {
      refuse(`Hedef DB'de cekirdek tablolar (${CORE_TABLES.join('/')}) ZATEN var. `
           + `Bu muhtemelen kurulu/production bir DB. Durduruldu.`);
    }

    // Buraya ulastiysak: --fresh verildi VE DB bos. Guvenli kurulum.
    const base = __dirname;
    const schemaPath = path.join(base, 'schema.sql');
    const migDir = path.join(base, 'migrations');
    const files = fs.readdirSync(migDir)
      .filter(f => /^\d.*\.sql$/.test(f))
      .sort(); // 3 haneli numaralar: lexicographic = sayisal sira (004..010..024..025)

    console.log('✅ Bos DB + --fresh dogrulandi. Sema kuruluyor...');
    console.log('▶ schema.sql');
    await client.query(fs.readFileSync(schemaPath, 'utf-8'));

    for (const f of files) {
      console.log(`▶ ${f}`);
      await client.query(fs.readFileSync(path.join(migDir, f), 'utf-8'));
    }
    console.log(`🎉 Tamamlandi: schema.sql + ${files.length} migration uygulandi.`);
  } catch (err) {
    console.error('❌ Kurulum hatasi:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
})();
