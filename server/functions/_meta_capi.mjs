/** 메타 전환 API(Conversions API) — 접수를 서버에서 메타로 직접 알린다 (2026-10-29)
 *
 *  왜: 광고를 눌러 들어온 방문자 상당수가 브라우저 픽셀에 잡히지 않는다
 *      (앱 안 브라우저, 광고 차단, 쿠키 배너를 넘김). 그러면 메타는 접수가 없다고 보고
 *      예산을 엉뚱한 곳으로 보낸다. 접수 원장(/api/lead)에 들어온 진짜 접수만 서버에서 한 번 더 알린다.
 *
 *  원칙
 *   · 방문자가 광고 측정에 동의한 상태일 때만 보낸다(body.meta_ok === true).
 *   · 이메일·전화번호는 기본으로 보내지 않는다. 보내려면 META_CAPI_PII=1 (폼에 국외 이전 동의가 있을 때만).
 *   · 브라우저 픽셀과 같은 이벤트 ID 로 보내 메타가 한 건으로 합친다(중복 없음).
 *   · 실패해도 접수에는 영향이 없다(응답 뒤에 보낸다).
 *
 *  설정 (Cloudflare → Variables and Secrets)
 *   META_CAPI_TOKEN      필수 — 이벤트 관리자 → 데이터 세트 → 설정 → 전환 API → 액세스 토큰 생성
 *   META_PIXEL_ID        선택 — 기본 1375041798098647 (Monnit Korea Pixel)
 *   META_CAPI_TEST_CODE  선택 — 이벤트 관리자 「이벤트 테스트」 코드 (시험할 때만)
 *   META_CAPI_PII        선택 — 1 이면 이메일·전화번호를 해시해서 함께 보냄
 */
import crypto from 'node:crypto';

const env = k => { try { const v = globalThis.__MNK_ENV_GET && globalThis.__MNK_ENV_GET(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ } return process.env[k] || ''; };
const DEFAULT_PIXEL = '1375041798098647';
const GRAPH = 'https://graph.facebook.com/v21.0/';

const sha = v => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
const cookieOf = (req, k) => { const m = new RegExp('(?:^|;\\s*)' + k + '=([^;]+)').exec(req.headers.get('cookie') || ''); return m ? decodeURIComponent(m[1]) : ''; };

/** 전화번호 → 국가번호 포함 숫자 (010-1234-5678 → 821012345678) */
function phoneE164(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '82' + d.slice(1);
  return d;
}

/** 출처 문자열(fbclid=...)에서 fbc 만들기 — _fbc 쿠키가 없을 때 */
function fbcFrom(source) {
  const m = /(?:^|[\s·?&])fbclid=([^\s·&#]+)/.exec(String(source || ''));
  return m ? 'fb.1.' + Date.now() + '.' + m[1] : '';
}

export function configured() { return !!env('META_CAPI_TOKEN'); }

/** 이 접수를 보낼지 — 전화 클릭 기록·테스트·껍데기는 제외 */
export function eligible(body, lead) {
  if (!configured()) return false;
  if (!body || body.meta_ok !== true) return false;
  if (lead && lead.test) return false;
  if (/\(전화 클릭\)/.test(String((lead && lead.company) || '')) || /^\[전화클릭\]/.test(String((lead && lead.memo) || ''))) return false;
  return true;
}

/**
 * @param {Request} req   접수 요청 (IP·브라우저·쿠키를 읽는다)
 * @param {object}  o     { type, eventId, url, source, interest, point, email, phone }
 */
export async function sendLead(req, o) {
  const token = env('META_CAPI_TOKEN');
  if (!token) return { ok: false, skipped: 'no_token' };
  const pixel = env('META_PIXEL_ID') || DEFAULT_PIXEL;
  const name = o.type === 'subscribe' ? 'CompleteRegistration' : 'Lead';
  const user = {
    client_ip_address: req.headers.get('cf-connecting-ip') || undefined,
    client_user_agent: (req.headers.get('user-agent') || '').slice(0, 400) || undefined,
    fbp: cookieOf(req, '_fbp') || undefined,
    fbc: cookieOf(req, '_fbc') || fbcFrom(o.source) || undefined
  };
  if (env('META_CAPI_PII') === '1') {
    if (o.email) user.em = [sha(o.email)];
    const ph = phoneE164(o.phone); if (ph) user.ph = [sha(ph)];
  }
  const ev = {
    event_name: name,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: String(o.url || 'https://monnit.co.kr/').slice(0, 1000),
    user_data: user,
    custom_data: { content_name: o.interest || '', content_category: o.point || '', currency: 'KRW', value: 1 }
  };
  if (o.eventId) ev.event_id = String(o.eventId).slice(0, 100);
  const body = { data: [ev] };
  const test = env('META_CAPI_TEST_CODE'); if (test) body.test_event_code = test;
  const base = env('META_CAPI_BASE') || GRAPH;   /* 시험용으로만 바꾼다 */
  const f = globalThis.__MNK_REAL_FETCH || fetch;
  try {
    const r = await f(base + encodeURIComponent(pixel) + '/events?access_token=' + encodeURIComponent(token), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) console.warn('[meta-capi] 실패', r.status, JSON.stringify(j).slice(0, 200));
    return { ok: r.ok, status: r.status, received: j && j.events_received };
  } catch (e) {
    console.warn('[meta-capi] 오류', e && e.message);
    return { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
}
