/** 사이트 전체 IP 차단 + 방문 기록 — 엣지 함수 (2026-09-16)
 *
 *  ── 방문 기록 ────────────────────────────────────────────────────────
 *  페이지를 열 때마다 「누가(IP) · 언제 · 어느 페이지 · 어디서(지역) · 무슨 기기」를
 *  visits 저장소에 한 건씩 남긴다. 키는  YYYY-MM-DD/IP/시각  이다.
 *    · 읽지 않고 쓰기만 하므로 동시 접속에도 기록이 덮이지 않는다.
 *    · 검색엔진 로봇은 남기지 않는다(양만 많고 쓸모가 없다).
 *    · 이미지·스크립트 같은 정적 파일은 애초에 이 함수가 돌지 않는다.
 *    · 응답을 먼저 보내고 뒤에서 기록한다(waitUntil) — 페이지 속도에 영향 없음.
 *    · 끄려면 Netlify 환경변수 VISIT_LOG=off
 *  보관은 90일. 조회·정리는 /ops/block 과 /api/block 이 한다.
 *
 *  ── 사이트 전체 IP 차단 ─────────────────────────────────────────────
 *
 *  차단 목록에 「사이트 전체(scope=site)」로 올라간 IP 는 어떤 페이지도 열 수 없다.
 *  목록은 netlify/functions/_guard.js 와 같은 곳을 읽는다.
 *    · 환경변수 BLOCK_IPS (쉼표 구분)
 *    · ops 저장소 blocklist.json  (/ops/block 화면에서 관리, 1분 안에 반영)
 *
 *  안전장치
 *    · 이 함수가 어떤 이유로든 오류를 내면 그냥 통과시킨다 (onError: bypass).
 *      차단 기능이 고장 나서 사이트 전체가 멈추는 일은 없다.
 *    · /ops 관제 화면은 제외한다. 실수로 우리 IP 를 넣어도 풀 수 있어야 한다.
 *    · 이미지·스크립트·글꼴 같은 정적 파일은 검사하지 않는다(호출량 절약).
 *      페이지 자체가 막히므로 의미가 없다. */
import { getStore } from "@netlify/blobs";

const CACHE_MS = 60 * 1000;
let cache = null, cacheAt = 0;

/* 검색엔진·미리보기 로봇 — 기록하지 않는다.
   curl·python 같은 수집 스크립트는 경쟁사가 쓸 수 있으므로 일부러 남긴다. */
const BOTS = /googlebot|bingbot|yeti|daumoa|duckduckbot|baiduspider|yandex|applebot|facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|slackbot|kakaotalk-scrap|slurp|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-searchbot|ccbot|perplexity|amazonbot|seznambot|uptimerobot|pingdom|netlify/i;

const kday = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const ipKey = (ip) => String(ip).toLowerCase().replace(/[^0-9a-f.]/g, "_");

async function logVisit(request, context, ip, blocked) {
  try {
    if ((globalThis.Netlify && Netlify.env.get("VISIT_LOG")) === "off") return;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    const accept = request.headers.get("accept") || "";
    const isPdf = /\.pdf$/i.test(url.pathname);
    if (!accept.includes("text/html") && !isPdf) return;          /* 페이지·PDF 만 */
    if (request.headers.get("purpose") === "prefetch" || request.headers.get("sec-purpose")) return;
    const ua = request.headers.get("user-agent") || "";
    if (BOTS.test(ua)) return;
    const now = new Date();
    const key = kday(now) + "/" + ipKey(ip) + "/" + now.getTime() + "-" + Math.random().toString(36).slice(2, 6);
    const g = context.geo || {};
    await getStore("visits").setJSON(key, {
      ip,
      p: (url.pathname + url.search).slice(0, 240),
      ref: (request.headers.get("referer") || "").slice(0, 240),
      ua: ua.slice(0, 180),
      lang: (request.headers.get("accept-language") || "").slice(0, 30),
      c: (g.country && g.country.code) || "",
      r: (g.subdivision && g.subdivision.name) || "",
      city: g.city || "",
      b: blocked ? 1 : 0
    });
  } catch (e) { /* 기록 실패는 무시 */ }
}
function later(context, p) {
  if (context && typeof context.waitUntil === "function") context.waitUntil(p);
  else p.catch(() => {});
}

function v4int(ip) {
  const p = String(ip).split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) { if (!/^\d{1,3}$/.test(x) || Number(x) > 255) return null; n = n * 256 + Number(x); }
  return n;
}
function ipMatch(ip, rule) {
  ip = String(ip || "").trim().toLowerCase(); rule = String(rule || "").trim().toLowerCase();
  if (!ip || !rule) return false;
  if (ip === rule) return true;
  if (rule.endsWith("*")) return ip.startsWith(rule.slice(0, -1));
  const m = /^([\d.]+)\/(\d{1,2})$/.exec(rule);
  if (m) {
    const a = v4int(ip), b = v4int(m[1]), bits = Number(m[2]);
    if (a == null || b == null || bits > 32) return false;
    if (bits === 0) return true;
    const div = Math.pow(2, 32 - bits);
    return Math.floor(a / div) === Math.floor(b / div);
  }
  return false;
}

async function siteRules() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const env = String((globalThis.Netlify && Netlify.env.get("BLOCK_IPS")) || "")
    .split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  let stored = [];
  try {
    const raw = await getStore("ops").get("blocklist.json", { type: "text" });
    const o = raw ? JSON.parse(raw) : null;
    const now = Date.now();
    stored = ((o && Array.isArray(o.ips)) ? o.ips : [])
      .filter((x) => x && x.v && (x.scope || "site") === "site" && (!x.until || x.until > now))
      .map((x) => x.v);
  } catch (e) { /* 저장소를 못 읽으면 환경변수만 쓴다 */ }
  cache = [...env, ...stored];
  cacheAt = Date.now();
  return cache;
}

const PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>접근 제한</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0B1220;color:#A6B3CC;font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-size:14px;padding:20px}</style>
</head><body><p>요청하신 페이지에 접근할 수 없습니다.</p></body></html>`;

export default async (request, context) => {
  const ip = context.ip || "";
  if (!ip) return;
  const list = await siteRules();
  for (const r of list) {
    if (ipMatch(ip, r)) {
      later(context, logVisit(request, context, ip, true));
      return new Response(PAGE, {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" }
      });
    }
  }
  later(context, logVisit(request, context, ip, false));
  return;   /* 통과 */
};

export const config = {
  path: "/*",
  excludedPath: [
    "/ops", "/ops/*",
    "/images/*", "/email/images/*", "/js/*", "/fonts/*", "/assets/*",
    /* 맞춤 제안서 진행 화면이 몇 초마다 부르는 읽기 전용 API — 방문 기록이 부풀지 않게 (2026-09-17).
       접수(POST /api/proposal)는 그대로 검사한다. 함수 안의 _guard 도 한 번 더 막는다. */
    "/api/proposal/status", "/api/proposal/preview", "/api/proposal/detect",
    "/*.css", "/*.js", "/*.mjs", "/*.webp", "/*.png", "/*.jpg", "/*.jpeg", "/*.gif", "/*.svg",
    "/*.ico", "/*.woff", "/*.woff2", "/*.map", "/*.txt", "/*.xml"
  ],
  onError: "bypass"
};
