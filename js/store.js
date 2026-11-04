/* 제품몰 (/store) — 2026-11-04
   · 가격은 공개하지 않는다 — 모든 제품은 「견적 및 납기 확인」으로 받는다.
   · 견적함(이 브라우저에 보관) → 견적 요청 → /api/lead (리드 원장 · 담당자 메일 1015@(장일호 팀장) + 대표님 · 먼데이)
   · 데이터: js/store-data.js(기본) → 구글 시트 Products·Applications 탭이 있으면 덮어씀(/api/sheets)
   · 멤버십 등급: 회원 로그인(/account, 이메일 인증)과 같은 계정. 등급은 관리 화면(/billing-admin → 회원)에서 지정 */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const D = window.__STORE_DATA || { products: [], apps: [], cats: [], groups: [], icons: {}, rules: [] };

/* ── 멤버십 등급 (문구는 여기서 고치면 됩니다) ── */
const TIERS = [
  { id: "welcome", name: "웰컴", color: "#86868b", cond: "회원 가입 즉시", perks: ["견적 영업일 1일 내 회신", "데이터시트·설치 가이드 바로 받기", "신제품·기획전 소식"] },
  { id: "silver", name: "실버", color: "#9aa7b8", cond: "첫 거래 완료 후", perks: ["견적 우선 회신", "회원 전용 기획전 가격 안내", "설치 후 원격 점검 1회"] },
  { id: "gold", name: "골드", color: "#c9a227", cond: "연간 거래 1,000만 원 이상", perks: ["전담 담당자 배정", "프로젝트 단가 협의", "데모 키트 대여 상담"] },
  { id: "partner", name: "파트너", color: "#2f7bff", cond: "SI·설치 파트너 계약", perks: ["파트너 단가", "기술 교육·인증", "공동 제안·영업 지원"] },
];
const HUE = { temperature: "red", humid: "blue", humidity: "blue", water: "blue", vibration: "violet", electrical: "amber", power: "amber", motion: "cyan", door: "green", contact: "green", gas: "teal", air: "teal", pressure: "violet", soil: "green", vehicle: "blue", control: "cyan", button: "pink", light: "amber", tilt: "violet", resistance: "amber", pulse: "cyan", software: "violet", cloud: "cyan", server: "blue", signal: "cyan", alarm: "pink", battery: "green", gateway: "blue", edge: "violet", sensor: "cyan" };
/* 제품 → 적용 분야(APPS.sensors 코드) 연결 규칙 */
const CODE_RULES = [[/온도|열전대/, ["TEMP", "ULT TEMP"]], [/습도/, ["HUMID"]], [/누수/, ["WATER"]], [/차압/, ["DP"]], [/이산화탄소|CO2/, ["CO₂"]], [/공기질/, ["AIR", "VOC"]], [/진동|가속도/, ["VIB"]], [/전류/, ["CURRENT"]], [/모션|점유/, ["MOTION", "OCC"]], [/개폐|도어/, ["DOOR"]], [/압력계/, ["PRESSURE"]], [/VDC|VAC|전압/, ["VOLTAGE"]], [/조도/, ["LIGHT"]]];
const RULES = (D.rules || []).map(([s, f, k]) => [new RegExp(s, f), k]);

let P = [], APPS = D.apps || [], CATS = D.cats || [], GROUPS = D.groups || [];
const S = { cat: "all", grp: "", q: "", sort: "rec", me: null };
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
let CART = LS.get("mnkQuoteCart", []);
let RECENT = LS.get("mnkRecent", []);

function slugOf(p, i) { return (p.c + "-" + (p.n || "").replace(/[^\w가-힣]+/g, "-").replace(/^-|-$/g, "")).toLowerCase() || "p" + i; }
function iconKey(p) { const hay = (p.n || "") + " " + (p.g || "") + " " + p.c; for (const [re, k] of RULES) if (re.test(hay)) return k; return p.c === "software" ? "software" : p.c === "gateways" ? "gateway" : p.c === "accessories" ? "control" : "sensor"; }
function ico(p, big) { const k = iconKey(p); return `<span class="s-ico h-${HUE[k] || "cyan"}"><svg viewBox="0 0 24 24">${(D.icons || {})[k] || (D.icons || {}).sensor || ""}</svg></span>`; }
function appsOf(p) {
  const codes = []; for (const [re, cs] of CODE_RULES) if (re.test(p.n)) codes.push(...cs);
  if (p.c === "gateways" || p.c === "software") return APPS.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 6);
  return APPS.filter((a) => codes.some((c) => String(a.sensors || "").split(/\s*·\s*/).includes(c))).sort((a, b) => b.popularity - a.popularity);
}
function score(p) { const a = appsOf(p); return p.c === "sensors" ? (a[0] ? a[0].popularity : 0) + a.length * 3 : p.c === "gateways" ? 95 : 40; }
function catName(p) { const c = CATS.find((x) => x.id === p.c); const g = GROUPS.find((x) => x.id === p.g); return (c ? c.ko : "") + (g ? " · " + g.ko : ""); }
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("is-on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("is-on"), 2600); }

/* ── 데이터 ── */
function prep(list) {
  P = list.map((p, i) => ({ ...p, id: slugOf(p, i) }));
  P.forEach((p) => { p.score = score(p); });
  const top = P.filter((p) => p.c === "sensors").sort((a, b) => b.score - a.score).slice(0, 8).map((p) => p.id);
  P.forEach((p) => { p.hot = top.includes(p.id); });
}
function parseCSV(t) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c !== "\r") cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const h = (rows.shift() || []).map((x) => x.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] || "").trim()])));
}
async function fromSheets() {
  try {
    const r = await fetch("/api/sheets?tabs=Products,Applications"); if (!r.ok) return;
    const j = await r.json(); if (!j.ok || !j.tabs) return;
    const pick = (o, ks) => { for (const k of ks) if (o[k]) return o[k]; return ""; };
    const catBy = {}; CATS.forEach((c) => { catBy[c.id] = c.id; catBy[c.ko] = c.id; });
    const grpBy = {}; GROUPS.forEach((g) => { grpBy[g.id] = g.id; grpBy[g.ko] = g.id; });
    if (j.tabs.Products) {
      const list = parseCSV(j.tabs.Products).map((o) => {
        const n = pick(o, ["name", "이름", "제품명", "name_ko"]), raw = pick(o, ["category", "cat", "카테고리", "분류"]), c = catBy[raw] || catBy[raw.toLowerCase()];
        if (!n || !c || /^(y|yes|1|숨김)$/i.test(pick(o, ["store_hidden", "숨김"]))) return null;
        const u = pick(o, ["url", "link", "링크", "데이터시트", "datasheet"]);
        return { c, g: c === "sensors" ? (grpBy[pick(o, ["group", "grp", "그룹", "센서군"])] || "") : "", n, d: pick(o, ["desc", "description", "설명", "desc_ko"]), u, p: /\.pdf($|\?)/i.test(u), badge: pick(o, ["badge", "배지"]) };
      }).filter(Boolean);
      if (list.length) prep(list);
    }
    if (j.tabs.Applications) { const a = parseCSV(j.tabs.Applications).filter((o) => o.id && o.name).map((o) => ({ id: o.id, name: o.name, sensors: o.sensors || "", popularity: Number(o.popularity) || 0 })); if (a.length) { APPS = a; P.forEach((p) => (p.score = score(p))); } }
    render();
  } catch (e) { /* 기본 데이터로 계속 */ }
}

/* ── 렌더 ── */
function card(p) {
  const inCart = CART.some((c) => c.id === p.id);
  const badges = [p.badge && `<span class="s-badge">${esc(p.badge)}</span>`, p.hot && `<span class="s-badge b-blue">많이 찾는</span>`].filter(Boolean).join("");
  return `<article class="s-card" data-id="${esc(p.id)}" tabindex="0" aria-label="${esc(p.n)} 상세 보기">
    ${ico(p)}<div class="s-badges">${badges}</div>
    <div class="s-card__cat">${esc(catName(p))}</div><h3>${esc(p.n)}</h3><p>${esc(p.d)}</p>
    <div class="s-card__ft"><span class="s-price">견적 문의<small>회원 등급별 견적가</small></span>
      <button class="s-add${inCart ? " is-in" : ""}" data-add="${esc(p.id)}" type="button" aria-label="견적함에 담기">${inCart ? "✓" : "+"}</button></div></article>`;
}
function list() {
  let l = P.filter((p) => (S.cat === "all" || p.c === S.cat) && (!S.grp || p.g === S.grp));
  if (S.q) { const q = S.q.toLowerCase(); l = P.filter((p) => (p.n + " " + p.d + " " + catName(p) + " " + appsOf(p).map((a) => a.name).join(" ")).toLowerCase().includes(q)); }
  return S.sort === "name" ? l.sort((a, b) => a.n.localeCompare(b.n, "ko")) : l.sort((a, b) => b.score - a.score);
}
function render() {
  const cnt = (c) => P.filter((p) => c === "all" || p.c === c).length;
  $("#cats").innerHTML = [`<button data-cat="all" class="${S.cat === "all" && !S.q ? "is-on" : ""}"><span>전체 제품</span><small>${cnt("all")}</small></button>`]
    .concat(CATS.map((c) => `<button data-cat="${c.id}" class="${S.cat === c.id && !S.grp ? "is-on" : ""}"><span><i class="dot" style="background:${c.color}"></i>${esc(c.ko)}</span><small>${cnt(c.id)}</small></button>` +
      (c.id === "sensors" ? GROUPS.map((g) => `<button class="sub ${S.grp === g.id ? "is-on" : ""}" data-cat="sensors" data-grp="${g.id}"><span>${esc(g.ko)}</span><small>${P.filter((p) => p.g === g.id).length}</small></button>`).join("") : ""))).join("");
  $("#chips").innerHTML = S.cat === "sensors" ? [`<button data-grp="" class="${!S.grp ? "is-on" : ""}">센서 전체</button>`].concat(GROUPS.map((g) => `<button data-grp="${g.id}" class="${S.grp === g.id ? "is-on" : ""}">${esc(g.ko)}</button>`)).join("") : "";
  const l = list();
  const c = CATS.find((x) => x.id === S.cat), g = GROUPS.find((x) => x.id === S.grp);
  $("#listTitle").textContent = S.q ? `'${S.q}' 검색 결과` : g ? `센서 · ${g.ko}` : c ? c.ko : "전체 제품";
  $("#listCount").textContent = `${l.length}개`;
  $("#grid").innerHTML = l.map(card).join("");
  $("#empty").hidden = !!l.length;
  $("#popular").innerHTML = P.filter((p) => p.hot).map(card).join("");
  const rec = RECENT.map((id) => P.find((p) => p.id === id)).filter(Boolean);
  $("#recentRow").hidden = !rec.length; $("#recent").innerHTML = rec.map(card).join("");
  renderTiers(); renderCount();
}
function renderTiers() {
  const my = S.me && S.me.member ? (S.me.member.grade || "welcome") : "";
  $("#tiers").innerHTML = TIERS.map((t) => `<div class="s-tier${t.id === my ? " is-me" : ""}">${t.id === my ? '<span class="me">내 등급</span>' : ""}<div class="s-tier__name"><i style="background:${t.color}"></i>${t.name}</div><small>${esc(t.cond)}</small><ul>${t.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("");
  if (my) { const t = TIERS.find((x) => x.id === my) || TIERS[0]; $("#myGrade").innerHTML = `<b>${esc(S.me.member.email)}</b> 님은 <b style="color:${t.color}">${t.name}</b> 등급이에요.`; $("#memberLink").textContent = t.name + " 회원"; }
}
function renderCount() {
  const n = CART.reduce((a, c) => a + c.qty, 0);
  $("#cartCount").hidden = !n; $("#cartCount").textContent = n; $("#mCount").textContent = n;
}

/* ── 상세 ── */
const FACTS = {
  sensors: [["무선 940MHz", "국내 주파수 · 배선 공사 없이 설치"], ["내구연한 15년", "산업 현장 장기 운용"], ["알림", "문자·이메일·웹/모바일 대시보드"], ["구성", "센서 → IoT 게이트웨이 → 서버"]],
  gateways: [["센서 250개", "게이트웨이 1대 반경 내 매핑"], ["정전 시 2~3일", "내장 배터리로 자립 작동"], ["내구연한 15년", "산업 현장 장기 운용"], ["플랫폼 연동", "iMonnit · iMonnit Scube 전용 플랫폼"]],
  software: [["알림", "문자·이메일·웹/모바일 대시보드"], ["Open API", "Webhook API · MQTT (iMonnit)"], ["전용 플랫폼", "iMonnit Scube 전용 플랫폼"], ["구독", "연 단위 구독 — 견적 안내"]],
  accessories: [["ALTA 호환", "모넷 무선 센서·게이트웨이와 함께 사용"], ["설치 상담", "현장 조건에 맞춰 구성 안내"]],
};
function openDetail(id, push = true) {
  const p = P.find((x) => x.id === id); if (!p) return;
  RECENT = [p.id, ...RECENT.filter((x) => x !== p.id)].slice(0, 10); LS.set("mnkRecent", RECENT);
  const apps = appsOf(p).slice(0, 10);
  const needGw = p.c === "sensors" && !CART.some((c) => (P.find((x) => x.id === c.id) || {}).c === "gateways");
  const gw = P.find((x) => x.c === "gateways" && /이더넷/.test(x.n)) || P.find((x) => x.c === "gateways");
  const el = $("#detail");
  el.innerHTML = `<div class="s-sheet__hd">${ico(p)}<div>
      <div class="s-card__cat">${esc(catName(p))}</div><h2 id="dName">${esc(p.n)}</h2><p class="s-sheet__desc">${esc(p.d)}</p>
      <div class="s-buy"><span class="s-price">가격 · 견적 문의<small>구성·수량·회원 등급에 맞춰 안내</small></span>
        <span class="stepper"><button type="button" data-q="-1" aria-label="줄이기">−</button><output id="dQty">1개</output><button type="button" data-q="1" aria-label="늘리기">＋</button></span>
        <button class="btn btn--line btn--sm" id="dAdd" type="button">견적함에 담기</button><button class="btn btn--sm" id="dNow" type="button">견적 및 납기 확인</button></div>
    </div><button class="s-sheet__x" id="dX" type="button" aria-label="닫기">×</button></div>
    <div class="s-sheet__body">
      ${needGw && gw ? `<div class="s-upsell"><p><b>센서는 게이트웨이가 있어야 동작해요.</b> 게이트웨이 1대가 반경 내 센서 250개까지 연결합니다.</p><button class="btn btn--sm btn--dark" data-add="${esc(gw.id)}" type="button">${esc(gw.n)} 담기</button></div>` : ""}
      <div class="s-sec"><h4>주요 특징</h4><div class="s-facts">${(FACTS[p.c] || []).map(([a, b]) => `<div><b>${esc(a)}</b>${esc(b)}</div>`).join("")}</div></div>
      ${apps.length ? `<div class="s-sec"><h4>이렇게 활용해요</h4><div class="s-apps">${apps.map((a) => `<a href="/app/${esc(a.id)}">${esc(a.name)}</a>`).join("")}</div></div>` : ""}
      <div class="s-sec"><h4>사양 · 자료</h4><div class="s-files">${p.u ? `<a href="${esc(p.u)}" target="_blank" rel="noopener"><i>${p.p ? "PDF" : "WEB"}</i>${esc(p.n)} ${p.p ? "데이터시트 (상세 사양)" : "제품 정보"}<span style="margin-left:auto;color:var(--blue)">열기 →</span></a>` : `<span class="s-muted">자료는 견적 회신 때 함께 보내 드려요.</span>`}</div></div>
      <div class="s-sec"><h4>상담</h4><div class="s-buy" style="margin-top:0"><a class="btn btn--line btn--sm" href="tel:0220881454">전화 02-2088-1454</a><a class="btn btn--line btn--sm" href="https://pf.kakao.com/_xfIMpj" target="_blank" rel="noopener">카카오톡 상담</a></div></div>
    </div>`;
  el.hidden = false; $("#scrim").hidden = false; document.body.style.overflow = "hidden";
  let qty = 1;
  $$("[data-q]", el).forEach((b) => b.onclick = () => { qty = Math.max(1, Math.min(999, qty + Number(b.dataset.q))); $("#dQty").textContent = qty + "개"; });
  $("#dAdd").onclick = () => { add(p.id, qty); closeDetail(); };
  $("#dNow").onclick = () => { add(p.id, qty, true); closeDetail(); openCart(); };
  $("#dX").onclick = closeDetail;
  if (push) history.pushState({ p: p.id }, "", "?p=" + encodeURIComponent(p.id));
  render();
}
function closeDetail() { $("#detail").hidden = true; $("#scrim").hidden = true; document.body.style.overflow = ""; if (/[?&]p=/.test(location.search)) history.pushState({}, "", location.pathname); }

/* ── 견적함 ── */
function add(id, qty = 1, silent) {
  const it = CART.find((c) => c.id === id);
  if (it) it.qty = Math.min(999, it.qty + qty); else CART.push({ id, qty });
  LS.set("mnkQuoteCart", CART); render();
  const b = $("#cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  if (!silent) { const p = P.find((x) => x.id === id); toast(`${p ? p.n : "제품"} — 견적함에 담았어요`); }
}
function openCart() { $("#cart").hidden = false; $("#scrim").hidden = false; document.body.style.overflow = "hidden"; drawCart(); }
function closeCart() { $("#cart").hidden = true; $("#scrim").hidden = true; document.body.style.overflow = ""; }
function drawCart(done) {
  const body = $("#cartBody");
  if (done) {
    body.innerHTML = `<div class="done" style="padding:30px 0"><div class="done__mark"><svg viewBox="0 0 42 42"><path d="M11 22l7 7 14-15"/></svg></div><h1 style="font-size:26px">견적 요청이 접수됐어요.</h1>
      <p>접수번호 <b>${esc(done)}</b><br>담당자가 구성·단가·납기를 확인해 영업일 1일 안에 연락드립니다.</p>
      <div class="acts"><a class="btn btn--dark" href="tel:0220881454">급하면 바로 전화</a><button class="btn btn--line" id="cDone" type="button">계속 둘러보기</button></div></div>`;
    $("#cDone").onclick = closeCart; return;
  }
  const items = CART.map((c) => ({ ...c, p: P.find((x) => x.id === c.id) })).filter((c) => c.p);
  const hasSensor = items.some((c) => c.p.c === "sensors"), hasGw = items.some((c) => c.p.c === "gateways");
  const gw = P.find((x) => x.c === "gateways" && /이더넷/.test(x.n));
  const me = S.me && S.me.member, pf = (me && me.profile) || LS.get("mnkQuoteForm", {});
  body.innerHTML = (items.length ? items.map((c) => `<div class="s-item">${ico(c.p)}<div><b>${esc(c.p.n)}</b><small>${esc(catName(c.p))}</small></div>
      <span class="stepper"><button type="button" data-cq="${esc(c.id)}" data-d="-1">−</button><output>${c.qty}</output><button type="button" data-cq="${esc(c.id)}" data-d="1">＋</button></span><button class="x" data-rm="${esc(c.id)}" type="button" aria-label="빼기">×</button></div>`).join("")
    : `<p class="s-muted" style="padding:10px 0">아직 담은 제품이 없어요. 제품 없이 <b>구성 상담</b>만 요청하셔도 됩니다.</p>`)
    + (hasSensor && !hasGw && gw ? `<div class="s-upsell" style="margin-top:6px"><p>센서만 담겨 있어요. <b>게이트웨이</b>도 함께 견적받으시겠어요?</p><button class="btn btn--sm btn--dark" data-add="${esc(gw.id)}" type="button">담기</button></div>` : "")
    + `<form class="s-form" id="qForm" novalidate>
      ${me ? `<p class="note note--blue" style="margin:0"><span><b>${esc(me.email)}</b> · ${(TIERS.find((t) => t.id === (me.grade || "welcome")) || TIERS[0]).name} 회원으로 요청합니다.</span></p>` : `<p class="note" style="margin:0"><span><a href="/account">회원 로그인</a>하면 정보가 자동으로 채워지고 등급 혜택이 적용돼요.</span></p>`}
      <div class="field"><input id="fCo" placeholder=" " value="${esc(pf.company || "")}" autocomplete="organization"><label for="fCo">상호 (기관·업체명) *</label></div>
      <div class="row2"><div class="field"><input id="fNm" placeholder=" " value="${esc(pf.manager || "")}" autocomplete="name"><label for="fNm">담당자 *</label></div><div class="field"><input id="fPh" type="tel" placeholder=" " value="${esc(pf.phone || "")}" autocomplete="tel"><label for="fPh">휴대전화 *</label></div></div>
      <div class="field"><input id="fEm" type="email" placeholder=" " value="${esc((me && me.email) || pf.email || "")}" autocomplete="email"><label for="fEm">이메일 (견적서 받을 곳)</label></div>
      <div class="row2"><div class="field"><select id="fDue"><option>1주 이내</option><option selected>2주 이내</option><option>1개월 이내</option><option>일정 미정 (검토 중)</option></select><label for="fDue" style="top:7px;font-size:12px">희망 납기</label></div>
        <div class="field"><input id="fRg" placeholder=" " value="${esc(pf.siteAddr || "")}"><label for="fRg">설치 지역</label></div></div>
      <div class="field"><textarea id="fMemo" placeholder=" "></textarea><label for="fMemo">현장 상황 · 요청 사항 (선택)</label></div>
      <label class="s-consent"><input type="checkbox" id="fOk"> <span>[필수] 견적 회신을 위한 개인정보(상호·담당자·연락처·이메일) 수집·이용에 동의합니다. <a href="/privacy.html" target="_blank">자세히</a></span></label>
      <button class="btn btn--dark btn--block" type="submit" id="fSend">${items.length ? `견적 및 납기 확인 요청 (${items.length}종)` : "구성 상담 요청"}</button>
      <p class="s-muted" style="font-size:12px;text-align:center;margin:0">담당 팀장·대표가 함께 받아 영업일 1일 안에 회신드립니다 · 급하면 02-2088-1454</p></form>`;
  $$("[data-cq]", body).forEach((b) => b.onclick = () => { const it = CART.find((c) => c.id === b.dataset.cq); it.qty = Math.max(1, Math.min(999, it.qty + Number(b.dataset.d))); LS.set("mnkQuoteCart", CART); renderCount(); drawCart(); });
  $$("[data-rm]", body).forEach((b) => b.onclick = () => { CART = CART.filter((c) => c.id !== b.dataset.rm); LS.set("mnkQuoteCart", CART); render(); drawCart(); });
  $("#fPh").addEventListener("input", (e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 11); e.target.value = d.length < 4 ? d : d.length < 8 ? d.replace(/(\d{3})(\d+)/, "$1-$2") : d.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3"); });
  $("#qForm").onsubmit = submit;
}
async function submit(e) {
  e.preventDefault();
  const v = { co: $("#fCo").value.trim(), nm: $("#fNm").value.trim(), ph: $("#fPh").value.trim(), em: $("#fEm").value.trim(), due: $("#fDue").value, rg: $("#fRg").value.trim(), memo: $("#fMemo").value.trim() };
  if (!v.co || !v.nm || !v.ph) return toast("상호·담당자·휴대전화를 입력해 주세요.");
  if (!/^0\d{8,10}$/.test(v.ph.replace(/\D/g, ""))) return toast("휴대전화 번호를 확인해 주세요.");
  if (v.em && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.em)) return toast("이메일 주소를 확인해 주세요.");
  if (!$("#fOk").checked) return toast("개인정보 수집·이용에 동의해 주세요.");
  LS.set("mnkQuoteForm", { company: v.co, manager: v.nm, phone: v.ph, email: v.em, siteAddr: v.rg });
  const items = CART.map((c) => ({ ...c, p: P.find((x) => x.id === c.id) })).filter((c) => c.p);
  const no = "MQ-" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const me = S.me && S.me.member, grade = me ? (TIERS.find((t) => t.id === (me.grade || "welcome")) || TIERS[0]).name : "비회원";
  const lines = items.map((c) => `${c.p.n}(${catName(c.p)}) × ${c.qty}`).join(" / ");
  const src = (() => { try { return new URLSearchParams(location.search).toString() || "direct"; } catch (e) { return "direct"; } })();
  const payload = { "회사명": v.co, "담당자명": v.nm, "전화번호": v.ph, ...(v.em ? { "이메일": v.em } : {}), "문의항목": "제품 견적 및 납기 확인", "지역": v.rg || "(미기재)",
    "문의 사항": `[${no}] ${lines || "제품 미선택 — 구성 상담"} · 희망 납기: ${v.due} · 회원: ${grade}${me ? " (" + me.email + ")" : ""}${v.memo ? " · 메모: " + v.memo : ""}`,
    "접수번호": no, "접점": "/store 견적함", "유입 페이지": location.pathname, "출처": src };
  const btn = $("#fSend"); btn.disabled = true; btn.textContent = "보내는 중…";
  let ok = false;
  try { const r = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_type: "contact", page: "/store", ts: new Date().toISOString(), payload }) }); ok = r.ok || r.status === 204; } catch (err) { ok = false; }
  if (!ok) {
    btn.disabled = false; btn.textContent = "다시 보내기";
    location.href = "mailto:1015@monnit.com?subject=" + encodeURIComponent(`[견적 요청] ${v.co} ${no}`) + "&body=" + encodeURIComponent(Object.entries(payload).map(([k, x]) => k + ": " + x).join("\n"));
    return toast("전송이 원활하지 않아 메일 앱으로 연결합니다.");
  }
  try { window.dataLayer && window.dataLayer.push({ event: "store_quote", items: items.length }); } catch (err) {}
  CART = []; LS.set("mnkQuoteCart", CART); render(); drawCart(no);
}

/* ── 이벤트 ── */
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-add]"); if (a) { e.stopPropagation(); add(a.dataset.add, 1); if (!$("#cart").hidden) drawCart(); return; }
  const c = e.target.closest(".s-card"); if (c) return openDetail(c.dataset.id);
  const cat = e.target.closest("[data-cat]"); if (cat) { S.cat = cat.dataset.cat; S.grp = cat.dataset.grp || ""; S.q = ""; $("#q").value = ""; render(); return; }
  const g = e.target.closest("#chips [data-grp]"); if (g) { S.grp = g.dataset.grp; render(); return; }
  const so = e.target.closest("[data-sort]"); if (so) { S.sort = so.dataset.sort; $$("[data-sort]").forEach((x) => x.classList.toggle("is-on", x === so)); render(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.classList && e.target.classList.contains("s-card")) openDetail(e.target.dataset.id); if (e.key === "Escape") { closeDetail(); closeCart(); } });
$("#q").addEventListener("input", (e) => { S.q = e.target.value.trim(); render(); if (S.q) $("#catalog").scrollIntoView({ behavior: "smooth", block: "start" }); });
$("#scrim").onclick = () => { closeDetail(); closeCart(); };
$("#cartBtn").onclick = openCart; $("#mCart").onclick = openCart; $("#cartClose").onclick = closeCart;
$("#helpQuote").onclick = $("#emptyQuote").onclick = (e) => { e.preventDefault(); openCart(); };
$("#clearRecent").onclick = () => { RECENT = []; LS.set("mnkRecent", RECENT); render(); };
window.addEventListener("popstate", () => { const id = new URLSearchParams(location.search).get("p"); if (id) openDetail(id, false); else { $("#detail").hidden = true; if ($("#cart").hidden) $("#scrim").hidden = true; document.body.style.overflow = ""; } });

/* ── 시작 ── */
prep(D.products || []);
render();
const first = new URLSearchParams(location.search).get("p"); if (first) openDetail(first, false);
if (/[?&]cart=1/.test(location.search)) openCart();
fromSheets();
fetch("/api/billing/me").then((r) => r.json()).then((j) => { if (j && j.ok) { S.me = j; renderTiers(); } }).catch(() => {});
})();
