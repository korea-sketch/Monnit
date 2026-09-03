/** 제안서 다운로드 — 이메일 검증 후 "서명된 임시 다운로드 링크" 1건만 반환 + 안내 메일
 *
 *  ── 왜 이렇게 하는가 ────────────────────────────────────────────────
 *  예전에는 다운로드 주소가 구글 시트(Whitepapers 탭) url 열에 있었고, 그 시트를
 *  브라우저가 gviz CSV 로 통째로 내려받았다. 방문자가 개발자도구만 열면 16개 주소가
 *  전부 보였고 이메일 입력은 아무것도 막지 못했다.
 *  → 이제 PDF 는 저장소 proposals/ 안에 있고 공개 URL 이 없다(_redirects 로 차단).
 *    이 함수가 이메일을 확인한 뒤, 10분짜리 서명 링크를 1건만 발급한다.
 *
 *  필요 환경변수
 *    BREVO_API_KEY : 안내 메일 발송 (없으면 메일만 건너뛰고 다운로드는 정상)
 *    DL_SECRET     : 링크 서명 키 (없으면 코드 기본값 사용 — 운영에서는 설정 권장)
 */
const { lookup, SECRET, TTL_MS, norm } = require('./_docmap');

/* ── 현장 진단 컨설팅 제안 ────────────────────────────────────
   /promo/proposal 로 「예지보전 제안 가이드」를 받아간 분에게는
   다운로드 안내 대신 컨설팅 배정 안내를 보낸다. 회신이 오면 전화를 건다.
   나머지 16종 제안서는 기존 안내문 그대로다 — 업종이 다른데 회전설비
   컨설팅을 권하면 안 된다.

   배정 현황(잔여 개사·마감일)은 코드에 박지 않는다. 매번 달라지므로
   ops 저장소(consult.json)에서 읽고, /ops 화면에서 고친다.
   값이 없으면 숫자를 아예 빼고 문장을 내보낸다 — 틀린 숫자보다 없는 게 낫다. */
const CONSULT_DOC = '무선 IoT 설비 예지보전 제안 가이드';

async function readSlots() {
  try {
    const { get } = await import('./_store.mjs');
    const o = JSON.parse(await get('ops', 'consult.json') || 'null');
    if (!o || typeof o !== 'object') return null;
    return {
      month:    String(o.month || '').trim(),
      total:    Number(o.total) > 0 ? Number(o.total) : null,
      left:     Number.isFinite(Number(o.left)) ? Number(o.left) : null,
      deadline: String(o.deadline || '').trim(),
      value:    String(o.value || '100만원').trim()
    };
  } catch (e) { return null; }
}

function consultBody({ company, name, abs, slots }) {
  const s = slots || {};
  const M = s.month || '이번 달';
  const line = (label, v) => v ? '· ' + label + ': ' + v + '\n' : '';

  const status =
    '■ ' + M + ' 배정 현황\n' +
    '· 대상: 자료를 요청하신 기업 중 회전설비 보유 현장\n' +
    (s.total != null ? '· 배정 규모: 월 ' + s.total + '개사 (설비 진단 전문 인력 운영 여건상 제한)\n' : '') +
    (s.left  != null ? '· 잔여: ' + s.left + '개사\n' : '') +
    line('접수 마감', s.deadline ? s.deadline + ' 회신분까지, 이후 문의는 다음 달 배정으로 이월' : '') +
    '· 배정 방식: 회신 접수 순\n';

  /* 회사·담당자는 폼에 적어주신 값을 그대로 쓴다. 둘 다 없으면 인사말 줄을
     통째로 빼서 빈 줄이 남지 않게 한다 — 「님께」만 덩그러니 남으면 안 된다. */
  const head = (company ? company + '\n' : '') + (name ? name + ' 님께\n' : '');

  return (
    (head ? head + '\n' : '') +
    '안녕하십니까. 모넷코리아입니다.\n' +
    '저희 홈페이지를 통해 〈예지보전 제안 가이드〉를 요청해 주셔 감사드립니다.\n\n' +
    '■ 요청하신 자료\n' +
    '· ' + CONSULT_DOC + ' (PDF)\n' +
    '· 다운로드: ' + abs + '\n' +
    '· 유효시간: 발급 후 10분 (만료 시 사이트에서 다시 신청)\n\n' +
    '가이드는 일반적인 도입 체계를 다룬 문서로, 개별 현장의 설비 구성과 운전\n' +
    '조건에 따라 적용 방안은 상이합니다. 이에 실질적인 검토를 도와드리고자\n' +
    '현장 진단 컨설팅 배정을 안내드립니다.\n\n' +
    status + '\n' +
    '본 컨설팅은 설비 진단 전문 인력이 직접 방문하는 유상 서비스(' + (s.value || '100만원') + ' 상당)이며,\n' +
    '자료 요청 기업에 한해 별도 비용 없이 제공해 드리고 있습니다.\n' +
    '인력 일정상 배정 규모를 늘리기 어려운 점 양해 부탁드립니다.\n\n' +
    '■ 진동센서 1개월 무상 체험 (컨설팅 신청 기업 대상)\n' +
    '컨설팅을 신청하신 기업에 한해, 무선 진동센서를 실제 설비에 부착하여\n' +
    '1개월간 운영해 보실 수 있는 체험 프로그램을 함께 진행하고 있습니다.\n' +
    '· 제공 내용: 무선 진동센서 및 게이트웨이 대여, 부착 지원, 관제 화면 계정 제공\n' +
    '· 운영 기간: 부착일로부터 1개월\n' +
    '· 기대 효과: 자사 설비의 실측 진동 데이터를 확보하여, 도입 효과를\n' +
    '            가정이 아닌 실제 수치로 검토 가능\n' +
    '· 종료 후: 반납 또는 정식 도입 전환 중 선택 (의무 없음)\n' +
    '체험 장비 역시 보유 수량이 한정되어 있어 컨설팅 배정 순으로 지원됩니다.\n\n' +
    '■ 예지보전 도입의 기대 효과\n' +
    '1. 계획외 정지의 사전 예측 — 진동·온도를 상시 계측하여 이상 징후를\n' +
    '   고장 발생 이전 단계에서 검출\n' +
    '2. 설비 통합 관제 — 분산된 설비의 상태를 단일 대시보드에서 모니터링하여\n' +
    '   대응 우선순위 판단\n' +
    '3. 점검·운영 비용 절감 — 시간 기반 주기 정비를 상태 기반 정비로 전환하여\n' +
    '   순회 점검·과잉 정비 감축\n' +
    '4. 에너지 사용 최적화 — 비정상 부하·과부하 구간을 데이터로 식별하여\n' +
    '   전력 손실 요인 개선\n\n' +
    '■ 진단 범위\n' +
    '· 보유 회전설비 현황 파악 및 예지보전 적용 우선순위 선정\n' +
    '· 계측 항목 및 센서 부착 위치 설계, 관제 화면 구성안 제시\n' +
    '· 도입 규모별 시스템 구성과 개략 견적 산출\n' +
    '· 동종 설비 적용 사례 및 운영 성과 공유\n\n' +
    '소요 시간은 1시간 내외이며, 결과는 보고 형태로 정리하여 전달해 드립니다.\n' +
    '이후 도입 검토 여부에 대한 제약은 없습니다.\n\n' +
    M + ' 배정과 센서 체험을 함께 원하시면 가능한 날짜 둘 또는 셋을\n' +
    '회신해 주시기 바랍니다. 잔여 일정 소진 시 다음 달로 안내드리게 되는 점\n' +
    '참고 부탁드립니다.\n\n' +
    '감사합니다.\n모넷코리아 드림\n\n' +
    '서울 서초구 효령로 380, 2층\n' +
    'T. 02-2088-1454 | korea@monnit.com | monnit.co.kr'
  );
}

function consultSubject(slots) {
  const s = slots || {};
  const M = s.month || '';
  const left = s.left != null ? ' 잔여 ' + s.left + '개사' : '';
  return '[모넷코리아] ' + (M ? M + ' ' : '') + '현장 진단 컨설팅' + left +
         ' – 진동센서 1개월 체험 포함';
}
const crypto = require('crypto');

const TOKEN = 'mnt-pw-2026-7f3k9';

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

    const title = String(d.title || '').slice(0, 120).trim();
    if (!title) return reply(400, { ok: false, error: 'no_title' });
    const company = String(d.company || '').slice(0, 80).trim();
    const person  = String(d.name || '').slice(0, 40).trim();

    /* ── 이 조회를 통과해야만 주소가 밖으로 나간다 ── */
    const hit = lookup(title);
    if (!hit) return reply(404, { ok: false, error: 'not_ready' });
    const [file, dlname] = hit;

    const exp = Date.now() + TTL_MS;
    const url = '/.netlify/functions/getdoc?f=' + encodeURIComponent(file) +
                '&e=' + exp + '&s=' + sign(file, exp) + '&n=' + encodeURIComponent(dlname);

    const origin = (event.headers && (event.headers.origin || event.headers.referer)) || 'https://monnit.co.kr';
    const abs = (origin.match(/^https?:\/\/[^/]+/) || ['https://monnit.co.kr'])[0] + url;

    /* ── 안내 메일 (실패해도 다운로드는 진행) ── */
    const isConsult = norm(title) === norm(CONSULT_DOC);
    const slots = isConsult ? await readSlots() : null;

    const plainBody =
      '안녕하세요, Monnit Korea입니다.\n\n' +
      '요청하신 「' + title + '」 제안서를 신청해 주셔서 감사합니다.\n' +
      '브라우저에서 다운로드가 자동으로 시작됩니다.\n' +
      '혹시 시작되지 않았다면 아래 주소로 10분 이내에 내려받아 주세요.\n\n' +
      '■ 제안서   : ' + title + '\n' +
      '■ 다운로드 : ' + abs + '\n' +
      '■ 유효시간 : 발급 후 10분 (만료 시 사이트에서 다시 신청)\n' +
      '■ 열람     : 비밀번호 없이 바로 열림\n' +
      '■ 편집     : 보호됨 (수정이 필요하시면 담당자에게 요청해 주세요)\n\n' +
      '현장 상황에 맞춘 구성·견적 상담은 언제든 도와드리겠습니다.\n' +
      '문의: korea@monnit.com · 02-2088-1454\n\n' +
      '감사합니다.\nMonnit Korea 드림';

    const body    = isConsult ? consultBody({ company, name: person, abs, slots }) : plainBody;
    const subject = isConsult ? consultSubject(slots)
                              : '[Monnit Korea] 제안서 다운로드 안내 — ' + title;

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
            subject: subject,
            textContent: body
          })
        });
        mailed = (r.status === 201);
      }
    } catch (e) { /* 메일 실패가 다운로드를 막지 않는다 */ }

    return reply(200, { ok: true, url, mailed, consult: isConsult });
  } catch (e) {
    return reply(500, { ok: false, error: 'server' });
  }
};
