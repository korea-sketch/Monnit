/** 맞춤 제안서 — 백그라운드 생성 (최대 15분)
 *  AI 문안 호출이 수십 초 걸릴 수 있어 접수 API 와 분리했다.
 *  호출: POST /.netlify/functions/proposal-build-background  { id, candidate? }  + x-proposal-sig 헤더
 *  응답은 Netlify 가 즉시 202 로 돌려주므로 여기서 반환값은 쓰이지 않는다. */
import { buildJob, buildSig, buildCandidate } from '../lib/proposal/pipeline.mjs';
import EQ from './_eq.js';                 /* 서명은 상수시간으로 비교 (2026-09-18) */

export default async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  let id = '', body = {};
  try { body = await req.json(); id = String(body.id || ''); } catch (e) { return new Response(null, { status: 400 }); }
  if (!/^[a-f0-9]{16}$/.test(id) || !EQ.eq(req.headers.get('x-proposal-sig'), buildSig(id))) return new Response(null, { status: 403 });
  /* 관리 화면 「AI로 재생성」 — 후보 버전 생성 + 검토 (발송은 담당자가 고른다) */
  if (body.candidate) {
    const c = await buildCandidate(id);
    console.log('[proposal-candidate]', id, JSON.stringify(c));
    return new Response(null, { status: 204 });
  }
  /* 즉시 방식이면 생성 → 화면 단계가 끝나는 시각까지 기다렸다가 발송까지 여기서 처리한다 */
  const r = await buildJob(id, { ai: true, autoSend: true });
  console.log('[proposal-build]', id, JSON.stringify(r));
  return new Response(null, { status: 204 });
};
