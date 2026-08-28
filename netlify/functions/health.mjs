/** 사이트·폼 상시 감시 (15분 주기)
 *  광고가 도는 동안 신청 폼이 죽으면 광고비가 전액 낭비된다. 그 공백을 없앤다. */
import { append, set, get } from './_store.mjs';

export const config = { schedule: '*/15 * * * *' };

const SITE = 'https://monnit.co.kr';
const ALERT_TO = 'korea@monnit.com';
const WEB3FORMS_KEY = process.env.WEB3FORMS_KEY || 'e4d5cb03-1b25-425c-a47d-f04e4a05e7e2';

const PAGES = [
  { path: '/promo/consulting', name: '광고 랜딩(예지보전)', must: ['id="apply"', 'monnit-lead.js', 'GTM-T8H73VW'] },
  { path: '/',                 name: '홈',                  must: ['mk-leadForm', 'monnit-lead.js', 'GTM-T8H73VW'] },
  { path: '/contact',          name: '문의 페이지',          must: ['GTM-T8H73VW'] }
];

async function checkPage(p) {
  const t0 = Date.now();
  const r = { name: p.name, path: p.path, ok: false, status: 0, ms: 0, missing: [] };
  try {
    const res = await fetch(SITE + p.path, {
      headers: { 'user-agent': 'MonnitHealthCheck/1.0' },
      signal: AbortSignal.timeout(12000)
    });
    r.status = res.status;
    r.ms = Date.now() - t0;
    const html = await res.text();
    r.missing = (p.must || []).filter(m => html.indexOf(m) === -1);
    r.ok = res.ok && r.missing.length === 0;
  } catch (e) {
    r.ms = Date.now() - t0;
    r.error = String(e?.message || e).slice(0, 120);
  }
  return r;
}

async function checkBackend() {
  const r = { name: '폼 전송 백엔드', ok: false, status: 0 };
  try {
    const res = await fetch('https://api.staticforms.dev/submit', { method: 'OPTIONS', signal: AbortSignal.timeout(8000) });
    r.status = res.status;
    r.ok = res.status < 500;
  } catch (e) { r.error = String(e?.message || e).slice(0, 120); }
  return r;
}

async function alertMail(fails) {
  const lines = fails.map(f =>
    `· ${f.name} (${f.path || '-'}) — ${f.error ? '응답 없음: ' + f.error
      : f.status >= 400 ? 'HTTP ' + f.status
      : (f.missing?.length) ? '누락: ' + f.missing.join(', ') : '이상'}`).join('\n');
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `[모넷·경보] 사이트 점검 이상 ${fails.length}건`,
        from_name: 'Monnit 사이트 감시',
        email: ALERT_TO,
        점검시각: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        이상항목: lines,
        조치: '광고가 계속 집행 중입니다. 신청 폼이 정상인지 즉시 확인해 주세요.'
      })
    });
  } catch (e) {}
}

export default async () => {
  const results = [];
  for (const p of PAGES) results.push(await checkPage(p));
  results.push(await checkBackend());

  const fails = results.filter(r => !r.ok);
  const snap = { ts: new Date().toISOString(), ok: fails.length === 0, fail_count: fails.length, results };

  const day = new Intl.DateTimeFormat('en-CA',
    { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await append('health', day + '.jsonl', snap);
  await set('health', 'latest.json', JSON.stringify(snap));

  /* 상태가 바뀔 때만 알린다 — 같은 장애로 15분마다 오지 않게 */
  const sig = fails.map(f => f.name).sort().join('|');
  const prev = await get('health', 'alerted.txt');
  if (fails.length && prev !== sig) { await alertMail(fails); await set('health', 'alerted.txt', sig); }
  if (!fails.length && prev) await set('health', 'alerted.txt', '');

  return new Response(JSON.stringify(snap), { headers: { 'content-type': 'application/json' } });
};
