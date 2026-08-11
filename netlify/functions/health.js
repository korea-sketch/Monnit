/** 사이트·폼 상시 감시 (15분 주기)
 *
 *  왜 필요한가: 광고는 계속 돌아가는데 신청 폼이 죽으면 광고비가 전액 낭비된다.
 *  사람이 알아채기까지 보통 하루가 걸린다. 이 함수가 그 공백을 없앤다.
 *
 *  점검 항목
 *   1) 주요 페이지 응답 여부·속도
 *   2) 신청 폼이 페이지에 실제로 존재하는지 (배포 사고로 사라지는 경우 감지)
 *   3) 측정 스크립트(GTM·리드 규격)가 붙어 있는지
 *   4) 폼 전송 백엔드가 살아 있는지
 *  이상 시 담당자에게 메일 발송(Web3Forms) + 이력 저장
 */
const store = require('./_store');

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
    r.error = String(e && e.message || e).slice(0, 120);
  }
  return r;
}

async function checkBackend() {
  const r = { name: '폼 전송 백엔드', ok: false, status: 0 };
  try {
    const res = await fetch('https://api.staticforms.dev/submit', {
      method: 'OPTIONS', signal: AbortSignal.timeout(8000)
    });
    r.status = res.status;
    r.ok = res.status < 500;           /* 4xx 는 살아있다는 뜻 */
  } catch (e) { r.error = String(e && e.message || e).slice(0, 120); }
  return r;
}

async function alert(fails) {
  const lines = fails.map(f =>
    `· ${f.name} (${f.path || '-'}) — ${f.error ? '응답 없음: ' + f.error
      : f.status >= 400 ? 'HTTP ' + f.status
      : (f.missing && f.missing.length) ? '누락: ' + f.missing.join(', ')
      : '이상'}`).join('\n');
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

exports.handler = async () => {
  const results = [];
  for (const p of PAGES) results.push(await checkPage(p));
  results.push(await checkBackend());

  const fails = results.filter(r => !r.ok);
  const snap = {
    ts: new Date().toISOString(),
    ok: fails.length === 0,
    fail_count: fails.length,
    results
  };

  /* 이력 저장 (일 단위) */
  const d = new Date();
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}.jsonl`;
  await store.append('health', key, snap);
  await store.set('health', 'latest.json', JSON.stringify(snap));

  /* 이상이 새로 생겼을 때만 알린다 (같은 장애로 15분마다 오는 것 방지) */
  if (fails.length) {
    const prev = await store.get('health', 'alerted.txt');
    const sig = fails.map(f => f.name).sort().join('|');
    if (prev !== sig) {
      await alert(fails);
      await store.set('health', 'alerted.txt', sig);
    }
  } else {
    await store.set('health', 'alerted.txt', '');
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(snap, null, 2)
  };
};
