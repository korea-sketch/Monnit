/* IoT몰 단일 파일 빌드 — 서버 없이 더블클릭·미리보기로 바로 열리는 mall-standalone.html
   실행: node tools/mall/standalone.mjs  →  dist-mall/mall-standalone.html
   · CSS·JS·제품 데이터·이미지를 모두 한 파일 안에 넣는다(외부는 Pretendard 글꼴 CDN 하나).
   · 화면 이동은 #/mall/... 해시 주소로 동작한다(js/mall.js 의 HASHMODE).
   · 견적 요청은 monnit.co.kr/api/lead 로 보내고, 막히면 메일 앱(1015@monnit.com)으로 넘긴다. */
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };
const dataUri = (u) => { const f = path.join(ROOT, u.replace(/^\//, "")); if (!fs.existsSync(f)) return null; return `data:${MIME[path.extname(f).toLowerCase()] || "application/octet-stream"};base64,${fs.readFileSync(f).toString("base64")}`; };

const js = rd("js/mall.js");
const assets = {};
const want = new Set(["/logo.png"]);
for (const m of js.matchAll(/["'`](\/images\/[^"'`$]+\.(?:png|webp|jpe?g))["'`]/g)) want.add(m[1]);
const logos = (js.match(/LOGOS = \[([^\]]*)\]/) || [, ""])[1].match(/"([^"]+)"/g) || [];
logos.forEach((l) => want.add(`/images/clogo-${l.replace(/"/g, "")}.png`));
fs.readdirSync(path.join(ROOT, "images/mall/products")).filter((f) => f.endsWith(".png")).forEach((f) => want.add("/images/mall/products/" + f));
fs.readdirSync(path.join(ROOT, "images/mall/res")).filter((f) => f.endsWith(".png")).forEach((f) => want.add("/images/mall/res/" + f));
for (const u of want) { const d = dataUri(u); if (d) assets[u] = d; }

let html = rd("mall.html");
const css = rd("css/mall.css");
html = html
  .replace(/<link rel="canonical"[^>]*>\n?/, "")
  /* 모니 챗봇은 사이트 API 가 있어야 동작한다 — 단일 파일에서는 뺀다 */
  .replace(/<link rel="stylesheet" href="\/css\/moni\.css[^"]*">\n?/, "")
  .replace(/<!-- 모니 챗봇[\s\S]*?<\/script>\n<script>addEventListener\("load"[\s\S]*?<\/script>\n?/, "")
  .replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>\n?/g, "")
  .replace(/<link rel="stylesheet" href="\/fonts\/[^"]*">/, '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">')
  .replace(/<link rel="stylesheet" href="\/css\/mall\.css[^"]*">/, () => `<style>\n${css}\n</style>`)
  .replace(/<img src="\/logo\.png"/g, () => `<img src="${assets["/logo.png"] || ""}"`)
  .replace(/<script src="\/js\/store-data\.js[^"]*"><\/script>/, () => `<script>window.__MALL_STANDALONE = true; window.__MALL_API = "https://monnit.co.kr"; window.__MALL_ASSETS = ${JSON.stringify(assets)};</script>\n<script>\n${rd("js/store-data.js")}\n</script>`)
  .replace(/<script src="\/js\/mall-i18n\.js[^"]*"><\/script>/, () => `<script>\n${rd("js/mall-en.js")}\n${rd("js/mall-i18n.js").replace(/<\/script/gi, "<\\/script")}\n</script>`)
  .replace(/<script src="\/js\/mall\.js[^"]*"><\/script>/, () => `<script>\n${js.replace(/<\/script/gi, "<\\/script")}\n</script>`);
/* 머리·꼬리의 사이트 링크(/who-we-are 등)는 mall.js 가 monnit.co.kr 새 창으로 연다 */
const out = path.join(ROOT, "dist-mall");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "mall-standalone.html"), html);
console.log("dist-mall/mall-standalone.html —", (Buffer.byteLength(html) / 1024 / 1024).toFixed(2), "MB · 이미지", Object.keys(assets).length, "개");
