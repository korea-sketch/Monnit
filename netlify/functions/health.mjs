/** 사이트·폼 상시 감시 (15분 주기)
 *  광고가 도는 동안 신청 폼이 죽으면 광고비가 전액 낭비된다. 그 공백을 없앤다. */
import { append, set, get } from './_store.mjs';
import { runOnce as backfillOnce } from './_backfill.mjs';

export const config = { schedule: '*/15 * * * *' };

const SITE = 'https://monnit.co.kr';
/* 사이트 장애 알림 수신자. 접수 알림과 같은 스위치를 쓴다.
   다만 Web3Forms 로 나가는 경로는 키에 등록된 주소로만 가므로,
   실제로 주소를 바꾸려면 Brevo 경로(_notify.mjs)를 타야 한다. */
const ALERT_TO = process.env.NOTIFY_TO || '0702yeom@gmail.com';
const WEB3FORMS_KEY = process.env.WEB3FORMS_KEY || 'e4d5cb03-1b25-425c-a47d-f04e4a05e7e2';

const PAGES = [
  { path: '/promo/consulting', name: '광고 랜딩(예지보전)', must: ['id="apply"', 'monnit-lead.js', 'GTM-T8H73VW'] },
  { path: '/promo/proposal',   name: '광고 랜딩(제안가이드)', must: ['id="fmForm"', 'monnit-lead.js', 'GTM-T8H73VW'] },
  /* 온도 감시 랜딩 — 이미지 11장과 제안서 3종이 함께 걸려 있어 깨질 구석이 많다.
     og-image 경로를 함께 보는 이유: 이미지 폴더를 통째로 안 올리면 페이지는
     멀쩡히 뜨는데 사진만 전부 빈칸이 된다. 그 상태로 광고가 계속 돈다. */
  { path: '/promo/temperature', name: '광고 랜딩(온도감시)',
    must: ['id="fmForm"', 'monnit-lead.js', 'GTM-T8H73VW', '/images/temp-packages/og-image.jpg'] },
  /* Modbus 백서 랜딩 — 백서 신청 폼과 공통 스크립트가 살아 있는지 본다.
     이 페이지는 1MB 단일 HTML 이라 배포가 잘리면 폼만 조용히 사라진다. */
  { path: '/promo/modbus',     name: '광고 랜딩(Modbus백서)',
    must: ['wpForm-hero', 'monnit-lead.js', 'GTM-T8H73VW', 'sendpw'] },
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
  /* 밀린 접수 1회 자동 발송 — 배포 직후 한 번만 돈다. 실패해도 감시는 계속한다. */
  try { await backfillOnce(); } catch (e) {}

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
