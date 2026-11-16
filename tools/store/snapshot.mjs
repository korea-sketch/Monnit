/* 제품몰(/store) 기본 데이터 스냅샷 — app.js 의 기본 제품·적용분야 배열을 js/store-data.js 로 뽑는다.
   실행: node tools/store/snapshot.mjs   (구글 시트 Products·Applications 탭이 있으면 화면이 실시간으로 덮어씀) */
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const APPJS = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
function extract(decl) {
  const i = APPJS.indexOf(decl); if (i < 0) return null;
  let j = APPJS.indexOf("=", i) + 1; while (/\s/.test(APPJS[j])) j++;
  const open = APPJS[j], close = open === "[" ? "]" : "}";
  let depth = 0, inStr = false, strCh = "", esc = false, k = j;
  for (; k < APPJS.length; k++) {
    const c = APPJS[k];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === strCh) inStr = false; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
    if (c === "/" && APPJS[k + 1] === "*") { k = APPJS.indexOf("*/", k) + 1; continue; }
    if (c === open) depth++; else if (c === close) { depth--; if (depth === 0) { k++; break; } }
  }
  return (new Function("return (" + APPJS.slice(j, k) + ")"))();
}
const products = extract("var PRODUCTS =");
const apps = (extract("let APPS =") || []).map(({ id, name, cat, desc, sensors, popularity, isNew }) => ({ id, name, cat, desc, sensors, popularity, isNew }));
const cats = (extract("var PRODUCT_CATS =") || []).map(({ id, ko, color }) => ({ id, ko, color }));
const groups = extract("var SENSOR_GROUPS =");
const icons = extract("var PROD_SVG =") || {};
const rules = (extract("var PROD_ICON_RULES =") || []).map(([re, k]) => [re.source, re.flags, k]);
const out = `/* 자동 생성 — node tools/store/snapshot.mjs (${new Date().toISOString().slice(0, 10)}) · 직접 고치지 마세요 */\nwindow.__STORE_DATA = ${JSON.stringify({ products, apps, cats, groups, icons, rules })};\n`;
fs.writeFileSync(path.join(ROOT, "js/store-data.js"), out);
console.log("store-data.js —", products.length, "products ·", apps.length, "apps");
