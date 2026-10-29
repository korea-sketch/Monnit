/** Cloudflare 이관용 데이터 내보내기 (2026-10)
 *
 *  Netlify Blobs 에 쌓인 리드·방문 기록·제안서·관제 설정을 Cloudflare(R2)로 옮길 때
 *  Cloudflare 쪽 /ops/migrate 화면이 이 주소를 불러 데이터를 가져갑니다.
 *
 *  인증: x-mnk-migrate 헤더 = HMAC-SHA256(MIGRATE_SECRET → 없으면 PROPOSAL_SECRET → DL_SECRET, 'mnk-blob-migrate-v1')
 *        MIGRATE_SECRET 은 이관 전용 열쇠 — Netlify 의 비밀값은 다시 볼 수 없어서, 새 값을 양쪽에 넣어 맞춘다.
 *        두 사이트에 같은 비밀값이 들어 있어야 합니다(환경변수를 그대로 옮기면 같음).
 *        비밀값이 없으면 아예 닫혀 있습니다.
 *  이관이 끝나면 이 파일을 지워도 됩니다.
 *
 *    GET  /api/blob-export?op=stores               → { stores: [...] }
 *    GET  /api/blob-export?op=keys&store=NAME       → { keys: [...] }
 *    POST /api/blob-export?op=get  {store, keys}    → { items: [{ key, b64, meta }], next }
 *    GET  /api/blob-export?op=env                   → { vars: {...} }  함수가 쓰는 설정값(환경변수)
 *         Cloudflare 쪽에 비밀값을 하나하나 다시 넣지 않도록, 위와 같은 인증으로 서버끼리 옮깁니다.
 */
import crypto from 'node:crypto';
import { getStore, listStores } from '@netlify/blobs';

const env = k => { try { const v = globalThis.Netlify && Netlify.env.get(k); if (v) return v; } catch (e) { /* 무시 */ } return process.env[k] || ''; };
export function migrateToken() {
  const s = env('MIGRATE_SECRET') || env('PROPOSAL_SECRET') || env('DL_SECRET');
  return s ? crypto.createHmac('sha256', s).update('mnk-blob-migrate-v1').digest('hex') : '';
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

/* 함수 코드가 읽는 설정값 이름 (시스템 값 URL·DEPLOY_* 등과 PROPOSAL_ETA_TEXT 는 제외 — 새 기본 문구를 쓰도록) */
const ENV_NAMES = ('AI_PROVIDER ALARM_MAIL_OFF ANTHROPIC_API_KEY BACKFILL_FROM BACKFILL_MAX BACKFILL_OFF BLOCK_API_KEY BLOCK_COMPANIES ' +
  'BLOCK_DOMAINS BLOCK_IPS BLOCK_PHONES BREVO_API_KEY CLARITY_TOKEN DL_SECRET GA4_PROPERTY_ID GA4_SA_EMAIL GA4_SA_KEY GEMINI_API_KEY ' +
  'GEMINI_MODEL GOOGLE_ADS_SHEET MAIL_FROM MAIL_PREVIEW_TOKEN MAIL_REPLYTO META_AD_ACCOUNT META_TOKEN MONDAY_API_TOKEN MONDAY_BOARD_ID ' +
  'MONDAY_TOKEN MONNIT_TEST_EMAIL MONNIT_TEST_NAME NAVER_API_KEY NAVER_CUSTOMER_ID NAVER_SECRET NOTIFY_TO OPS_PASS OPS_USER ' +
  'PROPOSAL_ADMIN_KEY PROPOSAL_AI_MODEL PROPOSAL_BCC PROPOSAL_BRAND_COUNTRIES PROPOSAL_BRAND_CUSTOMERS PROPOSAL_BRAND_LINE ' +
  'PROPOSAL_BRAND_PUBLIC PROPOSAL_CALLBACK_TEXT PROPOSAL_CHAT_MODEL PROPOSAL_CHAT_RETRY PROPOSAL_FONT_DIR PROPOSAL_FROM_EMAIL ' +
  'PROPOSAL_FROM_NAME PROPOSAL_HOLIDAYS PROPOSAL_MODE PROPOSAL_MONDAY_BOARD PROPOSAL_MONDAY_COLUMNS PROPOSAL_MONDAY_GROUP ' +
  'PROPOSAL_MONDAY_TOKEN PROPOSAL_OPENED_TO PROPOSAL_REPLY_TO PROPOSAL_REVIEW PROPOSAL_SECRET PROPOSAL_SITE PROPOSAL_STAFF_TO ' +
  'PROPOSAL_WEBHOOK_URL RELAY_ORIGINS RELAY_TOKEN ROUTE_ALARM_TO ROUTE_GENERAL_TO ROUTE_MAIL_OFF SITE_ORIGIN STAFF_MAIL_KINDS STATICFORMS_KEY VISIT_LOG VISIT_NOTIFY_TO VISIT_PASS VISIT_USER WEB3FORMS_KEY').split(' ');

export default async (req, context) => {
  const tok = migrateToken();
  const got = req.headers.get('x-mnk-migrate') || '';
  if (!tok || got.length !== tok.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(tok))) return json({ ok: false, error: 'unauthorized' }, 401);
  const u = new URL(req.url);
  const op = u.searchParams.get('op');
  try {
    if (op === 'env') {
      const vars = {};
      for (const k of ENV_NAMES) { const v = env(k); if (v) vars[k] = v; }
      const sid = env('SITE_ID') || (context && context.site && context.site.id) || '';
      if (sid) vars.SITE_ID = sid;
      return json({ ok: true, vars });
    }
    if (op === 'stores') {
      const r = await listStores();
      return json({ ok: true, stores: (r.stores || []).map(s => (typeof s === 'string' ? s : s.name)) });
    }
    if (op === 'keys') {
      const name = u.searchParams.get('store');
      if (!name) return json({ ok: false, error: 'store' }, 400);
      const r = await getStore({ name, consistency: 'strong' }).list();
      return json({ ok: true, keys: (r.blobs || []).map(b => b.key) });
    }
    if (op === 'get' && req.method === 'POST') {
      const { store: name, keys } = await req.json();
      const s = getStore({ name, consistency: 'strong' });
      const items = []; let size = 0, i = 0;
      for (; i < (keys || []).length; i++) {
        if (size > 3.5 * 1024 * 1024) break;                 /* 함수 응답 6MB 한도 안쪽 */
        const r = await s.getWithMetadata(keys[i], { type: 'arrayBuffer' });
        if (!r) { items.push({ key: keys[i], missing: true }); continue; }
        const b64 = Buffer.from(r.data).toString('base64');
        size += b64.length;
        items.push({ key: keys[i], b64, meta: r.metadata || {} });
      }
      return json({ ok: true, items, next: i < (keys || []).length ? i : null });
    }
    return json({ ok: false, error: 'op' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
};

export const config = { path: '/api/blob-export' };
