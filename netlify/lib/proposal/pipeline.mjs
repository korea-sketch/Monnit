/** 맞춤 제안서 — 처리 파이프라인 (생성 · 발송 · 정기 점검)
 *
 *   접수(api) ──▶ 생성(build: 문안+PDF) ──▶ 대기(queue) ──▶ 발송(send) ──▶ 후속(followup)
 *                     ▲ 실패·지연 시 점검(tick)이 다시 깨운다        │ 실패 시 백오프 재시도
 *
 *  원칙
 *   · 같은 건을 두 번 보내지 않는다 — 발송 잠금 + 상태 확인 + sent 표시 후에만 대기열 삭제
 *   · 어느 단계가 실패해도 접수 데이터는 남고, 담당자가 관리 화면에서 이어서 처리할 수 있다
 *   · 함수는 throw 하지 않고 결과 객체를 돌려준다 */
import { CFG } from './config.mjs';
import * as S from './store.mjs';
import { addLog, addNotice, hash, dueFor } from './jobs.mjs';
import { modeOf } from './schedule.mjs';
import { buildCopy, templateCopy } from './copy.mjs';
import { renderPdf } from './pdf.mjs';
import { insight } from './match.mjs';
import * as Mail from './mail.mjs';
import { recordSend, anonymize } from './archive.mjs';
import { autoChecks, aiReview } from './review.mjs';

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const pdfKey = id => 'pdf/' + id + '.pdf';

/* 백그라운드 생성 함수 호출 인증 */
export const buildSig = id => hash('build|' + id);

/** 백그라운드 생성 깨우기 — 실패해도 정기 점검이 다시 시도한다 */
export async function kickBuild(origin, id, extra = {}) {
  const base = (origin || CFG.site).replace(/\/$/, '');
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(base + '/.netlify/functions/proposal-build-background', {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-proposal-sig': buildSig(id) },
      body: JSON.stringify({ id, ...extra })
    });
    return { ok: r.status === 202 || r.ok, status: r.status };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { clearTimeout(t); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 발송 예정 시각 옮기기 — 대기열 키에 시각이 들어 있어 함께 옮긴다 */
export async function moveDue(job, due) {
  await S.del(S.queueKey(job.dueAt, job.id)).catch(() => {});
  job.dueAt = due;
  await S.setJSON(S.queueKey(due, job.id), 1).catch(() => {});
}

/** 즉시 방식에서 처리 도중 문제가 생기면 엔지니어 확인(review)으로 돌린다 — 고객에게는 접수 메일로 알린다 */
export async function switchToReview(id, reason) {
  let job = await S.getJob(id);
  if (!job || modeOf(job) !== 'instant' || ['sent', 'canceled'].includes(job.status)) return { ok: false };
  const now = Date.now();
  job.plan = { ...job.plan, mode: 'review', switched: true, reasons: [...(job.plan.reasons || []), reason] };
  await moveDue(job, dueFor(job.plan, now));
  addLog(job, '즉시 발송 → 엔지니어 확인으로 전환: ' + reason);
  await S.saveJob(job);
  const [rc, st] = await Promise.all([
    job.notices.some(n => n.type === 'receipt' && n.ok) ? null : Mail.sendReceipt(job),
    Mail.notifyStaff('review', job, { '전환 사유': reason })
  ]);
  await S.patchJob(id, j => {
    if (rc) addNotice(j, 'receipt', rc.ok, { via: rc.via || '', error: rc.error || rc.skipped || '' });
    addNotice(j, 'preview', st.ok, { via: st.via || '' });
  });
  return { ok: true };
}

/** 제안서 생성 — 문안(AI 또는 템플릿) + PDF
 *  autoSend: 즉시 방식이면 생성 뒤 예정 시각(화면의 단계가 끝나는 때)까지 기다렸다가 바로 보낸다 */
export async function buildJob(id, { ai = true, autoSend = false } = {}) {
  const r = await buildOnce(id, { ai });
  if (!autoSend) return r;
  const job = await S.getJob(id).catch(() => null);
  if (!job || modeOf(job) !== 'instant') return r;
  if (!r.ok) {
    if (!r.busy) await switchToReview(id, '제안서 생성 오류 — ' + String(r.error || '').slice(0, 80));
    return r;
  }
  if (job.status !== 'drafted') return r;
  /* 규칙 점검에 걸린 문안은 자동으로 보내지 않고 엔지니어 확인으로 */
  const bad = ((job.draft && job.draft.checks) || []).filter(c => !c.ok && !c.warn);
  if (bad.length) { await switchToReview(id, '규칙 점검 — ' + bad.map(c => c.label).join(', ')); return { ...r, sent: false, checks: bad.length }; }
  const wait = job.dueAt - Date.now();
  if (wait > 0) await sleep(Math.min(wait, 8 * MIN));
  const s = await sendJob(id, {});
  return { ...r, sent: !!s.ok, send: s };
}

async function buildOnce(id, { ai = true } = {}) {
  const release = await S.lease('build-' + id, 5 * MIN);
  if (!release) return { ok: false, busy: true };
  try {
    const job = await S.getJob(id);
    if (!job) return { ok: false, error: 'not_found' };
    if (['sent', 'canceled', 'sending'].includes(job.status)) return { ok: true, skipped: job.status };
    const wasHold = job.status === 'hold';
    job.buildAttempts = (job.buildAttempts || 0) + 1;
    /* 플레이북 도입 전에 접수된 건은 매칭을 다시 계산해 v2 제안서로 만든다 */
    if (!job.match.playbook) { job.match = insight(job.lead, undefined, { company: job.intake && job.intake.company }); addLog(job, '매칭 재계산(산업 플레이북 반영)'); }
    if (!wasHold) job.status = 'drafting';
    await S.saveJob(job);

    const logs = [];
    let copy;
    try { copy = ai ? await buildCopy(job, m => logs.push(m)) : templateCopy(job); }
    catch (e) { logs.push('문안 오류 → 템플릿: ' + e.message); copy = templateCopy(job); }
    if (job.override && job.override.summary) copy.summary = job.override.summary;   /* 담당자가 고친 요약 */

    let bytes;
    try { bytes = await renderPdf(job, copy); }
    catch (e) {
      /* AI 문안이 조판을 깨뜨렸을 가능성 → 템플릿으로 한 번 더 */
      logs.push('PDF 오류 → 템플릿 재시도: ' + e.message);
      copy = templateCopy(job);
      bytes = await renderPdf(job, copy);
    }
    await S.setBytes(pdfKey(id), bytes);

    const fresh = await S.getJob(id) || job;     /* 생성 도중 담당자가 보류·취소했을 수 있다 */
    fresh.draft = {
      ai: !!copy.ai, model: copy.model || '', summary: copy.summary,
      caseNotes: copy.caseNotes, steps: copy.steps, next: copy.next,
      pdfKey: pdfKey(id), pdfBytes: bytes.length, builtAt: new Date().toISOString(),
      checks: autoChecks(fresh, copy)
    };
    if (fresh.status === 'drafting' || fresh.status === 'received') fresh.status = 'drafted';
    fresh.lastError = '';
    logs.forEach(l => addLog(fresh, l));
    addLog(fresh, `제안서 생성 (${copy.ai ? 'AI 문안' : '템플릿 문안'}, ${Math.round(bytes.length / 1024)}KB)`);
    if (CFG.progressMail && !fresh.notices.some(n => n.type === 'progress')) {
      const r = await Mail.sendProgress(fresh);
      addNotice(fresh, 'progress', r.ok, { via: r.via || '', error: r.error || r.skipped || '' });
    }
    await S.saveJob(fresh);
    return { ok: true, bytes: bytes.length, ai: !!copy.ai };
  } catch (e) {
    const job = await S.getJob(id).catch(() => null);
    if (job) {
      job.status = job.status === 'drafting' ? 'received' : job.status;
      job.lastError = '생성 실패: ' + e.message;
      addLog(job, job.lastError);
      await S.saveJob(job).catch(() => {});
      if (job.buildAttempts >= 3 && !job.notices.some(n => n.type === 'build_failed')) {
        const r = await Mail.notifyStaff('build_failed', job, { '오류': e.message });
        addNotice(job, 'build_failed', r.ok);
        await S.saveJob(job).catch(() => {});
      }
    }
    return { ok: false, error: e.message };
  } finally { await release(); }
}

/* ── 재생성 후보 (관리 화면 「AI로 재생성」) ──────────────────────────
   현재 발송본(draft)은 건드리지 않고 후보 버전을 만든 뒤, 점검·검토 결과와 함께 job.candidate 에 둔다.
   담당자가 「채택」해야 draft 가 바뀐다. */
const verKey = (id, n) => `pdf/${id}-v${n}.pdf`;
const draftOf = (copy, key, bytes) => ({
  ai: !!copy.ai, model: copy.model || '', summary: copy.summary, caseNotes: copy.caseNotes, steps: copy.steps, next: copy.next,
  pdfKey: key, pdfBytes: bytes.length, builtAt: new Date().toISOString()
});

export async function requestCandidate(origin, id, { instruction = '', by = '관리자', inline = false } = {}) {
  const job = await S.getJob(id);
  if (!job) return { ok: false, error: '없는 건입니다' };
  if (job.candidate && ['queued', 'building', 'reviewing'].includes(job.candidate.state) && Date.now() - Date.parse(job.candidate.at) < 6 * MIN)
    return { ok: false, error: '이미 재생성 중입니다' };
  const n = Math.max(0, ...(job.versions || []).map(v => v.n)) + 1;
  await S.patchJob(id, j => { j.candidate = { state: 'queued', n, instruction: String(instruction).slice(0, 500), by, at: new Date().toISOString() }; addLog(j, `${by} AI 재생성 요청 v${n}${instruction ? ' — ' + String(instruction).slice(0, 80) : ''}`); });
  if (inline) return buildCandidate(id);
  const k = await kickBuild(origin, id, { candidate: true });
  if (!k.ok) {
    await S.patchJob(id, j => { j.candidate = { ...j.candidate, state: 'error', error: '백그라운드 호출 실패' }; });
    return { ok: false, error: '백그라운드 호출 실패 — 잠시 뒤 다시 시도하세요' };
  }
  return { ok: true, n };
}

export async function buildCandidate(id) {
  const release = await S.lease('cand-' + id, 5 * MIN);
  if (!release) return { ok: false, busy: true };
  try {
    let job = await S.getJob(id);
    if (!job || !job.candidate) return { ok: false, error: 'no_candidate' };
    const c = job.candidate, n = c.n;
    await S.patchJob(id, j => { j.candidate = { ...j.candidate, state: 'building' }; });
    const logs = [];
    let copy;
    try { copy = await buildCopy(job, m => logs.push(m), { instruction: c.instruction }); }
    catch (e) { logs.push('문안 오류 → 템플릿: ' + e.message); copy = templateCopy(job); }
    let bytes;
    try { bytes = await renderPdf(job, copy); }
    catch (e) { logs.push('PDF 오류 → 템플릿: ' + e.message); copy = templateCopy(job); bytes = await renderPdf(job, copy); }
    const key = verKey(id, n);
    await S.setBytes(key, bytes);
    let pages = 0;
    try { const { PDFDocument } = await import('pdf-lib'); pages = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount(); } catch (e) { /* 무시 */ }
    await S.patchJob(id, j => { j.candidate = { ...j.candidate, state: 'reviewing' }; });
    const checks = autoChecks(job, copy, { pages });
    const review = await aiReview(job, copy, checks, { instruction: c.instruction, prev: job.draft });
    await S.patchJob(id, j => {
      if (!j.candidate || j.candidate.n !== n) return false;   /* 그사이 새 요청이 들어왔다 */
      j.candidate = { ...j.candidate, state: 'ready', readyAt: new Date().toISOString(), pages, checks, review,
        draft: draftOf(copy, key, bytes), prevSummary: j.draft ? j.draft.summary : '', understanding: copy.understanding || '', diagnosis: copy.diagnosis };
      logs.forEach(l => addLog(j, l));
      addLog(j, `v${n} 생성 · 검토 ${review.by === 'claude' ? 'Claude' : '규칙'} → ${review.verdict} ${review.score}`);
    });
    return { ok: true, n, verdict: review.verdict };
  } catch (e) {
    await S.patchJob(id, j => { if (j.candidate) j.candidate = { ...j.candidate, state: 'error', error: e.message }; addLog(j, '재생성 실패: ' + e.message); }).catch(() => {});
    return { ok: false, error: e.message };
  } finally { await release(); }
}

/** 담당자 결정 — adopt: 채택(예정대로) · send: 채택 후 지금 발송 · discard: 버리기 */
export async function decideCandidate(id, decision, { by = '관리자' } = {}) {
  const job = await S.getJob(id);
  const c = job && job.candidate;
  if (!c || c.state !== 'ready') return { ok: false, error: '검토가 끝난 후보가 없습니다' };
  if (decision === 'discard') {
    await S.del(c.draft.pdfKey).catch(() => {});
    await S.patchJob(id, j => { j.candidate = null; addLog(j, `${by} v${c.n} 버림 — 현재 발송본 유지`); });
    return { ok: true };
  }
  if (!['adopt', 'send'].includes(decision)) return { ok: false, error: '알 수 없는 결정' };
  const wasSent = job.status === 'sent';
  await S.patchJob(id, j => {
    const prevKey = j.draft && j.draft.pdfKey;
    j.versions = (j.versions || []).map(v => ({ ...v, adopted: false }));
    if (prevKey && !j.versions.some(v => v.pdfKey === prevKey)) j.versions.unshift({ n: 0, at: (j.draft && j.draft.builtAt) || j.createdAt, ai: !!(j.draft && j.draft.ai), pdfKey: prevKey, summary: j.draft && j.draft.summary, instruction: '', adopted: false, label: '최초 생성본' });
    j.versions.push({ n: c.n, at: c.readyAt, ai: c.draft.ai, model: c.draft.model, pdfKey: c.draft.pdfKey, summary: c.draft.summary, instruction: c.instruction, review: { verdict: c.review.verdict, score: c.review.score, by: c.review.by }, adopted: true, by });
    j.versions = j.versions.slice(-12);
    j.draft = { ...c.draft, review: { verdict: c.review.verdict, score: c.review.score, by: c.review.by } };
    j.candidate = null;
    if (['received', 'drafting', 'failed'].includes(j.status)) j.status = 'drafted';
    if (wasSent && decision === 'send') j.status = 'drafted';
    j.approved = true;
    addLog(j, `${by} v${c.n} 채택${decision === 'send' ? ' · 지금 발송' : ''}`);
  });
  if (decision !== 'send') return { ok: true };
  const r = await sendJob(id, { force: true, kind: wasSent ? 'resend' : 'proposal', by });
  return { ok: !!r.ok, error: r.error || (r.busy ? '다른 곳에서 처리 중입니다' : r.skipped || '') };
}

/** 발송 — force: 담당자가 「지금 발송」을 누른 경우 (보류·예정시각 무시) */
export async function sendJob(id, { force = false, now = Date.now(), kind = 'proposal', by = 'auto' } = {}) {
  const release = await S.lease('send-' + id, 3 * MIN);
  if (!release) return { ok: false, busy: true };
  try {
    let job = await S.getJob(id);
    if (!job) return { ok: false, error: 'not_found' };
    if (job.status === 'sent') { await S.del(S.queueKey(job.dueAt, id)).catch(() => {}); return { ok: true, skipped: 'already_sent' }; }
    if (job.status === 'canceled') return { ok: false, skipped: 'canceled' };
    /* 지난번 발송이 도중에 끊겼다(함수 시간 초과 등) — 메일이 나갔는지 알 수 없으니 자동으로 다시 보내지 않는다 */
    if (job.status === 'sending' && !force) {
      if (now - Date.parse(job.updatedAt) < 10 * MIN) return { ok: false, skipped: 'sending' };
      job.status = 'hold';
      job.lastError = '발송 도중 중단 — 고객 수신 여부 확인 후 「지금 발송」으로 처리하세요';
      addLog(job, job.lastError);
      const n = await Mail.notifyStaff('failed', job, { '오류': job.lastError });
      addNotice(job, 'staff_failed', n.ok);
      await S.saveJob(job);
      return { ok: false, skipped: 'uncertain' };
    }
    if (!force) {
      if (job.status === 'hold') return { ok: false, skipped: 'hold' };
      if (CFG.review === 'manual' && !job.approved) return { ok: false, skipped: 'not_approved' };
      if (job.dueAt > now) return { ok: false, skipped: 'not_due' };
      if (job.retryAt && job.retryAt > now) return { ok: false, skipped: 'backoff' };
    }
    if (!job.draft || !job.draft.pdfKey) return { ok: false, skipped: 'not_built' };
    const bytes = await S.getBytes(job.draft.pdfKey);
    if (!bytes) { job.draft = null; job.status = 'received'; addLog(job, 'PDF 파일 없음 → 다시 생성'); await S.saveJob(job); return { ok: false, skipped: 'pdf_missing' }; }

    job.status = 'sending';
    job.attempts = (job.attempts || 0) + 1;
    await S.saveJob(job);

    const r = await Mail.sendProposal(job, bytes);
    if (r.ok) {
      job.status = 'sent';
      job.sentAt = new Date().toISOString();
      job.retryAt = 0; job.lastError = '';
      addNotice(job, 'sent', true, { via: r.via, attached: r.attached, messageId: r.messageId || '' });
      addLog(job, `제안서 발송 (${r.attached ? '첨부+링크' : '링크'})${force ? ' · 수동' : ''}`);
      await S.saveJob(job);
      await S.del(S.queueKey(job.dueAt, id)).catch(() => {});
      /* 발송 대장 — 누구에게 무슨 자료가 나갔는지(PDF 사본 포함) */
      await recordSend(job, { kind, bytes, via: r.via, attached: r.attached, messageId: r.messageId || '', by });
      job = await S.getJob(id) || job;
      if (CFG.followupDays > 0) await S.setJSON('follow/' + String(now + CFG.followupDays * DAY).padStart(13, '0') + '-' + id, 1).catch(() => {});
      const n = await Mail.notifyStaff('sent', job);
      addNotice(job, 'staff_sent', n.ok);
      await S.saveJob(job);
      return { ok: true };
    }
    /* 실패 → 백오프 (10분, 20분, 40분, 80분 …) */
    const wait = 10 * MIN * Math.pow(2, Math.min(5, job.attempts - 1));
    job.status = 'failed';
    job.retryAt = now + wait;
    job.lastError = '발송 실패: ' + (r.error || r.skipped || '알 수 없음');
    addNotice(job, 'sent', false, { error: job.lastError });
    addLog(job, `${job.lastError} (재시도 ${job.attempts}/${CFG.maxAttempts})`);
    if (job.attempts >= CFG.maxAttempts) {
      job.retryAt = now + 365 * DAY;   /* 자동 재시도 중단 — 담당자가 관리 화면에서 처리 */
      addLog(job, '자동 재시도 중단');
      const n = await Mail.notifyStaff('failed', job, { '오류': job.lastError });
      addNotice(job, 'staff_failed', n.ok);
    }
    await S.saveJob(job);
    return { ok: false, error: job.lastError };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally { await release(); }
}

const dueOf = key => Number(key.split('/')[1].split('-')[0]);
const idOf = key => key.split('/')[1].split('-')[1];

/** 정기 점검 (스케줄 함수가 10분마다 호출) — 시간 예산 안에서만 일한다 */
export async function tick({ now = Date.now(), origin, budgetMs = 22000 } = {}) {
  const t0 = Date.now(), left = () => budgetMs - (Date.now() - t0);
  const out = { sent: 0, failed: 0, kicked: 0, built: 0, preview: 0, followup: 0, purged: 0, skipped: 0 };
  const queue = await S.list('queue/', 2000);

  for (const key of queue) {
    if (left() < 4000) break;
    const id = idOf(key), due = dueOf(key);
    let job = await S.getJob(id);
    if (!job) { await S.del(key); continue; }
    if (['sent', 'canceled'].includes(job.status)) { await S.del(key); continue; }

    /* ① 생성이 안 됐거나 멈춘 건 — 접수 3분 뒤부터 깨운다 (3회까지) */
    const built = job.draft && job.draft.pdfKey;
    if (!built) {
      const age = now - Date.parse(job.updatedAt || job.createdAt);
      if (age > 3 * MIN && (job.buildAttempts || 0) < 3) {
        /* 발송 시각이 지났으면 백그라운드를 기다리지 않고 템플릿으로 바로 만든다 */
        /* 방금 만든 건은 아래에서 그대로 발송한다 — 읽어 둔 job 은 생성 전 상태라 다시 읽는다
           (예전에는 만든 직후 「생성 미완료」로 보고 엔지니어 확인으로 넘겨 발송이 멈췄다) */
        if (due <= now && left() > 12000) { const b = await buildJob(id, { ai: false }); if (b.ok) { out.built++; job = (await S.getJob(id)) || job; } }
        else { const k = await kickBuild(origin, id); if (k.ok) out.kicked++; }
      }
      if (due > now) continue;
      /* 즉시 방식인데 생성이 끝나지 않은 채 예정 시각이 지났다 → 엔지니어 확인으로 */
      if (modeOf(job) === 'instant' && now - due > 5 * MIN && !(job.draft && job.draft.pdfKey)) { await switchToReview(id, '예정 시각까지 제안서 생성 미완료'); continue; }
    }

    /* ② 발송 전 검수 알림 (즉시 방식은 발송 뒤 확인 연락이라 해당 없음) */
    if (modeOf(job) === 'delayed' && due - now <= CFG.previewLeadHours * HOUR && due > now && !job.notices.some(n => n.type === 'preview')) {
      const r = await Mail.notifyStaff('preview', job, { '검수 방식': CFG.review === 'manual' ? '승인해야 발송' : '보류하지 않으면 자동 발송' });
      await S.patchJob(id, j => { addNotice(j, 'preview', r.ok); });   /* 메일은 patch 밖에서 — 재시도 시 중복 방지 */
      out.preview++;
    }

    /* ③ 발송 */
    if (due <= now) {
      const r = await sendJob(id, { now });
      if (r.ok && !r.skipped) out.sent++;
      else if (r.error) out.failed++;
      else out.skipped++;
    }
  }

  /* ④ 후속 안내 — 발송 N일 뒤, PDF 를 한 번도 안 열었을 때만 */
  if (left() > 3000) {
    for (const key of await S.list('follow/', 500)) {
      if (left() < 3000) break;
      if (dueOf(key) > now) break;
      const id = idOf(key);
      const job = await S.getJob(id);
      await S.del(key);
      if (!job || job.status !== 'sent' || job.pdfOpens > 0 || job.notices.some(n => n.type === 'followup')) continue;
      if (job.meta && job.meta.noFollowup) continue;
      const r = await Mail.sendFollowup(job);
      await S.patchJob(id, j => { addNotice(j, 'followup', r.ok, { error: r.error || r.skipped || '' }); });
      if (r.ok) await recordSend(await S.getJob(id) || job, { kind: 'followup', via: r.via, messageId: r.messageId || '' });
      out.followup++;
    }
  }

  /* ⑤ 보관 기간이 지난 개인정보 익명화 */
  if (left() > 2000) {
    for (const key of await S.list('purge/', 200)) {
      if (left() < 2000 || dueOf(key) > now) break;
      const id = idOf(key);
      await S.patchJob(id, j => {
        j.lead = { ...j.lead, name: '(파기)', email: '', phone: '', title: '', memo: '' };
        j.token = ''; j.purged = true; addLog(j, '보관 기간 만료 — 개인정보 파기');
      });
      await S.del(key);
      await S.del(pdfKey(id)).catch(() => {});
      for (const v of ((await S.getJob(id)) || {}).versions || []) await S.del(v.pdfKey).catch(() => {});
      await anonymize(id).catch(() => {});
      out.purged++;
    }
  }
  return out;
}
