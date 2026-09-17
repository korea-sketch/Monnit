/** 맞춤 제안서 — 연동 점검 (관리 화면 「연동 점검」 · tools/check-proposal.mjs)
 *
 *  기본 점검은 외부 서비스에 아무것도 보내지 않는다(설정·저장소·PDF 조판·스케줄 기록).
 *  deep=true 이면 각 서비스에 「읽기 전용」 호출을 한 번씩 한다 — 메일을 보내거나 항목을 만들지 않는다.
 *    Brevo    GET /v3/account
 *    Claude   GET /v1/models
 *    먼데이    query { me { id } }
 *    사이트    HEAD /assets/brand/…  (메일 로고) · 백그라운드 함수 호출(빈 작업) */
import { CFG } from './config.mjs';
import * as S from './store.mjs';

const t0 = () => Date.now();
async function timed(fn, ms = 8000) {
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), ms);
  try { return await fn(ac.signal); } finally { clearTimeout(tm); }
}

export async function runHealth({ deep = false, origin = CFG.site } = {}) {
  const out = [];
  const add = (key, label, ok, detail = '', warn = false) => out.push({ key, label, ok: !!ok, warn: !ok && warn, detail: String(detail).slice(0, 200) });

  /* 설정 */
  add('secret', '서명 키(PROPOSAL_SECRET)', !CFG.secretIsDefault, CFG.secretIsDefault ? '기본값 — 운영 전에 긴 임의 문자열로 설정' : '설정됨');
  add('admin', '관리 키(PROPOSAL_ADMIN_KEY)', CFG.adminKey.length >= 16, CFG.adminKey ? (CFG.adminKey.length >= 16 ? '설정됨' : '16자 이상 권장') : '없음 — 관제 로그인으로만 접속', true);
  add('site', '사이트 주소', /^https:\/\//.test(CFG.site) || /localhost/.test(CFG.site), CFG.site);
  add('mailkey', '메일(BREVO_API_KEY)', !!CFG.brevoKey, CFG.brevoKey ? '설정됨' : '없음 — 고객 메일이 나가지 않습니다');
  add('aikey', 'Claude(ANTHROPIC_API_KEY)', !!CFG.aiKey, CFG.aiKey ? CFG.aiModel : '없음 — 템플릿 문안 + 규칙 점검으로 동작', true);
  add('staff', '담당자 알림 주소', CFG.staffTo.length > 0, CFG.staffTo.join(', '));

  /* 저장소 */
  try {
    const k = 'health/ping-' + Date.now();
    await S.setJSON(k, { at: Date.now() });
    const back = await S.getJSON(k);
    await S.del(k);
    add('store', '저장소(Netlify Blobs) 읽기·쓰기', !!back, back ? '정상' : '읽기 실패');
  } catch (e) { add('store', '저장소(Netlify Blobs) 읽기·쓰기', false, e.message); }

  /* PDF 조판 — 글꼴 · 표지 배너 · 로고 */
  try {
    const s = t0();
    const J = await import('./jobs.mjs'), Cp = await import('./copy.mjs'), P = await import('./pdf.mjs');
    const c = J.cleanInput({ entry: 'finder', auto: true, fac: 'datacenter', con: 'leak', company: '연동점검', name: '점검', email: 'check@monnit.co.kr', consent: true });
    const job = J.createJob(c.lead, {}, Date.now(), c.intake);
    const bytes = await P.renderPdf(job, Cp.templateCopy(job));
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    add('pdf', 'PDF 조판(글꼴·표지 배너·로고)', doc.getPageCount() >= 7, `${doc.getPageCount()}쪽 · ${Math.round(bytes.length / 1024)}KB · ${Date.now() - s}ms`);
  } catch (e) { add('pdf', 'PDF 조판(글꼴·표지 배너·로고)', false, e.message); }

  /* 정기 점검(스케줄 함수) */
  try {
    const lt = await S.getJSON('meta/last-tick.json');
    const age = lt ? Date.now() - Date.parse(lt.at) : Infinity;
    add('tick', '정기 점검(proposal-dispatch)', age < 40 * 60000, lt ? `마지막 실행 ${Math.round(age / 60000)}분 전` : '기록 없음 — 게시된 배포에서 10분마다 실행됩니다', !lt);
  } catch (e) { add('tick', '정기 점검(proposal-dispatch)', false, e.message); }

  /* 느슨하게 연결한 모듈 */
  try { const G = await import('./guard.mjs'); add('guard', '경쟁사 차단(_guard) 연결', await G.available(), (await G.available()) ? '연결됨' : '없음 — 기본 규칙만 적용', true); }
  catch (e) { add('guard', '경쟁사 차단(_guard) 연결', false, e.message, true); }
  try { const O = await import('./opsauth.mjs'); const a = await O.available(); add('opsauth', '통합 관제 로그인 공유(_ops_auth)', a, a ? '연결됨 — /ops 로그인으로 바로 열림' : '없음 — 관리 키로 로그인', true); }
  catch (e) { add('opsauth', '통합 관제 로그인 공유(_ops_auth)', false, e.message, true); }
  try { const C = await import('./crm.mjs'); add('monday', '먼데이 발송 대장', C.configured(), C.configured() ? '설정됨' : '미설정(선택) — 사이트 안 발송 대장만 사용', true); }
  catch (e) { add('monday', '먼데이 발송 대장', false, e.message, true); }

  if (!deep) return summarize(out);

  /* 외부 서비스 — 읽기 전용 호출 */
  if (CFG.brevoKey) {
    try {
      const r = await timed(sg => fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': CFG.brevoKey, accept: 'application/json' }, signal: sg }));
      const j = await r.json().catch(() => ({}));
      add('brevo', 'Brevo 계정 연결', r.ok, r.ok ? `${j.companyName || j.email || '계정 확인'}${Array.isArray(j.plan) && j.plan[0] ? ' · ' + (j.plan[0].type || '') + (j.plan[0].credits != null ? ' · 남은 발송 ' + j.plan[0].credits : '') : ''}` : 'HTTP ' + r.status + ' — 키 확인');
    } catch (e) { add('brevo', 'Brevo 계정 연결', false, e.name === 'AbortError' ? '시간 초과' : e.message); }
  }
  if (CFG.aiKey) {
    try {
      const r = await timed(sg => fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': CFG.aiKey, 'anthropic-version': '2023-06-01' }, signal: sg }));
      const j = await r.json().catch(() => ({}));
      const has = Array.isArray(j.data) && j.data.some(m => m.id === CFG.aiModel || String(CFG.aiModel).startsWith(m.id));
      add('claude', 'Claude API 연결', r.ok, r.ok ? (has ? `모델 ${CFG.aiModel} 사용 가능` : `연결됨 · 모델 목록에 ${CFG.aiModel} 확인 필요`) : 'HTTP ' + r.status + ' — 키 확인');
    } catch (e) { add('claude', 'Claude API 연결', false, e.name === 'AbortError' ? '시간 초과' : e.message); }
  }
  try {
    const C = await import('./crm.mjs');
    if (C.configured()) { const r = await C.ping(); add('monday_api', '먼데이 API 연결', r.ok, r.ok ? r.detail : r.error); }
  } catch (e) { add('monday_api', '먼데이 API 연결', false, e.message); }
  try {
    const u = CFG.site + '/assets/brand/monnit-korea-white-480.png';
    const r = await timed(sg => fetch(u, { method: 'HEAD', signal: sg }));
    add('asset', '메일 로고 이미지 공개 주소', r.ok, r.ok ? u : 'HTTP ' + r.status + ' — assets/brand 배포 확인');
  } catch (e) { add('asset', '메일 로고 이미지 공개 주소', false, e.message); }
  try {
    const P = await import('./pipeline.mjs');
    const k = await P.kickBuild(origin, '0000000000000000');
    add('background', '백그라운드 생성 함수 호출', k.ok, k.ok ? '응답 ' + (k.status || 'OK') : (k.error || 'HTTP ' + k.status));
  } catch (e) { add('background', '백그라운드 생성 함수 호출', false, e.message); }
  return summarize(out);
}

function summarize(items) {
  const bad = items.filter(i => !i.ok && !i.warn), warn = items.filter(i => i.warn);
  return { ok: bad.length === 0, at: new Date().toISOString(), bad: bad.length, warn: warn.length, items };
}
