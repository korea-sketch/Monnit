/** 무경험 신청자 자동 안내 메일 — /promo/consulting 전용
 *
 *  ── 왜 따로 만드는가 ────────────────────────────────────────────────
 *  진동센서를 한 번도 안 써본 분에게 바로 영업 전화를 걸면 대화가 안 된다.
 *  "이게 뭔지"부터 설명해야 하는데, 그건 전화보다 문서가 낫다.
 *  그래서 접수 즉시 예지보전 가이드를 보내고, 담당자는 그걸 읽었다는 전제로
 *  3영업일 안에 연락한다. 메일에도 그 약속을 그대로 적는다.
 *
 *  sendpw.js 와 같은 구조다 — Brevo 로 보내고, PDF 는 공개 URL 없이
 *  getdoc 서명 링크로만 나간다. 다른 점은 두 가지뿐이다.
 *    · 제목이 고정이다 (가이드 1종)
 *    · 링크 유효기간이 7일이다 (메일은 나중에 열어보므로 10분은 너무 짧다)
 *
 *  필요 환경변수
 *    BREVO_API_KEY : 없으면 메일만 건너뛴다. 접수 자체는 실패시키지 않는다.
 *    DL_SECRET     : 링크 서명 키 (_docmap 기본값 있음)
 */
const { lookup, SECRET } = require('./_docmap');
const crypto = require('crypto');

const TOKEN = 'mnt-pw-2026-7f3k9';                 /* sendpw 와 동일 */
/* 무경험자에게 보내는 자료 — _docmap 의 제목 키를 그대로 쓴다.
   지금은 1종이다. 늘리려면 항목만 추가하면 메일 본문이 알아서 맞춰진다. */
const GUIDES = [
  { title: '무선 IoT 설비 예지보전 제안 가이드',
    label: '실제 제안서 샘플 (20쪽)',
    why:   '회전기기 26대 + 수배전반 4포인트를 실제로 진행한 사례입니다. 한 달 뒤 무엇을 받게 되는지 그대로 보실 수 있습니다.' }
];
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;        /* 7일 */
const SLA = '영업일 기준 3~4일';

function sign(file, exp) {
  return crypto.createHmac('sha256', SECRET).update(file + '|' + exp).digest('hex').slice(0, 32);
}

exports.handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  const reply = (code, obj) => ({ statusCode: code, headers: H, body: JSON.stringify(obj) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false });

  try {
    const d = JSON.parse(event.body || '{}');
    if (d.token !== TOKEN) return reply(401, { ok: false, error: 'unauthorized' });

    const email = String(d.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { ok: false, error: 'bad_email' });

    const company = String(d.company || '').slice(0, 80).trim();
    const name    = String(d.name || '').slice(0, 40).trim();
    const line    = String(d.line || '').slice(0, 80).trim();
    const spot    = String(d.spot || '').slice(0, 120).trim();
    const asset   = String(d.asset || '').slice(0, 40).trim();

    const exp = Date.now() + LINK_TTL_MS;
    const origin = (event.headers && (event.headers.origin || event.headers.referer)) || 'https://monnit.co.kr';
    const base = (origin.match(/^https?:\/\/[^/]+/) || ['https://monnit.co.kr'])[0];

    /* 자료가 하나라도 빠지면 링크 없는 메일이 나가므로, 있는 것만 추려서 보낸다 */
    const docs = [];
    for (const g of GUIDES) {
      const hit = lookup(g.title);
      if (!hit) continue;
      const [file, dlname] = hit;
      docs.push({ ...g, abs: base + '/.netlify/functions/getdoc?f=' + encodeURIComponent(file) +
        '&e=' + exp + '&s=' + sign(file, exp) + '&n=' + encodeURIComponent(dlname) });
    }
    if (!docs.length) return reply(404, { ok: false, error: 'not_ready' });

    const hello = (name ? name + ' 님' : '담당자님') + (company ? ' (' + company + ')' : '');
    const where = [line, spot].filter(Boolean).join(' · ') || asset || '';

    const many = docs.length > 1;
    const docBlock = docs.map((d, i) =>
      (many ? '  ' + (i + 1) + '. ' : '  ') + d.title + ' — ' + d.label + '\n' +
      '     ' + d.why + '\n' +
      '     ' + d.abs + '\n'
    ).join('\n');

    const text =
      '안녕하세요 ' + hello + ', Monnit Korea입니다.\n\n' +
      '회전설비 AI 예지보전 1개월 무료 체험 신청이 정상 접수되었습니다.\n\n' +
      '진동센서를 처음 검토하신다고 해주셨습니다. 그래서 통화 전에 먼저\n' +
      '읽어보실 자료를 보내드립니다. 한 번 훑어보시면 한 달 뒤에 무엇을\n' +
      '받게 되는지 그림이 잡힙니다.\n\n' +
      docBlock + '\n' +
      '■ 링크 유효 : 발송일로부터 7일\n' +
      (where ? '■ 신청하신 대상 : ' + where + '\n' : '') +
      '\n' +
      '── 다음 단계 ────────────────────────────────\n' +
      '담당자가 ' + SLA + ' 이내에 ' + (name ? name + ' 님께' : '') + ' 연락드립니다.\n' +
      '자료를 미리 보셨다면 "우리 설비에 되는지"부터 바로 이야기하실 수 있습니다.\n' +
      '먼저 통화를 원하시면 02-2088-1454 로 편하게 전화 주세요.\n\n' +
      '문의 : korea@monnit.com · 02-2088-1454\n\n' +
      '감사합니다.\nMonnit Korea 드림';

    let mailed = false;
    try {
      if (process.env.BREVO_API_KEY) {
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            /* 발신 주소는 Brevo 에서 인증된 monnit.co.kr 을 쓴다.
               monnit.com 은 본사 도메인이라 DMARC 가 p=reject 이고 SPF·DKIM 에
               Brevo 가 없어서, 그 주소로 보내면 수신측이 스푸핑으로 보고 거부한다.
               답장 주소는 그대로 두므로 고객 회신은 기존 메일함으로 온다. */
            sender: { name: 'Monnit Korea', email: 'no-reply@monnit.co.kr' },
            to: [{ email }],
            replyTo: { name: 'Monnit Korea', email: 'korea@monnit.com' },
            subject: '[Monnit Korea] 무료 체험 접수 완료 — 먼저 읽어보실 예지보전 가이드',
            textContent: text
          })
        });
        mailed = (r.status === 201);
      }
    } catch (e) { /* 메일 실패가 접수를 막지 않는다 */ }

    return reply(200, { ok: true, mailed, sla: SLA, docs: docs.length });
  } catch (e) {
    return reply(500, { ok: false, error: 'server' });
  }
};
