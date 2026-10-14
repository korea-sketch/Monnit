/* ============================================================
   monnit.co.kr — Cloudflare Worker 진입점
   ------------------------------------------------------------
   Netlify 에서 하던 일을 그대로 한 곳에서 처리합니다.
     · 정적 파일·리다이렉트·헤더·404  → netlify-compat/site.mjs (dist/ 파일)
     · 서버 함수(netlify/functions/*)  → 코드 수정 없이 그대로 불러 실행
     · 엣지 함수(IP 차단·방문 기록)    → netlify/edge-functions/block-ip.js 그대로 실행
     · 예약 함수(schedule)             → Cron Trigger
     · 백그라운드 함수                  → Cloudflare Queue (없으면 waitUntil)
     · Netlify Blobs                   → R2 (netlify-compat/blobs.mjs, wrangler.toml alias)
   ============================================================ */
import { installIntlCache } from './intl-cache.mjs';
installIntlCache();   /* 날짜 형식기 재사용 — 무료 플랜 CPU 10ms (다른 모듈보다 먼저) */
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { bindBlobs } from './netlify-compat/blobs.mjs';
import { resolveStatic, matchRedirect, applyHeaders, DEFAULT_HSTS } from './netlify-compat/site.mjs';
import { migrateRoute } from './migrate.mjs';
import { blobApi } from './blob-api.mjs';
import { withConfig } from './env-config.mjs';
import { sheetsRoute } from './sheets-cache.mjs';

/* ── Netlify 함수들 (v2: default + config) ───────────────────── */
import * as fn_blockadmin from '../netlify/functions/blockadmin.mjs';
import * as fn_blockapi from '../netlify/functions/blockapi.mjs';
import * as fn_flowadmin from '../netlify/functions/flowadmin.mjs';
import * as fn_lead from '../netlify/functions/lead.mjs';
import * as fn_mailpreview from '../netlify/functions/mailpreview.mjs';
import * as fn_noticeadmin from '../netlify/functions/noticeadmin.mjs';
import * as fn_ops from '../netlify/functions/ops.mjs';
import * as fn_proposal_admin from '../netlify/functions/proposal-admin.mjs';
import * as fn_proposal_api from '../netlify/functions/proposal-api.mjs';
import * as fn_proposal_chat from '../netlify/functions/proposal-chat.mjs';
import * as fn_track from '../netlify/functions/track.mjs';
import * as fn_visitadmin from '../netlify/functions/visitadmin.mjs';
import * as fn_blob_export from '../netlify/functions/blob-export.mjs';
/* 백그라운드 · 예약 */
import * as fn_build_bg from '../netlify/functions/proposal-build-background.mjs';
import * as fn_adsync from '../netlify/functions/adsync.mjs';
import * as fn_health from '../netlify/functions/health.mjs';
import * as fn_dispatch from '../netlify/functions/proposal-dispatch.mjs';
/* v1 (exports.handler) */
import * as fn_getdoc from '../netlify/functions/getdoc.js';
import * as fn_sendguide from '../netlify/functions/sendguide.js';
import * as fn_sendpw from '../netlify/functions/sendpw.js';
/* 엣지 함수 */
import * as edge_blockip from '../netlify/edge-functions/block-ip.js';
/* 동적 import 로 불러오던 모듈 — 번들 안에서는 경로 계산 import 가 안 되므로 미리 꽂아 둔다 */
import * as opsAuth from '../netlify/functions/_ops_auth.mjs';
import * as guardMod from '../netlify/functions/_guard.js';

const V2 = {
  blockadmin: fn_blockadmin, blockapi: fn_blockapi, flowadmin: fn_flowadmin, lead: fn_lead,
  mailpreview: fn_mailpreview, noticeadmin: fn_noticeadmin, ops: fn_ops, 'proposal-admin': fn_proposal_admin,
  'proposal-api': fn_proposal_api, 'proposal-chat': fn_proposal_chat, track: fn_track, visitadmin: fn_visitadmin,
  'blob-export': fn_blob_export
};
const BACKGROUND = { 'proposal-build-background': fn_build_bg };
const SCHEDULED = { adsync: fn_adsync, health: fn_health, 'proposal-dispatch': fn_dispatch };
const V1 = { getdoc: fn_getdoc, sendguide: fn_sendguide, sendpw: fn_sendpw };

/* 경로 → 함수 */
const ROUTES = new Map();
for (const [name, mod] of Object.entries(V2)) {
  const p = mod.config && mod.config.path;
  for (const x of (Array.isArray(p) ? p : p ? [p] : [])) ROUTES.set(x, { name, kind: 'v2', mod });
  ROUTES.set('/.netlify/functions/' + name, { name, kind: 'v2', mod });
}
for (const [name, mod] of Object.entries(V1)) ROUTES.set('/.netlify/functions/' + name, { name, kind: 'v1', mod });
for (const [name, mod] of Object.entries(BACKGROUND)) ROUTES.set('/.netlify/functions/' + name, { name, kind: 'bg', mod });
const CRON = new Map();
for (const [name, mod] of Object.entries(SCHEDULED)) if (mod.config && mod.config.schedule) CRON.set(mod.config.schedule, { name, mod });

/* ── 실행 환경 ───────────────────────────────────────────────── */
const ALS = new AsyncLocalStorage();
let BOOTED = false;
function boot(env) {
  bindBlobs(env.BLOBS);
  globalThis.__MNK_ENV = env;
  if (!BOOTED) {
    BOOTED = true;
    /* 무료 플랜: PDF 조판은 GitHub Actions 에 맡긴다 (wrangler.toml PDF_BUILDER = "github") */
    globalThis.__MNK_PDF_OFFLOAD = String(env.PDF_BUILDER || '').toLowerCase() === 'github';
    globalThis.Netlify = { env: { get: k => { const e = globalThis.__MNK_ENV || {}; return e[k] != null ? String(e[k]) : undefined; }, has: k => (globalThis.__MNK_ENV || {})[k] != null, toObject: () => ({ ...(globalThis.__MNK_ENV || {}) }) } };
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

/* 자기 자신 호출(/.netlify/functions/...)은 네트워크로 나가지 않고 안에서 처리
   — DNS 이전 전(workers.dev)에도 Netlify 쪽으로 새지 않게 */
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.__MNK_REAL_FETCH = realFetch;
globalThis.fetch = async function (input, init) {
  const st = ALS.getStore();
  if (st) {
    try {
      const req = new Request(input, init);
      const u = new URL(req.url);
      if ((st.hosts.has(u.host) || u.host === st.host) && (u.pathname.startsWith('/.netlify/functions/') || ROUTES.has(u.pathname))) {
        return await dispatch(req, st.env, st.ctx, { internal: true });
      }
    } catch (e) { /* 일반 요청으로 */ }
  }
  return realFetch(input, init);
};

/* ── Netlify context 흉내 ───────────────────────────────────── */
function geoOf(req) {
  const cf = req.cf || {};
  return {
    city: cf.city || '', country: { code: cf.country || '', name: cf.country || '' },
    subdivision: { code: cf.regionCode || '', name: cf.region || '' },
    timezone: cf.timezone || '', latitude: Number(cf.latitude) || 0, longitude: Number(cf.longitude) || 0, postalCode: cf.postalCode || ''
  };
}
function makeContext(req, env, ctx, extra = {}) {
  return {
    ip: req.headers.get('x-nf-client-connection-ip') || '',
    geo: geoOf(req),
    waitUntil: p => ctx.waitUntil(Promise.resolve(p).catch(e => console.error('[waitUntil]', e))),
    params: {}, requestId: req.headers.get('cf-ray') || crypto.randomUUID(),
    site: { id: env.SITE_ID || '', name: 'monnit', url: env.URL || 'https://monnit.co.kr' },
    deploy: { context: 'production', id: '', published: true },
    account: { id: '' }, server: { region: (req.cf && req.cf.colo) || '' },
    cookies: cookieJar(req),
    ...extra
  };
}
function cookieJar(req) {
  const raw = req.headers.get('cookie') || '';
  const map = new Map(raw.split(/;\s*/).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]; }));
  return { get: k => map.get(k), set: () => {}, delete: () => {} };
}

/* 방문자 IP — Cloudflare 가 준 값만 믿는다. 방문자가 보낸 같은 이름 헤더는 지운다.
   예외: DNS 전파 기간에 Netlify 가 넘겨준 요청(netlify/edge-functions/a-relay-cf.js)은
   MIGRATE_SECRET 서명이 맞을 때만 그 IP 를 믿고, 주소도 원래 도메인(monnit.co.kr)으로 되돌린다. */
const RELAY_HDRS = ['x-mnk-relay-ip', 'x-mnk-relay-sig', 'x-mnk-relay-host'];
function relaySecret(env) { return (env && (env.MIGRATE_SECRET || env.PROPOSAL_SECRET || env.DL_SECRET)) || ''; }
function relayIp(request, env) {
  const ip = request.headers.get('x-mnk-relay-ip') || '', sig = request.headers.get('x-mnk-relay-sig') || '', s = relaySecret(env);
  if (!ip || !sig || !s) return '';
  const want = crypto.createHmac('sha256', s).update('relay|' + ip).digest('hex');
  try { return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig)) ? ip.slice(0, 45) : ''; } catch (e) { return ''; }
}
function trustedRequest(request, env) {
  const h = new Headers(request.headers);
  for (const k of ['x-mnk-ip', 'x-nf-client-connection-ip', 'x-forwarded-for', 'client-ip', 'x-real-ip']) h.delete(k);
  const ip = relayIp(request, env) || request.headers.get('cf-connecting-ip') || '';
  if (ip) { h.set('x-nf-client-connection-ip', ip); h.set('x-forwarded-for', ip); }
  let url = request.url;
  const host = (request.headers.get('x-mnk-relay-host') || '').toLowerCase();
  if (host && selfHosts(env).has(host)) { const u = new URL(url); u.protocol = 'https:'; u.hostname = host; u.port = ''; url = u.toString(); }
  for (const k of RELAY_HDRS) h.delete(k);
  return new Request(url, new Request(request, { headers: h }));
}

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
    /* Netlify 백그라운드 함수처럼: 바로 202, 실제 작업은 큐(최대 15분)에서 */
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
/* Netlify 함수 응답 기본값 — cache-control 이 없으면 no-cache */
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

/* ── 정적 사이트 (Netlify 규칙 재현) ─────────────────────────── */
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
      const pr = await realFetch(new Request(withQuery(rule.to, url.search), req));
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
    const mig = await migrateRoute(req, env, ctx, { opsAuth, makeContext });
    if (mig) return mig;
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
    env = await withConfig(env);          /* Netlify 에서 옮겨 온 설정값 + 대시보드 값 */
    boot(env);
    const req = trustedRequest(request, env);
    const u = new URL(req.url);
    /* http → https (Netlify 와 같은 동작) */
    if (u.protocol === 'http:' && selfHosts(env).has(u.host)) {
      u.protocol = 'https:';
      if (env.PRIMARY_HOST && selfHosts(env).has(u.host)) u.host = env.PRIMARY_HOST;
      return Response.redirect(u.toString(), 301);
    }
    /* www → 기본 도메인 (Netlify 의 도메인 별칭과 같은 동작) */
    if (env.PRIMARY_HOST && u.host !== env.PRIMARY_HOST && selfHosts(env).has(u.host)) {
      u.host = env.PRIMARY_HOST;
      return Response.redirect(u.toString(), 301);
    }
    return ALS.run({ env, ctx, host: u.host, hosts: selfHosts(env) }, async () => {
      try {
        const t0 = env.DEBUG_TIMING ? Date.now() : 0;
        let res = await dispatch(req, env, ctx);
        if (t0) console.log('[timing]', req.method, u.pathname, res.status, (Date.now() - t0) + 'ms');
        if (!res.headers.has('strict-transport-security')) {          /* Netlify 처럼 모든 응답에 HSTS */
          res = new Response(res.body, res); res.headers.set('strict-transport-security', DEFAULT_HSTS);
        }
        return res;
      }
      catch (e) {
        console.error('[worker]', e && e.stack || e);
        return new Response('일시적인 오류입니다. 잠시 뒤 다시 시도해 주세요.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
      }
    });
  },

  /* 예약 함수 — Netlify schedule 과 같은 cron 식(UTC) */
  async scheduled(event, env, ctx) {
    bindBlobs(env.BLOBS);
    env = await withConfig(env);
    boot(env);
    /* 전환 전(시험 기간)에는 예약 작업을 돌리지 않는다 — Netlify 와 메일·동기화가 겹치지 않게.
       도메인을 옮긴 뒤 대시보드 변수 CRON_ENABLED = 1 을 넣으면 켜진다 */
    if (String(env.CRON_ENABLED || '') !== '1') { console.log('[cron] CRON_ENABLED 아님 — 건너뜀:', event.cron); return; }
    const job = CRON.get(event.cron);
    if (!job) { console.warn('[cron] 연결된 함수 없음:', event.cron); return; }
    const site = env.URL || 'https://monnit.co.kr';
    const req = new Request(site + '/.netlify/functions/' + job.name, { method: 'POST', body: JSON.stringify({ next_run: new Date(event.scheduledTime).toISOString() }) });
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
