/** ChatGPT(OpenAI) 광고 전환 API(Conversions API) — 접수를 서버에서 OpenAI 로 직접 알린다 (2026-11-13)
 *
 *  왜: 브라우저 픽셀(js/monnit-consent.js · monnit-lead.js)이 못 본 접수(광고 차단·앱 안 브라우저)도
 *      ChatGPT 광고 관리자가 전환으로 볼 수 있게 한다. 메타 전환 API(_meta_capi.mjs)와 같은 원칙이다.
 *
 *  원칙
 *   · 방문자가 광고 측정에 동의한 상태일 때만 보낸다(body.meta_ok === true — 「광고·마케팅」 동의 값).
 *   · 이메일·전화번호는 보내지 않는다(접수 사실·IP·브라우저 정보·OpenAI 픽셀 쿠키만).
 *   · 브라우저 픽셀과 같은 이벤트 ID 로 보내 OpenAI 가 한 건으로 합친다(픽셀 ID + 이벤트 이름 + ID).
 *   · 전화 클릭 기록·테스트 접수는 보내지 않는다. 실패해도 접수에는 영향이 없다(응답 뒤에 보낸다).
 *
 *  설정 (Cloudflare → Variables and Secrets)
 *   OPENAI_ADS_API_KEY   필수 — ChatGPT 광고 관리자 → Conversions 탭에서 발급한 API 키 (Secret 으로)
 *   OPENAI_PIXEL_ID      선택 — 기본 9ewGG1XjnBQr6bSLcrgiHp
 *   OPENAI_ADS_VALIDATE  선택 — 1 이면 validate_only(검증만, 저장 안 함)로 보낸다 (시험할 때만)
 */
const env = k => { try { const v = globalThis.__MNK_ENV_GET && globalThis.__MNK_ENV_GET(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ } return process.env[k] || ''; };
const DEFAULT_PIXEL = '9ewGG1XjnBQr6bSLcrgiHp';
const ENDPOINT = 'https://bzr.openai.com/v1/events';

const cookieOf = (req, k) => { const m = new RegExp('(?:^|;\\s*)' + k + '=([^;]+)').exec(req.headers.get('cookie') || ''); if (!m) return ''; try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } };

export function configured() { return !!env('OPENAI_ADS_API_KEY'); }

/** 이 접수를 보낼지 — 동의 없음·전화 클릭 기록·테스트는 제외 */
export function eligible(body, lead) {
  if (!configured()) return false;
  if (!body || body.meta_ok !== true) return false;
  if (lead && lead.test) return false;
  if (/\(전화 클릭\)/.test(String((lead && lead.company) || '')) || /^\[전화클릭\]/.test(String((lead && lead.memo) || ''))) return false;
  return true;
}

/** 보낼 본문 — 시험에서 모양을 확인할 수 있게 따로 둔다 */
export function buildBody(req, o) {
  let url = String(o.url || '');
  if (!/^https?:\/\/[^/]+/.test(url)) url = 'https://monnit.co.kr/';
  const ev = {
    id: String(o.eventId || '').slice(0, 100) || ('mk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)),
    type: o.type === 'subscribe' ? 'registration_completed' : 'lead_created',
    timestamp_ms: Date.now(),
    source_url: url.slice(0, 1000),
    action_source: 'web',
    data: { type: 'customer_action' }
  };
  const oppref = cookieOf(req, '__oppref'); if (oppref) ev.oppref = oppref;          /* 받은 값 그대로 */
  const user = {};
  const obref = cookieOf(req, '__obref'); if (obref.trim()) user.obref = obref;
  const ip = req.headers.get('cf-connecting-ip'); if (ip) user.ip_address = ip;
  const ua = (req.headers.get('user-agent') || '').slice(0, 400); if (ua) user.user_agent = ua;
  if (Object.keys(user).length) ev.user = user;
  const body = { validate_only: env('OPENAI_ADS_VALIDATE') === '1', integration_source: 'monnit-korea-site', events: [ev] };
  return body;
}

/**
 * @param {Request} req   접수 요청 (IP·브라우저·쿠키를 읽는다)
 * @param {object}  o     { type, eventId, url }
 */
export async function sendLead(req, o) {
  const key = env('OPENAI_ADS_API_KEY');
  if (!key) return { ok: false, skipped: 'no_key' };
  const pixel = env('OPENAI_PIXEL_ID') || DEFAULT_PIXEL;
  const body = buildBody(req, o);
  const base = env('OPENAI_ADS_BASE') || ENDPOINT;   /* 시험용으로만 바꾼다 */
  const f = globalThis.__MNK_REAL_FETCH || fetch;
  try {
    const r = await f(base + '?pid=' + encodeURIComponent(pixel), {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });
    const t = r.ok ? '' : (await r.text().catch(() => '')).slice(0, 200);
    if (!r.ok) console.warn('[oai-capi] 실패', r.status, t);
    return { ok: r.ok, status: r.status, event: body.events[0].type, oppref: !!body.events[0].oppref, ...(t ? { error: t } : {}) };
  } catch (e) {
    console.warn('[oai-capi] 오류', e && e.message);
    return { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
}
