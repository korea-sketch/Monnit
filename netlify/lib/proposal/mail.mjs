/** 맞춤 제안서 — 메일 · 알림
 *
 *  고객 메일   Brevo (BREVO_API_KEY) — 첨부가 필요해서 Brevo 만 쓴다. 키가 없으면 보내지 않고 기록만 남긴다.
 *  담당자 알림 Brevo → 실패 시 사이트 기존 알림 경로(_notify.mjs: StaticForms → Web3Forms) → 웹훅
 *  모든 함수는 throw 하지 않고 { ok, via, error } 를 돌려준다. */
import { CFG } from './config.mjs';
import { PROBLEMS, GOALS } from './kb.mjs';
import { statusUrl, pdfUrl, quoteUrl } from './jobs.mjs';
import { scopeOf } from './match.mjs';
import { fmtKST, maskEmail, modeOf } from './schedule.mjs';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const utm = (url, content) => url + (url.includes('?') ? '&' : '?') + 'utm_source=email&utm_medium=proposal&utm_campaign=custom_proposal&utm_content=' + content;

async function brevo({ to, subject, html, text, attachment, tags }) {
  if (!CFG.brevoKey) return { ok: false, skipped: 'BREVO_API_KEY 없음' };
  const body = {
    sender: CFG.from, to: to.map(e => (typeof e === 'string' ? { email: e } : e)), replyTo: CFG.replyTo,
    subject, htmlContent: html, textContent: text, tags: tags || ['custom-proposal']
  };
  if (CFG.bcc.length && tags && tags.includes('customer')) body.bcc = CFG.bcc.map(email => ({ email }));
  if (attachment) body.attachment = [attachment];
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', signal: ac.signal,
      headers: { 'api-key': CFG.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: 'brevo ' + r.status + ' ' + String(j.message || j.code || '').slice(0, 120) };
    return { ok: true, via: 'brevo', messageId: j.messageId || '' };
  } catch (e) { return { ok: false, error: 'brevo ' + (e.name === 'AbortError' ? 'timeout' : e.message) }; }
  finally { clearTimeout(t); }
}

/* ── 공통 레이아웃 (메일 클라이언트 호환: 표 + 인라인 스타일) ─────────────── */
function layout({ pre, title, body, cta, ctaUrl, foot, hero = false }) {
  const c = CFG.company;
  const asset = f => `${CFG.site}/assets/brand/${f}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#eef1f6;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b2433">
<span style="display:none;max-height:0;overflow:hidden">${esc(pre)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
${hero ? `<tr><td style="background:#0C1220;line-height:0"><img src="${asset('proposal-cover-1200.jpg')}" width="600" alt="MONNIT KOREA — 모든 선택에는, 분명한 이유가 있다." style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>` : ''}
<tr><td style="background:#0C1220;padding:22px 28px 26px">
  <img src="${asset('monnit-korea-white-480.png')}" width="150" alt="MONNIT KOREA" style="display:block;width:150px;height:auto;border:0;margin:0 0 12px;color:#ffffff;font-size:14px;font-weight:700">
  <div style="color:#2DD4BF;font-size:11px;letter-spacing:2px;font-weight:700">CUSTOM PROPOSAL</div>
  <div style="color:#ffffff;font-size:21px;font-weight:800;line-height:1.4;margin-top:8px">${title}</div>
</td></tr>
<tr><td style="padding:26px 28px;font-size:15px;line-height:1.75">${body}
${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:#2B84F5;border-radius:10px"><a href="${esc(ctaUrl)}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-weight:800;text-decoration:none;font-size:15px">${esc(cta)}</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid #e6eaf0;font-size:12px;color:#6b778a;line-height:1.7">
${foot || ''}${c.legal} · ${c.address}<br>T. ${c.tel} · ${c.email} · <a href="https://${c.web}" style="color:#6b778a">${c.web}</a><br>
본 메일은 홈페이지 맞춤 제안서 신청에 따라 발송되었습니다. 회신하시면 담당자에게 바로 전달됩니다.
</td></tr></table></td></tr></table></body></html>`;
}
const box = inner => `<div style="background:#f4f7fb;border-radius:10px;padding:14px 16px;margin:14px 0;font-size:14px">${inner}</div>`;
const who = job => `${esc(job.lead.company)} ${esc(job.lead.name)}${job.lead.title ? ' ' + esc(job.lead.title) : ''}님`;

/* ── 고객: 접수 확인 ─────────────────────────────────────────────── */
export async function sendReceipt(job) {
  const m = job.match, top = m.top[0];
  const url = utm(statusUrl(job), 'receipt');
  const html = layout({
    pre: `${fmtKST(job.dueAt)}까지 맞춤 제안서를 보내드립니다.`,
    title: `${who(job)}을 위한<br>맞춤 제안서를 준비하고 있습니다`,
    body: `<p style="margin:0 0 12px">안녕하세요, 모넷코리아입니다. 남겨 주신 내용을 잘 받았습니다.</p>
<p style="margin:0 0 12px">Monnit 글로벌 레퍼런스와 국내 도입 현장(${esc(CFG.brand.publicRef)} 등) 데이터에서 ${esc(m.industry.label)} 현장과 닮은 사례를 골라, 말씀하신 과제에 맞는 구성안을 정리하고 있습니다. ${modeOf(job) === 'review' ? '입력하신 내용 중 현장에 맞게 한 번 더 살펴볼 부분이 있어, 담당 엔지니어가 확인한 뒤 보내드립니다.' : '담당 엔지니어가 한 번 더 확인한 뒤 보내드립니다.'}</p>
${box(`<b>발송 예정</b> ${esc(fmtKST(job.dueAt))}까지<br><b>제안 번호</b> ${esc(job.no)}<br><b>기준 과제</b> ${esc(m.input.problems.map(k => PROBLEMS[k].label).join(', '))}`)}
${top ? `<p style="margin:0 0 6px;font-size:14px;color:#56637a">지금까지 가장 가까운 사례는 <b style="color:#1b2433">${esc(top.name)}</b>입니다 (일치도 ${top.pct}%).</p>` : ''}
<p style="margin:0;font-size:14px;color:#56637a">진행 상황은 아래 버튼에서 언제든 확인하실 수 있습니다.</p>`,
    cta: '진행 상황 보기', ctaUrl: url, hero: true,
    foot: `급하신 건은 ${CFG.company.tel} 로 전화 주시면 먼저 안내드리겠습니다.<br><br>`
  });
  const text = `${job.lead.company} ${job.lead.name}님, 맞춤 제안서를 준비하고 있습니다.\n발송 예정: ${fmtKST(job.dueAt)}까지\n제안 번호: ${job.no}\n진행 상황: ${url}\n\n모넷코리아 ${CFG.company.tel}`;
  return brevo({ to: [{ email: job.lead.email, name: job.lead.name }], subject: `[모넷코리아] ${job.lead.company} ${job.lead.name}님 맞춤 제안서를 준비하고 있습니다`, html, text, tags: ['custom-proposal', 'customer', 'receipt'] });
}

/* ── 고객: 진행 화면 링크 다시 보내기 (같은 회사·이메일로 다시 신청했을 때) ── */
export async function sendStatusLink(job) {
  const url = utm(statusUrl(job), 'relink');
  const quote = quoteUrl(job, 'proposal_mail');
  const sent = job.status === 'sent';
  const html = layout({
    pre: '신청하신 맞춤 제안서의 진행 화면 링크를 다시 보내드립니다.',
    title: `${who(job)}, 이미 신청하신<br>맞춤 제안서가 있습니다`,
    body: `<p style="margin:0 0 12px">같은 회사·이메일로 다시 신청하셔서, 이전에 신청하신 맞춤 제안서(${esc(job.no)})의 ${sent ? '받은 제안서와 ' : ''}진행 상황을 아래 버튼으로 보실 수 있게 링크를 다시 보내드립니다.</p>
<p style="margin:0 0 12px">무료 맞춤 제안서는 회사·이메일당 ${CFG.onePerDays}일에 한 번, 가장 고민되는 과제 하나를 기준으로 만들어 드립니다. 다른 과제나 현장 전체 구성·견적이 필요하시면 <a href="${esc(quote)}" style="color:#2B84F5;font-weight:700">견적 요청</a>을 남겨 주세요. 담당 엔지니어가 함께 정리해 드립니다.</p>
<p style="margin:0;font-size:13px;color:#8a94a6">본인이 신청하지 않으셨다면 이 메일은 무시하셔도 됩니다.</p>`,
    cta: '내 맞춤 제안서 보기', ctaUrl: url
  });
  return brevo({ to: [{ email: job.lead.email, name: job.lead.name }], subject: `[모넷코리아] ${job.lead.company} 맞춤 제안서 진행 화면 링크`, html, text: `진행 화면: ${url}\n견적 요청: ${quote}`, tags: ['custom-proposal', 'customer', 'relink'] });
}

/* ── 고객: 분석 완료(선택) ───────────────────────────────────────── */
export async function sendProgress(job) {
  const url = utm(statusUrl(job), 'progress');
  const html = layout({
    pre: '유사 사례 분석이 끝났습니다.', title: '데이터 분석이 끝났습니다',
    body: `<p style="margin:0 0 12px">${who(job)}, Monnit 글로벌 레퍼런스와 국내 현장 데이터를 대조한 결과가 나왔습니다. 지금은 담당 엔지니어가 구성안을 확인하고 있고, ${esc(fmtKST(job.dueAt))}에 제안서를 보내드립니다.</p>`,
    cta: '분석 결과 미리 보기', ctaUrl: url
  });
  return brevo({ to: [{ email: job.lead.email, name: job.lead.name }], subject: `[모넷코리아] ${job.lead.company} 맞춤 제안서 — 데이터 분석 완료`, html, text: `분석 완료. ${url}`, tags: ['custom-proposal', 'customer', 'progress'] });
}

/* ── 고객: 제안서 발송 ───────────────────────────────────────────── */
export async function sendProposal(job, pdfBytes) {
  const m = job.match;
  const dl = utm(pdfUrl(job), 'pdf');
  const visit = utm(CFG.site + '/visit', 'visit');
  const quote = quoteUrl(job, 'proposal_mail');
  const sc = scopeOf(m);
  const d = job.draft || {};
  const attach = pdfBytes && pdfBytes.length <= CFG.attachMaxBytes
    ? { content: Buffer.from(pdfBytes).toString('base64'), name: `모넷코리아_맞춤제안서_${job.lead.company.replace(/[\\/:*?"<>|\s]/g, '')}.pdf` } : null;
  const ev = (m.evidence || []).slice(0, 3).map(e => `<li style="margin:2px 0"><b>${esc(e.n)}</b> ${esc(e.l)} <span style="color:#8a94a6">(${esc(e.from)})</span></li>`).join('');
  const html = layout({
    pre: `${CFG.brand.countries}개국 Monnit 레퍼런스에서 ${m.industry.label} 현장과 가장 닮은 사례를 골라 정리했습니다.`,
    title: `${who(job)}을 위한<br>맞춤 제안서를 보내드립니다`,
    body: `<p style="margin:0 0 12px">${modeOf(job) === 'instant'
      ? `신청해 주셔서 감사합니다. 입력하신 회사·현장 정보를 Monnit 글로벌 레퍼런스·국내 도입 현장 데이터와 ${esc((m.playbook && m.playbook.segment && m.playbook.segment.label) || m.industry.label)} 플레이북에 대조해 방금 정리한 맞춤 제안서입니다.`
      : '기다려 주셔서 감사합니다. 말씀하신 과제를 기준으로 비슷한 현장의 사례와 구성안을 정리했습니다.'}</p>
${d.summary ? box(esc(d.summary)) : ''}
${ev ? `<p style="margin:14px 0 4px;font-weight:700">유사 현장에서 공개된 수치</p><ul style="margin:0;padding-left:18px;font-size:14px">${ev}</ul><p style="margin:6px 0 0;font-size:12px;color:#8a94a6">현장 조건에 따라 결과는 달라질 수 있어, 참고용으로만 봐 주세요.</p>` : ''}
<div style="border:1px solid #cfe0fb;background:#f5f9ff;border-radius:10px;padding:14px 16px;margin:16px 0 0;font-size:14px">
<b>이 제안서의 범위</b><br>가장 고민된다고 고르신 「<b>${esc(sc.problems.join(', '))}</b>」 과제를 기준으로 작성했습니다.
${sc.others.length ? `다른 과제(${esc(sc.others.slice(0, 3).join(', '))} 등)나 ` : ''}현장 전체의 구역별 수량·설치 위치·견적이 필요하시면 <a href="${esc(quote)}" style="color:#2B84F5;font-weight:700">전체 현장 견적 요청</a>을 남겨 주세요. 설비 목록이나 도면을 함께 주시면 더 정확하게 정리해 드립니다.</div>
<p style="margin:16px 0 0">${attach ? 'PDF를 첨부했고, 아래 버튼으로도 받으실 수 있습니다.' : '아래 버튼으로 PDF를 받으실 수 있습니다.'} (링크 유효기간 ${CFG.linkDays}일)</p>
${modeOf(job) === 'instant' ? `<p style="margin:12px 0 0;font-size:14px;color:#56637a">담당 엔지니어가 ${esc(CFG.callbackText)} 내용을 확인하고 연락드리겠습니다. 현장과 다른 부분이 있으면 이 메일에 회신만 주셔도 됩니다.</p>` : ''}`,
    cta: '제안서 PDF 받기', ctaUrl: dl, hero: true,
    foot: `현장 전체 구성·견적: <a href="${esc(quote)}" style="color:#2B84F5">견적 요청</a> · 실제 설비 배치를 보고 수량과 위치를 확정하려면 <a href="${esc(visit)}" style="color:#2B84F5">현장 진단 예약</a><br><br>`
  });
  const text = `${job.lead.company} ${job.lead.name}님, 맞춤 제안서를 보내드립니다.\n이 제안서는 「${sc.problems.join(', ')}」 기준입니다. 다른 과제나 현장 전체 견적: ${quote}\nPDF: ${dl}\n현장 진단 예약: ${visit}\n\n모넷코리아 ${CFG.company.tel}`;
  const r = await brevo({ to: [{ email: job.lead.email, name: job.lead.name }], subject: `[모넷코리아] ${job.lead.company} 맞춤 제안서 — ${m.industry.label} 유사 사례 기반`, html, text, attachment: attach, tags: ['custom-proposal', 'customer', 'proposal'] });
  /* 첨부 때문에 거절되면 링크만으로 한 번 더 */
  if (!r.ok && attach && /40\d/.test(r.error || '')) {
    const r2 = await brevo({ to: [{ email: job.lead.email, name: job.lead.name }], subject: `[모넷코리아] ${job.lead.company} 맞춤 제안서 — ${m.industry.label} 유사 사례 기반`, html, text, tags: ['custom-proposal', 'customer', 'proposal'] });
    return { ...r2, attached: false, firstError: r.error };
  }
  return { ...r, attached: !!attach };
}

/* ── 고객: 후속 안내 (열람하지 않은 경우) ─────────────────────────── */
export async function sendFollowup(job) {
  const dl = utm(pdfUrl(job), 'followup');
  const html = layout({
    pre: '제안서에 궁금한 점이 있으시면 편하게 회신 주세요.', title: '보내드린 제안서, 확인해 보셨나요?',
    body: `<p style="margin:0 0 12px">${who(job)}, 며칠 전 보내드린 맞춤 제안서가 메일함 아래로 내려갔을 수 있어 한 번 더 전해드립니다.</p>
<p style="margin:0 0 12px">내용 중 현장과 다른 부분이 있으면 이 메일에 회신만 주셔도 됩니다. 다른 과제나 현장 전체의 수량·견적이 필요하시면 <a href="${esc(quoteUrl(job, 'proposal_mail'))}" style="color:#2B84F5">견적 요청</a>을 남겨 주세요.</p>`,
    cta: '제안서 다시 받기', ctaUrl: dl
  });
  return brevo({ to: [{ email: job.lead.email, name: job.lead.name }], subject: `[모넷코리아] ${job.lead.company} 맞춤 제안서 다시 보내드립니다`, html, text: `제안서: ${dl}`, tags: ['custom-proposal', 'customer', 'followup'] });
}

/* ── 담당자 알림 ─────────────────────────────────────────────────── */
const KIND = {
  new: '신규 접수', review: '엔지니어 확인 필요', preview: '발송 전 검수', sent: '발송 완료', failed: '발송 실패', opened: '제안서 열람', build_failed: '제안서 생성 실패', hot: '재방문', more: '추가 제안 요청 · 견적 연결'
};
const ENTRY = { proposal: '제안서 신청', finder: '홈 솔루션 파인더', contact: '상담 신청 폼', widget: '빠른 상담', whitepaper: '백서 다운로드' };
const AUTO = { explicit: '고객 선택', finder: '파인더 선택', detect: '회사 인식', concerns: '관심 칩', memo: '문의 글 추정', default: '산업 기본값' };
/* 담당자가 확인해야 할 「자동 판단」 요약 */
export function intakeLines(job) {
  const i = job.intake || {}, c = i.company || {}, a = i.auto || {}, pb = job.match.playbook;
  const out = {};
  const plan = job.plan || { mode: 'delayed', reasons: [] };
  out['발송 방식'] = plan.mode === 'instant' ? `즉시 발송 (접수 후 약 ${Math.round((job.dueAt - Date.parse(job.createdAt)) / 1000)}초) → 발송 뒤 ${CFG.callbackText} 확인 연락`
    : plan.mode === 'review' ? `엔지니어 확인 후 발송 (${fmtKST(job.dueAt)}까지)${plan.reasons && plan.reasons.length ? ' — 사유: ' + plan.reasons.join(', ') : ''}`
    : `예약 발송 (${fmtKST(job.dueAt)})`;
  out['입구'] = ENTRY[i.entry] || i.entry || '제안서 신청';
  if (job.meta && job.meta.doc) out['함께 받은 자료'] = job.meta.doc;
  out['업종 판단'] = `${job.match.industry.label}${pb && pb.segment ? ' › ' + pb.segment.label : ''} (${AUTO[a.industry] || a.industry || '-'})`;
  if (c.source && c.source !== 'none') out['회사 인식'] = `${Math.round((c.confidence || 0) * 100)}% · ${(c.reasons || []).join(' / ')}`;
  if (a.problems && a.problems !== 'explicit') out['과제 판단'] = AUTO[a.problems] || a.problems;
  if (job.match.ownCase) out['기존 고객'] = `사례 「${job.match.ownCase.name}」 — 확장 제안으로 구성됨`;
  else if (c.maybeCustomer) out['기존 고객?'] = `사례 ${c.maybeCustomer} 와 관련 있을 수 있음(도메인·약칭 일치) — 확인 필요`;
  const also = (i.also || []).filter(k => PROBLEMS[k]);
  if (also.length) out['추가 관심 과제'] = also.map(k => PROBLEMS[k].label).join(', ') + ' — 제안서에는 넣지 않음, 견적 상담 때 확인';
  const notes = (a.notes || []).filter(x => !/^제안서 밖 관심 과제/.test(x));
  if (notes.length) out['확인 필요'] = notes.join(' / ');
  const asks = (job.meta && job.meta.moreAsks) || [];
  if (asks.length) out['추가 요청 이력'] = asks.slice(-3).map(x => `${fmtKST(Date.parse(x.at), false)} ${x.problem || '-'}`).join(' / ');
  return out;
}
export async function notifyStaff(kind, job, extra = {}) {
  const L = job.lead, g = (job.meta && job.meta.grade) || {};
  const admin = CFG.site + '/ops/proposals#' + job.id;
  const flag = kind === 'more' ? '·연락 필요' : kind === 'new' ? (modeOf(job) === 'instant' ? '·즉시 발송' : modeOf(job) === 'review' ? '·확인 필요' : '') : kind === 'sent' && modeOf(job) === 'instant' ? '·연락 필요' : '';
  const subject = `[맞춤제안·${KIND[kind] || kind}${flag}] ${g.grade ? g.grade + '등급 ' : ''}${L.company} ${L.name}`;
  const rows = {
    '제안 번호': job.no, '상태': job.status, '발송 예정': fmtKST(job.dueAt),
    '회사': L.company, '담당자': `${L.name} ${L.title || ''}`.trim(), '이메일': L.email, '전화': L.phone || '-',
    '산업': job.match.industry.label, '시설': L.facility || '-', '규모': L.scale || '-', '도입 시점': L.timeline || '-',
    '제안서 과제': job.match.input.problems.map(k => (PROBLEMS[k] || {}).label || k).join(', '), '목표': job.match.input.goals.map(k => (GOALS[k] || {}).label || k).join(', '),
    ...intakeLines(job), ...(L.inquiry ? { '문의 항목': L.inquiry } : {}),
    '1위 사례': job.match.top[0] ? `${job.match.top[0].name} (${job.match.top[0].pct}%)` : '-',
    '메모': L.memo || '-', '유입': (job.meta && job.meta.source) || '-',
    '등급': g.grade ? `${g.grade} (${g.score}점)${g.why ? ' — ' + g.why.replace(/^\d+점 — /, '') : ''}` : '-',
    ...(g.meaning ? { '등급 의미': g.meaning } : {}), ...(g.next ? { '올리려면': g.next } : {}), ...extra
  };
  const text = Object.entries(rows).map(([k, v]) => `${k.padEnd(8)} ${v}`).join('\n') + `\n\n관리 화면: ${admin}`;
  const html = layout({
    pre: subject, title: esc(KIND[kind] || kind) + '<br><span style="font-size:15px;font-weight:600;color:#9fb0c8">' + esc(L.company) + ' · ' + esc(L.name) + '</span>',
    body: `<table style="width:100%;border-collapse:collapse;font-size:13px">${Object.entries(rows).map(([k, v]) => `<tr><td style="padding:5px 8px;color:#6b778a;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:5px 8px">${esc(v)}</td></tr>`).join('')}</table>`,
    cta: '관리 화면에서 보기', ctaUrl: admin
  });

  const tried = [];
  let r = await brevo({ to: CFG.staffTo, subject, html, text, tags: ['custom-proposal', 'staff', kind] });
  if (!r.ok) {
    tried.push(r.error || r.skipped);
    try {
      const N = await import('../../functions/_notify.mjs');
      const lead = { ts: new Date().toISOString(), label: '맞춤제안', interest: '맞춤 제안서 · ' + (KIND[kind] || kind), company: L.company, name: L.name, phone: L.phone, email: L.email, memo: text, channel: '' };
      r = await N.notify(lead, {});
      if (!r.ok) tried.push(String(r.tried || 'notify 실패'));
    } catch (e) { tried.push('notify ' + e.message); }
  }
  /* 먼데이 발송 대장 항목에 반응 기록(항목이 있는 건만) */
  if (['opened', 'hot', 'more', 'failed', 'review'].includes(kind) && job.crm && job.crm.monday) {
    try { const C = await import('./crm.mjs'); await C.pushEvent(job, `[${KIND[kind] || kind}] ${fmtKST(Date.now())}\n` + Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join('\n')); } catch (e) { tried.push('crm ' + e.message); }
  }
  /* 웹훅은 메일 성공과 관계없이 보낸다 (슬랙·팀즈·알림톡 중계 서버 등) */
  if (CFG.webhook) {
    try {
      await fetch(CFG.webhook, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: subject + '\n' + admin, kind, id: job.id, no: job.no, company: L.company, name: L.name, grade: g.grade || '', status: job.status, due: new Date(job.dueAt).toISOString() }) });
    } catch (e) { tried.push('webhook ' + e.message); }
  }
  return { ...r, tried };
}

export { esc, maskEmail };
