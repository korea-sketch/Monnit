/* ============================================================
   monnit.co.kr — Cloudflare Worker 진입점
   ------------------------------------------------------------
   사이트 전체를 이 Worker 한 곳에서 처리합니다.
     · 정적 파일·리다이렉트·헤더·404  → site.mjs (dist/ 파일)
     · 서버 함수(server/functions/*)   → /api/fn/<이름> 또는 각 함수의 config.path
     · 엣지 처리(IP 차단·방문 기록)    → server/edge/block-ip.js
     · 예약 작업(schedule)             → Cron Trigger
     · 백그라운드 작업                  → GitHub Actions / Cloudflare Queue (없으면 waitUntil)
     · 저장소                          → R2 (server/lib/blobs.mjs)
   ============================================================ */
import { installIntlCache } from './intl-cache.mjs';
installIntlCache();   /* 날짜 형식기 재사용 — 무료 플랜 CPU 10ms (다른 모듈보다 먼저) */
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { bindBlobs } from '../server/lib/blobs.mjs';
import { resolveStatic, matchRedirect, applyHeaders, DEFAULT_HSTS } from './site.mjs';
import { blobApi } from './blob-api.mjs';
import { withConfig } from './env-config.mjs';
import { sheetsRoute } from './sheets-cache.mjs';

/* ── 서버 함수들 (v2: default + config) ───────────────────────── */
import * as fn_blockadmin from '../server/functions/blockadmin.mjs';
import * as fn_blockapi from '../server/functions/blockapi.mjs';
import * as fn_flowadmin from '../server/functions/flowadmin.mjs';
import * as fn_lead from '../server/functions/lead.mjs';
import * as fn_mailpreview from '../server/functions/mailpreview.mjs';
import * as fn_noticeadmin from '../server/functions/noticeadmin.mjs';
import * as fn_ops from '../server/functions/ops.mjs';
import * as fn_proposal_admin from '../server/functions/proposal-admin.mjs';
import * as fn_proposal_api from '../server/functions/proposal-api.mjs';
import * as fn_proposal_chat from '../server/functions/proposal-chat.mjs';
import * as fn_support_chat from '../server/functions/support-chat.mjs';   /* 기술지원 대화 (2026-10-20) */
import * as fn_track from '../server/functions/track.mjs';
import * as fn_visitadmin from '../server/functions/visitadmin.mjs';
/* 긴급 경보 알리미 계약·설문·SLA (2026-10-16) */
import * as fn_alarm from '../server/functions/alarm.mjs';
import * as fn_geo from '../server/functions/geo.mjs';   /* 접속 국가 → 영문 첫 화면 (2026-10-28) */
/* 백그라운드 · 예약 */
import * as fn_build_bg from '../server/functions/proposal-build-background.mjs';
import * as fn_adsync from '../server/functions/adsync.mjs';
import * as fn_health from '../server/functions/health.mjs';
import * as fn_dispatch from '../server/functions/proposal-dispatch.mjs';
/* v1 (exports.handler) */
import * as fn_getdoc from '../server/functions/getdoc.js';
import * as fn_sendguide from '../server/functions/sendguide.js';
import * as fn_sendpw from '../server/functions/sendpw.js';
/* 엣지 함수 */
import * as edge_blockip from '../server/edge/block-ip.js';
/* 동적 import 로 불러오던 모듈 — 번들 안에서는 경로 계산 import 가 안 되므로 미리 꽂아 둔다 */
import * as opsAuth from '../server/functions/_ops_auth.mjs';
import * as guardMod from '../server/functions/_guard.js';

const V2 = {
  blockadmin: fn_blockadmin, blockapi: fn_blockapi, flowadmin: fn_flowadmin, lead: fn_lead,
  mailpreview: fn_mailpreview, noticeadmin: fn_noticeadmin, ops: fn_ops, 'proposal-admin': fn_proposal_admin,
  'proposal-api': fn_proposal_api, 'proposal-chat': fn_proposal_chat, 'support-chat': fn_support_chat, track: fn_track, visitadmin: fn_visitadmin,
  alarm: fn_alarm, geo: fn_geo
};
const BACKGROUND = { 'proposal-build-background': fn_build_bg };
const SCHEDULED = { adsync: fn_adsync, health: fn_health, 'proposal-dispatch': fn_dispatch };
const V1 = { getdoc: fn_getdoc, sendguide: fn_sendguide, sendpw: fn_sendpw };

/* 경로 → 함수
   기본 주소: /api/fn/<이름>
   옛 주소(/.netlify/functions/<이름>)도 같은 함수로 받는다 — 이미 보낸 메일의 자료 받기 링크(getdoc)가 계속 열리도록 */
const FN_PREFIX = '/api/fn/';
const LEGACY_FN_PREFIX = '/.netlify/functions/';
const ROUTES = new Map();
const addFn = (name, entry) => { ROUTES.set(FN_PREFIX + name, entry); ROUTES.set(LEGACY_FN_PREFIX + name, entry); };
for (const [name, mod] of Object.entries(V2)) {
  const p = mod.config && mod.config.path;
  for (const x of (Array.isArray(p) ? p : p ? [p] : [])) ROUTES.set(x, { name, kind: 'v2', mod });
  addFn(name, { name, kind: 'v2', mod });
}
for (const [name, mod] of Object.entries(V1)) addFn(name, { name, kind: 'v1', mod });
for (const [name, mod] of Object.entries(BACKGROUND)) addFn(name, { name, kind: 'bg', mod });
const CRON = new Map();
for (const [name, mod] of Object.entries(SCHEDULED)) if (mod.config && mod.config.schedule) CRON.set(mod.config.schedule, { name, mod });

/* ── 실행 환경 ───────────────────────────────────────────────── */
const ALS = new AsyncLocalStorage();
/* 함수 코드가 응답 뒤에 마칠 일을 맡길 수 있게 — 요청마다 그 요청의 ctx.waitUntil 로 */
globalThis.__MNK_WAIT_UNTIL = p => { try { const st = ALS.getStore(); if (st && st.ctx) st.ctx.waitUntil(Promise.resolve(p).catch(() => {})); } catch (e) { /* 무시 */ } };
let BOOTED = false;
function boot(env) {
  bindBlobs(env.BLOBS);
  globalThis.__MNK_ENV = env;
  if (!BOOTED) {
    BOOTED = true;
    /* 무료 플랜: PDF 조판은 GitHub Actions 에 맡긴다 (wrangler.toml PDF_BUILDER = "github") */
    globalThis.__MNK_PDF_OFFLOAD = String(env.PDF_BUILDER || '').toLowerCase() === 'github';
    /* 함수 코드가 설정값(환경변수)을 읽는 통로 — 대시보드 값 + R2 __config/env.json */
    globalThis.__MNK_ENV_GET = k => { const e = globalThis.__MNK_ENV || {}; return e[k] != null ? String(e[k]) : undefined; };
    globalThis.__PROPOSAL_OPS_AUTH = opsAuth;
    globalThis.__PROPOSAL_GUARD = guardMod.default || guardMod;
    /* 함수가 읽는 비공개 파일(제안서 PDF·글꼴·메일 템플릿) — dist/__private 에서 */
    globalThis.__MNK_READ_PRIVATE = async (rel, as = 'arrayBuffer') => {
      const e = globalThis.__MNK_ENV;
      const u = 'https://assets.local/__private/' + String(rel).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
      const r = await e.ASSETS.fetch(new Request(u));
      if (!r.ok) return null;
      return as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
    };
  }
}
const selfHosts = env => new Set(String(env.SELF_HOSTS || 'monnit.co.kr,www.monnit.co.kr').split(/[,\s]+/).filter(Boolean));

/* 자기 자신 호출(/api/fn/... 등 자기 도메인)은 네트워크로 나가지 않고 안에서 처리 */
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.__MNK_REAL_FETCH = realFetch;
globalThis.fetch = async function (input, init) {
  const st = ALS.getStore();
  if (st) {
    try {
      const req = new Request(input, init);
      const u = new URL(req.url);
      /* 자기 도메인 주소는 전부 안에서 처리 (2026-10-14).
         Worker 가 자기 도메인(monnit.co.kr)을 밖으로 부르면 Cloudflare 가 522 로 막는다 —
         그래서 15분마다 도는 사이트 감시(health)가 모든 페이지를 「응답 없음」으로 기록하고 경보 메일을 보냈다 */
      if (st.hosts.has(u.host) || u.host === st.host) {
        /* 밖으로 나가는 fetch 처럼 리다이렉트(301·302 …)는 따라간다 — redirect:'manual' 이면 그대로 돌려준다 */
        let r = req, res = await dispatch(r, st.env, st.ctx, { internal: true });
        for (let hop = 0; hop < 5 && req.redirect !== 'manual' && [301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location'); hop++) {
          const next = new URL(res.headers.get('location'), r.url);
          if (!(st.hosts.has(next.host) || next.host === st.host)) return realFetch(next.toString(), { headers: r.headers });
          const keep = res.status === 307 || res.status === 308;
          r = new Request(next.toString(), keep ? r : { method: 'GET', headers: r.headers });
          res = await dispatch(r, st.env, st.ctx, { internal: true });
        }
        return res;
      }
    } catch (e) { /* 일반 요청으로 */ }
  }
  return realFetch(input, init);
};

/* ── 함수에 넘기는 context ───────────────────────────────────── */
function geoOf(req) {
  const cf = req.cf || {};
  return {
    city: cf.city || '', country: { code: cf.country || '', name: cf.country || '' },
    subdivision: { code: cf.regionCode || '', name: cf.region || '' },
    timezone: cf.timezone || '', latitude: Number(cf.latitude) || 0, longitude: Number(cf.longitude) || 0, postalCode: cf.postalCode || ''
  };
}
/* geo · cookies 등은 실제로 쓸 때만 계산한다(req.cf 읽기·쿠키 해석 비용 절약) */
function makeContext(req, env, ctx, extra = {}) {
  let geo, cookies, rid;
  return {
    ip: req.headers.get('cf-connecting-ip') || '',
    get geo() { return geo || (geo = geoOf(req)); },
    waitUntil: p => ctx.waitUntil(Promise.resolve(p).catch(e => console.error('[waitUntil]', e))),
    params: {},
    get requestId() { return rid || (rid = req.headers.get('cf-ray') || crypto.randomUUID()); },
    site: { id: env.SITE_ID || '', name: 'monnit', url: env.URL || 'https://monnit.co.kr' },
    deploy: { context: 'production', id: '', published: true },
    account: { id: '' },
    get server() { return { region: (req.cf && req.cf.colo) || '' }; },
    get cookies() { return cookies || (cookies = cookieJar(req)); },
    ...extra
  };
}
function cookieJar(req) {
  const raw = req.headers.get('cookie') || '';
  const map = new Map(raw.split(/;\s*/).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]; }));
  return { get: k => map.get(k), set: () => {}, delete: () => {} };
}

/* 방문자 IP — 모든 함수가 cf-connecting-ip(Cloudflare 가 넣고, 방문자가 위조할 수 없는 값)를 먼저 읽는다.
   그래서 요청을 다시 만들어 헤더를 고치지 않는다 — Request 를 새로 만들 때마다 CPU 가 크게 든다. */

/* ── 함수 실행 ───────────────────────────────────────────────── */
async function runV1(mod, req) {
  const url = new URL(req.url);
  const ct = req.headers.get('content-type') || '';
  const text = /json|text|form|xml|javascript/.test(ct) || !ct;
  let body = null, isBase64Encoded = false;
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (text) body = await req.text();
    else { body = Buffer.from(await req.arrayBuffer()).toString('base64'); isBase64Encoded = true; }
  }
  const headers = {}; req.headers.forEach((v, k) => { headers[k] = v; });
  const event = {
    httpMethod: req.method, headers, body, isBase64Encoded, path: url.pathname, rawUrl: req.url,
    queryStringParameters: Object.fromEntries(url.searchParams), multiValueQueryStringParameters: {}
  };
  const r = (await mod.handler(event, {})) || { statusCode: 204 };
  const out = new Headers();
  for (const [k, v] of Object.entries(r.headers || {})) out.set(k, String(v));
  for (const [k, vs] of Object.entries(r.multiValueHeaders || {})) for (const v of vs) out.append(k, String(v));
  const b = r.body == null ? null : (r.isBase64Encoded ? Buffer.from(r.body, 'base64') : r.body);
  return new Response(b, { status: r.statusCode || 200, headers: out });
}

async function runRoute(route, req, env, ctx) {
  if (route.kind === 'v1') return fnDefaults(await runV1(route.mod, req));
  if (route.kind === 'bg') {
    /* 백그라운드 작업: 바로 202, 실제 작업은 GitHub Actions 또는 큐(최대 15분)에서 */
    const body = ['GET', 'HEAD'].includes(req.method) ? '' : Buffer.from(await req.arrayBuffer()).toString('base64');
    const headers = {}; req.headers.forEach((v, k) => { headers[k] = v; });
    const msg = { name: route.name, url: req.url, method: req.method, headers, body };
    if (globalThis.__MNK_PDF_OFFLOAD) return dispatchGithub(msg, env);
    if (env.BG_QUEUE) await env.BG_QUEUE.send(msg);
    else ctx.waitUntil(runBackground(msg, env, ctx));
    return new Response(null, { status: 202 });
  }
  const res = await route.mod.default(req, makeContext(req, env, ctx));
  return fnDefaults(res instanceof Response ? res : new Response(res == null ? null : String(res), { status: res == null ? 204 : 200 }));
}
/* 함수 응답 기본값 — cache-control 이 없으면 no-cache */
function fnDefaults(res) {
  if (res.headers.has('cache-control')) return res;
  const r = new Response(res.body, res); r.headers.set('cache-control', 'no-cache'); return r;
}
/* GitHub Actions 깨우기 — .github/workflows/proposal-build.yml 이 받아서 실행 */
async function dispatchGithub(msg, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    console.error('[bg] GITHUB_TOKEN · GITHUB_REPO 가 없어 제안서 생성 작업을 보낼 수 없습니다');
    return new Response('builder not configured', { status: 503 });
  }
  const r = await realFetch('https://api.github.com/repos/' + env.GITHUB_REPO + '/dispatches', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.GITHUB_TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'monnit-worker', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
    body: JSON.stringify({ event_type: 'proposal-build', client_payload: { name: msg.name, sig: msg.headers['x-proposal-sig'] || '', body: msg.body } })
  });
  if (r.status !== 204) console.error('[bg] GitHub 호출 실패', r.status, (await r.text()).slice(0, 200));
  return new Response(null, { status: r.status === 204 ? 202 : 502 });
}
async function runBackground(msg, env, ctx) {
  const mod = BACKGROUND[msg.name]; if (!mod) return;
  const req = new Request(msg.url, { method: msg.method, headers: msg.headers, body: msg.body ? Buffer.from(msg.body, 'base64') : undefined });
  try { await mod.default(req, makeContext(req, env, ctx)); }
  catch (e) { console.error('[background]', msg.name, e && e.stack || e); throw e; }
}

/* ── 정적 사이트 (_redirects · _headers 규칙) ──────────────────── */
function assetRequest(file, req) {
  const u = new URL(req.url);
  u.pathname = file.split('/').map(s => encodeURIComponent(s)).join('/');
  u.search = '';
  const h = new Headers();
  for (const k of ['if-none-match', 'if-modified-since', 'range', 'accept-encoding']) { const v = req.headers.get(k); if (v) h.set(k, v); }
  return new Request(u, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers: h });
}
async function serveFile(file, req, env, status) {
  const r = await env.ASSETS.fetch(assetRequest(file, req));
  if (status && status !== r.status && r.status === 200) return new Response(r.body, { status, headers: r.headers });
  return r;
}
async function notFound(req, env, pathname) {
  const r = resolveStatic('/404.html');
  const res = r && r.file ? await serveFile(r.file, req, env, 404) : new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return applyHeaders(new Response(res.body, { status: 404, headers: res.headers }), pathname);
}
const withQuery = (to, search) => { if (/[^\x00-\x7f]/.test(to)) to = encodeURI(to); return search && !to.includes('?') ? to + search : to; };

async function serveSite(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  const rule = matchRedirect(url);
  if (rule) {
    if ([301, 302, 303, 307, 308].includes(rule.status)) {
      return applyHeaders(new Response('Redirecting to ' + rule.to, { status: rule.status, headers: { location: withQuery(rule.to, url.search), 'content-type': 'text/plain; charset=utf-8' } }), path);
    }
    if (/^https?:\/\//.test(rule.to)) {                       /* 외부 프록시(200) */
      /* 방문자 쿠키·위조 가능한 IP 헤더는 넘기지 않고, 실제 IP 만 x-forwarded-for 로 */
      const h = new Headers(req.headers);
      for (const k of ['cookie', 'x-mnk-ip', 'x-mnk-client-ip', 'x-forwarded-for', 'client-ip', 'x-real-ip']) h.delete(k);
      const ip = req.headers.get('cf-connecting-ip'); if (ip) h.set('x-forwarded-for', ip);
      const pr = await realFetch(new Request(withQuery(rule.to, url.search), { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, redirect: 'manual' }));
      return new Response(pr.body, pr);
    }
    const target = rule.to.split('?')[0];
    const t = resolveStatic(target);
    if (rule.status === 404) {
      if (t && t.file) return applyHeaders(await serveFile(t.file, req, env, 404), path);
      return notFound(req, env, path);
    }
    if (t && t.file) return applyHeaders(await serveFile(t.file, req, env, rule.status || 200), path);
    if (ROUTES.has(target)) return null;                       /* 함수로 다시 쓰기 → 호출 쪽에서 처리 */
    return notFound(req, env, path);
  }
  const s = resolveStatic(path);
  if (s && s.file) return applyHeaders(await serveFile(s.file, req, env), path);
  if (s && s.redirect) {
    return new Response('Redirecting to ' + s.redirect, { status: 301, headers: { location: withQuery(s.redirect, url.search), 'content-type': 'text/html' } });
  }
  return notFound(req, env, path);
}

/* ── 엣지 함수 범위 (block-ip config) ────────────────────────── */
const globRe = g => new RegExp('^' + g.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
const EDGE = (() => {
  const c = edge_blockip.config || {};
  const inc = (Array.isArray(c.path) ? c.path : [c.path || '/*']).map(globRe);
  const exc = (c.excludedPath || []).map(globRe);
  return { inc, exc, bypass: c.onError === 'bypass' };
})();
const edgeApplies = p => EDGE.inc.some(r => r.test(p)) && !EDGE.exc.some(r => r.test(p));

/* ── 요청 처리 ───────────────────────────────────────────────── */
async function dispatch(request, env, ctx, opts = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/__private' || path.startsWith('/__private/')) return notFound(request, env, path);
  if (path === '/api/__blobs') return (await blobApi(request, env)) || notFound(request, env, path);   /* 엣지(방문 기록) 거치지 않음 */
  if (path === '/api/sheets') return (await sheetsRoute(request, env, ctx)) || notFound(request, env, path);   /* CMS 시트 묶음 캐시 — 방문 기록·차단 검사 불필요 */

  const inner = async req => {
    const p = new URL(req.url).pathname;
    const bapi = await blobApi(req, env);
    if (bapi) return bapi;
    const route = ROUTES.get(p);
    if (route) return runRoute(route, req, env, ctx);
    const res = await serveSite(req, env);
    if (res) return res;
    /* 리다이렉트 규칙이 함수 경로로 다시 쓴 경우 */
    const rule = matchRedirect(new URL(req.url));
    const r2 = rule && ROUTES.get(rule.to.split('?')[0]);
    return r2 ? runRoute(r2, req, env, ctx) : notFound(req, env, p);
  };

  if (!opts.internal && edgeApplies(path)) {
    const context = makeContext(request, env, ctx, { next: r => inner(r || request) });
    try {
      const r = await edge_blockip.default(request, context);
      if (r instanceof Response) return r;
    } catch (e) {
      if (!EDGE.bypass) throw e;
      console.error('[edge]', e && e.message);
    }
  }
  return inner(request);
}

export default {
  async fetch(request, env, ctx) {
    bindBlobs(env.BLOBS);
    env = await withConfig(env);          /* R2 에 저장된 설정값 + 대시보드 값 */
    boot(env);
    const req = request;
    const u = new URL(req.url);
    /* http → https */
    if (u.protocol === 'http:' && selfHosts(env).has(u.host)) {
      u.protocol = 'https:';
      if (env.PRIMARY_HOST && selfHosts(env).has(u.host)) u.host = env.PRIMARY_HOST;
      return Response.redirect(u.toString(), 301);
    }
    /* www → 기본 도메인 */
    if (env.PRIMARY_HOST && u.host !== env.PRIMARY_HOST && selfHosts(env).has(u.host)) {
      u.host = env.PRIMARY_HOST;
      return Response.redirect(u.toString(), 301);
    }
    return ALS.run({ env, ctx, host: u.host, hosts: selfHosts(env) }, async () => {
      try {
        const t0 = env.DEBUG_TIMING ? Date.now() : 0;
        let res = await dispatch(req, env, ctx);
        if (t0) console.log('[timing]', req.method, u.pathname, res.status, (Date.now() - t0) + 'ms');
        if (!res.headers.has('strict-transport-security')) {          /* 모든 응답에 HSTS */
          res = new Response(res.body, res); res.headers.set('strict-transport-security', DEFAULT_HSTS);
        }
        /* 관제·방문 관리 화면에는 Cloudflare 방문 분석 스크립트를 끼워 넣지 않게(no-transform) —
           이 화면들은 보안상 외부 스크립트를 막아 두어 콘솔에 오류만 남는다 (2026-10-14) */
        if (/^\/(ops|visit)(\/|$)/.test(u.pathname) && /text\/html/.test(res.headers.get('content-type') || '')) {
          const cc = res.headers.get('cache-control') || 'no-store';
          if (!/no-transform/.test(cc)) { res = new Response(res.body, res); res.headers.set('cache-control', cc + ', no-transform'); }
        }
        return res;
      }
      catch (e) {
        console.error('[worker]', e && e.stack || e);
        return new Response('일시적인 오류입니다. 잠시 뒤 다시 시도해 주세요.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
      }
    });
  },

  /* 예약 함수 — 각 함수 config.schedule 과 같은 cron 식(UTC) */
  async scheduled(event, env, ctx) {
    bindBlobs(env.BLOBS);
    env = await withConfig(env);
    boot(env);
    /* 예약 작업은 기본으로 켜져 있다. 잠시 멈추려면 대시보드 변수 CRON_ENABLED = 0 */
    if (String(env.CRON_ENABLED || '') === '0') { console.log('[cron] CRON_ENABLED=0 — 건너뜀:', event.cron); return; }
    const job = CRON.get(event.cron);
    if (!job) { console.warn('[cron] 연결된 함수 없음:', event.cron); return; }
    const site = env.URL || 'https://monnit.co.kr';
    const req = new Request(site + FN_PREFIX + job.name, { method: 'POST', body: JSON.stringify({ next_run: new Date(event.scheduledTime).toISOString() }) });
    const t0 = Date.now();
    await ALS.run({ env, ctx, host: new URL(site).host, hosts: selfHosts(env) }, () => job.mod.default(req, makeContext(req, env, ctx)));
    if (env.DEBUG_TIMING) console.log('[timing] cron', job.name, (Date.now() - t0) + 'ms');
  },

  /* 백그라운드 함수 큐 */
  async queue(batch, env, ctx) {
    bindBlobs(env.BLOBS);
    env = await withConfig(env);
    boot(env);
    for (const m of batch.messages) {
      const site = new URL(m.body.url);
      try {
        await ALS.run({ env, ctx, host: site.host, hosts: selfHosts(env) }, () => runBackground(m.body, env, ctx));
        m.ack();
      } catch (e) { m.retry({ delaySeconds: 30 }); }
    }
  }
};
