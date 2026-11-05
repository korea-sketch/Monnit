/* 모넷 IoT몰 (/mall) — 2026-11-04
   · 기업 구매형 견적몰. 가격은 공개하지 않고, 온라인 결제도 하지 않는다 — 견적함 → 견적 요청서 → 공식 견적서(담당자 회신).
   · 접수는 사이트의 다른 문의와 같은 /api/lead (리드 원장 · 1015@ 장일호 팀장 + 대표님 · 먼데이).
   · 데이터: js/store-data.js (제품몰 /store 와 같은 원본). 구글 시트 Products·Applications 탭이 있으면 덮어씀(/api/sheets).
   · 화면 이동은 주소(/mall/...)로 — _redirects 에서 /mall/* 를 mall.html 로 돌려준다. */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const D = window.__STORE_DATA || { products: [], apps: [], cats: [], groups: [], icons: {}, rules: [] };
const LS = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const view = $("#view");

/* ───────── 데이터 ───────── */
let P = [], APPS = D.apps || [];
const CATS = D.cats || [], GROUPS = D.groups || [];
const CAT_KO = { sensors: "무선 센서", gateways: "게이트웨이", software: "플랫폼·소프트웨어", accessories: "액세서리" };
const CAT_DESC = { sensors: "온도·습도·누수·진동·전력·가스 등 80여 종 — 배터리 무선, 배선 공사 없이 설치", gateways: "센서 데이터를 플랫폼으로 — 이더넷·셀룰러·Modbus", software: "알림·대시보드·데이터 관리 — 클라우드·온프레미스", accessories: "설치 진단·현장 경보·원격 제어" };
const HUE = { temperature: "red", humid: "blue", humidity: "blue", water: "blue", vibration: "violet", electrical: "amber", power: "amber", motion: "cyan", door: "green", contact: "green", gas: "teal", air: "teal", pressure: "violet", soil: "green", vehicle: "blue", control: "cyan", button: "pink", light: "amber", tilt: "violet", resistance: "amber", pulse: "cyan", software: "violet", cloud: "cyan", server: "blue", signal: "cyan", alarm: "pink", battery: "green", gateway: "blue", edge: "violet", sensor: "cyan" };
const CODE_RULES = [[/온도|열전대/, ["TEMP", "ULT TEMP"]], [/습도/, ["HUMID"]], [/누수/, ["WATER"]], [/차압/, ["DP"]], [/이산화탄소|CO2/, ["CO₂"]], [/공기질/, ["AIR", "VOC"]], [/진동|가속도/, ["VIB"]], [/전류/, ["CURRENT"]], [/모션|점유/, ["MOTION", "OCC"]], [/개폐|도어/, ["DOOR"]], [/압력계/, ["PRESSURE"]], [/VDC|VAC|전압/, ["VOLTAGE"]], [/조도/, ["LIGHT"]]];
const RULES = (D.rules || []).map(([s, f, k]) => [new RegExp(s, f), k]);
const FACTS = {
  sensors: [["무선 940MHz", "국내 주파수 · 배선 공사 없이 설치"], ["내구연한 15년", "산업 현장 장기 운용"], ["알림", "문자·이메일·웹/모바일 대시보드"], ["구성", "센서 → IoT 게이트웨이 → 플랫폼"]],
  gateways: [["센서 250개", "게이트웨이 1대 반경 내 매핑"], ["정전 시 2~3일", "내장 배터리로 자립 작동"], ["내구연한 15년", "산업 현장 장기 운용"], ["플랫폼 연동", "iMonnit · iMonnit Scube 전용 플랫폼"]],
  software: [["알림", "문자·이메일·웹/모바일 대시보드"], ["Open API", "Webhook API · MQTT (iMonnit)"], ["전용 플랫폼", "iMonnit Scube 전용 플랫폼"], ["구독", "연 단위 구독 — 견적 안내"]],
  accessories: [["ALTA 호환", "모넷 무선 센서·게이트웨이와 함께 사용"], ["설치 상담", "현장 조건에 맞춰 구성 안내"]],
};
/* 추천 패키지 — 기본 수량은 예시이며 견적 때 현장에 맞춰 조정한다 */
const PACKS = [
  { id: "cold", name: "냉장·냉동 온도 기록 패키지", for: "식품 공장 · 물류센터 · 약국", desc: "냉장·냉동 창고 온도를 자동 기록하고 이탈 시 즉시 알림. HACCP 기록 관리에.", img: "/images/why-roll-05-fridge-720.webp", items: [["온도", 10], ["이더넷 게이트웨이", 1], ["iMonnit 클라우드 관리 SW", 1]] },
  { id: "server", name: "서버룸·전산실 환경 패키지", for: "데이터센터 · 통신실 · 전산실", desc: "온도·습도·누수를 한 화면에서. 야간·주말 무인 시간대 사고를 막습니다.", img: "/images/why-roll-02-ups-720.webp", items: [["온도", 4], ["습도", 2], ["누수 — 로프형", 2], ["이더넷 게이트웨이", 1], ["iMonnit 클라우드 관리 SW", 1]] },
  { id: "pdm", name: "설비 예지보전 패키지", for: "공장 모터 · 펌프 · 팬", desc: "진동과 전류로 설비 이상 징후를 미리 감지해 돌발 정지를 줄입니다.", img: "/images/why-roll-01-motor-720.webp", items: [["가속도·진동계", 6], ["3상 전류계", 2], ["이더넷 게이트웨이", 1], ["iMonnit 클라우드 관리 SW", 1]] },
  { id: "clean", name: "클린룸·제약 환경 패키지", for: "클린룸 · 제약 · 반도체", desc: "차압·온도·습도를 동시에 관리하고 기준 이탈 시 담당자에게 바로 알림.", img: "/images/temp-packages/cover-pharma-480.jpg", items: [["차압", 4], ["온도", 4], ["습도", 4], ["이더넷 게이트웨이", 1], ["iMonnit 클라우드 관리 SW", 1]] },
  { id: "building", name: "건물 무인 안전 패키지", for: "빌딩 · 학교 · 공공시설", desc: "누수·출입·설비 경보 접점을 감시하고 현장 경보기로 즉시 알립니다.", img: "/images/why-roll-03-crane-720.webp", items: [["누수 — 로프형", 4], ["개폐(도어)", 4], ["드라이컨택", 2], ["로컬 경보기", 1], ["이더넷 게이트웨이", 1], ["iMonnit 클라우드 관리 SW", 1]] },
  { id: "bms", name: "BMS·DDC 연동 패키지", for: "기존 BMS · BEMS · SCADA", desc: "무선 센서 값을 Modbus로 기존 관제 시스템에 그대로 연결합니다.", img: "/images/promo-modbus.webp", items: [["온도", 6], ["습도", 2], ["시리얼 Modbus 게이트웨이", 1]] },
];
const BANNERS = [
  { href: "/promo/alarm", img: "/images/promo-alarm.webp", tag: "구독형 · 설치비 무료", title: "긴급 경보 알리미", sub: "화재·누수·정전·설비 경보를 휴대폰으로 — 월 구독" },
  { href: "/promo/modbus", img: "/images/promo-modbus.webp", tag: "BMS 연동", title: "Modbus 연동 무선 센서", sub: "기존 DDC·BEMS에 무선 센서를 그대로" },
  { href: "/promo/remote", img: "/images/promo-remote.webp", tag: "통합관제", title: "여러 현장을 한 화면에서", sub: "원격 통합관제 — 다현장 운영 조직용" },
];
const LOGOS = ["samsung", "lg-elec", "hyundai", "sk-hynix", "lotte", "naver", "kakao", "samsung-bio", "gc", "pulmuone", "kaist", "etri", "hdc", "hanwha-energy", "veolia", "usfk"];
const TIERS = [
  { id: "welcome", name: "웰컴", color: "#86868b", cond: "가입하시는 즉시", perks: ["견적 영업일 1일 내 회신", "데이터시트·설치 가이드 바로 받기", "신제품·기획전 소식"] },
  { id: "silver", name: "실버", color: "#9aa7b8", cond: "첫 거래를 마치신 고객사", perks: ["견적 우선 회신", "회원 전용 기획전 가격 안내", "설치 후 원격 점검 1회"] },
  { id: "gold", name: "골드", color: "#c9a227", cond: "꾸준히 함께해 주시는 고객사", perks: ["전담 담당자 배정", "프로젝트 단가 협의", "데모 키트 대여 상담"] },
  { id: "partner", name: "파트너", color: "#2f7bff", cond: "SI·설치 파트너사", perks: ["파트너 단가", "기술 교육·인증", "공동 제안·영업 지원"] },
];

function slugOf(p, i) { return (p.c + "-" + (p.n || "").replace(/[^\w가-힣]+/g, "-").replace(/^-|-$/g, "")).toLowerCase() || "p" + i; }
function iconKey(p) { const hay = (p.n || "") + " " + (p.g || "") + " " + p.c; for (const [re, k] of RULES) if (re.test(hay)) return k; return p.c === "software" ? "software" : p.c === "gateways" ? "gateway" : p.c === "accessories" ? "control" : "sensor"; }
/* 제품 사진 (Monnit 공식 이미지 → 배경 제거 PNG, /images/mall/products) — 이름이 없으면 아이콘으로 */
const IMG = {"온도":"p00","습도":"p01","공기질":"p02","풍속":"p03","차압":"p04","토양 수분":"p05","조도 (Lux)":"p06","조도 (PAR·광합성)":"p07","AC 전류계":"p08","3상 전류계":"p09","200VDC 미터":"p10","200VDC 감지":"p11","500VAC 미터":"p12","500VAC 감지":"p13","모션·점유":"p14","개폐(도어)":"p15","버튼":"p16","차량 감지":"p17","가속도·진동계":"p18","열전대":"p19","저항":"p20","누수 — 로프형":"p21","누수 — 프로브형(Detect+)":"p22","누수 — 퍽형(디스크)":"p23","누수 — 전선형(Detect)":"p24","압력계":"p25","초음파 거리":"p26","프로판 탱크":"p27","일산화탄소(CO)":"p28","이산화탄소(CO2)":"p29","황화수소(H2S)":"p30","드라이컨택":"p31","5채널 드라이컨택":"p32","0-5VDC":"p33","0-10VDC":"p34","0-20mA":"p35","저항 브리지":"p36","펄스 카운터 — 싱글":"p37","펄스 카운터 — 듀얼":"p38","북미 IoT 셀룰러 게이트웨이":"p39","인터내셔널 셀룰러 게이트웨이":"p40","이더넷 게이트웨이":"p41","시리얼 Modbus 게이트웨이":"p42","센서 어댑터 (USB)":"p43","iMonnit 클라우드 관리 SW":"p44","iMonnit Express 독립형 SW":"p45","온프레미스 엔터프라이즈":"p46","Monnit Mine":"p47","사이트 서베이 툴":"p48","컨트롤 유닛":"p49","로컬 경보기":"p50"};
const imgOf = (p) => IMG[p.n] ? ASSET(`/images/mall/products/${IMG[p.n]}.png`) : "";
function svgIco(p, cls = "") { const k = iconKey(p); return `<span class="m-ico h-${HUE[k] || "cyan"} ${cls}"><svg viewBox="0 0 24 24">${(D.icons || {})[k] || (D.icons || {}).sensor || ""}</svg></span>`; }
function ico(p, cls = "") {
  const src = imgOf(p); if (!src) return svgIco(p, cls);
  return `<span class="m-ph ${cls.replace(/m-ico--/g, "m-ph--")}${p.c === "software" ? " m-ph--shot" : ""}"><img src="${src}" alt="${esc(p.n)}" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('is-err')"></span>`;
}
function appsOf(p) {
  if (p.c === "gateways" || p.c === "software") return APPS.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 8);
  const codes = []; for (const [re, cs] of CODE_RULES) if (re.test(p.n)) codes.push(...cs);
  return APPS.filter((a) => codes.some((c) => String(a.sensors || "").split(/\s*·\s*/).includes(c))).sort((a, b) => b.popularity - a.popularity);
}
function prodsOfApp(a) { const codes = String(a.sensors || "").split(/\s*·\s*/); return P.filter((p) => p.c === "sensors" && CODE_RULES.some(([re, cs]) => re.test(p.n) && cs.some((c) => codes.includes(c)))); }
const grpName = (id) => (GROUPS.find((g) => g.id === id) || {}).ko || "";
const catLine = (p) => CAT_KO[p.c] + (p.g ? " · " + grpName(p.g) : "");
const byName = (n) => P.find((p) => p.n === n);
function prep(list) {
  P = list.map((p, i) => ({ ...p, id: slugOf(p, i) }));
  P.forEach((p) => { const a = appsOf(p); p.score = p.c === "sensors" ? (a[0] ? a[0].popularity : 0) + a.length * 3 : p.c === "gateways" ? 95 : 40; });
  /* 베스트셀러 — 모넷코리아 실제 판매 상위 5종 (2026-11-05 지시). 나머지는 BEST 표시 없음 */
  P.forEach((p) => { const r = BEST.findIndex((b) => b.n === p.n); p.hot = r >= 0; p.rank = r >= 0 ? r + 1 : 0; if (r >= 0) p.score += 1000 - r * 10; });
}
const BEST = [
  { n: "온도", label: "온도 센서", why: "냉장·냉동 · 서버실 · 공정 온도" },
  { n: "누수 — 전선형(Detect)", label: "물감지 센서", why: "기계실 · 배관 · 공조기 누수" },
  { n: "드라이컨택", label: "드라이컨택 센서", why: "기존 설비 경보 접점 · 정전 · 펌프" },
  { n: "가속도·진동계", label: "정밀 진동 센서", why: "모터 · 펌프 · 팬 예지보전" },
  { n: "습도", label: "습도 센서", why: "보관실 · 클린룸 · 데이터센터" },
];
/* ── 필수 구성 (2026-11-05 지시) ─────────────────────────────────────
   ALTA 센서는 ALTA 게이트웨이와만 통신하고, 데이터는 플랫폼(라이선스)으로 본다.
   센서를 담으면 게이트웨이 1종 + 플랫폼 라이선스 1종이 반드시 함께 들어가고, 견적함·요청서에서 항상 맨 위에 보인다. */
const REQ_GW = [
  { n: "이더넷 게이트웨이", label: "이더넷 게이트웨이", sub: "사내 인터넷(LAN)에 연결 · 가장 많이 선택" },
  { n: "북미 IoT 셀룰러 게이트웨이", label: "IoT 게이트웨이 (LTE + 이더넷)", sub: "인터넷선이 없는 현장 · LTE 통신 겸용" },
];
const REQ_SW = [
  { n: "iMonnit 클라우드 관리 SW", label: "iMonnit 클라우드 라이선스", sub: "웹·모바일 대시보드 · 문자·이메일 알림 · 가장 많이 선택" },
  { n: "iMonnit Express 독립형 SW", label: "iMonnit Express (PC 설치형)", sub: "외부 인터넷 없이 사내 PC에서 운영" },
  { n: "온프레미스 엔터프라이즈", label: "엔터프라이즈 (자체 서버)", sub: "자체 서버 · 대규모 · 보안 정책 현장" },
];
const needsReq = () => CART.some((c) => { const p = P.find((x) => x.id === c.id); return p && p.c === "sensors"; });
const cartHas = (cat) => CART.some((c) => { const p = P.find((x) => x.id === c.id); return p && p.c === cat; });
const isReqItem = (p) => p && (p.c === "gateways" || p.c === "software");
/** 센서가 있는데 게이트웨이·라이선스가 없으면 기본값을 넣는다. 넣었으면 true */
function ensureReq() {
  if (!needsReq()) return false;
  let added = false;
  if (!cartHas("gateways")) { const g = byName(REQ_GW[0].n); if (g) { CART.unshift({ id: g.id, qty: 1 }); added = true; } }
  if (!cartHas("software")) { const w = byName(REQ_SW[0].n); if (w) { CART.splice(1, 0, { id: w.id, qty: 1 }); added = true; } }
  if (added) saveCart();
  return added;
}
/** 필수 구성 종류 바꾸기 (같은 칸 안에서 하나만) */
function swapReq(list, n) {
  const want = byName(n); if (!want) return;
  const names = list.map((x) => x.n);
  const cur = CART.find((c) => { const p = P.find((x) => x.id === c.id); return p && names.includes(p.n); });
  const qty = cur ? cur.qty : 1;
  CART = CART.filter((c) => { const p = P.find((x) => x.id === c.id); return !(p && names.includes(p.n)); });
  CART.unshift({ id: want.id, qty });
  saveCart();
}
/* 시스템 구성 안내 — 홈 · 상세 · 견적함 공용 */
function sysHTML(mode) {
  const s = byName("온도"), g = byName("이더넷 게이트웨이"), w = byName("iMonnit 클라우드 관리 SW");
  return `<section class="m-sys${mode === "mini" ? " m-sys--mini" : ""}">
    <div class="m-sys__hd"><span>꼭 알아 두세요</span><h2>모넷 무선 시스템은 <b>센서 + 게이트웨이 + 플랫폼 라이선스</b>가 한 세트입니다</h2></div>
    <ol class="m-sys__flow">
      <li>${s ? ico(s, "m-ico--md") : ""}<b>① ALTA 무선 센서</b><span>현장 값을 측정해 무선(940MHz)으로 보냅니다</span></li>
      <li>${g ? ico(g, "m-ico--md") : ""}<b>② ALTA 게이트웨이 <em>필수</em></b><span>센서 신호를 받아 인터넷으로 올립니다 · 1대에 센서 최대 250개</span></li>
      <li>${w ? ico(w, "m-ico--md") : ""}<b>③ 플랫폼 라이선스 <em>필수</em></b><span>대시보드에서 데이터를 보고 문자·이메일 알림을 받습니다</span></li>
    </ol>
    ${mode === "mini" ? "" : `<ul class="m-sys__faq">
      <li><b>우리 회사 게이트웨이(타사 제품)에 센서만 붙일 수 있나요?</b><span>아니요. ALTA 센서는 전용 무선 방식이라 <b>ALTA 게이트웨이와만 통신</b>합니다. 타사 게이트웨이·Wi-Fi 공유기와는 직접 연결되지 않습니다.</span></li>
      <li><b>ALTA 게이트웨이에 다른 회사 센서를 연결할 수 있나요?</b><span>아니요. ALTA 게이트웨이는 <b>ALTA 센서 전용</b>입니다. 기존 BMS·SCADA와 데이터를 주고받는 것은 Modbus 게이트웨이나 API 연동으로 따로 구성합니다.</span></li>
      <li><b>라이선스는 왜 필요한가요?</b><span>게이트웨이가 올린 데이터를 보고, 기준을 넘으면 알림을 받는 곳이 플랫폼입니다. <b>라이선스가 없으면 측정값을 확인할 수 없습니다.</b> 클라우드 · PC 설치형 · 자체 서버 중 고르시면 됩니다.</span></li>
    </ul>`}
    <p class="m-sys__note">센서를 견적함에 담으면 게이트웨이와 플랫폼 라이선스가 <b>자동으로 함께 담깁니다.</b> 종류는 견적함에서 바꿀 수 있어요.</p>
  </section>`;
}
/* 센서를 처음 담았을 때 뜨는 필수 구성 안내 시트 */
function reqSheet() {
  let el = $("#reqSheet");
  if (!el) { el = document.createElement("div"); el.id = "reqSheet"; el.className = "m-req"; document.body.appendChild(el); }
  const curName = (list) => { const names = list.map((x) => x.n); const c = CART.find((c) => { const p = P.find((x) => x.id === c.id); return p && names.includes(p.n); }); const p = c && P.find((x) => x.id === c.id); return p ? p.n : list[0].n; };
  const opts = (list, key) => list.map((o) => { const p = byName(o.n); if (!p) return ""; return `<label class="m-req__opt"><input type="radio" name="${key}" value="${esc(o.n)}" ${curName(list) === o.n ? "checked" : ""}>${ico(p, "m-ico--sm")}<span><b>${esc(o.label)}</b><small>${esc(o.sub)}</small></span></label>`; }).join("");
  el.innerHTML = `<div class="m-req__scrim" data-reqclose></div><div class="m-req__box" role="dialog" aria-modal="true" aria-labelledby="reqT">
    <button class="m-x m-req__x" type="button" data-reqclose aria-label="닫기">×</button>
    <span class="m-req__eye">필수 구성이 함께 담겼어요</span>
    <h3 id="reqT">센서만으로는 데이터를 볼 수 없어요</h3>
    <p>ALTA 센서는 <b>ALTA 게이트웨이</b>와만 통신하고, 측정값은 <b>플랫폼 라이선스</b>로 확인합니다. 아래에서 현장에 맞는 종류를 골라 주세요.</p>
    <div class="m-req__grp"><h4>① 게이트웨이 <em>필수 · 1종</em></h4>${opts(REQ_GW, "rgw")}</div>
    <div class="m-req__grp"><h4>② 플랫폼 라이선스 <em>필수 · 1종</em></h4>${opts(REQ_SW, "rsw")}</div>
    <p class="m-req__warn">타사 게이트웨이에 ALTA 센서를 붙이거나, ALTA 게이트웨이에 타사 센서를 붙이는 것은 지원되지 않습니다.</p>
    <div class="m-req__btns"><button class="m-btn m-btn--line" type="button" data-reqclose>계속 둘러보기</button><a class="m-btn" href="/mall/cart" data-link data-reqgo>견적함 보기</a></div></div>`;
  el.hidden = false; requestAnimationFrame(() => el.classList.add("is-on"));
  el.onchange = (e) => { const r = e.target.closest("input[type=radio]"); if (!r) return; swapReq(r.name === "rgw" ? REQ_GW : REQ_SW, r.value); badge(); if (L().pathname === "/mall/cart") route(); };
  el.onclick = (e) => { if (e.target.closest("[data-reqclose],[data-reqgo]")) { el.classList.remove("is-on"); setTimeout(() => (el.hidden = true), 250); } };
}

/* 주소 — 서버(/mall/...)에서는 실제 경로, 파일로 열거나 미리보기에서는 #/mall/... 해시 경로로 동작 */
const HASHMODE = !!window.__MALL_STANDALONE || !/^https?:$/.test(location.protocol);
const BASE = window.__MALL_BASE || "";
const ASSET = (u) => (window.__MALL_ASSETS && window.__MALL_ASSETS[u]) || BASE + u;
let CUR = "";   /* 해시를 바꿀 수 없는 미리보기 창(샌드박스)에서도 화면 이동이 되게 메모리에 현재 주소를 둔다 */
function L() {
  if (!HASHMODE) return { pathname: location.pathname, search: location.search, hash: location.hash };
  const h = CUR || location.hash.replace(/^#/, "") || "/mall"; const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(h) || [];
  return { pathname: m[1] || "/mall", search: m[2] || "", hash: m[3] || "" };
}
/* ───────── 상태 ───────── */
let CART = LS.get("mnkQuoteCart", []);           // 제품몰(/store)과 같은 견적함
let FAV = LS.get("mnkFav", []), RECENT = LS.get("mnkRecent", []), CMP = LS.get("mnkCmp", []);
let HIST = LS.get("mnkMallQuotes", []);
let ME = null;
const saveCart = () => { LS.set("mnkQuoteCart", CART); badge(); };
function badge() { const n = CART.reduce((a, c) => a + c.qty, 0); $("#cartN").hidden = !n; $("#cartN").textContent = n; const t = $("#tabCartN"); if (t) { t.hidden = !n; t.textContent = n > 99 ? "99+" : n; } }
function toast(t, p) {
  const el = $("#toast"); const src = p && imgOf(p);
  el.innerHTML = (src ? `<img src="${src}" alt="">` : "") + `<span>${esc(t)}</span>` + (p ? `<a href="/mall/cart" data-link>견적함 보기</a>` : "");
  el.classList.toggle("has-act", !!p); el.classList.add("is-on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("is-on"), p ? 3400 : 2600);
}
function add(id, qty = 1, quiet) {
  const it = CART.find((c) => c.id === id);
  if (it) it.qty = Math.min(9999, it.qty + qty); else CART.push({ id, qty: Math.max(1, Math.min(9999, qty)) });
  { const pa = P.find((x) => x.id === id); if (pa) evc("a", pa.n, 1); }
  saveCart();
  const reqAdded = ensureReq();
  if (reqAdded && !quiet) setTimeout(reqSheet, 350);
  const b = $(".m-ic--cart"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
  if (!quiet) { const p = P.find((x) => x.id === id); toast(`${p ? p.n : "제품"} ${qty}개를 담았어요`, p); }
}
function toggleFav(id) { FAV = FAV.includes(id) ? FAV.filter((x) => x !== id) : [id, ...FAV].slice(0, 50); LS.set("mnkFav", FAV); toast(FAV.includes(id) ? "관심 상품에 담았어요" : "관심 상품에서 뺐어요"); }
function toggleCmp(id, on) {
  if (on && !CMP.includes(id)) { if (CMP.length >= 4) { toast("비교는 4개까지 할 수 있어요"); return false; } CMP.push(id); }
  if (!on) CMP = CMP.filter((x) => x !== id);
  LS.set("mnkCmp", CMP); cmpBar(); return true;
}
function cmpBar() { const n = CMP.length; $("#cmpBar").hidden = !n || L().pathname === "/mall/compare"; $("#cmpTxt").textContent = `비교함 ${n}/4 · ` + CMP.map((id) => (P.find((p) => p.id === id) || {}).n).filter(Boolean).join(", "); }

/* ───────── 공통 조각 ───────── */
function card(p, opt = {}) {
  const inCart = CART.some((c) => c.id === p.id);
  return `<article class="m-card" data-go="/mall/product/${esc(p.id)}">
    <div class="m-card__img">${ico(p, "m-ico--lg")}${p.hot ? '<span class="m-tag m-tag--blue">BEST</span>' : ""}${p.badge ? `<span class="m-tag">${esc(p.badge)}</span>` : ""}
      <button class="m-fav${FAV.includes(p.id) ? " is-on" : ""}" data-fav="${esc(p.id)}" type="button" aria-label="관심 상품">${FAV.includes(p.id) ? "♥" : "♡"}</button></div>
    <div class="m-card__body"><small>${esc(catLine(p))}</small><h3>${esc(p.n)}</h3><p>${esc(p.d)}</p></div>
    <div class="m-card__ft"><div class="m-price">견적가<small>재고 · 납기 확인 후 회신</small></div>
      <label class="m-chk" data-stop><input type="checkbox" data-cmp="${esc(p.id)}" ${CMP.includes(p.id) ? "checked" : ""}>비교</label>
      <button class="m-add${inCart ? " is-in" : ""}" data-add="${esc(p.id)}" type="button" aria-label="견적함 담기">${inCart ? "✓" : "＋"}</button></div>
  </article>`;
}
function row(p) {
  return `<article class="m-rowitem" data-go="/mall/product/${esc(p.id)}">${ico(p, "m-ico--md")}
    <div class="m-rowitem__body"><small>${esc(catLine(p))}</small><h3>${esc(p.n)}</h3><p>${esc(p.d)}</p>
      <div class="m-rowitem__apps">${appsOf(p).slice(0, 4).map((a) => `<span>${esc(a.name)}</span>`).join("")}</div></div>
    <div class="m-rowitem__side"><div class="m-price">견적가<small>재고 · 납기 확인 후 회신</small></div>
      <div class="m-rowitem__btns"><label class="m-chk" data-stop><input type="checkbox" data-cmp="${esc(p.id)}" ${CMP.includes(p.id) ? "checked" : ""}>비교</label>
      <button class="m-btn m-btn--sm m-btn--line" data-fav="${esc(p.id)}" type="button">${FAV.includes(p.id) ? "♥ 관심" : "♡ 관심"}</button>
      <button class="m-btn m-btn--sm" data-add="${esc(p.id)}" type="button">견적함 담기</button></div></div></article>`;
}
const crumbs = (list) => `<nav class="m-crumb" aria-label="현재 위치"><a href="/mall" data-link>홈</a>${list.map(([t, h]) => h ? ` › <a href="${h}" data-link>${esc(t)}</a>` : ` › <b>${esc(t)}</b>`).join("")}</nav>`;
const sec = (title, sub, inner, more) => `<section class="m-sec"><div class="m-sec__hd"><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ""}${more ? `<a href="${more}" data-link class="m-more">전체 보기 ›</a>` : ""}</div>${inner}</section>`;
function setTitle(t) { document.title = (t ? t + " | " : "") + "모넷 IoT몰 · 모넷코리아"; }

/* ───────── 화면: 홈 ───────── */
function vHome() {
  setTitle("");
  const best = P.filter((p) => p.hot);
  const rec = RECENT.map((id) => P.find((p) => p.id === id)).filter(Boolean).slice(0, 6);
  const bests = BEST.map((b) => ({ ...b, p: byName(b.n) })).filter((b) => b.p);
  return `<section class="m-bestband"><div class="m-in">
      <div class="m-bestband__hd"><span>MONNIT KOREA BEST SELLER</span><h1>현장에서 가장 많이 선택하는 센서</h1><p>모넷코리아 판매 상위 5종 — 담으시면 게이트웨이와 플랫폼 라이선스가 함께 담깁니다.</p></div>
      <div class="m-best5">${bests.map((b, i) => `<article class="m-best" data-go="/mall/product/${esc(b.p.id)}"><i class="m-best__rk">${i + 1}</i>${ico(b.p, "m-ico--lg")}<b>${esc(b.label)}</b><small>${esc(b.why)}</small>
        <button class="m-btn m-btn--sm m-btn--accent" type="button" data-add="${esc(b.p.id)}">견적함 담기</button></article>`).join("")}</div>
    </div></section>
    <div class="m-in">
      ${sec("업종별 추천 구성", "우리 현장과 비슷한 업종을 고르면 필요한 구성이 한 번에 — 게이트웨이·라이선스 포함", `<div class="m-inds m-inds--snap">${INDS.map(indCard).join("")}</div>`, "/mall/industry")}
      ${sysHTML()}
      <div class="m-quick3"><a href="/mall/quick" data-link><b>모델명으로 빠른 견적</b><span>구매 목록을 붙여 넣으면 한 번에 담아요 ›</span></a><a href="/mall/quote" data-link><b>구성 상담 요청</b><span>무엇이 필요한지 몰라도 현장만 알려 주세요 ›</span></a><a href="${ME && ME.member ? "/mall/my" : "/account?next=/mall"}" ${ME && ME.member ? "data-link" : ""}><b>${ME && ME.member ? esc(ME.member.email) + " 님" : "기업 구매 회원"}</b><span>${ME && ME.member ? tierOf().name + " 등급 혜택 보기 ›" : "로그인하면 견적 정보가 자동으로 채워져요 ›"}</span></a></div>
    </div>
    <section class="m-hero" hidden><div class="m-in m-hero__in">
      <div class="m-hero__main" id="slider">${BANNERS.map((b, i) => `<a class="m-slide${i ? "" : " is-on"}" href="${b.href}"><img src="${ASSET(b.img)}" alt="" ${i ? 'loading="lazy"' : ""}><div><span class="m-tag m-tag--w">${esc(b.tag)}</span><b>${esc(b.title)}</b><small>${esc(b.sub)}</small></div></a>`).join("")}
        <div class="m-dots">${BANNERS.map((_, i) => `<button type="button" data-slide="${i}" class="${i ? "" : "is-on"}" aria-label="${i + 1}번 배너"></button>`).join("")}</div></div>
      <aside class="m-hero__side"><div class="m-hello"><b>${ME && ME.member ? esc(ME.member.email) + " 님" : "기업 구매 회원이신가요?"}</b>
          <p>${ME && ME.member ? `<span class="m-grade" style="--g:${tierOf().color}">${tierOf().name}</span> 등급 혜택이 적용돼요.` : "로그인하면 견적 정보가 자동으로 채워지고 등급 혜택이 적용돼요."}</p>
          <div class="m-hello__btns">${ME && ME.member ? `<a class="m-btn m-btn--sm" href="/mall/my" data-link>마이페이지</a>` : `<a class="m-btn m-btn--sm" href="/account?next=/mall">로그인 · 가입</a>`}<a class="m-btn m-btn--sm m-btn--line" href="/mall/cart" data-link>견적함 ${CART.length ? CART.length + "종" : ""}</a></div></div>
        <a class="m-sidebox" href="/mall/quick" data-link><b>모델명으로 빠른 견적</b><span>구매 목록을 붙여 넣으면 한 번에 담아요 ›</span></a>
        <a class="m-sidebox m-sidebox--navy" href="/mall/quote" data-link><b>구성 상담 요청</b><span>무엇이 필요한지 몰라도 현장만 알려 주세요 ›</span></a></aside>
    </div></section>
    <div class="m-in">
      <section class="m-quickcats">${[["sensors", "무선 센서", "온도"], ["gateways", "게이트웨이", "이더넷 게이트웨이"], ["software", "플랫폼·SW", "iMonnit 클라우드 관리 SW"], ["accessories", "액세서리", "로컬 경보기"]].map(([c, t, n]) => { const f = byName(n) || P.find((p) => p.c === c); return `<a href="/mall/category/${c}" data-link>${f ? ico(f) : ""}${t}<small>${P.filter((p) => p.c === c).length}종</small></a>`; }).join("")}
        ${GROUPS.slice(0, 6).map((g) => { const f = P.find((p) => p.g === g.id); return `<a href="/mall/category/sensors?g=${g.id}" data-link>${f ? ico(f) : ""}${esc(g.ko)}<small>${P.filter((p) => p.g === g.id).length}종</small></a>`; }).join("")}</section>
      <ul class="m-benefits"><li><b>공식 견적서</b>영업일 1일 회신</li><li><b>세금계산서</b>발행 · 지급 조건 협의</li><li><b>무선 940MHz</b>배선 공사 없이 설치</li><li><b>기본 보증 1년</b>설치 후 기술지원</li></ul>
      ${sec("현장별 추천 패키지", "자주 쓰는 구성을 한 번에 견적 — 수량은 견적 때 현장에 맞춰 조정", `<div class="m-packs">${PACKS.slice(0, 3).map(packCard).join("")}</div>`, "/mall/packages")}
      <section class="m-sec" id="events"><div class="m-sec__hd"><h2>기획전</h2><span>지금 문의가 많은 솔루션</span></div><div class="m-events">${BANNERS.map((b) => `<a href="${b.href}"><img src="${ASSET(b.img)}" alt="" loading="lazy"><div><span class="m-tag">${esc(b.tag)}</span><b>${esc(b.title)}</b><small>${esc(b.sub)}</small></div></a>`).join("")}</div></section>
      ${sec("산업별 솔루션", "현장에 맞는 센서를 용도로 찾기", `<div class="m-apps">${APPS.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 12).map((a) => `<a href="/mall/solution/${esc(a.id)}" data-link><b>${esc(a.name)}</b><small>${esc(a.desc || "")}</small></a>`).join("")}</div>`, "/mall/solutions")}
      ${sec("기업 구매, 이렇게 진행돼요", "", stepsHTML())}
      ${rec.length ? sec("최근 본 제품", "", `<div class="m-grid m-grid--6">${rec.map((p) => card(p)).join("")}</div>`) : ""}
      <section class="m-sec"><div class="m-sec__hd"><h2>함께하는 고객사</h2><span>공공 · 제조 · 바이오 · 유통 · 연구 기관</span><a href="/stories" class="m-more">도입 사례 ›</a></div><div class="m-logos">${LOGOS.map((l) => `<img src="${ASSET(`/images/clogo-${l}.png`)}" alt="" onerror="this.remove()">`).join("")}</div></section>
    </div>`;
}
function stepsHTML() {
  return `<ol class="m-steps"><li><i>1</i><b>제품 담기</b><span>센서·게이트웨이·플랫폼을 견적함에</span></li><li><i>2</i><b>견적 요청서</b><span>수량 · 희망 납기 · 필요 서류</span></li><li><i>3</i><b>공식 견적서</b><span>영업일 1일 안에 단가 · 납기 회신</span></li><li><i>4</i><b>발주 · 계약</b><span>세금계산서 발행 · 지급 조건 협의</span></li><li><i>5</i><b>납품 · 설치 · 교육</b><span>현장 설치부터 플랫폼 교육까지</span></li></ol>`;
}
function packCard(k) {
  const its = k.items.map(([n, q]) => [byName(n), q]).filter(([p]) => p);
  return `<article class="m-pack"><img src="${ASSET(k.img)}" alt="" loading="lazy"><div class="m-pack__body"><small>${esc(k.for)}</small><h3>${esc(k.name)}</h3><p>${esc(k.desc)}</p>
    <ul>${its.map(([p, q]) => `<li><a href="/mall/product/${esc(p.id)}" data-link>${esc(p.n)}</a><span>× ${q}</span></li>`).join("")}</ul>
    <div class="m-pack__ft"><div class="m-price">패키지 견적가<small>현장 규모에 맞춰 조정</small></div><button class="m-btn m-btn--sm" type="button" data-pack="${k.id}">패키지 담기</button></div></div></article>`;
}

/* ───────── 화면: 카테고리 · 검색 ───────── */
function vList(cat, qs) {
  const g = qs.get("g") || "", app = qs.get("app") || "", sort = qs.get("sort") || "rec", mode = LS.get("mnkMallView", "grid"), q = (qs.get("q") || "").trim();
  let list = q ? P.filter((p) => (p.n + " " + p.d + " " + catLine(p) + " " + appsOf(p).map((a) => a.name).join(" ")).toLowerCase().includes(q.toLowerCase()))
    : P.filter((p) => (cat === "all" || p.c === cat) && (!g || p.g === g));
  if (app) { const a = APPS.find((x) => x.id === app); if (a) { const ids = prodsOfApp(a).map((p) => p.id); list = list.filter((p) => ids.includes(p.id) || p.c !== "sensors"); } }
  list = sort === "name" ? list.slice().sort((a, b) => a.n.localeCompare(b.n, "ko")) : list.slice().sort((a, b) => b.score - a.score);
  const title = q ? `'${q}' 검색 결과` : g ? grpName(g) + " 센서" : CAT_KO[cat] || "전체 제품";
  setTitle(title);
  const link = (o) => { const u = new URLSearchParams(qs); Object.entries(o).forEach(([k, v]) => (v ? u.set(k, v) : u.delete(k))); const s = u.toString(); return L().pathname + (s ? "?" + s : ""); };
  const topApps = APPS.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 14);
  return `<div class="m-in">${crumbs(q ? [["검색", ""]] : [[CAT_KO[cat] || "전체 제품", g ? "/mall/category/" + cat : ""], ...(g ? [[grpName(g), ""]] : [])])}
    <div class="m-catbanner"><div><h1>${esc(title)}</h1><p>${esc(q ? `${list.length}개 제품을 찾았어요` : CAT_DESC[cat] || "Monnit ALTA 무선 IoT 전 제품")}</p></div><a class="m-btn m-btn--w" href="/mall/quote" data-link>구성 상담 요청</a></div>
    <button class="m-btn m-btn--line m-filterbtn" type="button" id="fltBtn"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h14M6 10h8M8.5 15h3"/></svg>필터 · 카테고리</button>
    <div class="m-listwrap">
      <aside class="m-filter" id="flt"><div class="m-filter__hd"><b>필터</b><button type="button" class="m-x" id="fltX" aria-label="닫기">×</button></div>
        <h4>카테고리</h4>
        <a href="/mall/category/all" data-link class="${cat === "all" && !q ? "is-on" : ""}">전체 제품<small>${P.length}</small></a>
        ${CATS.map((c) => `<a href="/mall/category/${c.id}" data-link class="${cat === c.id && !g ? "is-on" : ""}">${esc(CAT_KO[c.id])}<small>${P.filter((p) => p.c === c.id).length}</small></a>` +
          (c.id === "sensors" ? `<div class="m-filter__sub">${GROUPS.map((x) => `<a href="/mall/category/sensors?g=${x.id}" data-link class="${g === x.id ? "is-on" : ""}"><i style="background:${x.color}"></i>${esc(x.ko)}<small>${P.filter((p) => p.g === x.id).length}</small></a>`).join("")}</div>` : "")).join("")}
        <h4>활용 분야</h4>
        <div class="m-filter__apps">${topApps.map((a) => `<a href="${link({ app: app === a.id ? "" : a.id })}" data-link class="${app === a.id ? "is-on" : ""}">${esc(a.name)}</a>`).join("")}</div>
        <h4>업종별 구성</h4>${INDS.map((k) => `<a href="/mall/industry/${k.id}" data-link>${esc(k.name)}<small>${indItems(k).length}</small></a>`).join("")}
        <div class="m-filter__help"><b>찾는 제품이 없나요?</b><p>현장 상황만 알려 주시면 구성을 잡아 드려요.</p><a class="m-btn m-btn--sm m-btn--navy" href="/mall/quote" data-link>구성 상담</a></div>
      </aside>
      <div>
        <div class="m-toolbar"><b>${list.length}</b>개 제품${app ? ` · 활용 분야: ${esc((APPS.find((a) => a.id === app) || {}).name || "")} <a href="${link({ app: "" })}" data-link class="m-x">×</a>` : ""}<span class="m-sp"></span>
          <div class="m-seg"><a href="${link({ sort: "" })}" data-link class="${sort === "rec" ? "is-on" : ""}">추천순</a><a href="${link({ sort: "name" })}" data-link class="${sort === "name" ? "is-on" : ""}">이름순</a></div>
          <div class="m-seg"><button type="button" data-mode="grid" class="${mode === "grid" ? "is-on" : ""}" aria-label="격자 보기">▦</button><button type="button" data-mode="list" class="${mode === "list" ? "is-on" : ""}" aria-label="목록 보기">☰</button></div></div>
        ${cat === "sensors" && !q ? `<div class="m-chips">${[["", "센서 전체"], ...GROUPS.map((x) => [x.id, x.ko])].map(([id, t]) => `<a href="${link({ g: id })}" data-link class="${g === id ? "is-on" : ""}">${esc(t)}</a>`).join("")}</div>` : ""}
        ${list.length ? (mode === "list" ? `<div class="m-rows">${list.map(row).join("")}</div>` : `<div class="m-grid m-grid--3">${list.map((p) => card(p)).join("")}</div>`)
          : `<div class="m-empty"><b>조건에 맞는 제품이 없어요.</b><p>찾는 제품을 견적 요청서 메모로 남겨 주시면 확인해 드립니다.</p><a class="m-btn" href="/mall/quote" data-link>견적 요청서 작성</a></div>`}
      </div></div></div>`;
}

/* ───────── 화면: 상품 상세 ───────── */
function vProduct(id) {
  const p = P.find((x) => x.id === id);
  if (!p) return vNotFound();
  RECENT = [p.id, ...RECENT.filter((x) => x !== p.id)].slice(0, 12); LS.set("mnkRecent", RECENT);
  setTitle(p.n);
  const apps = appsOf(p).slice(0, 12);
  const rel = P.filter((x) => x.id !== p.id && x.c === p.c && (p.g ? x.g === p.g : true)).slice(0, 4);
  const gw = byName("이더넷 게이트웨이"), sw = byName("iMonnit 클라우드 관리 SW");
  const together = p.c === "sensors" ? [gw, sw].filter(Boolean) : p.c === "gateways" ? [sw, ...P.filter((x) => x.hot).slice(0, 2)].filter(Boolean) : P.filter((x) => x.hot).slice(0, 3);
  return `<div class="m-in">${crumbs([[CAT_KO[p.c], "/mall/category/" + p.c], ...(p.g ? [[grpName(p.g), "/mall/category/sensors?g=" + p.g]] : []), [p.n, ""]])}
    <section class="m-pd">
      <div class="m-pd__gal">${imgOf(p) ? `<div class="m-zoom${p.c === "software" ? " m-zoom--shot" : ""}" id="pdZoom"><img src="${imgOf(p)}" alt="${esc(p.n)}"><span class="m-zoom__hint">마우스를 올리면 확대</span></div>` : ico(p, "m-ico--xl")}<div class="m-pd__note">${p.c === "sensors" ? "무선 · 배터리 · 940MHz" : p.c === "gateways" ? "센서 최대 250개 연결" : p.c === "software" ? "웹 · 모바일 대시보드" : "ALTA 무선 연동"}</div></div>
      <div class="m-pd__info">
        <div class="m-pd__tags">${p.hot ? '<span class="m-tag m-tag--blue">BEST</span>' : ""}<span class="m-tag m-tag--line">${esc(catLine(p))}</span></div>
        <h1>${esc(p.n)}</h1><p class="m-pd__desc">${esc(p.d)}</p>
        <dl class="m-pd__meta">
          <div><dt>판매가</dt><dd><b class="m-pd__price">견적 문의</b><small>구성 · 수량 · 납기에 맞춰 공식 견적서로 안내</small></dd></div>
          <div><dt>납기</dt><dd>재고 · 납기 확인 후 견적서에 기재</dd></div>
          <div><dt>결제</dt><dd>세금계산서 발행 후 계좌이체 · 지급 조건 협의</dd></div>
          <div><dt>설치</dt><dd>설치 · 교육 포함 견적 가능 (배선 공사 없음)</dd></div>
          <div><dt>보증</dt><dd>기본 보증 1년 · 기술지원 창구 연결</dd></div>
        </dl>
        <div class="m-pd__qty"><span>수량</span><div class="m-stepper"><button type="button" data-pq="-1" aria-label="줄이기">−</button><input id="pdQty" type="number" min="1" max="9999" value="1" inputmode="numeric"><button type="button" data-pq="1" aria-label="늘리기">＋</button></div></div>
        <div class="m-pd__btns"><button class="m-btn m-btn--lg m-btn--line" type="button" id="pdAdd">견적함 담기</button><button class="m-btn m-btn--lg" type="button" id="pdNow">바로 견적 요청</button>
          <button class="m-btn m-btn--lg m-btn--icon${FAV.includes(p.id) ? " is-on" : ""}" type="button" data-fav="${esc(p.id)}" aria-label="관심 상품">${FAV.includes(p.id) ? "♥" : "♡"}</button></div>
        <div class="m-pd__sub"><label class="m-chk"><input type="checkbox" data-cmp="${esc(p.id)}" ${CMP.includes(p.id) ? "checked" : ""}>비교함에 담기</label>${p.u ? `<a href="${esc(p.u)}" target="_blank" rel="noopener">${p.p ? "데이터시트 PDF" : "제품 정보"} 받기 ›</a>` : ""}<a href="tel:0220881454">전화 상담 02-2088-1454</a></div>
        ${p.c === "sensors" ? `<div class="m-upsell m-upsell--req"><b>이 센서는 ALTA 게이트웨이 + 플랫폼 라이선스가 꼭 필요합니다.</b> 담으시면 두 가지가 자동으로 함께 담기고, 종류는 견적함에서 고를 수 있어요. 타사 게이트웨이와는 연결되지 않습니다.</div>`
          : p.c === "gateways" ? `<div class="m-upsell m-upsell--req"><b>ALTA 게이트웨이는 ALTA 센서 전용입니다.</b> 타사 센서는 연결되지 않으며, 측정값을 보려면 플랫폼 라이선스가 필요합니다.</div>`
          : p.c === "software" ? `<div class="m-upsell m-upsell--req"><b>플랫폼 라이선스는 ALTA 게이트웨이를 통해 들어온 ALTA 센서 데이터를 보는 용도입니다.</b> 센서 수에 맞는 등급으로 견적드립니다.</div>` : ""}
      </div>
    </section>
    <nav class="m-tabs" id="pdTabs"><a href="#t-over">상품 개요</a><a href="#t-spec">사양 · 자료</a><a href="#t-apps">활용 분야</a><a href="#t-buy">구매 · 납품 안내</a><a href="#t-qna">제품 문의</a></nav>
    <section class="m-tab" id="t-over"><h2>상품 개요</h2><p class="m-lead">${esc(p.d)}</p><div class="m-facts">${(FACTS[p.c] || []).map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>
      ${p.c === "sensors" ? `<div class="m-diagram"><div><b>${esc(p.n)} 센서</b><small>현장에 부착 · 무선 송신</small></div><i>→</i><div><b>IoT 게이트웨이</b><small>반경 내 센서 250개</small></div><i>→</i><div><b>플랫폼</b><small>iMonnit · Scube</small></div><i>→</i><div><b>담당자 알림</b><small>문자 · 이메일 · 대시보드</small></div></div>` : ""}</section>
    <section class="m-tab" id="t-spec"><h2>사양 · 자료</h2><table class="m-spec"><tbody>
      <tr><th>제품군</th><td>${esc(catLine(p))}</td></tr><tr><th>통신</th><td>${p.c === "software" ? "클라우드 · 온프레미스 (제품별 상이)" : "Monnit ALTA 무선 · 940MHz (국내)"}</td></tr>
      <tr><th>용도</th><td>${esc(p.d)}</td></tr><tr><th>상세 사양</th><td>${p.u ? `<a href="${esc(p.u)}" target="_blank" rel="noopener">${p.p ? "데이터시트(PDF)" : "제품 정보 페이지"} 열기 ›</a>` : "견적 회신 때 데이터시트를 함께 보내 드립니다."} <span class="m-muted">— 측정 범위 · 정확도 · 배터리 · 인증은 모델별 데이터시트 기준</span></td></tr></tbody></table>
      <div class="m-files">${p.u ? `<a href="${esc(p.u)}" target="_blank" rel="noopener"><i>${p.p ? "PDF" : "WEB"}</i>${esc(p.n)} ${p.p ? "데이터시트" : "제품 정보"}<span>받기 ›</span></a>` : ""}<a href="/guides"><i>DOC</i>설치 · 기술지원 가이드<span>보기 ›</span></a><a href="/kb/scube"><i>DOC</i>Scube 플랫폼 매뉴얼<span>보기 ›</span></a></div></section>
    <section class="m-tab" id="t-apps"><h2>활용 분야</h2>${apps.length ? `<div class="m-apps m-apps--sm">${apps.map((a) => `<a href="/mall/solution/${esc(a.id)}" data-link><b>${esc(a.name)}</b><small>${esc(a.desc || "")}</small></a>`).join("")}</div>` : `<p class="m-muted">현장 조건에 맞춰 활용 방법을 안내드려요.</p>`}</section>
    <section class="m-tab" id="t-buy"><h2>구매 · 납품 안내</h2>${stepsHTML()}
      <table class="m-spec"><tbody><tr><th>견적</th><td>견적함에 담아 요청하시면 영업일 1일 안에 공식 견적서(품목 · 수량 · 단가 · 납기)를 이메일로 보내 드립니다.</td></tr>
      <tr><th>결제</th><td>세금계산서 발행 후 계좌이체가 기본이며, 지급 시기 등은 회사 구매 규정에 맞춰 협의합니다. 온라인 카드 결제는 제공하지 않습니다.</td></tr>
      <tr><th>납품 · 설치</th><td>납기는 재고와 수량에 따라 견적서에 기재합니다. 설치 · 플랫폼 교육은 견적에 포함할 수 있습니다.</td></tr>
      <tr><th>교환 · 반품</th><td>제품 이상은 납품 후 담당자에게 연락 주시면 확인 후 교환 · 수리해 드립니다. 세부 조건은 견적서 · 계약서 기준입니다.</td></tr>
      <tr><th>보증 · A/S</th><td>기본 보증 1년 · 기술지원 창구 <a href="/guides">monnit.co.kr/guides</a></td></tr></tbody></table></section>
    <section class="m-tab" id="t-qna"><h2>제품 문의</h2><form class="m-form m-form--inline" id="qnaForm" novalidate>
      <input id="qaCo" placeholder="회사 · 기관명 *"><input id="qaNm" placeholder="담당자 *"><input id="qaPh" type="tel" placeholder="연락처 *"><input id="qaEm" type="email" placeholder="이메일">
      <textarea id="qaMsg" placeholder="${esc(p.n)}에 대해 궁금한 점 (사양 · 호환 · 설치 환경 등)"></textarea>
      <label class="m-consent"><input type="checkbox" id="qaOk"> [필수] 답변을 위한 개인정보(회사 · 담당자 · 연락처 · 이메일) 수집 · 이용에 동의합니다. <a href="/privacy.html" target="_blank">자세히</a></label>
      <button class="m-btn" type="submit">문의 남기기</button></form></section>
    ${sec("함께 견적받는 제품", "", `<div class="m-grid m-grid--4">${together.map((x) => card(x)).join("")}</div>`)}
    ${rel.length ? sec("같은 분류의 제품", "", `<div class="m-grid m-grid--4">${rel.map((x) => card(x)).join("")}</div>`, "/mall/category/" + p.c + (p.g ? "?g=" + p.g : "")) : ""}
  </div>`;
}

/* ───────── 화면: 패키지 · 솔루션 ───────── */
/* 업종별 추천 구성 — [제품명, 기본 수량, 이 현장에서의 역할] */
const INDS = [
  { id: "facility", en: "FACILITY", name: "시설·빌딩 관리", desc: "기계실 누수, 설비 고장 접점, 정전, 무인 시간대 출입을 한 플랫폼에서 관리합니다.", items: [["누수 — 로프형", 4, "기계실·배관 하부 누수 선 감지"], ["누수 — 전선형(Detect)", 4, "화장실·공조기 드레인 점 감지"], ["드라이컨택", 4, "펌프·화재수신기 고장 접점"], ["500VAC 감지", 2, "분전반 정전 감지"], ["개폐(도어)", 4, "기계실·전기실 출입"], ["모션·점유", 2, "무인 시간대 침입"], ["온도", 4, "전기실·서버실 과열"], ["로컬 경보기", 1, "현장 경광·경보음"], ["이더넷 게이트웨이", 1, "센서 수신 · 반경 내 최대 250개"], ["iMonnit 클라우드 관리 SW", 1, "문자·이메일 알림 · 대시보드"]] },
  { id: "pharma", en: "PHARMA · BIO", name: "제약·바이오", desc: "GMP 보관실 온습도, 초저온 냉동고, 클린룸 차압을 기록하고 이탈 시 알립니다.", items: [["온도", 6, "보관실·냉장고·초저온 냉동고"], ["습도", 6, "GMP 보관실 상대습도"], ["차압", 4, "클린룸 실간 차압"], ["열전대", 2, "멸균기·건조기 고온 구간"], ["개폐(도어)", 2, "냉동고·보관실 문 열림"], ["0-20mA", 2, "기존 계측기 아날로그 신호"], ["이더넷 게이트웨이", 1, "센서 수신"], ["iMonnit 클라우드 관리 SW", 1, "기록 보관 · 이탈 알림 · 보고서"]] },
  { id: "cold", en: "COLD CHAIN", name: "물류·콜드체인", desc: "냉장·냉동 창고 온도와 도어 개폐를 상시 기록해 HACCP 대응을 자동화합니다.", items: [["온도", 10, "냉장·냉동 구역별 온도"], ["습도", 4, "상온 창고 습도"], ["개폐(도어)", 4, "도크·냉동실 문 열림 시간"], ["500VAC 감지", 2, "냉동기 전원 차단"], ["버튼", 2, "점검 완료 체크"], ["로컬 경보기", 1, "현장 경보"], ["이더넷 게이트웨이", 1, "센서 수신"], ["iMonnit 클라우드 관리 SW", 1, "HACCP 기록 · 알림"]] },
  { id: "pdm", en: "PREDICTIVE MAINT.", name: "제조·예지보전", desc: "모터·펌프 진동, 3상 전류, 배관 압력으로 설비 이상을 조기에 파악합니다.", items: [["가속도·진동계", 8, "모터·펌프·팬 진동"], ["3상 전류계", 4, "모터 부하·과전류"], ["열전대", 4, "베어링·로 고온부"], ["압력계", 2, "배관·유압 압력"], ["펄스 카운터 — 싱글", 2, "가동 횟수·생산 카운트"], ["드라이컨택", 4, "설비 알람 접점"], ["이더넷 게이트웨이", 1, "센서 수신"], ["iMonnit 클라우드 관리 SW", 1, "추세 분석 · 임계치 알림"]] },
  { id: "energy", en: "ENERGY · UTILITY", name: "에너지·유틸리티", desc: "전력량 펄스, DC/AC 전압, 고압 배관과 방폭 구역 신호를 원격 계측합니다.", items: [["펄스 카운터 — 듀얼", 4, "전력량계·유량계 펄스"], ["AC 전류계", 4, "회로별 전류"], ["500VAC 미터", 2, "AC 전압"], ["200VDC 미터", 2, "축전지·태양광 DC 전압"], ["압력계", 2, "배관 압력"], ["0-10VDC", 2, "기존 계측기 아날로그 신호"], ["시리얼 Modbus 게이트웨이", 1, "기존 SCADA·DDC 연동"], ["iMonnit 클라우드 관리 SW", 1, "원격 계측 · 알림"]] },
  { id: "agri", en: "AGRI · GOLF", name: "스마트팜·골프장", desc: "토양 수분, 광합성 유효광, CO2, 온습도로 생육과 관수를 관리합니다.", items: [["토양 수분", 8, "구역별 토양 수분장력"], ["조도 (PAR·광합성)", 2, "광합성 유효광"], ["이산화탄소(CO2)", 2, "온실 CO2 농도"], ["온도", 4, "온실·그린 온도"], ["습도", 4, "온실 습도"], ["이더넷 게이트웨이", 1, "센서 수신"], ["iMonnit 클라우드 관리 SW", 1, "관수 판단 · 알림"]] },
];
const indItems = (k) => k.items.map(([n, q, r]) => ({ p: byName(n), q, r })).filter((x) => x.p);
function indCard(k) {
  const it = indItems(k);
  return `<a class="m-ind" href="/mall/industry/${k.id}" data-link><div class="m-ind__hd"><span>${esc(k.en)}</span><em>${it.length}개 품목 →</em></div>
    <b>${esc(k.name)}</b><p>${esc(k.desc)}</p><div class="m-ind__th">${it.slice(0, 6).map((x) => `<i title="${esc(x.p.n)}">${ico(x.p)}</i>`).join("")}</div></a>`;
}
function vInds() { setTitle("업종별 구성"); return `<div class="m-in">${crumbs([["업종별 구성", ""]])}<div class="m-catbanner m-catbanner--plain"><div><h1>업종별 추천 구성</h1><p>현장 유형별로 자주 함께 구성하는 센서·게이트웨이·플랫폼 조합입니다. 구성 전체를 담은 뒤 견적함에서 수량을 조정하세요.</p></div></div><div class="m-inds">${INDS.map(indCard).join("")}</div></div>`; }
function vInd(id) {
  const k = INDS.find((x) => x.id === id); if (!k) return vNotFound();
  setTitle(k.name + " 추천 구성"); const it = indItems(k);
  return `<div class="m-in">${crumbs([["업종별 구성", "/mall/industry"], [k.name, ""]])}
    <div class="m-indhero"><div><span>${esc(k.en)}</span><h1>${esc(k.name)}</h1><p>${esc(k.desc)}</p></div>
      <div class="m-indhero__act"><button class="m-btn m-btn--lg m-btn--accent" type="button" data-ind="${k.id}">구성 전체 담기 · ${it.length}개 품목</button><a class="m-btn m-btn--lg m-btn--ghostw" href="/mall/quote" data-link>현장 맞춤 상담</a></div></div>
    <div class="m-indlist">${it.map((x) => `<article class="m-indrow" data-go="/mall/product/${esc(x.p.id)}">${ico(x.p, "m-ico--md")}<div><small>${esc(catLine(x.p))}</small><b>${esc(x.p.n)}</b><span>${esc(x.r)}</span></div>
      <em>권장 ${x.q}${x.p.c === "software" ? "식" : "개"}</em><button class="m-btn m-btn--sm m-btn--line" type="button" data-add="${esc(x.p.id)}">담기</button></article>`).join("")}</div>
    <div class="m-indbar"><span><b>${esc(k.name)}</b> ${it.length}개 품목</span><button class="m-btn m-btn--accent" type="button" data-ind="${k.id}">구성 전체 담기</button></div>
    <p class="m-muted m-small" style="margin-top:12px">권장 수량은 중소 규모 현장 기준 예시입니다. 실제 수량은 현장 면적·구역 수에 맞춰 공식 견적서에서 확정합니다.</p>
    <div class="m-inds m-inds--more">${INDS.filter((x) => x.id !== k.id).slice(0, 3).map(indCard).join("")}</div></div>`;
}
function vPacks() { setTitle("추천 패키지"); return `<div class="m-in">${crumbs([["추천 패키지", ""]])}<div class="m-catbanner"><div><h1>현장별 추천 패키지</h1><p>자주 쓰는 구성을 한 번에 견적받으세요. 수량은 견적 때 현장 규모에 맞춰 조정합니다.</p></div></div><div class="m-packs">${PACKS.map(packCard).join("")}</div></div>`; }
function vSolutions() {
  setTitle("산업별 솔루션");
  const groups = {}; APPS.forEach((a) => { (groups[a.cat] = groups[a.cat] || []).push(a); });
  const CATNAME = { env: "환경 · 시설", power: "전력 · 에너지", motion: "보안 · 출입", mech: "설비 · 기계", level: "수위 · 누수", gas: "가스 · 안전", iface: "계측 · 연동" };
  return `<div class="m-in">${crumbs([["산업별 솔루션", ""]])}<div class="m-catbanner"><div><h1>산업별 솔루션</h1><p>용도에서 출발해 필요한 센서를 찾아보세요. ${APPS.length}개 활용 분야.</p></div></div>
    ${Object.entries(groups).map(([c, list]) => sec(CATNAME[c] || c, "", `<div class="m-apps">${list.sort((a, b) => b.popularity - a.popularity).map((a) => `<a href="/mall/solution/${esc(a.id)}" data-link><b>${esc(a.name)}</b><small>${esc(a.desc || "")}</small></a>`).join("")}</div>`)).join("")}</div>`;
}
function vSolution(id) {
  const a = APPS.find((x) => x.id === id); if (!a) return vNotFound();
  setTitle(a.name);
  const ps = prodsOfApp(a), gw = byName("이더넷 게이트웨이"), sw = byName("iMonnit 클라우드 관리 SW");
  return `<div class="m-in">${crumbs([["산업별 솔루션", "/mall/solutions"], [a.name, ""]])}<div class="m-catbanner"><div><h1>${esc(a.name)}</h1><p>${esc(a.desc || "")}</p></div><button class="m-btn m-btn--w" type="button" data-solpack="${esc(a.id)}">추천 구성 한 번에 담기</button></div>
    ${sec("추천 센서", `${ps.length}종`, ps.length ? `<div class="m-grid m-grid--4">${ps.map((p) => card(p)).join("")}</div>` : `<p class="m-muted">현장 조건에 맞춰 센서를 골라 드려요. <a href="/mall/quote" data-link>구성 상담 요청 ›</a></p>`)}
    ${sec("함께 필요한 제품", "센서 데이터를 받아 알림까지", `<div class="m-grid m-grid--4">${[gw, sw].filter(Boolean).map((p) => card(p)).join("")}</div>`)}
    ${sec("도입 문의", "", `<div class="m-cta"><div><b>${esc(a.name)} 구성이 궁금하신가요?</b><p>현장 사진이나 도면만 보내 주셔도 센서 위치와 수량을 잡아 드립니다.</p></div><a class="m-btn" href="/mall/quote?topic=${encodeURIComponent(a.name)}" data-link>구성 상담 요청</a></div>`)}</div>`;
}

/* ───────── 화면: 견적함 · 견적 요청서 · 완료 ───────── */
function cartItems() {
  const l = CART.map((c) => ({ ...c, p: P.find((x) => x.id === c.id) })).filter((c) => c.p);
  const rank = (c) => (c.p.c === "gateways" ? 0 : c.p.c === "software" ? 1 : 2);   /* 필수 구성(게이트웨이 · 라이선스)이 항상 맨 위 */
  return l.sort((a, b) => rank(a) - rank(b));
}
function reqBlock() {
  if (!needsReq()) return "";
  const block = (title, list, key) => {
    const names = list.map((x) => x.n);
    const cur = CART.find((c) => { const p = P.find((x) => x.id === c.id); return p && names.includes(p.n); });
    return `<div class="m-reqbox__grp"><h4>${title} <em>필수</em></h4><div class="m-reqbox__opts">${list.map((o) => { const p = byName(o.n); if (!p) return ""; const on = cur && cur.id === p.id;
      return `<label class="m-req__opt${on ? " is-on" : ""}"><input type="radio" name="${key}" value="${esc(o.n)}" ${on ? "checked" : ""}>${ico(p, "m-ico--sm")}<span><b>${esc(o.label)}</b><small>${esc(o.sub)}</small></span>${on ? `<div class="m-stepper m-stepper--sm"><button type="button" data-cq="${esc(p.id)}" data-d="-1">−</button><input type="number" min="1" max="9999" value="${cur.qty}" data-cqi="${esc(p.id)}"><button type="button" data-cq="${esc(p.id)}" data-d="1">+</button></div>` : ""}</label>`; }).join("")}</div></div>`;
  };
  return `<section class="m-reqbox"><div class="m-reqbox__hd"><b>필수 구성</b><span>센서 데이터를 받으려면 게이트웨이와 플랫폼 라이선스가 꼭 필요합니다 · 종류만 골라 주세요</span></div>
    ${block("① 게이트웨이", REQ_GW, "cgw")}${block("② 플랫폼 라이선스", REQ_SW, "csw")}
    <p class="m-reqbox__warn">ALTA 센서는 ALTA 게이트웨이와만 통신합니다 — 타사 게이트웨이 · 타사 센서와는 연결되지 않습니다.</p></section>`;
}
function vCart() {
  setTitle("견적함");
  ensureReq();
  const items = cartItems();
  const hasSensor = items.some((c) => c.p.c === "sensors"), hasGw = items.some((c) => c.p.c === "gateways"), hasSw = items.some((c) => c.p.c === "software");
  const gw = byName("이더넷 게이트웨이"), sw = byName("iMonnit 클라우드 관리 SW");
  return `<div class="m-in">${flow(1)}<div class="m-cartwrap"><div>
    <div class="m-cartbar"><label class="m-chk"><input type="checkbox" id="selAll" checked>전체 선택</label><button class="m-btn m-btn--sm m-btn--line" type="button" id="delSel">선택 삭제</button><span class="m-sp"></span>
      ${items.length ? `<button class="m-btn m-btn--sm m-btn--line" type="button" id="cPrint">견적 요청서 인쇄 · PDF</button><button class="m-btn m-btn--sm m-btn--line" type="button" id="cShare">결재용 링크 복사</button>` : ""}</div>
    ${reqBlock()}
    ${items.length ? `<table class="m-carttbl"><thead><tr><th></th><th>품목</th><th>수량</th><th>단가</th><th>금액</th><th></th></tr></thead><tbody>
      ${items.filter((c) => !(needsReq() && isReqItem(c.p) && [...REQ_GW, ...REQ_SW].some((o) => o.n === c.p.n))).map((c) => `<tr><td><input type="checkbox" class="selOne" value="${esc(c.id)}" checked></td><td><a class="m-cartitem" href="/mall/product/${esc(c.id)}" data-link>${ico(c.p, "m-ico--sm")}<span><b>${esc(c.p.n)}</b><small>${esc(catLine(c.p))}</small></span></a></td>
        <td><div class="m-stepper m-stepper--sm"><button type="button" data-cq="${esc(c.id)}" data-d="-1">−</button><input type="number" min="1" max="9999" value="${c.qty}" data-cqi="${esc(c.id)}"><button type="button" data-cq="${esc(c.id)}" data-d="1">＋</button></div></td>
        <td class="m-muted">견적</td><td class="m-muted">견적</td><td><button class="m-x" type="button" data-rm="${esc(c.id)}" aria-label="삭제">×</button></td></tr>`).join("")}</tbody></table>`
      : `<div class="m-empty"><b>견적함이 비어 있어요.</b><p>제품을 담거나, 제품 없이 구성 상담만 요청하셔도 됩니다.</p><div class="m-empty__btns"><a class="m-btn m-btn--line" href="/mall/category/sensors" data-link>제품 둘러보기</a><a class="m-btn m-btn--line" href="/mall/quick" data-link>모델명으로 담기</a><a class="m-btn" href="/mall/quote" data-link>구성 상담 요청</a></div></div>`}
    ${hasSensor && (!hasGw || !hasSw) && false ? `<div class="m-upsell"><b>센서만으로는 데이터를 볼 수 없어요.</b> ${!hasGw ? "게이트웨이" : ""}${!hasGw && !hasSw ? "와 " : ""}${!hasSw ? "플랫폼" : ""}도 함께 견적받으시겠어요?
      ${!hasGw && gw ? `<button class="m-btn m-btn--sm m-btn--navy" type="button" data-add="${esc(gw.id)}">${esc(gw.n)} 담기</button>` : ""}${!hasSw && sw ? `<button class="m-btn m-btn--sm m-btn--navy" type="button" data-add="${esc(sw.id)}">${esc(sw.n)} 담기</button>` : ""}</div>` : ""}
    </div>
    <aside class="m-sum"><h3>견적 요약</h3><dl><div><dt>품목</dt><dd>${items.length}종</dd></div><div><dt>총 수량</dt><dd>${items.reduce((a, c) => a + c.qty, 0)}개</dd></div><div><dt>예상 금액</dt><dd>공식 견적서로 안내</dd></div><div><dt>회신</dt><dd>영업일 1일 이내</dd></div></dl>
      <a class="m-btn m-btn--lg m-btn--block" href="/mall/quote" data-link>${items.length ? "견적 요청서 작성" : "구성 상담 요청"}</a><p class="m-muted m-small">온라인 결제는 없습니다. 공식 견적서 확인 후 발주하시면 됩니다.</p></aside></div></div>`;
}
function flow(n) { return `<ol class="m-flow">${["견적함", "견적 요청서", "요청 완료"].map((t, i) => `<li class="${i + 1 === n ? "is-on" : i + 1 < n ? "is-done" : ""}"><i>${i + 1}</i>${t}</li>`).join("")}</ol>`; }
function vQuote(qs) {
  setTitle("견적 요청서");
  const items = cartItems(), me = ME && ME.member, pf = Object.assign({}, LS.get("mnkQuoteForm", {}), (me && me.profile) || {});
  const topic = qs.get("topic") || "", miss = LS.get("mnkQuoteMiss", []);
  const v = (k) => esc(pf[k] || "");
  return `<div class="m-in">${flow(2)}<form class="m-quote" id="quoteForm" novalidate><div>
    <section class="m-box"><h3>요청 품목 <a href="/mall/cart" data-link class="m-more">견적함 수정 ›</a></h3>${items.length ? `<table class="m-carttbl m-carttbl--ro"><tbody>${items.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.p.n)}${isReqItem(c.p) && needsReq() ? ' <em class="m-reqtag">필수</em>' : ""}</b><small>${esc(catLine(c.p))}</small></td><td>${c.qty}개</td></tr>`).join("")}</tbody></table>` : `<p class="m-muted">담은 제품 없이 <b>구성 상담</b>으로 요청합니다. 아래 메모에 현장 상황을 적어 주세요.</p>`}</section>
    <section class="m-box"><h3>요청 기관 · 담당자</h3>${me ? `<p class="m-note">${esc(me.email)} · <b>${tierOf().name}</b> 회원으로 요청합니다.</p>` : `<p class="m-note"><a href="/account?next=/mall/quote">로그인</a>하면 정보가 자동으로 채워지고 등급 혜택이 적용돼요.</p>`}
      <div class="m-form m-form--2">
        <label>회사 · 기관명 <em>*</em><input id="fCo" value="${v("company")}" autocomplete="organization"></label><label>사업자등록번호 <span>견적서 발행용 · 선택</span><input id="fBiz" value="${v("bizNo")}" inputmode="numeric"></label>
        <label>담당자 <em>*</em><input id="fNm" value="${v("manager")}" autocomplete="name"></label><label>부서 · 직함 <span>선택</span><input id="fDept" value="${v("dept")}"></label>
        <label>휴대전화 <em>*</em><input id="fPh" type="tel" value="${v("phone")}" autocomplete="tel"></label><label>이메일 <em>*</em> <span>견적서 받을 곳</span><input id="fEm" type="email" value="${esc((me && me.email) || pf.email || "")}" autocomplete="email"></label></div></section>
    <section class="m-box"><h3>납품 · 구매 조건</h3><div class="m-form m-form--2">
        <label>납품 · 설치 지역<input id="fRg" value="${v("siteAddr")}" placeholder="예: 경기 평택시 · 물류센터"></label>
        <label>희망 납기<select id="fDue"><option>1주 이내</option><option selected>2주 이내</option><option>1개월 이내</option><option>일정 미정 (검토 중)</option></select></label>
        <label>구매 유형<select id="fType"><option>신규 도입</option><option>증설 · 추가 구매</option><option>교체 · 유지보수</option><option>예산 수립 · 검토용</option></select></label>
        <label>예산 범위 <span>선택</span><select id="fBudget"><option value="">선택 안 함</option><option>500만 원 미만</option><option>500만~2,000만 원</option><option>2,000만~5,000만 원</option><option>5,000만 원 이상</option></select></label>
        <label>설치 · 교육<select id="fInst"><option>설치 · 교육 포함 견적</option><option>제품만 (자체 설치)</option><option>상담 후 결정</option></select></label>
        <label>지급 조건 희망<select id="fPay"><option>세금계산서 후 계좌이체</option><option>회사 구매 규정에 따름 (협의)</option></select></label></div>
      <fieldset class="m-docs"><legend>함께 받을 서류</legend>${["공식 견적서", "사업자등록증 사본", "통장 사본", "제품 카탈로그 · 데이터시트", "납품확인서 양식"].map((d, i) => `<label><input type="checkbox" class="fDoc" value="${d}" ${i === 0 ? "checked" : ""}>${d}</label>`).join("")}</fieldset>
      <label class="m-form__full">요청 사항<textarea id="fMemo" placeholder="현장 상황 · 수량 근거 · 호환 장비 · 품의 일정 등">${esc([topic && `[${topic}] 구성 상담`, miss.length && "[목록에 없는 품목] " + miss.join(" / ")].filter(Boolean).join("\n"))}</textarea></label></section>
    </div>
    <aside class="m-sum"><h3>요청 확인</h3><dl><div><dt>품목</dt><dd>${items.length ? items.length + "종 · " + items.reduce((a, c) => a + c.qty, 0) + "개" : "구성 상담"}</dd></div><div><dt>회신</dt><dd>영업일 1일 이내</dd></div><div><dt>받는 곳</dt><dd>입력하신 이메일</dd></div></dl>
      <label class="m-consent"><input type="checkbox" id="fOk"> [필수] 견적 회신을 위한 개인정보(회사 · 담당자 · 연락처 · 이메일) 수집 · 이용에 동의합니다. <a href="/privacy.html" target="_blank">자세히</a></label>
      <button class="m-btn m-btn--lg m-btn--block" type="submit" id="fSend">견적 요청하기</button><button class="m-btn m-btn--block m-btn--line" type="button" id="qPrint">요청서 인쇄 · PDF</button>
      <p class="m-muted m-small">담당 팀장 · 대표가 함께 받아 구성 · 단가 · 납기를 확인해 회신드립니다. 급하면 02-2088-1454</p></aside></form></div>`;
}
function vDone(no) {
  setTitle("견적 요청 완료");
  const h = HIST.find((x) => x.no === no);
  return `<div class="m-in">${flow(3)}<section class="m-done"><div class="m-done__mark">✓</div><h1>견적 요청이 접수되었습니다.</h1><p>요청번호 <b>${esc(no)}</b></p>
    <p class="m-muted">담당자가 구성 · 단가 · 납기를 확인해 영업일 1일 안에 ${h && h.email ? esc(h.email) + "로 " : ""}공식 견적서를 보내 드립니다.</p>
    <div class="m-done__btns"><a class="m-btn m-btn--line" href="/mall/my" data-link>요청 내역 보기</a><a class="m-btn" href="/mall" data-link>쇼핑 계속하기</a><a class="m-btn m-btn--line" href="tel:0220881454">급하면 전화</a></div></section></div>`;
}

/* ───────── 화면: 마이 · 비교 · 빠른 견적 · 고객센터 ───────── */
function tierOf() { const g = ME && ME.member && ME.member.grade || "welcome"; return TIERS.find((t) => t.id === g) || TIERS[0]; }
function vMy() {
  setTitle("마이페이지");
  const fav = FAV.map((id) => P.find((p) => p.id === id)).filter(Boolean), rec = RECENT.map((id) => P.find((p) => p.id === id)).filter(Boolean).slice(0, 8);
  return `<div class="m-in">${crumbs([["마이페이지", ""]])}<section class="m-mytop"><div><small>${ME && ME.member ? "회원" : "비회원 (이 브라우저 기준)"}</small><h1>${ME && ME.member ? esc(ME.member.email) : "마이페이지"}</h1>
      ${ME && ME.member ? `<span class="m-grade" style="--g:${tierOf().color}">${tierOf().name} 등급</span>` : `<a class="m-btn m-btn--sm" href="/account?next=/mall/my">로그인 · 가입</a>`}</div>
      <ul><li><b>${HIST.length}</b>견적 요청</li><li><b>${CART.length}</b>견적함</li><li><b>${FAV.length}</b>관심 상품</li><li><b>${CMP.length}</b>비교함</li></ul></section>
    ${sec("견적 요청 내역", "이 브라우저에서 요청한 건 · 공식 견적서는 이메일로 회신", HIST.length ? `<table class="m-carttbl"><thead><tr><th>요청번호</th><th>요청일</th><th>품목</th><th>상태</th><th></th></tr></thead><tbody>${HIST.map((h) => `<tr><td><b>${esc(h.no)}</b></td><td>${esc(h.date)}</td><td>${esc(h.summary)}</td><td><span class="m-tag m-tag--line">회신 대기 · 확인 중</span></td><td><button class="m-btn m-btn--sm m-btn--line" type="button" data-reorder="${esc(h.no)}">같은 구성 다시 담기</button></td></tr>`).join("")}</tbody></table>` : `<p class="m-muted">아직 요청한 견적이 없어요.</p>`)}
    <div id="fav">${sec("관심 상품", "", fav.length ? `<div class="m-grid m-grid--4">${fav.map((p) => card(p)).join("")}</div>` : `<p class="m-muted">♡를 눌러 관심 상품을 모아 보세요.</p>`)}</div>
    ${rec.length ? sec("최근 본 제품", "", `<div class="m-grid m-grid--4">${rec.map((p) => card(p)).join("")}</div>`) : ""}
    ${sec("회원 등급 혜택", "거래해 주시는 만큼 더 나은 혜택으로 모시겠습니다", tiersHTML())}</div>`;
}
function tiersHTML() { const my = ME && ME.member ? tierOf().id : ""; return `<div class="m-tiers">${TIERS.map((t) => `<div class="${t.id === my ? "is-me" : ""}">${t.id === my ? '<em>내 등급</em>' : ""}<b><i style="background:${t.color}"></i>${t.name}</b><small>${esc(t.cond)}</small><ul>${t.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`; }
function vCompare() {
  setTitle("제품 비교");
  const ps = CMP.map((id) => P.find((p) => p.id === id)).filter(Boolean);
  if (!ps.length) return `<div class="m-in">${crumbs([["제품 비교", ""]])}<div class="m-empty"><b>비교함이 비어 있어요.</b><p>제품 카드의 「비교」를 체크해 최대 4개까지 비교하세요.</p><a class="m-btn" href="/mall/category/sensors" data-link>제품 보러 가기</a></div></div>`;
  const rows = [["분류", (p) => esc(catLine(p))], ["설명", (p) => esc(p.d)], ["주요 특징", (p) => (FACTS[p.c] || []).map(([a, b]) => `<b>${esc(a)}</b> ${esc(b)}`).join("<br>")],
    ["주요 활용 분야", (p) => appsOf(p).slice(0, 5).map((a) => esc(a.name)).join(" · ") || "—"], ["사양 자료", (p) => p.u ? `<a href="${esc(p.u)}" target="_blank" rel="noopener">${p.p ? "데이터시트(PDF)" : "제품 정보"} ›</a>` : "견적 회신 시 제공"], ["판매가 · 납기", () => "견적 문의"]];
  return `<div class="m-in">${crumbs([["제품 비교", ""]])}<div class="m-catbanner"><div><h1>제품 비교</h1><p>${ps.length}개 제품</p></div><button class="m-btn m-btn--w" type="button" id="cmpAll">모두 견적함 담기</button></div>
    <div class="m-cmpwrap"><table class="m-cmptbl"><thead><tr><th></th>${ps.map((p) => `<th><button class="m-x" type="button" data-uncmp="${esc(p.id)}" aria-label="빼기">×</button>${ico(p, "m-ico--md")}<a href="/mall/product/${esc(p.id)}" data-link>${esc(p.n)}</a></th>`).join("")}</tr></thead>
    <tbody>${rows.map(([k, f]) => `<tr><th>${k}</th>${ps.map((p) => `<td>${f(p)}</td>`).join("")}</tr>`).join("")}<tr><th></th>${ps.map((p) => `<td><button class="m-btn m-btn--sm" type="button" data-add="${esc(p.id)}">견적함 담기</button></td>`).join("")}</tr></tbody></table></div></div>`;
}
function vQuick() {
  setTitle("빠른 견적");
  return `<div class="m-in">${crumbs([["모델명으로 빠른 견적", ""]])}<div class="m-quick"><div><h1>모델명으로 빠른 견적</h1><p>구매 목록을 그대로 붙여 넣으세요. 한 줄에 하나씩 <b>제품명, 수량</b>.<br>찾은 제품은 견적함에 담고, 못 찾은 항목은 요청서 메모로 넘깁니다.</p>
    <p class="m-small">엑셀에서 「제품명 | 수량」 두 칸을 복사해 붙여 넣어도 됩니다.</p></div>
    <div><textarea id="quickText" placeholder="예)&#10;온도, 20&#10;누수 로프, 8&#10;이더넷 게이트웨이	2"></textarea><div class="m-quick__ft"><span id="quickMsg"></span><button class="m-btn" type="button" id="quickAdd">견적함에 담기</button></div></div></div>
    ${sec("제품명 참고", "아래 이름 그대로 쓰면 가장 정확해요", `<div class="m-names">${P.map((p) => `<span>${esc(p.n)}</span>`).join("")}</div>`)}</div>`;
}
function vHelp() {
  setTitle("고객센터");
  const faq = [["왜 가격이 공개되어 있지 않나요?", "무선 센서는 게이트웨이 · 플랫폼 구성, 수량, 설치 여부에 따라 총액이 크게 달라집니다. 담은 구성 그대로 공식 견적서를 영업일 1일 안에 보내 드려요."],
    ["온라인으로 결제할 수 있나요?", "모넷 IoT몰은 기업 구매용 견적몰이라 온라인 결제를 받지 않습니다. 공식 견적서 확인 후 발주하시면 세금계산서를 발행하고 계좌이체로 결제합니다."],
    ["세금계산서는 언제 발행되나요?", "발주 · 납품 일정에 맞춰 발행하며, 지급 시기는 회사 구매 규정에 맞춰 협의합니다."],
    ["납기는 얼마나 걸리나요?", "제품과 수량에 따라 다릅니다. 요청서에 희망 납기를 적어 주시면 재고와 일정을 확인해 견적서에 기재합니다."],
    ["센서만 사면 바로 쓸 수 있나요?", "센서는 게이트웨이를 거쳐 플랫폼으로 데이터를 보냅니다. 게이트웨이 1대가 반경 내 센서 250개까지 연결하니, 처음 도입이라면 게이트웨이와 플랫폼을 함께 견적받으세요."],
    ["설치도 해 주나요?", "네. 무선이라 배선 공사 없이 설치합니다. 설치 · 교육 범위와 일정은 현장 조건을 확인해 견적에 포함해 드려요."],
    ["사내 결재(품의)용 자료가 필요해요.", "견적함의 「견적 요청서 인쇄 · PDF」로 바로 출력하거나 「결재용 링크 복사」로 같은 구성을 공유할 수 있어요. 공식 견적서 · 사업자등록증 · 통장 사본 등 구매 서류는 요청서에서 체크하시면 함께 보내 드립니다."],
    ["회원 등급은 어떻게 정해지나요?", "이메일 인증만으로 웰컴 회원으로 모시며, 이후에는 거래 이력을 살펴 담당자가 한 단계 높은 등급으로 안내해 드립니다."]];
  return `<div class="m-in">${crumbs([["고객센터", ""]])}<div class="m-catbanner"><div><h1>고객센터</h1><p>구매 상담 02-2088-1454 · 평일 업무시간 · 1015@monnit.com</p></div><a class="m-btn m-btn--w" href="/mall/quote" data-link>견적 · 구성 상담 요청</a></div>
    <div class="m-helpnav"><a href="#guide">구매 가이드</a><a href="#faq">자주 묻는 질문</a><a href="#policy">서비스 정책</a><a href="#member">회원 혜택</a><a href="/guides">기술지원</a></div>
    <section class="m-sec" id="guide"><div class="m-sec__hd"><h2>구매 가이드</h2></div>${stepsHTML()}</section>
    <section class="m-sec" id="faq"><div class="m-sec__hd"><h2>자주 묻는 질문</h2></div><div class="m-faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div></section>
    <section class="m-sec" id="policy"><div class="m-sec__hd"><h2>서비스 정책</h2></div><table class="m-spec"><tbody>
      <tr><th>거래 방식</th><td>견적 요청 → 공식 견적서 → 발주 · 계약 → 납품 · 설치. 온라인 카드 결제는 제공하지 않습니다.</td></tr>
      <tr><th>세금계산서 · 결제</th><td>세금계산서 발행 후 계좌이체 기본 · 지급 조건 협의</td></tr>
      <tr><th>보증</th><td>기본 보증 1년 (세부 조건은 견적서 · 계약서 기준)</td></tr>
      <tr><th>교환 · 수리</th><td>제품 이상 시 담당자 확인 후 교환 · 수리 · 기술지원 <a href="/guides">monnit.co.kr/guides</a></td></tr>
      <tr><th>개인정보</th><td>견적 회신 목적으로만 이용 · <a href="/privacy.html">개인정보처리방침</a></td></tr></tbody></table></section>
    <section class="m-sec" id="member"><div class="m-sec__hd"><h2>회원 혜택</h2><span>이메일 인증만으로 가입 (비밀번호 없음)</span></div>${tiersHTML()}</section></div>`;
}
function vNotFound() { setTitle("페이지를 찾을 수 없음"); return `<div class="m-in"><div class="m-empty"><b>페이지를 찾을 수 없어요.</b><p>주소를 확인하시거나 홈에서 다시 찾아 주세요.</p><a class="m-btn" href="/mall" data-link>몰 홈으로</a></div></div>`; }

/* ───────── 라우터 ───────── */
function route() {
  const path = L().pathname.replace(/\/+$/, "") || "/mall", qs = new URLSearchParams(L().search), seg = path.split("/").slice(2).map(decodeURIComponent);
  let html;
  if (!seg.length) html = vHome();
  else if (seg[0] === "category") html = vList(seg[1] || "all", qs);
  else if (seg[0] === "search") html = vList("all", qs);
  else if (seg[0] === "product") html = vProduct(seg[1]);
  else if (seg[0] === "packages") html = vPacks();
  else if (seg[0] === "industry") html = seg[1] ? vInd(seg[1]) : vInds();
  else if (seg[0] === "solutions") html = vSolutions();
  else if (seg[0] === "solution") html = vSolution(seg[1]);
  else if (seg[0] === "cart") html = vCart();
  else if (seg[0] === "quote") html = vQuote(qs);
  else if (seg[0] === "done") html = vDone(seg[1]);
  else if (seg[0] === "my") html = vMy();
  else if (seg[0] === "compare") html = vCompare();
  else if (seg[0] === "quick") html = vQuick();
  else if (seg[0] === "help") html = vHelp();
  else html = vNotFound();
  view.innerHTML = html;
  $("#q").value = seg[0] === "search" ? qs.get("q") || "" : "";
  $$(".m-gnb a").forEach((a) => { const h = a.getAttribute("href"); a.classList.toggle("is-on", h === path || (h.length > 6 && path.startsWith(h + "/"))); });
  badge(); cmpBar(); bind(seg); reveal(); tabbar(path);
  EV.pg++; if (seg[0] === "product") { const pv = P.find((x) => x.id === seg[1]); if (pv) evc("v", pv.n); } if (seg[0] === "search" && qs.get("q")) evc("s", qs.get("q").trim().slice(0, 30));
  if (L().hash) { const t = document.getElementById(L().hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView({ behavior: "smooth", block: "start" }), 30); } else window.scrollTo(0, 0);
}
function go(href) { const cur = L(); if (href === cur.pathname + cur.search + cur.hash) return route(); if (HASHMODE) { CUR = href; try { history.pushState({ p: href }, "", "#" + href); } catch (err) { try { location.hash = href; } catch (er) {} } route(); return; } history.pushState({}, "", href); route(); }

/* ───────── 화면별 이벤트 ───────── */
function bind(seg) {
  /* 홈 슬라이더 */
  const sl = $("#slider");
  if (sl) {
    let i = 0; const show = (n) => { i = (n + BANNERS.length) % BANNERS.length; $$(".m-slide", sl).forEach((s, k) => s.classList.toggle("is-on", k === i)); $$(".m-dots button", sl).forEach((d, k) => d.classList.toggle("is-on", k === i)); };
    $$(".m-dots button", sl).forEach((d) => d.onclick = (e) => { e.preventDefault(); show(Number(d.dataset.slide)); });
    let hold = false; sl.onmouseenter = () => (hold = true); sl.onmouseleave = () => (hold = false);
    let sx = 0; sl.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; hold = true; }, { passive: true });
    sl.addEventListener("touchend", (e) => { const dx = e.changedTouches[0].clientX - sx; hold = false; if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); sl.dataset.swiped = "1"; setTimeout(() => delete sl.dataset.swiped, 300); } }, { passive: true });
    sl.addEventListener("click", (e) => { if (sl.dataset.swiped) e.preventDefault(); }, true);
    clearInterval(bind.t); bind.t = setInterval(() => { if (!document.body.contains(sl)) return clearInterval(bind.t); if (!hold && !document.hidden) show(i + 1); }, 5000);
  }
  /* 목록 보기 방식 */
  $$("[data-mode]").forEach((b) => b.onclick = () => { LS.set("mnkMallView", b.dataset.mode); route(); });
  /* 상세 */
  if (seg[0] === "product") {
    const qi = $("#pdQty"), id = seg[1];
    const z = $("#pdZoom"); if (z && matchMedia("(hover:hover)").matches) { const im = $("img", z);
      z.onmousemove = (e) => { const r = z.getBoundingClientRect(); im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`; z.classList.add("is-on"); };
      z.onmouseleave = () => z.classList.remove("is-on"); }
    $$("[data-pq]").forEach((b) => b.onclick = () => { qi.value = Math.max(1, Math.min(9999, (Number(qi.value) || 1) + Number(b.dataset.pq))); });
    $("#pdAdd").onclick = (e) => { fly(e.currentTarget, $("#pdZoom img")); add(id, Number(qi.value) || 1); };
    $("#pdNow").onclick = () => { add(id, Number(qi.value) || 1, true); go("/mall/quote"); };
    $("#qnaForm").onsubmit = (e) => { e.preventDefault(); productQna(P.find((p) => p.id === id)); };
    $$("#pdTabs a").forEach((a) => a.onclick = (e) => { e.preventDefault(); const t = $(a.getAttribute("href")); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" }); });
  }
  /* 견적함 */
  if (seg[0] === "cart") {
    $$("[data-cq]").forEach((b) => b.onclick = () => { const it = CART.find((c) => c.id === b.dataset.cq); it.qty = Math.max(1, Math.min(9999, it.qty + Number(b.dataset.d))); saveCart(); route(); });
    $$("[data-cqi]").forEach((inp) => inp.onchange = () => { const it = CART.find((c) => c.id === inp.dataset.cqi); it.qty = Math.max(1, Math.min(9999, Number(inp.value) || 1)); saveCart(); route(); });
    $$("[data-rm]").forEach((b) => b.onclick = () => { CART = CART.filter((c) => c.id !== b.dataset.rm); saveCart(); route(); });
    const all = $("#selAll"); if (all) all.onchange = () => $$(".selOne").forEach((x) => (x.checked = all.checked));
    const del = $("#delSel"); if (del) del.onclick = () => { const ids = $$(".selOne").filter((x) => x.checked).map((x) => x.value); if (!ids.length) return toast("삭제할 품목을 선택해 주세요."); CART = CART.filter((c) => !ids.includes(c.id)); saveCart(); route(); };
    $$(".m-reqbox input[type=radio]").forEach((r) => r.onchange = () => { swapReq(r.name === "cgw" ? REQ_GW : REQ_SW, r.value); route(); });
    const cp = $("#cPrint"); if (cp) cp.onclick = () => printQuote({});
    const cs = $("#cShare"); if (cs) cs.onclick = shareCart;
  }
  /* 견적 요청서 */
  if (seg[0] === "quote") {
    $("#quoteForm").onsubmit = submitQuote;
    $("#qPrint").onclick = () => printQuote(readForm());
    $("#fPh").addEventListener("input", (e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 11); e.target.value = d.length < 4 ? d : d.length < 8 ? d.replace(/(\d{3})(\d+)/, "$1-$2") : d.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3"); });
  }
  if (seg[0] === "quick") $("#quickAdd").onclick = quickAdd;
  if (seg[0] === "compare") { const ca = $("#cmpAll"); if (ca) ca.onclick = () => { CMP.forEach((id) => add(id, 1, true)); toast(`${CMP.length}개 제품을 견적함에 담았어요`); }; }
}

/* ───────── 동작 ───────── */
function quickAdd() {
  const lines = $("#quickText").value.split(/\n/).map((x) => x.trim()).filter(Boolean);
  const miss = []; let hit = 0;
  const norm = (s) => s.replace(/[\s()·—\-]+/g, "").toLowerCase();
  for (const ln of lines) {
    const m = ln.match(/^(.*?)[\s,\t×x*|]+(\d{1,4})\s*(개|ea|EA|대|set|SET)?$/);
    const name = (m ? m[1] : ln).replace(/[,\t|]+$/, "").trim(), qty = m ? Number(m[2]) : 1, k = norm(name);
    const p = k && (P.find((x) => norm(x.n) === k) || P.find((x) => norm(x.n).includes(k)) || P.find((x) => k.includes(norm(x.n))));
    if (p) { add(p.id, qty, true); hit++; } else miss.push(ln);
  }
  LS.set("mnkQuoteMiss", miss);
  $("#quickMsg").textContent = `${hit}개 품목을 담았어요${miss.length ? ` · 못 찾은 ${miss.length}줄은 요청서 메모로 넘깁니다` : ""}`;
  if (hit || miss.length) setTimeout(() => go("/mall/cart"), 700);
}
function shareCart() {
  const u = (HASHMODE ? "https://monnit.co.kr" : location.origin) + "/mall/cart?items=" + encodeURIComponent(CART.map((c) => c.id + "*" + c.qty).join(","));
  (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("결재용 링크를 복사했어요 — 같은 구성으로 열립니다"), () => prompt("아래 링크를 복사하세요", u));
}
function readForm() {
  const g = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
  return { co: g("fCo"), biz: g("fBiz"), nm: g("fNm"), dept: g("fDept"), ph: g("fPh"), em: g("fEm"), rg: g("fRg"), due: g("fDue"), type: g("fType"), budget: g("fBudget"), inst: g("fInst"), pay: g("fPay"), memo: g("fMemo"),
    docs: $$(".fDoc").filter((x) => x.checked).map((x) => x.value) };
}
async function postLead(payload) {
  if (HASHMODE && !window.__MALL_API) return false; const API = window.__MALL_API || BASE;
  try { const r = await fetch(API + "/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_type: "contact", page: "/mall", ts: new Date().toISOString(), payload }) }); return r.ok || r.status === 204; } catch (e) { return false; }
}
const reqNo = () => "MQ-" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
async function submitQuote(e) {
  e.preventDefault();
  const v = readForm();
  if (!v.co || !v.nm || !v.ph || !v.em) return toast("회사 · 담당자 · 휴대전화 · 이메일을 입력해 주세요.");
  if (!/^0\d{8,10}$/.test(v.ph.replace(/\D/g, ""))) return toast("휴대전화 번호를 확인해 주세요.");
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.em)) return toast("이메일 주소를 확인해 주세요.");
  if (!$("#fOk").checked) return toast("개인정보 수집 · 이용에 동의해 주세요.");
  if (ensureReq()) { toast("게이트웨이와 플랫폼 라이선스를 함께 담았어요. 확인 후 다시 요청해 주세요."); return go("/mall/cart"); }
  LS.set("mnkQuoteForm", { company: v.co, bizNo: v.biz, manager: v.nm, dept: v.dept, phone: v.ph, email: v.em, siteAddr: v.rg });
  const items = cartItems(), no = reqNo();
  const lines = items.map((c) => `${c.p.n}(${catLine(c.p)}) × ${c.qty}`).join(" / ");
  const grade = ME && ME.member ? tierOf().name + " (" + ME.member.email + ")" : "비회원";
  const src = (() => { try { return sessionStorage.getItem("mnkMallSrc") || "direct"; } catch (err) { return "direct"; } })();
  const payload = { "회사명": v.co, "담당자명": v.nm + (v.dept ? " / " + v.dept : ""), "전화번호": v.ph, "이메일": v.em, "문의항목": items.length ? "IoT몰 견적 요청" : "IoT몰 구성 상담", "지역": v.rg || "(미기재)",
    "문의 사항": `[${no}] ${lines || "제품 미선택 — 구성 상담"} · 구매 유형: ${v.type} · 희망 납기: ${v.due} · 설치: ${v.inst} · 지급: ${v.pay}${v.budget ? " · 예산: " + v.budget : ""}${v.biz ? " · 사업자번호: " + v.biz : ""} · 요청 서류: ${v.docs.join(", ") || "없음"} · 회원: ${grade}${v.memo ? " · 메모: " + v.memo : ""}`,
    "접수번호": no, "접점": "/mall 견적 요청서", "유입 페이지": "/mall/quote", "출처": src,
    /* 서버 몰 원장(/ops/mall)용 구조화 데이터 — 담당자 메일에는 「견적 품목」으로 정리돼 들어간다 */
    "_mall": JSON.stringify({ items: items.map((c) => ({ n: c.p.n, c: catLine(c.p), q: c.qty })), type: v.type, due: v.due, inst: v.inst, pay: v.pay, budget: v.budget, biz: v.biz, docs: v.docs, memo: v.memo, dept: v.dept, grade }) };
  const btn = $("#fSend"); btn.disabled = true; btn.textContent = "보내는 중…";
  const ok = await postLead(payload);
  if (!ok) {
    btn.disabled = false; btn.textContent = "다시 보내기";
    location.href = "mailto:1015@monnit.com?subject=" + encodeURIComponent(`[견적 요청] ${v.co} ${no}`) + "&body=" + encodeURIComponent(Object.entries(payload).map(([k, x]) => k + ": " + x).join("\n"));
    return toast("전송이 원활하지 않아 메일 앱으로 연결합니다.");
  }
  try { window.dataLayer && window.dataLayer.push({ event: "mall_quote", items: items.length }); } catch (err) {}
  HIST = [{ no, date: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), email: v.em, summary: items.length ? `${items[0].p.n}${items.length > 1 ? ` 외 ${items.length - 1}종` : ""} · ${items.reduce((a, c) => a + c.qty, 0)}개` : "구성 상담", items: items.map((c) => ({ id: c.id, qty: c.qty })) }, ...HIST].slice(0, 50);
  LS.set("mnkMallQuotes", HIST); LS.set("mnkQuoteMiss", []);
  EV.q = true; CART = []; saveCart(); go("/mall/done/" + no);
}
async function productQna(p) {
  const g = (id) => $("#" + id).value.trim();
  const v = { co: g("qaCo"), nm: g("qaNm"), ph: g("qaPh"), em: g("qaEm"), msg: g("qaMsg") };
  if (!v.co || !v.nm || !v.ph) return toast("회사 · 담당자 · 연락처를 입력해 주세요.");
  if (!$("#qaOk").checked) return toast("개인정보 수집 · 이용에 동의해 주세요.");
  const no = reqNo().replace("MQ", "PQ");
  const ok = await postLead({ "회사명": v.co, "담당자명": v.nm, "전화번호": v.ph, ...(v.em ? { "이메일": v.em } : {}), "문의항목": "IoT몰 제품 문의", "지역": "(미기재)", "문의 사항": `[${no}] ${p.n} — ${v.msg || "(내용 없음)"}`, "접수번호": no, "접점": "/mall 제품 문의", "유입 페이지": L().pathname, "출처": "direct", "_mall": JSON.stringify({ product: p.n, items: [{ n: p.n, c: catLine(p), q: 1 }], memo: v.msg || "" }) });
  if (ok) { $("#qnaForm").innerHTML = `<p class="m-note"><b>문의가 접수되었어요 (${no}).</b> 담당자가 영업일 1일 안에 연락드립니다.</p>`; } else toast("전송에 실패했어요. 02-2088-1454로 연락 주세요.");
}
function printQuote(v) {
  const items = cartItems(), today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), x = (s) => esc(s || "") || "&nbsp;";
  $("#printArea").innerHTML = `<div class="pq"><div class="pq__hd"><img src="${ASSET("/logo.png")}" alt=""><div><h1>견적 요청서</h1><p>요청일 ${today} · 모넷 IoT몰</p></div></div>
    <table><tr><th>요청 기관</th><td>${x(v.co)}</td><th>사업자번호</th><td>${x(v.biz)}</td></tr><tr><th>담당자</th><td>${x(v.nm)} ${v.dept ? "/ " + esc(v.dept) : ""}</td><th>연락처</th><td>${x(v.ph)}</td></tr>
    <tr><th>이메일</th><td>${x(v.em)}</td><th>희망 납기</th><td>${x(v.due)}</td></tr><tr><th>납품 지역</th><td>${x(v.rg)}</td><th>구매 유형</th><td>${x(v.type)}</td></tr></table>
    <table class="pq__items"><thead><tr><th>No.</th><th>품목</th><th>분류</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>${items.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.p.n)}</td><td>${esc(catLine(c.p))}</td><td>${c.qty}</td><td>견적</td><td>견적</td></tr>`).join("") || `<tr><td colspan="6">구성 상담 요청</td></tr>`}</tbody></table>
    ${v.memo ? `<p class="pq__memo">${esc(v.memo)}</p>` : ""}<p class="pq__foot">공급 · 문의: 주식회사 모넷코리아 · 사업자등록번호 242-88-01218 · 서울특별시 서초구 효령로 380, 2층 · 02-2088-1454 · 1015@monnit.com<br>본 문서는 견적 요청 내역이며, 단가와 납기는 모넷코리아가 발행하는 공식 견적서로 확정됩니다.</p></div>`;
  window.print();
}

/* ───────── 전역 이벤트 ───────── */
document.addEventListener("click", (e) => {
  const ext = HASHMODE && e.target.closest('a[href^="/"]:not([data-link])');
  if (ext) { e.preventDefault(); window.open("https://monnit.co.kr" + ext.getAttribute("href"), "_blank", "noopener"); return; }
  const a = e.target.closest("a[data-link]");
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.target !== "_blank") { e.preventDefault(); closeMega(); return go(a.getAttribute("href")); }
  if (e.target.closest("[data-stop]")) return;
  const fv = e.target.closest("[data-fav]"); if (fv) { e.preventDefault(); e.stopPropagation(); toggleFav(fv.dataset.fav); const y = scrollY; route(); window.scrollTo(0, y); return; }
  const ad = e.target.closest("[data-add]"); if (ad) { e.preventDefault(); e.stopPropagation(); fly(ad); add(ad.dataset.add, 1); const c = ad.closest(".m-card"); if (c) { ad.classList.add("is-in"); ad.textContent = "✓"; } else if (L().pathname === "/mall/cart") route(); return; }
  const ind = e.target.closest("[data-ind]"); if (ind) { const k = INDS.find((x) => x.id === ind.dataset.ind), it = indItems(k);
    $$(".m-indrow .m-ph img").forEach((im, i) => setTimeout(() => fly(im, im), i * 70));
    evc("i", k.id); it.forEach((x) => add(x.p.id, x.q, true)); ind.classList.add("is-done"); ind.textContent = `✓ ${it.length}개 품목을 담았어요`;
    setTimeout(() => toast(`${k.name} 구성 ${it.length}개 품목을 견적함에 담았어요`, it[0].p), Math.min(it.length * 70, 500)); return; }
  const pk = e.target.closest("[data-pack]"); if (pk) { const k = PACKS.find((x) => x.id === pk.dataset.pack); k.items.forEach(([n, q]) => { const p = byName(n); if (p) add(p.id, q, true); }); toast(`${k.name}를 견적함에 담았어요`); return; }
  const sp = e.target.closest("[data-solpack]"); if (sp) { const ap = APPS.find((x) => x.id === sp.dataset.solpack); const ps = prodsOfApp(ap).slice(0, 3); [...ps, byName("이더넷 게이트웨이"), byName("iMonnit 클라우드 관리 SW")].filter(Boolean).forEach((p) => add(p.id, 1, true)); toast("추천 구성을 견적함에 담았어요 — 수량은 견적함에서 조정하세요"); return; }
  const uc = e.target.closest("[data-uncmp]"); if (uc) { toggleCmp(uc.dataset.uncmp, false); route(); return; }
  const ro = e.target.closest("[data-reorder]"); if (ro) { const h = HIST.find((x) => x.no === ro.dataset.reorder); (h.items || []).forEach((it) => add(it.id, it.qty, true)); go("/mall/cart"); return; }
  const card = e.target.closest("[data-go]"); if (card && !e.target.closest("a,button,input,label")) { go(card.dataset.go); return; }
  if (!e.target.closest(".m-all")) closeMega();
});
document.addEventListener("change", (e) => { const c = e.target.closest("[data-cmp]"); if (!c) return; if (!toggleCmp(c.dataset.cmp, c.checked)) c.checked = false; });
window.addEventListener("popstate", (e) => { if (HASHMODE) CUR = (e.state && e.state.p) || location.hash.replace(/^#/, ""); route(); });
if (HASHMODE) window.addEventListener("hashchange", () => { const h = location.hash.replace(/^#/, ""); if (h && h !== CUR) { CUR = h; route(); } });
$("#searchForm").onsubmit = (e) => { e.preventDefault(); const q = $("#q").value.trim(); go(q ? "/mall/search?q=" + encodeURIComponent(q) : "/mall/category/all"); };
$("#cmpClear").onclick = () => { CMP = []; LS.set("mnkCmp", CMP); route(); };
/* 전체 카테고리 메가메뉴 */
function mega() {
  return `<div class="m-mega__in"><div><h5>무선 센서</h5>${GROUPS.map((g) => `<a href="/mall/category/sensors?g=${g.id}" data-link><i style="background:${g.color}"></i>${esc(g.ko)} <small>${P.filter((p) => p.g === g.id).length}</small></a>`).join("")}</div>
    ${["gateways", "software", "accessories"].map((c) => `<div><h5>${CAT_KO[c]}</h5>${P.filter((p) => p.c === c).map((p) => `<a href="/mall/product/${esc(p.id)}" data-link>${esc(p.n)}</a>`).join("")}</div>`).join("")}
    <div><h5>업종별 구성</h5>${INDS.map((k) => `<a href="/mall/industry/${k.id}" data-link>${esc(k.name)}</a>`).join("")}</div>
    <div><h5>바로가기</h5><a href="/mall/packages" data-link>추천 패키지</a><a href="/mall/solutions" data-link>산업별 솔루션</a><a href="/mall/quick" data-link>모델명으로 빠른 견적</a><a href="/mall/compare" data-link>제품 비교</a><a href="/mall/help" data-link>고객센터</a></div></div>`;
}
function closeMega() { $("#mega").hidden = true; $("#allBtn").setAttribute("aria-expanded", "false"); }
$("#allBtn").onclick = (e) => { e.stopPropagation(); const m = $("#mega"); if (m.hidden) { m.innerHTML = mega(); m.hidden = false; $("#allBtn").setAttribute("aria-expanded", "true"); } else closeMega(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMega(); });

/* ───────── 이용 기록 (서버 /api/mall/ev — 방문 세션당 한 줄, 개인정보 없음) ─────────
   본 제품 · 담은 제품 · 검색어 · 업종 구성 담기 횟수만 모아 화면을 떠날 때 한 번 보낸다. /ops/mall 「많이 본·담은 제품」 */
const EV = { sid: Math.random().toString(36).slice(2, 10), v: {}, a: {}, s: {}, i: {}, pg: 0, q: false, dev: matchMedia("(max-width:700px)").matches ? "m" : "d", src: (() => { try { return sessionStorage.getItem("mnkMallSrc") || document.referrer.replace(/^https?:\/\//, "").split("/")[0] || "direct"; } catch (e) { return "direct"; } })() };
const evc = (k, name, n = 1) => { if (name) EV[k][name] = (EV[k][name] || 0) + n; };
function evFlush() {
  if (HASHMODE || !navigator.sendBeacon) return;
  if (!EV.pg && !Object.keys(EV.a).length && !Object.keys(EV.s).length) return;
  try { navigator.sendBeacon("/api/mall/ev", new Blob([JSON.stringify(EV)], { type: "application/json" })); } catch (e) {}
  EV.v = {}; EV.a = {}; EV.s = {}; EV.i = {}; EV.pg = 0; EV.q = false;
}
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") evFlush(); });
addEventListener("pagehide", evFlush);

/* ───────── 인터랙션 ───────── */
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
/* 담기 → 제품 사진이 견적함 아이콘으로 날아감 */
function fly(from, imgEl) {
  if (RM) return;
  const card = from.closest(".m-card,.m-rowitem,.m-pd,.m-indrow");
  const src = imgEl || (card && card.querySelector(".m-ph img"));
  const cart = matchMedia("(max-width:700px)").matches ? $("#tabCart") || $(".m-ic--cart") : $(".m-ic--cart");
  if (!src || !cart || !src.complete) return;
  const a = src.getBoundingClientRect(), b = cart.getBoundingClientRect();
  const g = src.cloneNode(); g.className = "m-fly"; g.removeAttribute("loading");
  const sz = Math.min(a.width, 120);
  Object.assign(g.style, { left: a.left + a.width / 2 - sz / 2 + "px", top: a.top + a.height / 2 - sz / 2 + "px", width: sz + "px", height: sz + "px" });
  document.body.appendChild(g);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const an = g.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 80}px) scale(.6)`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px,${dy}px) scale(.12)`, opacity: 0.4 }], { duration: 720, easing: "cubic-bezier(.5,0,.3,1)" });
  an.onfinish = () => g.remove();
}
/* 스크롤하면 카드·섹션이 차례로 떠오름 */
let IO = null;
function reveal() {
  if (RM || !("IntersectionObserver" in window)) return;
  if (!IO) IO = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); IO.unobserve(en.target); } }), { rootMargin: "0px 0px -6% 0px" });
  const els = $$("#view .m-card, #view .m-sec, #view .m-pack, #view .m-rowitem, #view .m-sol, #view .m-step, #view .m-events a, #view .m-ind, #view .m-indrow");
  els.forEach((el, k) => { if (el.getBoundingClientRect().top < innerHeight) return; el.classList.add("rv"); el.style.setProperty("--d", (k % 4) * 60 + "ms"); IO.observe(el); });
}
/* 모바일 하단 탭바 */
function tabbar(path) {
  $$("#tabbar a").forEach((a) => { const h = a.getAttribute("href"); a.classList.toggle("is-on", h === "/mall" ? path === "/mall" || path === "/mall/" : path.startsWith(h)); });
  /* 목록 화면 — 모바일 필터 시트 */
  const fb = $("#fltBtn"), fl = $("#flt");
  if (fb && fl) { const close = () => { fl.classList.remove("is-open"); document.body.classList.remove("no-scroll"); $("#scrim").hidden = true; };
    fb.onclick = () => { fl.classList.add("is-open"); document.body.classList.add("no-scroll"); $("#scrim").hidden = false; $("#scrim").onclick = close; };
    $("#fltX").onclick = close; $$("a", fl).forEach((a) => a.addEventListener("click", close)); }
}
/* 업종 카드 — 커서를 따라가는 빛 + 살짝 기울기 (마우스 환경만) */
if (matchMedia("(hover:hover) and (pointer:fine)").matches && !RM) {
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest && e.target.closest(".m-ind"); if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty("--mx", x * 100 + "%"); c.style.setProperty("--my", y * 100 + "%");
    c.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-4px)`;
  });
  document.addEventListener("pointerout", (e) => { const c = e.target.closest && e.target.closest(".m-ind"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });
}
/* 검색 — 입력하면 제품 사진과 함께 바로 추천 (↑↓ · Enter) */
{ const q = $("#q"), box = document.createElement("div"); box.className = "m-sugg"; box.hidden = true; document.body.appendChild(box);
  let sel = -1, list = [];
  const place = () => { const r = $("#searchForm").getBoundingClientRect(); Object.assign(box.style, { left: r.left + "px", top: r.bottom + 6 + "px", width: r.width + "px" }); };
  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, "");
  const draw = () => {
    const v = norm(q.value); if (!v) { box.hidden = true; return; }
    list = P.map((p) => { const n = norm(p.n), d = norm(p.d + " " + catLine(p)); return { p, sc: n.startsWith(v) ? 3 : n.includes(v) ? 2 : d.includes(v) ? 1 : 0 }; }).filter((x) => x.sc).sort((a, b) => b.sc - a.sc || b.p.score - a.p.score).slice(0, 6).map((x) => x.p);
    const inds = INDS.filter((k) => norm(k.name + k.desc).includes(v)).slice(0, 2);
    sel = -1; place();
    box.innerHTML = (list.length ? list.map((p, i) => `<a href="/mall/product/${esc(p.id)}" data-link data-i="${i}">${ico(p, "m-ico--sm")}<span><b>${esc(p.n)}</b><small>${esc(catLine(p))}</small></span><i>›</i></a>`).join("") : `<p>‘${esc(q.value)}’와 맞는 제품이 없어요. Enter로 전체 검색</p>`)
      + inds.map((k) => `<a href="/mall/industry/${k.id}" data-link class="m-sugg__ind"><em>${esc(k.en)}</em><span><b>${esc(k.name)} 추천 구성</b><small>${indItems(k).length}개 품목</small></span><i>›</i></a>`).join("");
    box.hidden = false;
  };
  q.addEventListener("input", draw); q.addEventListener("focus", draw);
  q.addEventListener("keydown", (e) => {
    const as = $$("a", box); if (box.hidden || !as.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + as.length) % as.length; as.forEach((a, i) => a.classList.toggle("is-sel", i === sel)); }
    else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); box.hidden = true; q.blur(); go(as[sel].getAttribute("href")); }
    else if (e.key === "Escape") box.hidden = true;
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".m-sugg,#searchForm")) box.hidden = true; else if (e.target.closest(".m-sugg a")) { box.hidden = true; q.blur(); } });
  addEventListener("resize", () => { if (!box.hidden) place(); }); addEventListener("scroll", () => { if (!box.hidden) place(); }, { passive: true });
  $("#searchForm").addEventListener("submit", () => (box.hidden = true));
}
/* 스크롤 — 헤더 축소 · 맨 위로 버튼 */
{ let tk = false; const on = () => { tk = false; const y = scrollY; document.body.classList.toggle("is-scrolled", y > 60); $("#toTop").classList.toggle("is-on", y > 700); };
  addEventListener("scroll", () => { if (!tk) { tk = true; requestAnimationFrame(on); } }, { passive: true }); }
$("#toTop").onclick = () => window.scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" });

/* ───────── 시작 ───────── */
prep(D.products || []);
try { const s = new URLSearchParams(L().search); const src = ["utm_source", "utm_campaign", "gclid", "n_keyword"].filter((k) => s.get(k)).map((k) => k + "=" + s.get(k)).join("&"); if (src) sessionStorage.setItem("mnkMallSrc", src); } catch (e) {}
/* 결재용 링크(/mall/cart?items=id*qty,...) — 같은 구성으로 견적함 채우기 */
{ const it = new URLSearchParams(L().search).get("items");
  if (it) { it.split(",").forEach((t) => { const [id, n] = t.split("*"); if (P.find((p) => p.id === id) && !CART.some((c) => c.id === id)) CART.push({ id, qty: Math.max(1, Math.min(9999, Number(n) || 1)) }); }); saveCart(); if (HASHMODE) CUR = "/mall/cart"; else history.replaceState({}, "", "/mall/cart"); setTimeout(() => toast("공유받은 구성을 견적함에 담았어요"), 300); } }
route();
(HASHMODE ? Promise.reject() : fetch("/api/billing/me")).then((r) => r.json()).then((j) => { if (j && j.ok && j.member) { ME = j; $("#uLogin").textContent = tierOf().name + " 회원"; if (["", "my", "quote"].includes((L().pathname.split("/")[2] || ""))) route(); } }).catch(() => {});
})();
