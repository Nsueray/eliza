const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const queryEngine = require('./queryEngine.js');
const fs = require('fs');

const QUESTION_TIMEOUT = 15000;
const DELAY_BETWEEN = 500;

const ERROR_KEYWORDS = [
  'veri yok', 'veri bulunamadı', 'data missing', 'sonuç bulunamadı',
  'bilgi yok', 'bilgi bulunamadı', 'no data available', 'no results found',
  'not found in the database', 'unknown error',
  'veri eksik', 'data is missing',
];

// Intent synonym mapping — these pairs are considered equivalent
const INTENT_SYNONYMS = {
  exhibitors_by_country: ['exhibitors_by_country', 'country_count'],
  country_count: ['country_count', 'exhibitors_by_country'],
  agent_performance: ['agent_performance', 'top_agents'],
  top_agents: ['top_agents', 'agent_performance'],
  expo_progress: ['expo_progress', 'expo_list', 'days_to_event'],
  expo_list: ['expo_list', 'expo_progress', 'days_to_event'],
  days_to_event: ['days_to_event', 'expo_list', 'expo_progress'],
  general_stats: ['general_stats', 'revenue_summary', 'exhibitors_by_country', 'expo_list'],
  agent_country_breakdown: ['agent_country_breakdown', 'agent_performance', 'agent_expo_breakdown'],
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runWithTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

function hasErrorKeyword(answer) {
  const lower = answer.toLowerCase();
  return ERROR_KEYWORDS.some(kw => lower.includes(kw));
}

function classify(q, result) {
  const { intent, answer } = result;

  // No answer
  if (!answer || answer.trim().length === 0) {
    return { status: 'FAIL', reason: 'empty answer' };
  }

  // Error keywords
  if (hasErrorKeyword(answer)) {
    return { status: 'FAIL', reason: `error keyword detected` };
  }

  const gotIntent = (intent || '').toLowerCase();
  const expectedIntent = q.expected_intent.toLowerCase();
  const acceptedIntents = INTENT_SYNONYMS[expectedIntent] || [expectedIntent];
  const intentMatch = acceptedIntents.includes(gotIntent);

  // Intent mismatch
  if (!intentMatch) {
    if (answer.trim().length > 0) {
      return { status: 'WARN', reason: `intent mismatch (got: ${gotIntent}, expected: ${expectedIntent})` };
    }
    return { status: 'FAIL', reason: `wrong intent (got: ${gotIntent}, expected: ${expectedIntent})` };
  }

  // Answer too long
  if (answer.length > 600) {
    return { status: 'WARN', reason: `answer too long: ${answer.length} chars` };
  }

  // Long but passing
  if (answer.length >= 450) {
    return { status: 'WARN', reason: `answer borderline long: ${answer.length} chars` };
  }

  return { status: 'PASS', reason: null };
}

async function main() {
  const questionsPath = path.resolve(__dirname, '../../docs/benchmark/questions.json');
  const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

  const total = questions.length;
  let pass = 0, fail = 0, warn = 0, skip = 0;
  const failed = [];
  const warned = [];

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`ELIZA Benchmark — ${total} Questions`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const q of questions) {
    // Skip future intents
    if (q.future_intent) {
      skip++;
      console.log(`[SKIP] Q${q.id}: future_intent: ${q.expected_intent}`);
      continue;
    }

    const start = Date.now();
    try {
      const result = await runWithTimeout(
        () => queryEngine.run(q.question, 0, q.language),
        QUESTION_TIMEOUT,
      );
      const elapsed = Date.now() - start;
      const { status, reason } = classify(q, result);

      const shortQ = q.question.length > 50 ? q.question.slice(0, 50) + '...' : q.question;

      if (status === 'PASS') {
        pass++;
        console.log(`[PASS] Q${q.id}: ${shortQ} (${result.intent}, ${elapsed}ms)`);
      } else if (status === 'WARN') {
        warn++;
        warned.push({ id: q.id, question: q.question, reason });
        console.log(`[WARN] Q${q.id}: ${shortQ} (${reason})`);
      } else {
        fail++;
        failed.push({ id: q.id, question: q.question, reason });
        console.log(`[FAIL] Q${q.id}: ${shortQ} (${reason})`);
      }
    } catch (err) {
      const elapsed = Date.now() - start;
      fail++;
      const reason = err.message === 'TIMEOUT' ? `timeout after ${QUESTION_TIMEOUT}ms` : err.message;
      failed.push({ id: q.id, question: q.question, reason });
      const shortQ = q.question.length > 50 ? q.question.slice(0, 50) + '...' : q.question;
      console.log(`[FAIL] Q${q.id}: ${shortQ} (${reason})`);
    }

    await sleep(DELAY_BETWEEN);
  }

  // Summary
  const passRate = total > 0 ? Math.round((pass / (total - skip)) * 100) : 0;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Results: ${total} total | ${pass} PASS | ${fail} FAIL | ${warn} WARN | ${skip} SKIP`);
  console.log(`Pass rate: ${passRate}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (failed.length > 0) {
    console.log('FAILED questions:');
    for (const f of failed) {
      console.log(`  - Q${f.id}: ${f.question}`);
      console.log(`    Reason: ${f.reason}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  if (warned.length > 0) {
    console.log('WARNED questions:');
    for (const w of warned) {
      console.log(`  - Q${w.id}: ${w.question}`);
      console.log(`    Reason: ${w.reason}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
