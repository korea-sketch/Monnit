/** 맞춤 제안서 — 외부 대장 연동 (먼데이)
 *
 *  설정이 있을 때만 동작한다. 없으면 아무 일도 하지 않는다(사이트 안 발송 대장이 기준 기록).
 *    PROPOSAL_MONDAY_TOKEN   (없으면 MONDAY_API_TOKEN)   먼데이 API 토큰
 *    PROPOSAL_MONDAY_BOARD   「제안서 발송 대장」 보드 ID
 *    PROPOSAL_MONDAY_GROUP   (선택) 그룹 ID
 *    PROPOSAL_MONDAY_COLUMNS (선택) 열 연결 JSON — 예
 *       {"company":"text","email":"email","phone":"phone","industry":"text1","problem":"text2",
 *        "grade":"status","sent":"date4","opens":"numbers","no":"text3","entry":"text4"}
 *       열 ID 가 email·phone·status·date·numbers 로 시작하면 그 형식으로 넣는다.
 *
 *  발송 1건 = 보드 항목 1개(같은 건의 재발송·열람·연락·추가 요청은 그 항목의 업데이트로 쌓인다). */
import { CFG } from './config.mjs';

const env = k => { try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k); if (v) return v; } catch (e) { /* 무시 */ } return process.env[k] || ''; };
const token = () => env('PROPOSAL_MONDAY_TOKEN') || env('MONDAY_API_TOKEN');
const board = () => env('PROPOSAL_MONDAY_BOARD');
export const configured = () => !!(token() && board());

async function gql(query, variables) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch('https://api.monday.com/v2', {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', authorization: token(), 'API-Version': '2024-10' },
      body: JSON.stringify({ query, variables })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) return { ok: false, error: 'monday ' + r.status + ' ' + JSON.stringify(j.errors || j.error_message || '').slice(0, 160) };
    return { ok: true, data: j.data };
  } catch (e) { return { ok: false, error: 'monday ' + e.message }; }
  finally { clearTimeout(t); }
}

function columns(rec, job) {
  let map = {};
  try { map = JSON.parse(env('PROPOSAL_MONDAY_COLUMNS') || '{}'); } catch (e) { map = {}; }
  const val = {
    company: rec.company, email: rec.to.email, phone: rec.to.phone, name: rec.to.name, industry: [rec.industry.label, rec.segment].filter(Boolean).join(' › '),
    problem: rec.problems.join(', '), also: rec.also.join(', '), grade: rec.grade, score: rec.score, sent: rec.at.slice(0, 10), no: rec.no,
    entry: rec.entry, channel: rec.channel, doc: rec.doc, mode: rec.mode, opens: (job && job.pdfOpens) || 0, scale: rec.scale, timeline: rec.timeline
  };
  const out = {};
  for (const [k, col] of Object.entries(map)) {
    const v = val[k]; if (v == null || v === '' || !col) continue;
    if (/^email/.test(col)) out[col] = { email: String(v), text: String(v) };
    else if (/^phone/.test(col)) out[col] = { phone: String(v).replace(/[^\d+]/g, ''), countryShortName: 'KR' };
    else if (/^(status|color)/.test(col)) out[col] = { label: String(v) };
    else if (/^date/.test(col)) out[col] = { date: String(v).slice(0, 10) };
    else if (/^numbers?/.test(col)) out[col] = String(Number(v) || 0);
    else out[col] = String(v);
  }
  return out;
}

const body = rec => [
  `${rec.doc} 발송 (${rec.kind === 'resend' ? '재발송' : rec.kind === 'followup' ? '후속 안내' : '최초'}) — ${rec.no}`,
  `받는 분: ${rec.to.name} ${rec.to.title} <${rec.to.email}> ${rec.to.phone}`,
  `업종: ${rec.industry.label}${rec.segment ? ' › ' + rec.segment : ''} · 기준 과제: ${rec.problems.join(', ')}`,
  rec.also.length ? `추가 관심: ${rec.also.join(', ')}` : '',
  `등급: ${rec.grade} (${rec.score}점) · 입구: ${rec.entry} · 채널: ${rec.channel} · 방식: ${rec.mode}`,
  `문안: ${rec.ai ? 'AI ' + rec.model : '템플릿'}${rec.version ? ' · v' + rec.version : ''}${rec.review ? ' · 검토 ' + rec.review.verdict + ' ' + rec.review.score : ''}`,
  `유사 사례: ${rec.top.map(t => `${t.name} ${t.pct}%`).join(' / ')}`,
  `관리 화면: ${CFG.site}/ops/proposals#${rec.id}`
].filter(Boolean).join('\n');

export async function pushSend(job, rec) {
  if (!configured()) return { skipped: true };
  let itemId = job.crm && job.crm.monday;
  if (!itemId) {
    const r = await gql(`mutation ($b: ID!, $g: String, $n: String!, $c: JSON) { create_item (board_id: $b, group_id: $g, item_name: $n, column_values: $c) { id } }`,
      { b: board(), g: env('PROPOSAL_MONDAY_GROUP') || null, n: `${rec.company} · ${rec.problems.join(', ')} (${rec.no})`, c: JSON.stringify(columns(rec, job)) });
    if (!r.ok) { console.warn('[proposal-crm]', r.error); return { ok: false, error: r.error }; }
    itemId = r.data.create_item.id;
  }
  await gql(`mutation ($i: ID!, $t: String!) { create_update (item_id: $i, body: $t) { id } }`, { i: itemId, t: body(rec) });
  return { ok: true, itemId };
}

/** 열람 · 재방문 · 추가 요청 · 확인 연락 같은 반응을 같은 항목에 한 줄씩 */
export async function pushEvent(job, text) {
  if (!configured() || !(job && job.crm && job.crm.monday)) return { skipped: true };
  return gql(`mutation ($i: ID!, $t: String!) { create_update (item_id: $i, body: $t) { id } }`, { i: job.crm.monday, t: String(text).slice(0, 2000) });
}

/** 연동 점검 — 읽기 전용 */
export async function ping() {
  const r = await gql(`query ($b: [ID!]) { me { name } boards (ids: $b) { name } }`, { b: [board()] });
  if (!r.ok) return r;
  const b = (r.data.boards || [])[0];
  return b ? { ok: true, detail: `${r.data.me ? r.data.me.name + ' · ' : ''}보드 「${b.name}」` } : { ok: false, error: '보드를 찾지 못했습니다 — PROPOSAL_MONDAY_BOARD 확인' };
}
