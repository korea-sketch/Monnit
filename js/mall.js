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
  { id: "welcome", name: "웰컴", color: "#86868b", cond: "회원 가입 즉시", perks: ["견적 영업일 1일 내 회신", "데이터시트·설치 가이드 바로 받기", "신제품·기획전 소식"] },
  { id: "silver", name: "실버", color: "#9aa7b8", cond: "첫 거래 완료 후", perks: ["견적 우선 회신", "회원 전용 기획전 가격 안내", "설치 후 원격 점검 1회"] },
  { id: "gold", name: "골드", color: "#c9a227", cond: "연간 거래 1,000만 원 이상", perks: ["전담 담당자 배정", "프로젝트 단가 협의", "데모 키트 대여 상담"] },
  { id: "partner", name: "파트너", color: "#2f7bff", cond: "SI·설치 파트너 계약", perks: ["파트너 단가", "기술 교육·인증", "공동 제안·영업 지원"] },
];

function slugOf(p, i) { return (p.c + "-" + (p.n || "").replace(/[^\w가-힣]+/g, "-").replace(/^-|-$/g, "")).toLowerCase() || "p" + i; }
function iconKey(p) { const hay = (p.n || "") + " " + (p.g || "") + " " + p.c; for (const [re, k] of RULES) if (re.test(hay)) return k; return p.c === "software" ? "software" : p.c === "gateways" ? "gateway" : p.c === "accessories" ? "control" : "sensor"; }
function ico(p, cls = "") { const k = iconKey(p); return `<span class="m-ico h-${HUE[k] || "cyan"} ${cls}"><svg viewBox="0 0 24 24">${(D.icons || {})[k] || (D.icons || {}).sensor || ""}</svg></span>`; }
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
  const top = P.filter((p) => p.c === "sensors").sort((a, b) => b.score - a.score).slice(0, 8).map((p) => p.id);
  P.forEach((p) => { p.hot = top.includes(p.id); });
}

/* ───────── 상태 ───────── */
let CART = LS.get("mnkQuoteCart", []);           // 제품몰(/store)과 같은 견적함
let FAV = LS.get("mnkFav", []), RECENT = LS.get("mnkRecent", []), CMP = LS.get("mnkCmp", []);
let HIST = LS.get("mnkMallQuotes", []);
let ME = null;
const saveCart = () => { LS.set("mnkQuoteCart", CART); badge(); };
function badge() { const n = CART.reduce((a, c) => a + c.qty, 0); $("#cartN").hidden = !n; $("#cartN").textContent = n; }
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("is-on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("is-on"), 2600); }
function add(id, qty = 1, quiet) {
  const it = CART.find((c) => c.id === id);
  if (it) it.qty = Math.min(9999, it.qty + qty); else CART.push({ id, qty: Math.max(1, Math.min(9999, qty)) });
  saveCart(); const b = $(".m-ic--cart"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  if (!quiet) { const p = P.find((x) => x.id === id); toast(`${p ? p.n : "제품"} ${qty}개를 견적함에 담았어요`); }
}
function toggleFav(id) { FAV = FAV.includes(id) ? FAV.filter((x) => x !== id) : [id, ...FAV].slice(0, 50); LS.set("mnkFav", FAV); toast(FAV.includes(id) ? "관심 상품에 담았어요" : "관심 상품에서 뺐어요"); }
function toggleCmp(id, on) {
  if (on && !CMP.includes(id)) { if (CMP.length >= 4) { toast("비교는 4개까지 할 수 있어요"); return false; } CMP.push(id); }
  if (!on) CMP = CMP.filter((x) => x !== id);
  LS.set("mnkCmp", CMP); cmpBar(); return true;
}
function cmpBar() { const n = CMP.length; $("#cmpBar").hidden = !n || location.pathname === "/mall/compare"; $("#cmpTxt").textContent = `비교함 ${n}/4 · ` + CMP.map((id) => (P.find((p) => p.id === id) || {}).n).filter(Boolean).join(", "); }

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
  return `<section class="m-hero"><div class="m-in m-hero__in">
      <div class="m-hero__main" id="slider">${BANNERS.map((b, i) => `<a class="m-slide${i ? "" : " is-on"}" href="${b.href}"><img src="${b.img}" alt="" ${i ? 'loading="lazy"' : ""}><div><span class="m-tag m-tag--w">${esc(b.tag)}</span><b>${esc(b.title)}</b><small>${esc(b.sub)}</small></div></a>`).join("")}
        <div class="m-dots">${BANNERS.map((_, i) => `<button type="button" data-slide="${i}" class="${i ? "" : "is-on"}" aria-label="${i + 1}번 배너"></button>`).join("")}</div></div>
      <aside class="m-hero__side"><div class="m-hello"><b>${ME && ME.member ? esc(ME.member.email) + " 님" : "기업 구매 회원이신가요?"}</b>
          <p>${ME && ME.member ? `<span class="m-grade" style="--g:${tierOf().color}">${tierOf().name}</span> 등급 혜택이 적용돼요.` : "로그인하면 견적 정보가 자동으로 채워지고 등급 혜택이 적용돼요."}</p>
          <div class="m-hello__btns">${ME && ME.member ? `<a class="m-btn m-btn--sm" href="/mall/my" data-link>마이페이지</a>` : `<a class="m-btn m-btn--sm" href="/account?next=/mall">로그인 · 가입</a>`}<a class="m-btn m-btn--sm m-btn--line" href="/mall/cart" data-link>견적함 ${CART.length ? CART.length + "종" : ""}</a></div></div>
        <a class="m-sidebox" href="/mall/quick" data-link><b>모델명으로 빠른 견적</b><span>구매 목록을 붙여 넣으면 한 번에 담아요 ›</span></a>
        <a class="m-sidebox m-sidebox--navy" href="/mall/quote" data-link><b>구성 상담 요청</b><span>무엇이 필요한지 몰라도 현장만 알려 주세요 ›</span></a></aside>
    </div></section>
    <div class="m-in">
      <section class="m-quickcats">${[["sensors", "무선 센서", "temperature"], ["gateways", "게이트웨이", "gateway"], ["software", "플랫폼·SW", "software"], ["accessories", "액세서리", "control"]].map(([c, t, k]) => `<a href="/mall/category/${c}" data-link><span class="m-ico h-${HUE[k]}"><svg viewBox="0 0 24 24">${D.icons[k] || D.icons.sensor}</svg></span>${t}<small>${P.filter((p) => p.c === c).length}종</small></a>`).join("")}
        ${GROUPS.slice(0, 6).map((g) => { const f = P.find((p) => p.g === g.id); return `<a href="/mall/category/sensors?g=${g.id}" data-link>${f ? ico(f) : ""}${esc(g.ko)}<small>${P.filter((p) => p.g === g.id).length}종</small></a>`; }).join("")}</section>
      <ul class="m-benefits"><li><b>공식 견적서</b>영업일 1일 회신</li><li><b>세금계산서</b>발행 · 지급 조건 협의</li><li><b>무선 940MHz</b>배선 공사 없이 설치</li><li><b>기본 보증 1년</b>설치 후 기술지원</li></ul>
      ${sec("많이 찾는 제품", "적용 분야 문의가 많은 순", `<div class="m-grid m-grid--4">${best.map((p) => card(p)).join("")}</div>`, "/mall/category/sensors")}
      ${sec("현장별 추천 패키지", "자주 쓰는 구성을 한 번에 견적 — 수량은 견적 때 현장에 맞춰 조정", `<div class="m-packs">${PACKS.slice(0, 3).map(packCard).join("")}</div>`, "/mall/packages")}
      <section class="m-sec" id="events"><div class="m-sec__hd"><h2>기획전</h2><span>지금 문의가 많은 솔루션</span></div><div class="m-events">${BANNERS.map((b) => `<a href="${b.href}"><img src="${b.img}" alt="" loading="lazy"><div><span class="m-tag">${esc(b.tag)}</span><b>${esc(b.title)}</b><small>${esc(b.sub)}</small></div></a>`).join("")}</div></section>
      ${sec("산업별 솔루션", "현장에 맞는 센서를 용도로 찾기", `<div class="m-apps">${APPS.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 12).map((a) => `<a href="/mall/solution/${esc(a.id)}" data-link><b>${esc(a.name)}</b><small>${esc(a.desc || "")}</small></a>`).join("")}</div>`, "/mall/solutions")}
      ${sec("기업 구매, 이렇게 진행돼요", "", stepsHTML())}
      ${rec.length ? sec("최근 본 제품", "", `<div class="m-grid m-grid--6">${rec.map((p) => card(p)).join("")}</div>`) : ""}
      <section class="m-sec"><div class="m-sec__hd"><h2>함께하는 고객사</h2><span>공공 · 제조 · 바이오 · 유통 · 연구 기관</span><a href="/stories" class="m-more">도입 사례 ›</a></div><div class="m-logos">${LOGOS.map((l) => `<img src="/images/clogo-${l}.png" alt="" onerror="this.remove()">`).join("")}</div></section>
    </div>`;
}
function stepsHTML() {
  return `<ol class="m-steps"><li><i>1</i><b>제품 담기</b><span>센서·게이트웨이·플랫폼을 견적함에</span></li><li><i>2</i><b>견적 요청서</b><span>수량 · 희망 납기 · 필요 서류</span></li><li><i>3</i><b>공식 견적서</b><span>영업일 1일 안에 단가 · 납기 회신</span></li><li><i>4</i><b>발주 · 계약</b><span>세금계산서 발행 · 지급 조건 협의</span></li><li><i>5</i><b>납품 · 설치 · 교육</b><span>현장 설치부터 플랫폼 교육까지</span></li></ol>`;
}
function packCard(k) {
  const its = k.items.map(([n, q]) => [byName(n), q]).filter(([p]) => p);
  return `<article class="m-pack"><img src="${k.img}" alt="" loading="lazy"><div class="m-pack__body"><small>${esc(k.for)}</small><h3>${esc(k.name)}</h3><p>${esc(k.desc)}</p>
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
  const link = (o) => { const u = new URLSearchParams(qs); Object.entries(o).forEach(([k, v]) => (v ? u.set(k, v) : u.delete(k))); const s = u.toString(); return location.pathname + (s ? "?" + s : ""); };
  const topApps = APPS.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 14);
  return `<div class="m-in">${crumbs(q ? [["검색", ""]] : [[CAT_KO[cat] || "전체 제품", g ? "/mall/category/" + cat : ""], ...(g ? [[grpName(g), ""]] : [])])}
    <div class="m-catbanner"><div><h1>${esc(title)}</h1><p>${esc(q ? `${list.length}개 제품을 찾았어요` : CAT_DESC[cat] || "Monnit ALTA 무선 IoT 전 제품")}</p></div><a class="m-btn m-btn--w" href="/mall/quote" data-link>구성 상담 요청</a></div>
    <div class="m-listwrap">
      <aside class="m-filter">
        <h4>카테고리</h4>
        <a href="/mall/category/all" data-link class="${cat === "all" && !q ? "is-on" : ""}">전체 제품<small>${P.length}</small></a>
        ${CATS.map((c) => `<a href="/mall/category/${c.id}" data-link class="${cat === c.id && !g ? "is-on" : ""}">${esc(CAT_KO[c.id])}<small>${P.filter((p) => p.c === c.id).length}</small></a>` +
          (c.id === "sensors" ? `<div class="m-filter__sub">${GROUPS.map((x) => `<a href="/mall/category/sensors?g=${x.id}" data-link class="${g === x.id ? "is-on" : ""}"><i style="background:${x.color}"></i>${esc(x.ko)}<small>${P.filter((p) => p.g === x.id).length}</small></a>`).join("")}</div>` : "")).join("")}
        <h4>활용 분야</h4>
        <div class="m-filter__apps">${topApps.map((a) => `<a href="${link({ app: app === a.id ? "" : a.id })}" data-link class="${app === a.id ? "is-on" : ""}">${esc(a.name)}</a>`).join("")}</div>
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
      <div class="m-pd__gal">${ico(p, "m-ico--xl")}<div class="m-pd__note">무선 · 배터리 · 940MHz</div></div>
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
        ${p.c === "sensors" && !CART.some((c) => (P.find((x) => x.id === c.id) || {}).c === "gateways") && gw ? `<div class="m-upsell"><b>센서는 게이트웨이와 함께 써야 해요.</b> 게이트웨이 1대가 반경 내 센서 250개까지 연결합니다.<button class="m-btn m-btn--sm m-btn--navy" type="button" data-add="${esc(gw.id)}">${esc(gw.n)} 담기</button></div>` : ""}
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
function cartItems() { return CART.map((c) => ({ ...c, p: P.find((x) => x.id === c.id) })).filter((c) => c.p); }
function vCart() {
  setTitle("견적함");
  const items = cartItems();
  const hasSensor = items.some((c) => c.p.c === "sensors"), hasGw = items.some((c) => c.p.c === "gateways"), hasSw = items.some((c) => c.p.c === "software");
  const gw = byName("이더넷 게이트웨이"), sw = byName("iMonnit 클라우드 관리 SW");
  return `<div class="m-in">${flow(1)}<div class="m-cartwrap"><div>
    <div class="m-cartbar"><label class="m-chk"><input type="checkbox" id="selAll" checked>전체 선택</label><button class="m-btn m-btn--sm m-btn--line" type="button" id="delSel">선택 삭제</button><span class="m-sp"></span>
      ${items.length ? `<button class="m-btn m-btn--sm m-btn--line" type="button" id="cPrint">견적 요청서 인쇄 · PDF</button><button class="m-btn m-btn--sm m-btn--line" type="button" id="cShare">결재용 링크 복사</button>` : ""}</div>
    ${items.length ? `<table class="m-carttbl"><thead><tr><th></th><th>품목</th><th>수량</th><th>단가</th><th>금액</th><th></th></tr></thead><tbody>
      ${items.map((c) => `<tr><td><input type="checkbox" class="selOne" value="${esc(c.id)}" checked></td><td><a class="m-cartitem" href="/mall/product/${esc(c.id)}" data-link>${ico(c.p, "m-ico--sm")}<span><b>${esc(c.p.n)}</b><small>${esc(catLine(c.p))}</small></span></a></td>
        <td><div class="m-stepper m-stepper--sm"><button type="button" data-cq="${esc(c.id)}" data-d="-1">−</button><input type="number" min="1" max="9999" value="${c.qty}" data-cqi="${esc(c.id)}"><button type="button" data-cq="${esc(c.id)}" data-d="1">＋</button></div></td>
        <td class="m-muted">견적</td><td class="m-muted">견적</td><td><button class="m-x" type="button" data-rm="${esc(c.id)}" aria-label="삭제">×</button></td></tr>`).join("")}</tbody></table>`
      : `<div class="m-empty"><b>견적함이 비어 있어요.</b><p>제품을 담거나, 제품 없이 구성 상담만 요청하셔도 됩니다.</p><div class="m-empty__btns"><a class="m-btn m-btn--line" href="/mall/category/sensors" data-link>제품 둘러보기</a><a class="m-btn m-btn--line" href="/mall/quick" data-link>모델명으로 담기</a><a class="m-btn" href="/mall/quote" data-link>구성 상담 요청</a></div></div>`}
    ${hasSensor && (!hasGw || !hasSw) ? `<div class="m-upsell"><b>센서만으로는 데이터를 볼 수 없어요.</b> ${!hasGw ? "게이트웨이" : ""}${!hasGw && !hasSw ? "와 " : ""}${!hasSw ? "플랫폼" : ""}도 함께 견적받으시겠어요?
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
    <section class="m-box"><h3>요청 품목 <a href="/mall/cart" data-link class="m-more">견적함 수정 ›</a></h3>${items.length ? `<table class="m-carttbl m-carttbl--ro"><tbody>${items.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.p.n)}</b><small>${esc(catLine(c.p))}</small></td><td>${c.qty}개</td></tr>`).join("")}</tbody></table>` : `<p class="m-muted">담은 제품 없이 <b>구성 상담</b>으로 요청합니다. 아래 메모에 현장 상황을 적어 주세요.</p>`}</section>
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
    ${sec("회원 등급 혜택", "등급은 거래 실적에 따라 담당자가 지정합니다", tiersHTML())}</div>`;
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
    ["회원 등급은 어떻게 정해지나요?", "이메일 인증만으로 웰컴 회원이 되고, 이후 등급은 거래 실적에 따라 담당자가 지정합니다."]];
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
  const path = location.pathname.replace(/\/+$/, "") || "/mall", qs = new URLSearchParams(location.search), seg = path.split("/").slice(2).map(decodeURIComponent);
  let html;
  if (!seg.length) html = vHome();
  else if (seg[0] === "category") html = vList(seg[1] || "all", qs);
  else if (seg[0] === "search") html = vList("all", qs);
  else if (seg[0] === "product") html = vProduct(seg[1]);
  else if (seg[0] === "packages") html = vPacks();
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
  $$(".m-gnb a").forEach((a) => a.classList.toggle("is-on", a.getAttribute("href") === path));
  badge(); cmpBar(); bind(seg);
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView({ behavior: "smooth", block: "start" }), 30); } else window.scrollTo(0, 0);
}
function go(href) { if (href === location.pathname + location.search + location.hash) return route(); history.pushState({}, "", href); route(); }

/* ───────── 화면별 이벤트 ───────── */
function bind(seg) {
  /* 홈 슬라이더 */
  const sl = $("#slider");
  if (sl) {
    let i = 0; const show = (n) => { i = (n + BANNERS.length) % BANNERS.length; $$(".m-slide", sl).forEach((s, k) => s.classList.toggle("is-on", k === i)); $$(".m-dots button", sl).forEach((d, k) => d.classList.toggle("is-on", k === i)); };
    $$(".m-dots button", sl).forEach((d) => d.onclick = (e) => { e.preventDefault(); show(Number(d.dataset.slide)); });
    clearInterval(bind.t); bind.t = setInterval(() => { if (document.body.contains(sl)) show(i + 1); else clearInterval(bind.t); }, 5000);
  }
  /* 목록 보기 방식 */
  $$("[data-mode]").forEach((b) => b.onclick = () => { LS.set("mnkMallView", b.dataset.mode); route(); });
  /* 상세 */
  if (seg[0] === "product") {
    const qi = $("#pdQty"), id = seg[1];
    $$("[data-pq]").forEach((b) => b.onclick = () => { qi.value = Math.max(1, Math.min(9999, (Number(qi.value) || 1) + Number(b.dataset.pq))); });
    $("#pdAdd").onclick = () => add(id, Number(qi.value) || 1);
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
  const u = location.origin + "/mall/cart?items=" + encodeURIComponent(CART.map((c) => c.id + "*" + c.qty).join(","));
  (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("결재용 링크를 복사했어요 — 같은 구성으로 열립니다"), () => prompt("아래 링크를 복사하세요", u));
}
function readForm() {
  const g = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
  return { co: g("fCo"), biz: g("fBiz"), nm: g("fNm"), dept: g("fDept"), ph: g("fPh"), em: g("fEm"), rg: g("fRg"), due: g("fDue"), type: g("fType"), budget: g("fBudget"), inst: g("fInst"), pay: g("fPay"), memo: g("fMemo"),
    docs: $$(".fDoc").filter((x) => x.checked).map((x) => x.value) };
}
async function postLead(payload) {
  try { const r = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_type: "contact", page: "/mall", ts: new Date().toISOString(), payload }) }); return r.ok || r.status === 204; } catch (e) { return false; }
}
const reqNo = () => "MQ-" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
async function submitQuote(e) {
  e.preventDefault();
  const v = readForm();
  if (!v.co || !v.nm || !v.ph || !v.em) return toast("회사 · 담당자 · 휴대전화 · 이메일을 입력해 주세요.");
  if (!/^0\d{8,10}$/.test(v.ph.replace(/\D/g, ""))) return toast("휴대전화 번호를 확인해 주세요.");
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.em)) return toast("이메일 주소를 확인해 주세요.");
  if (!$("#fOk").checked) return toast("개인정보 수집 · 이용에 동의해 주세요.");
  LS.set("mnkQuoteForm", { company: v.co, bizNo: v.biz, manager: v.nm, dept: v.dept, phone: v.ph, email: v.em, siteAddr: v.rg });
  const items = cartItems(), no = reqNo();
  const lines = items.map((c) => `${c.p.n}(${catLine(c.p)}) × ${c.qty}`).join(" / ");
  const grade = ME && ME.member ? tierOf().name + " (" + ME.member.email + ")" : "비회원";
  const src = (() => { try { return sessionStorage.getItem("mnkMallSrc") || "direct"; } catch (err) { return "direct"; } })();
  const payload = { "회사명": v.co, "담당자명": v.nm + (v.dept ? " / " + v.dept : ""), "전화번호": v.ph, "이메일": v.em, "문의항목": items.length ? "IoT몰 견적 요청" : "IoT몰 구성 상담", "지역": v.rg || "(미기재)",
    "문의 사항": `[${no}] ${lines || "제품 미선택 — 구성 상담"} · 구매 유형: ${v.type} · 희망 납기: ${v.due} · 설치: ${v.inst} · 지급: ${v.pay}${v.budget ? " · 예산: " + v.budget : ""}${v.biz ? " · 사업자번호: " + v.biz : ""} · 요청 서류: ${v.docs.join(", ") || "없음"} · 회원: ${grade}${v.memo ? " · 메모: " + v.memo : ""}`,
    "접수번호": no, "접점": "/mall 견적 요청서", "유입 페이지": "/mall/quote", "출처": src };
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
  CART = []; saveCart(); go("/mall/done/" + no);
}
async function productQna(p) {
  const g = (id) => $("#" + id).value.trim();
  const v = { co: g("qaCo"), nm: g("qaNm"), ph: g("qaPh"), em: g("qaEm"), msg: g("qaMsg") };
  if (!v.co || !v.nm || !v.ph) return toast("회사 · 담당자 · 연락처를 입력해 주세요.");
  if (!$("#qaOk").checked) return toast("개인정보 수집 · 이용에 동의해 주세요.");
  const no = reqNo().replace("MQ", "PQ");
  const ok = await postLead({ "회사명": v.co, "담당자명": v.nm, "전화번호": v.ph, ...(v.em ? { "이메일": v.em } : {}), "문의항목": "IoT몰 제품 문의", "지역": "(미기재)", "문의 사항": `[${no}] ${p.n} — ${v.msg || "(내용 없음)"}`, "접수번호": no, "접점": "/mall 제품 문의", "유입 페이지": location.pathname, "출처": "direct" });
  if (ok) { $("#qnaForm").innerHTML = `<p class="m-note"><b>문의가 접수되었어요 (${no}).</b> 담당자가 영업일 1일 안에 연락드립니다.</p>`; } else toast("전송에 실패했어요. 02-2088-1454로 연락 주세요.");
}
function printQuote(v) {
  const items = cartItems(), today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), x = (s) => esc(s || "") || "&nbsp;";
  $("#printArea").innerHTML = `<div class="pq"><div class="pq__hd"><img src="/logo.png" alt=""><div><h1>견적 요청서</h1><p>요청일 ${today} · 모넷 IoT몰</p></div></div>
    <table><tr><th>요청 기관</th><td>${x(v.co)}</td><th>사업자번호</th><td>${x(v.biz)}</td></tr><tr><th>담당자</th><td>${x(v.nm)} ${v.dept ? "/ " + esc(v.dept) : ""}</td><th>연락처</th><td>${x(v.ph)}</td></tr>
    <tr><th>이메일</th><td>${x(v.em)}</td><th>희망 납기</th><td>${x(v.due)}</td></tr><tr><th>납품 지역</th><td>${x(v.rg)}</td><th>구매 유형</th><td>${x(v.type)}</td></tr></table>
    <table class="pq__items"><thead><tr><th>No.</th><th>품목</th><th>분류</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>${items.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.p.n)}</td><td>${esc(catLine(c.p))}</td><td>${c.qty}</td><td>견적</td><td>견적</td></tr>`).join("") || `<tr><td colspan="6">구성 상담 요청</td></tr>`}</tbody></table>
    ${v.memo ? `<p class="pq__memo">${esc(v.memo)}</p>` : ""}<p class="pq__foot">공급 · 문의: 주식회사 모넷코리아 · 사업자등록번호 242-88-01218 · 서울특별시 서초구 효령로 380, 2층 · 02-2088-1454 · 1015@monnit.com<br>본 문서는 견적 요청 내역이며, 단가와 납기는 모넷코리아가 발행하는 공식 견적서로 확정됩니다.</p></div>`;
  window.print();
}

/* ───────── 전역 이벤트 ───────── */
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.target !== "_blank") { e.preventDefault(); closeMega(); return go(a.getAttribute("href")); }
  if (e.target.closest("[data-stop]")) return;
  const fv = e.target.closest("[data-fav]"); if (fv) { e.preventDefault(); e.stopPropagation(); toggleFav(fv.dataset.fav); const y = scrollY; route(); window.scrollTo(0, y); return; }
  const ad = e.target.closest("[data-add]"); if (ad) { e.preventDefault(); e.stopPropagation(); add(ad.dataset.add, 1); const c = ad.closest(".m-card"); if (c) { ad.classList.add("is-in"); ad.textContent = "✓"; } else if (location.pathname === "/mall/cart") route(); return; }
  const pk = e.target.closest("[data-pack]"); if (pk) { const k = PACKS.find((x) => x.id === pk.dataset.pack); k.items.forEach(([n, q]) => { const p = byName(n); if (p) add(p.id, q, true); }); toast(`${k.name}를 견적함에 담았어요`); return; }
  const sp = e.target.closest("[data-solpack]"); if (sp) { const ap = APPS.find((x) => x.id === sp.dataset.solpack); const ps = prodsOfApp(ap).slice(0, 3); [...ps, byName("이더넷 게이트웨이"), byName("iMonnit 클라우드 관리 SW")].filter(Boolean).forEach((p) => add(p.id, 1, true)); toast("추천 구성을 견적함에 담았어요 — 수량은 견적함에서 조정하세요"); return; }
  const uc = e.target.closest("[data-uncmp]"); if (uc) { toggleCmp(uc.dataset.uncmp, false); route(); return; }
  const ro = e.target.closest("[data-reorder]"); if (ro) { const h = HIST.find((x) => x.no === ro.dataset.reorder); (h.items || []).forEach((it) => add(it.id, it.qty, true)); go("/mall/cart"); return; }
  const card = e.target.closest("[data-go]"); if (card && !e.target.closest("a,button,input,label")) { go(card.dataset.go); return; }
  if (!e.target.closest(".m-all")) closeMega();
});
document.addEventListener("change", (e) => { const c = e.target.closest("[data-cmp]"); if (!c) return; if (!toggleCmp(c.dataset.cmp, c.checked)) c.checked = false; });
window.addEventListener("popstate", route);
$("#searchForm").onsubmit = (e) => { e.preventDefault(); const q = $("#q").value.trim(); go(q ? "/mall/search?q=" + encodeURIComponent(q) : "/mall/category/all"); };
$("#cmpClear").onclick = () => { CMP = []; LS.set("mnkCmp", CMP); route(); };
/* 전체 카테고리 메가메뉴 */
function mega() {
  return `<div class="m-mega__in"><div><h5>무선 센서</h5>${GROUPS.map((g) => `<a href="/mall/category/sensors?g=${g.id}" data-link><i style="background:${g.color}"></i>${esc(g.ko)} <small>${P.filter((p) => p.g === g.id).length}</small></a>`).join("")}</div>
    ${["gateways", "software", "accessories"].map((c) => `<div><h5>${CAT_KO[c]}</h5>${P.filter((p) => p.c === c).map((p) => `<a href="/mall/product/${esc(p.id)}" data-link>${esc(p.n)}</a>`).join("")}</div>`).join("")}
    <div><h5>바로가기</h5><a href="/mall/packages" data-link>추천 패키지</a><a href="/mall/solutions" data-link>산업별 솔루션</a><a href="/mall/quick" data-link>모델명으로 빠른 견적</a><a href="/mall/compare" data-link>제품 비교</a><a href="/mall/help" data-link>고객센터</a></div></div>`;
}
function closeMega() { $("#mega").hidden = true; $("#allBtn").setAttribute("aria-expanded", "false"); }
$("#allBtn").onclick = (e) => { e.stopPropagation(); const m = $("#mega"); if (m.hidden) { m.innerHTML = mega(); m.hidden = false; $("#allBtn").setAttribute("aria-expanded", "true"); } else closeMega(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMega(); });

/* ───────── 시작 ───────── */
prep(D.products || []);
try { const s = new URLSearchParams(location.search); const src = ["utm_source", "utm_campaign", "gclid", "n_keyword"].filter((k) => s.get(k)).map((k) => k + "=" + s.get(k)).join("&"); if (src) sessionStorage.setItem("mnkMallSrc", src); } catch (e) {}
/* 결재용 링크(/mall/cart?items=id*qty,...) — 같은 구성으로 견적함 채우기 */
{ const it = new URLSearchParams(location.search).get("items");
  if (it) { it.split(",").forEach((t) => { const [id, n] = t.split("*"); if (P.find((p) => p.id === id) && !CART.some((c) => c.id === id)) CART.push({ id, qty: Math.max(1, Math.min(9999, Number(n) || 1)) }); }); saveCart(); history.replaceState({}, "", "/mall/cart"); setTimeout(() => toast("공유받은 구성을 견적함에 담았어요"), 300); } }
route();
fetch("/api/billing/me").then((r) => r.json()).then((j) => { if (j && j.ok && j.member) { ME = j; $("#uLogin").textContent = tierOf().name + " 회원"; if (["", "my", "quote"].includes((location.pathname.split("/")[2] || ""))) route(); } }).catch(() => {});
})();
