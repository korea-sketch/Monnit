/** 담당자 알림함 — 메일로 보낼 것과 관제(/ops/notices)에만 남길 것을 가른다. (2026-09-30)
 *
 *  ── 왜 ──────────────────────────────────────────────────────────────
 *  2026-09-29 제안 가이드 랜딩에서 한 사람(사세 남우현)이 자료를 받고 맞춤 제안서를
 *  같이 신청하자 담당자 메일함에 5통이 쌓였다.
 *    ① [모넷·자료] … 신청         브라우저가 StaticForms/Web3Forms 로 직접 보낸 raw 폼
 *    ② [모넷·접수] …              서버 notify() — ①과 같은 내용 (notified 플래그 누락)
 *    ③ [맞춤제안·신규 접수·즉시 발송]
 *    ④ [맞춤제안·발송 완료·연락 필요]  ③ 몇십 초 뒤, 내용 거의 같음
 *    ⑤ [맞춤제안·제안서 열람]
 *  대표님 지시: 「모든 단계마다 노티 메일 보낼 필요 없고, 결정적인 행위 시에만 요약 메일로.
 *               경로나 긴 주소는 링크 표시로」. 무료 발송 한도(StaticForms·Web3Forms)도 아낀다.
 *
 *  ── 원칙 ────────────────────────────────────────────────────────────
 *  · 모든 알림은 이 알림함(ops 저장소 staffnote-YYYY-MM)에 한 줄씩 남는다 — 메일을 보냈든 안 보냈든.
 *  · 메일은 「사람이 움직여야 하는 순간」에만 보낸다. 나머지는 /ops/notices 에서 본다.
 *  · 목록은 환경변수로 바꿀 수 있다(코드 수정 없이).
 *      STAFF_MAIL_KINDS   기본 new,review,failed,build_failed,opened,more,contact
 *
 *  ── 종류 ────────────────────────────────────────────────────────────
 *    메일 O  new          맞춤 제안서 신규 접수 (자료 신청이 함께 왔으면 한 줄로 합침)
 *            contact      상담 문의 · 프로모션 신청 (사이트 공통 폼)
 *            opened       고객이 제안서를 처음 열었다 — 연락 적기
 *            more         받은 고객이 다른 과제로 다시 요청 — 견적 연결
 *            review       엔지니어 확인이 필요해 발송이 멈췄다
 *            failed       발송 실패 · 자동 재시도 중단
 *            build_failed 제안서 생성 실패
 *    알림함만 sent        발송 완료 (즉시 방식은 ③ 신규 접수 메일에 이미 예고됨)
 *            hot          발송 뒤 진행 화면 재방문
 *            preview      발송 전 검수 예고 (자동 발송 방식일 때)
 *            auto_fix     AI 문안을 템플릿으로 자동 교체하고 그대로 발송
 *            doc_request  자료(백서·가이드) 신청 — 대표님 「그냥 자료 다운이라 중요한 메일 아님」
 *            subscribe    뉴스레터 구독
 *            dup          같은 접수가 다른 경로로 이미 알려짐(중복 방지로 보류) */
import { append, readLines } from './_store.mjs';

const env = (k, d = '') => {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ }
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};

export const DEFAULT_MAIL_KINDS = ['new', 'review', 'failed', 'build_failed', 'opened', 'more', 'contact'];

export const LABEL = {
  new: '맞춤제안 신규 접수', contact: '상담·신청 접수', opened: '제안서 열람', more: '추가 제안 · 견적 연결',
  review: '엔지니어 확인 필요', failed: '발송 실패', build_failed: '제안서 생성 실패',
  sent: '제안서 발송 완료', hot: '진행 화면 재방문', preview: '발송 전 검수 예고', auto_fix: 'AI 문안 자동 교체',
  doc_request: '자료 신청', subscribe: '뉴스레터 구독', dup: '중복 알림 보류'
};

export function mailKinds() {
  const raw = env('STAFF_MAIL_KINDS', '');
  const list = raw ? raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean) : DEFAULT_MAIL_KINDS;
  return new Set(list);
}

/** 이 종류를 메일로 보낼까 — manualPreview: 수동 검수 방식이면 「발송 전 검수」는 승인이 필요하므로 메일 */
export function shouldMail(kind, { manualPreview = false } = {}) {
  if (kind === 'preview' && manualPreview) return true;
  return mailKinds().has(kind);
}

const monthKey = ts => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' })
  .format(ts ? new Date(ts) : new Date()).slice(0, 7);

const cut = (v, n) => String(v == null ? '' : v).slice(0, n);

/** 한 줄 남기기. 절대 throw 하지 않는다 — 기록 실패가 접수·발송을 막으면 안 된다.
 *  row: { src:'proposal'|'lead', kind, mailed, via, why, subject, company, name, phone, email,
 *         grade, channel, campaign, landing, link, summary:{…}, ref } */
export async function note(row = {}) {
  try {
    const ts = row.ts || new Date().toISOString();
    const summary = {};
    for (const [k, v] of Object.entries(row.summary || {}).slice(0, 30)) {
      const s = String(v == null ? '' : v).trim();
      if (s) summary[cut(k, 40)] = cut(s, 400);
    }
    await append('ops', 'staffnote-' + monthKey(ts) + '.jsonl', {
      ts, src: cut(row.src, 20), kind: cut(row.kind, 20), label: LABEL[row.kind] || cut(row.kind, 30),
      mailed: !!row.mailed, via: cut(row.via, 40), why: cut(row.why, 160), subject: cut(row.subject, 200),
      company: cut(row.company, 80), name: cut(row.name, 60), phone: cut(row.phone, 40), email: cut(row.email, 120),
      grade: cut(row.grade, 8), channel: cut(row.channel, 30), campaign: cut(row.campaign, 80),
      landing: cut(row.landing, 600), link: cut(row.link, 300), ref: cut(row.ref, 80), test: !!row.test, summary
    });
    return true;
  } catch (e) { return false; }
}

/** 최근 N개월 읽기 (새 것이 앞) */
export async function read({ months = 2, month = '' } = {}) {
  const keys = /^\d{4}-\d{2}$/.test(month) ? [month]
    : [...new Set(Array.from({ length: Math.max(1, Math.min(6, months)) }, (_, i) => monthKey(Date.now() - i * 30.5 * 864e5)))];
  let rows = [];
  for (const k of keys) rows = rows.concat(await readLines('ops', 'staffnote-' + k + '.jsonl').catch(() => []));
  rows = rows.filter(r => r && r.ts);
  rows.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return { months: keys, rows };
}

/* ── 긴 주소 · 출처 줄이기 ─────────────────────────────────────────────
   메일 본문에 fbclid·utm 이 붙은 400자짜리 주소를 그대로 싣지 않는다.
   「메타 · proposal_promo / proposal_ad_03」 처럼 읽을 수 있는 말로 바꾸고,
   주소는 경로만 남겨 링크로 건다. 원문은 알림함에 그대로 남는다. */
export function utmOf(src) {
  const s = String(src || '');
  const get = k => { const m = new RegExp('(?:^|[?&\\s·])' + k + '=([^&\\s·]+)').exec(s); if (!m) return ''; try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return m[1]; } };
  return { source: get('utm_source'), medium: get('utm_medium'), campaign: get('utm_campaign'), content: get('utm_content') };
}

export function campaignOf(src) {
  const u = utmOf(src);
  return [u.campaign, u.content].filter(Boolean).join(' / ');
}

/** 주소 → 짧은 표시 (도메인 + 경로, 쿼리 없음) */
export function shortUrl(u) {
  try { const x = new URL(String(u)); return x.hostname.replace(/^www\./, '') + (x.pathname === '/' ? '' : x.pathname.replace(/\/$/, '')); }
  catch (e) { return String(u || '').split('?')[0].slice(0, 80); }
}

/** 유입 채널 이름 — lead.mjs 의 channel() 과 같은 규칙 */
export function channelOf(src) {
  const s = String(src || '').toLowerCase();
  if (/fbclid|facebook|instagram|utm_source=(meta|fb|ig)\b/.test(s)) return '메타';
  if (/gclid|gbraid|wbraid|utm_source=(google|youtube|gdn)\b/.test(s)) return '구글';
  if (/naver/.test(s)) return '네이버';
  if (/utm_source=email/.test(s)) return '이메일';
  if (/utm_source=tel/.test(s)) return '전화문자';
  if (/utm_source=post/.test(s)) return '우편DM';
  if (/kakao/.test(s)) return '카카오';
  if (/^ref=/.test(s)) return '외부유입';
  if (!s || s === 'direct') return '직접';
  return '기타';
}
