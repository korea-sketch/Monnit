/** 맞춤 제안서 → 「공장 설비 진단 EVENT」 함께 신청 — 리드 원장 기록 (2026-10-02)
 *
 *  ── 왜 ─────────────────────────────────────────────────────────────
 *  제안서 신청에서 공장 설비 진단 EVENT 를 고르면 담당자 메일이 두 통 갔다.
 *    ① [맞춤제안·신규 접수] …               notifyStaff('new')
 *    ② [무료체험 신청·맞춤형 제안서] …       notifyFactoryConsult() — 별도 메일
 *  사이트의 다른 접점과 같이 「메일은 한 통, 기록은 원장에」로 맞춘다.
 *    · 메일   ① 한 통에 「공장 진단 EVENT: 신청함」 줄과 제목 표시(·공장진단EVENT)로 합친다
 *    · 원장   /ops 리드 원장(leads)에 /promo/consulting 신청과 같은 모양으로 한 줄
 *    · 먼데이 리드 보드에 아이템 생성 (다른 접수와 동일)
 *    · 알림함 /ops/notices 에 「중복 알림 보류 — 맞춤제안 신규 접수 메일에 포함」으로 한 줄
 *
 *  실패해도 제안서 접수에는 영향이 없다 — 호출하는 쪽이 allSettled 로 받는다.
 */
import { append } from './_store.mjs';
import { pushLead } from './_monday.mjs';
import * as _note from './_staffnote.mjs';
import * as _test from './_istest.mjs';

export const CONSULT_INTEREST = '회전설비 AI 예지보전 1개월 무료 체험';

function monthKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(d);
  return s.slice(0, 7) + '.jsonl';
}

/** 원장 한 줄 — lead.mjs 가 /promo/consulting 신청을 기록하는 것과 같은 필드 */
export function consultLead(job, now = new Date().toISOString()) {
  const L = job.lead || {}, M = job.meta || {};
  return {
    ts: now,
    type: 'contact', label: '접수', channel: _note.channelOf(M.source),
    point: 'promo_consulting',
    company: L.company || '', name: `${L.name || ''} ${L.title || ''}`.trim(),
    phone: L.phone || '', email: L.email || '',
    region: L.region || '',
    asset: L.facility || '',
    product: '',
    interest: CONSULT_INTEREST,
    exp: '', exp_group: '', line: L.facility || '', spot: [L.region, L.facility].filter(Boolean).join(' · '),
    sla: '담당자 확인 후 연락',
    memo: `맞춤 제안서 ${job.no || job.id}와 함께 신청` + (L.memo ? ' / ' + L.memo : ''),
    flags: '',
    source: M.source || '', landing: M.landing || '',
    consent_mkt: L.consentMkt ? '동의' : '미동의',
    ua: M.ua || '', ip: M.ip || '',
    via: 'proposal', proposal: job.no || job.id
  };
}

export async function recordFactoryConsult(job) {
  if (!job || !job.lead || job.lead.factoryConsult !== true) return { ok: true, skipped: 'not-requested' };
  const lead = consultLead(job);

  /* 테스트 접수 — 실제 원장·먼데이에 섞지 않는다 (lead.mjs 와 같은 규칙) */
  if (job.test === true) {
    lead.test = true;
    await append('leads-test', monthKey(lead.ts), lead).catch(() => {});
    return { ok: true, skipped: 'test', via: 'test' };
  }

  /* 원장 기록이 먼저 — 뒤의 연동이 실패해도 데이터는 남는다 */
  await append('leads', monthKey(lead.ts), lead);
  const id = lead.ts + '|' + (lead.email || lead.phone || lead.company || '');
  const [mon] = await Promise.allSettled([pushLead(id, lead)]);

  try {
    await _note.note({
      ts: lead.ts, src: 'lead', kind: 'dup', mailed: false, via: 'proposal',
      why: '맞춤제안 신규 접수 메일에 「공장 진단 EVENT」로 함께 알림',
      subject: `[모넷·접수] ${CONSULT_INTEREST} — ${lead.company || lead.name || lead.email}`,
      company: lead.company, name: lead.name, phone: lead.phone, email: lead.email,
      channel: lead.channel, campaign: _note.campaignOf(lead.source), landing: lead.landing, test: false,
      ref: job.no || job.id,
      summary: { '유형': lead.label, '관심분야': lead.interest, '설비·대상': lead.asset, '지역': lead.region,
        '문의내용': lead.memo, '마케팅 수신': lead.consent_mkt, '유입 페이지': lead.landing, '맞춤 제안서': job.no || job.id }
    });
  } catch (e) { /* 관측용 기록이 접수를 막으면 안 된다 */ }

  return { ok: true, via: 'ledger', monday: mon.status === 'fulfilled' };
}
