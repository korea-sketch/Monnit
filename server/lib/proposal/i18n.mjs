/** 맞춤 제안서 — 진행 현황 화면 영문(EN) 지원
 *  제안서 PDF·메일은 한국어로 나간다. 사이트를 영문으로 보는 고객에게는 진행 현황 화면을 영문으로 보여준다.
 *  사전: en.data.mjs (data/proposal/i18n/en.json → scripts/proposal-sync.mjs 가 생성)
 *  사전에 없는 항목은 한국어를 그대로 두지 않고 화면에서 뺀다(영문 화면에 한글이 섞이지 않게). */
import EN from './en.data.mjs';
import { PROBLEMS, GOALS } from './kb.mjs';

export const langOf = v => (String(v || '').toLowerCase() === 'en' ? 'en' : 'ko');
const HANGUL = /[가-힣]/;
const PROB_BY_LABEL = Object.fromEntries(Object.entries(PROBLEMS).map(([k, v]) => [v.label, k]));
const GOAL_BY_LABEL = Object.fromEntries(Object.entries(GOALS).map(([k, v]) => [v.label, k]));

/* 사례 성과 라벨 — 한국어 → 영문 (사례별) */
const CASE_RESULT = {};
export function caseEn(key) { return (EN.cases || {})[key] || null; }
export function resultLabel(key, ko, koList) {
  const c = caseEn(key); if (!c) return '';
  const m = CASE_RESULT[key] || (CASE_RESULT[key] = {});
  if (koList && !m.__built) { koList.slice(0, 4).forEach((r, i) => { if (c.results[i]) m[r.l] = c.results[i]; }); m.__built = true; }
  return m[ko] || '';
}

export const pb = s => (EN.playbook || {})[s] || '';
export const probLabel = k => ((EN.problems || {})[k] || {}).label || '';
export const probDesc = k => ((EN.problems || {})[k] || {}).desc || '';
export const goalLabel = k => (EN.goals || {})[k] || '';
export const sensorName = k => (EN.sensors || {})[k] || '';
export const industryEn = k => (EN.industries || {})[k] || null;
export const probByLabel = l => PROB_BY_LABEL[l] || '';
export const goalByLabel = l => GOAL_BY_LABEL[l] || '';
/* 한국어 라벨 목록 → 영문 (모르는 것은 뺀다) */
export const labels = (list, f) => list.map(f).filter(Boolean);
export const noHangul = s => (s && !HANGUL.test(s) ? s : '');

/** 매칭 근거 문장(「같은 산업」「공통 과제: …」) → 영문 */
export function whyEn(w) {
  if (w === '같은 산업') return 'Same industry';
  if (w === '인접 산업') return 'Adjacent industry';
  let m = /^공통 과제: (.+)$/.exec(w);
  if (m) { const l = labels(m[1].split(', '), x => probLabel(probByLabel(x))); return l.length ? 'Shared challenge: ' + l.join(', ') : ''; }
  m = /^같은 목표: (.+)$/.exec(w);
  if (m) { const l = labels(m[1].split(', '), x => goalLabel(goalByLabel(x))); return l.length ? 'Same goal: ' + l.join(', ') : ''; }
  return noHangul(w);
}

/* 시각 — Sep 17 (Thu) 2:35 PM KST */
const KST = 9 * 3600000;
export function fmtEn(ms, withTime = true) {
  const d = new Date(ms + KST);
  const M = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getUTCMonth()];
  const W = 'Sun Mon Tue Wed Thu Fri Sat'.split(' ')[d.getUTCDay()];
  const base = `${M} ${d.getUTCDate()} (${W})`;
  if (!withTime) return base;
  const h = d.getUTCHours(), mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${base} ${h % 12 || 12}:${mi} ${h < 12 ? 'AM' : 'PM'} KST`;
}

export const STAGE_EN = {
  collect: ['Request received', 'We have your company, site and challenge details'],
  analyze: ['Industry & challenge analysis', 'We identify your industry and process from your company and inquiry'],
  gather: ['Gathering Monnit data', 'Global references, industry playbooks and sensor application data'],
  insight: ['Monnit insight engine', 'Matching similar sites and selecting reference figures'],
  compose: ['Writing your proposal', 'Laying out the zone monitoring map and smart operations roadmap'],
  review: ['Engineer review', 'An engineer checks the content'],
  reviewInstant: ['Quality check', 'Figures, wording and structure are checked automatically'],
  deliver: ['Proposal delivery', 'We email the PDF to you']
};
export const NOTE_EN = {
  hold: 'An engineer is refining the content. Delivery timing may be adjusted.',
  switched: 'Some details need an engineer’s check before we send it — you will receive it within 1 business day.',
  failed: 'Email delivery was delayed and we are retrying.',
  canceled: 'Delivery was canceled at your request.',
  callback: 'An engineer will review it and contact you within 1 business day.'
};
export const NOTICE_EN = {
  receipt: 'Receipt email', staff: 'Engineer assigned', analysis: 'Data analysis complete', preview: 'Final review before sending',
  previewReview: 'Engineer review requested', sent: 'Proposal sent', callback: 'Engineer follow-up',
  chStaff: 'Monnit Korea technical sales', chScreen: 'Shown on this page', chEngineer: 'Assigned engineer', chCallback: 'Reply email or phone call',
  planned: 'scheduled', callbackAt: 'Within 1 business day'
};

/* 사례 성과 수치 중 한글이 섞인 것 */
const NUM_EN = { 'AI 학습': 'AI-ready', '분 단위': 'Per-minute', '방폭 구간': 'Ex zones', '수억원+': 'KRW 100M+' };
export const numEn = n => (HANGUL.test(n) ? (NUM_EN[n] || '') : n);
