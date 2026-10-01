/* 맞춤 제안서 — 로컬 개발 서버 (저장소는 메모리, 메일은 콘솔 출력)
   실행: node tools/proposal-dev.mjs  →  http://localhost:8788/proposal
   관리 화면: http://localhost:8788/ops/proposals  (키: dev)
   사이트는 Netlify 처럼 서빙한다 — 파일 → 폴더/index.html → 확장자 없는 경로는 index.html(SPA)
   빌드 결과로 보려면: node build.js 뒤 실행 (SITE_ROOT=다른폴더 로 바꿀 수 있음)
   PROPOSAL_INSTANT_SECONDS=20 node tools/proposal-dev.mjs  처럼 즉시 발송 연출 시간을 줄일 수 있다. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ROOT = path.resolve(process.env.SITE_ROOT || ROOT);
const PORT = Number(process.env.PORT || 8788);
globalThis.__PROPOSAL_MEM = {};
process.env.PROPOSAL_ADMIN_KEY ||= 'dev';
process.env.PROPOSAL_SECRET ||= 'dev-secret';
process.env.PROPOSAL_SITE ||= `http://localhost:${PORT}`;
process.env.BREVO_API_KEY ||= 'dev-console';

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('api.brevo.com') && process.env.BREVO_API_KEY === 'dev-console') {
    const b = JSON.parse(opt.body);
    console.log(`[메일] → ${b.to.map(t => t.email).join(', ')} | ${b.subject}${b.attachment ? ' (첨부)' : ''}`);
    return new Response(JSON.stringify({ messageId: 'dev' }), { status: 201 });
  }
  if (/staticforms|web3forms/.test(url)) return new Response('{"success":true}', { status: 200 });
  if (url.includes('proposal-build-background')) {
    const B = await import('../netlify/functions/proposal-build-background.mjs');
    setTimeout(() => B.default(new Request(url, { method: 'POST', headers: opt.headers, body: opt.body })), 10);
    return new Response(null, { status: 202 });
  }
  return realFetch(url, opt);
};

const API = (await import('../netlify/functions/proposal-api.mjs')).default;
const ADMIN = (await import('../netlify/functions/proposal-admin.mjs')).default;
const { tick } = await import('../netlify/lib/proposal/pipeline.mjs');
setInterval(() => tick({ origin: process.env.PROPOSAL_SITE }).then(r => { if (r.sent || r.failed || r.preview) console.log('[점검]', r); }), 15000);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  try {
    let fn = null;
    if (u.pathname.startsWith('/api/proposal')) fn = API;
    else if (u.pathname.startsWith('/ops/proposals')) fn = ADMIN;
    else if (u.pathname === '/api/lead') { res.writeHead(204); return res.end(); }
    if (fn) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const r = await fn(new Request(u, { method: req.method, headers: { ...req.headers, 'x-nf-client-connection-ip': '127.0.0.1' }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), { waitUntil: p => p });
      const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
      res.writeHead(r.status, h);
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let file = path.join(SITE_ROOT, decodeURIComponent(u.pathname));
    if (!file.startsWith(SITE_ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';   /* /visit → visit.html (Netlify 규칙과 같게) */
    if (!fs.existsSync(file)) {
      if (!path.extname(u.pathname) && !/^\/(assets|netlify|data)\//.test(u.pathname)) file = path.join(SITE_ROOT, 'index.html');   /* SPA 폴백 */
      else { res.writeHead(404); return res.end('404'); }
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log(`맞춤 제안서 개발 서버 → http://localhost:${PORT}/proposal  (관리: /ops/proposals, 키 ${process.env.PROPOSAL_ADMIN_KEY})`));
