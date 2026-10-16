/** 긴급 경보 알리미 — 계약 링크·계약 접수·설문·SLA 동의 API
 *
 *  Netlify v2 함수 형식. Cloudflare Worker(cloudflare/worker.mjs) 가 V2 목록에서 불러 실행한다.
 *  저장: @netlify/blobs 저장소 "alarm" → Cloudflare 에서는 R2 (wrangler.toml alias)
 *        offers/<id> 계약 링크(조건) · contracts/<ref> 체결 계약 · clients/<id> 기존 고객 ·
 *        surveys/<id> 설문 · consents/<ref> SLA 동의
 *  알림: 접수마다 _notify.notify() (대표님 메일함) + _staffnote.note() (/ops/notices 알림함)
 *        + 먼데이 「알리미 계약 현황」 보드 아이템 (_alarm_monday.mjs, MONDAY_TOKEN 필요).
 *        BREVO_API_KEY 가 있으면 계약 체결 고객에게 확인 메일 1통.
 *  관리 키: ALARM_ADMIN_KEY (없으면 OPS_PASS 로 대신) — /contract-admin 로그인
 */
import { getStore } from "@netlify/blobs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { notify } from "./_notify.mjs";
import { note } from "./_staffnote.mjs";
import { pushContract, pushConsent, pushSurvey } from "./_alarm_monday.mjs";

export const config = { path: [
  "/api/alarm/offer", "/api/alarm/contract", "/api/alarm/client", "/api/alarm/survey", "/api/alarm/consent",
  "/api/alarm/admin/ping", "/api/alarm/admin/list", "/api/alarm/admin/item",
  "/api/alarm/admin/offer", "/api/alarm/admin/offer/void", "/api/alarm/admin/client"
] };
//
// 공개(고객)                                관리자 (헤더 x-admin-key = 환경변수 ALARM_ADMIN_KEY)
//   GET  /api/alarm/offer?id=…  계약 조건     GET  /api/alarm/admin/list?type=offers|contracts|clients|surveys|consents
//   POST /api/alarm/contract    계약 체결     GET  /api/alarm/admin/item?type=…&id=…
//   GET  /api/alarm/client?id=… 기존 고객     POST /api/alarm/admin/offer        계약 링크(조건) 만들기
//   POST /api/alarm/survey      만족도 조사   POST /api/alarm/admin/offer/void   계약 링크 무효화
//   POST /api/alarm/consent     SLA 동의      POST /api/alarm/admin/client       기존 고객 등록(설문·SLA 링크)
//

const MAX_BODY = 12 * 1024 * 1024;           // 사업자등록증 이미지 포함
const TYPES = { offers: "offers/", contracts: "contracts/", clients: "clients/", surveys: "surveys/", consents: "consents/" };
const SLA_VERSION = "Rev. 3.0";
const PRODUCTS = ["fire", "water", "power", "alarm", "custom"];
const PRODUCT_LABEL = { fire: "화재 알리미", water: "물감지 알리미", power: "정전 알리미", alarm: "경보 알리미", custom: "커스텀 알리미" };
const products = (v) => (Array.isArray(v) ? v : []).map((x) => str(x, 10)).filter((x, i, a) => PRODUCTS.includes(x) && a.indexOf(x) === i);

const SITE = String(process.env.URL || "https://monnit.co.kr").replace(/\/$/, "");
const ST = getStore("alarm");
const store = () => ({
  setJSON: (k, v) => ST.setJSON(k, v),
  get: (k) => ST.get(k, { type: "json" }).catch(() => null),
  list: (o) => ST.list(o),
});

export default async (req) => {
  try {
    const url = new URL(req.url);
    const route = url.pathname.replace(/^\/api\/alarm\/?/, "").replace(/\/+$/, "");
    const m = req.method;

    if (route.startsWith("admin/")) {
      if (!isAdmin(req)) return json({ ok: false, error: "unauthorized" }, 401);
      const r = route.slice(6);
      if (m === "GET" && r === "list") return adminList(url.searchParams.get("type"));
      if (m === "GET" && r === "item") return adminItem(url.searchParams.get("type"), url.searchParams.get("id"));
      if (m === "POST" && r === "offer") return createOffer(await body(req));
      if (m === "POST" && r === "offer/void") return voidOffer(await body(req));
      if (m === "POST" && r === "client") return createClient(await body(req));
      if (m === "GET" && r === "ping") return json({ ok: true });
      return json({ ok: false, error: "not_found" }, 404);
    }

    if (m === "GET" && route === "offer") return getOffer(url.searchParams.get("id"));
    if (m === "POST" && route === "contract") return submitContract(req, await body(req));
    if (m === "GET" && route === "client") return getClient(url.searchParams.get("id"));
    if (m === "POST" && route === "survey") return submitSurvey(req, await body(req));
    if (m === "POST" && route === "consent") return submitConsent(req, await body(req));
    return json({ ok: false, error: "not_found" }, 404);
  } catch (e) {
    if (e && e.status) return json({ ok: false, error: e.message }, e.status);
    console.error("[alarm]", e && e.stack || e);
    return json({ ok: false, error: "server" }, 500);
  }
};

/* ───────── 계약 조건 계산 (화면과 같은 규칙) ───────── */
export function price(t) {
  const unit = Math.max(0, Math.round(Number(t.unit) || 0));
  const qty = Math.max(1, Math.round(Number(t.qty) || 1));
  const list = unit * qty;
  const type = ["none", "percent", "amount"].includes(t.discountType) ? t.discountType : "none";
  let value = Math.max(0, Number(t.discountValue) || 0);
  let discount = 0;
  if (type === "percent") { value = Math.min(100, value); discount = Math.round(list * value / 100); }
  if (type === "amount") { value = Math.min(list, Math.round(value)); discount = value; }
  return { unit, qty, list, discountType: type, discountValue: type === "none" ? 0 : value, discount, monthly: list - discount };
}

/* ───────── 관리자 ───────── */
async function createOffer(b) {
  const p = price(b);
  const prod = products(b.products);           // 비어 있으면 고객이 계약 화면에서 직접 고른다
  const terms = {
    products: prod, solNote: str(b.solNote, 120),
    sol: str(b.sol, 160) || "긴급 경보 알리미",
    ...p,
    discountNote: str(b.discountNote, 120),
    from: date(b.from), to: date(b.to),
    pay: str(b.pay, 60), bank: str(b.bank, 120), etc: str(b.etc, 2000),
  };
  const id = token(10);
  const offer = {
    id, status: "open", createdAt: now(),
    memo: { customer: str(b.customer, 80), contact: str(b.contact, 80), note: str(b.note, 300) },
    terms,
  };
  await store().setJSON(TYPES.offers + id, offer);
  return json({ ok: true, offer });
}

async function voidOffer(b) {
  const s = store(), key = TYPES.offers + str(b.id, 40);
  const o = await s.get(key);
  if (!o) return json({ ok: false, error: "not_found" }, 404);
  if (o.status === "signed") return json({ ok: false, error: "already_signed" }, 409);
  o.status = "void"; o.voidedAt = now();
  await s.setJSON(key, o);
  return json({ ok: true, offer: o });
}

async function createClient(b) {
  const name = str(b.name, 80);
  if (!name) return json({ ok: false, error: "name_required" }, 400);
  const id = token(10);
  const client = {
    id, createdAt: now(), name,
    site: str(b.site, 160), mgr: str(b.mgr, 40), email: str(b.email, 120),
    since: date(b.since), ref: str(b.ref, 40), type: b.type === "B2C" ? "B2C" : "B2B", products: products(b.products),
    surveyAt: "", consentAt: "", consentDecision: "",
  };
  await store().setJSON(TYPES.clients + id, client);
  return json({ ok: true, client });
}

async function adminList(type) {
  const prefix = TYPES[type];
  if (!prefix) return json({ ok: false, error: "bad_type" }, 400);
  const s = store();
  const { blobs } = await s.list({ prefix });
  const items = (await Promise.all(blobs.slice(0, 500).map((b) => s.get(b.key))))
    .filter(Boolean).map((x) => slim(type, x));
  items.sort((a, b) => String(b.createdAt || b.submittedAt || "").localeCompare(String(a.createdAt || a.submittedAt || "")));
  return json({ ok: true, items });
}

async function adminItem(type, id) {
  const prefix = TYPES[type];
  if (!prefix || !id) return json({ ok: false, error: "bad_request" }, 400);
  const x = await store().get(prefix + str(id, 60));
  return x ? json({ ok: true, item: x }) : json({ ok: false, error: "not_found" }, 404);
}

// 목록에는 서명·첨부 이미지 같은 큰 값은 빼고 보낸다
function slim(type, x) {
  if (type === "contracts") {
    const { signature, attachments, ...rest } = x;
    return { ...rest, signature: signature ? { name: signature.name, role: signature.role, signedOn: signature.signedOn } : null,
             hasLicense: !!(attachments && attachments.businessLicense) };
  }
  if (type === "consents") {
    const { signature, ...rest } = x;
    return { ...rest, signature: signature ? { name: signature.name, role: signature.role, signedOn: signature.signedOn } : null };
  }
  return x;
}

/* ───────── 공개: 계약 ───────── */
async function getOffer(id) {
  const o = id && await store().get(TYPES.offers + str(id, 40));
  if (!o) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true, id: o.id, status: o.status, terms: o.terms, customer: o.memo.customer || "" });
}

async function submitContract(req, b) {
  const s = store(), key = TYPES.offers + str(b.offerId, 40);
  const o = await s.get(key);
  if (!o) return json({ ok: false, error: "offer_not_found" }, 404);
  if (o.status !== "open") return json({ ok: false, error: "offer_" + o.status }, 409);

  const c = b.customer || {};
  for (const k of ["name", "address", "ceo", "manager", "phone", "email", "site"]) {
    if (!str(c[k], 200)) return json({ ok: false, error: "missing_" + k }, 400);
  }
  if (!b.signature || !/^data:image\/png;base64,/.test(b.signature.image || "")) return json({ ok: false, error: "missing_signature" }, 400);
  if (!b.slaAgreedAt) return json({ ok: false, error: "missing_sla" }, 400);

  const ref = refNo("MK");
  const t = o.terms; // 조건은 언제나 서버에 저장된 값을 쓴다 (링크·화면 조작 방지)
  // 제품: 담당자가 정해 두었으면 그 값, 아니면 고객이 고른 값 (최소 1개)
  const prodFixed = (t.products || []).length > 0;
  const prodList = prodFixed ? t.products : products(b.products);
  if (!prodList.length) return json({ ok: false, error: "products_required" }, 400);
  const solution = prodFixed ? t.sol : prodList.map((k) => PRODUCT_LABEL[k]).join(" · ") + (t.solNote ? " — " + t.solNote : "");
  const rec = {
    ref, offerId: o.id, submittedAt: now(), slaVersion: SLA_VERSION,
    terms: { solution, products: prodList, productsChosenBy: prodFixed ? "staff" : "customer", unitPrice: t.unit, sites: t.qty, listPrice: t.list,
             discountType: t.discountType, discountValue: t.discountValue, discount: t.discount, discountNote: t.discountNote,
             monthly: t.monthly, from: t.from, to: t.to, payDay: t.pay, bank: t.bank, etc: t.etc },
    customer: {
      name: str(c.name, 120), bizNo: str(c.bizNo, 20), address: str(c.address, 200), ceo: str(c.ceo, 40),
      contractType: c.contractType === "B2C" ? "B2C" : "B2B", manager: str(c.manager, 40), phone: str(c.phone, 30),
      email: str(c.email, 120), site: str(c.site, 200),
    },
    recipients: (Array.isArray(b.recipients) ? b.recipients : []).slice(0, 3)
      .map((r) => ({ name: str(r.name, 40), phone: str(r.phone, 30), email: str(r.email, 120) })),
    slaViewedAt: str(b.slaViewedAt, 40), slaAgreedAt: str(b.slaAgreedAt, 40), slaReadPct: Number(b.slaReadPct) || 0,
    acknowledged: Array.isArray(b.acknowledged) ? b.acknowledged.slice(0, 20).map((x) => str(x, 80)) : [],
    signature: { name: str(b.signature.name, 40), role: str(b.signature.role, 40), signedOn: date(b.signature.signedOn), image: b.signature.image },
    attachments: { businessLicense: b.attachments && b.attachments.businessLicense || null },
    client: meta(req),
  };
  await s.setJSON(TYPES.contracts + ref, rec);
  o.status = "signed"; o.signedAt = rec.submittedAt; o.contractRef = ref;
  await s.setJSON(key, o);

  const won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";
  const mailed = await alert({
    kind: "alarm_contract", label: "알리미 계약 체결", interest: "긴급 경보 알리미 계약 체결",
    company: rec.customer.name, name: rec.customer.manager, phone: rec.customer.phone, email: rec.customer.email,
    memo: `${solution} · ${t.qty}개소 · 월 ${won(t.monthly)} (부가세 별도)${t.discount ? " · 할인 " + won(t.discount) : ""} · ${t.from} ~ ${t.to}`,
    ip: rec.client.ip, ref,
  }, {
    "접수번호": ref, "설치 현장": rec.customer.site, "대표자": rec.customer.ceo, "계약 구분": rec.customer.contractType,
    "월 청구액": won(t.monthly) + " (부가세 별도)", "계약 기간": `${t.from} ~ ${t.to}`,
    "서명자": `${rec.signature.name} ${rec.signature.role}`.trim(), "SLA": `${SLA_VERSION} 동의 ${rec.slaAgreedAt}`,
    "알림 수신자": rec.recipients.map((r) => `${r.name} ${r.phone}`).join(" / "),
    "계약서 보기": SITE + "/contract-admin",
  });
  const [, monday] = await Promise.all([customerMail(rec), pushContract(rec)]);
  if (monday && monday.id) { rec.mondayItemId = monday.id; await s.setJSON(TYPES.contracts + ref, rec); }
  return json({ ok: true, ref, mailed });
}

/* ───────── 공개: 기존 고객 설문·SLA ───────── */
async function getClient(id) {
  const c = id && await store().get(TYPES.clients + str(id, 40));
  if (!c) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true, client: { id: c.id, name: c.name, site: c.site, mgr: c.mgr, since: c.since, type: c.type, products: c.products || [],
    surveyDone: !!c.surveyAt, consentDone: c.consentDecision === "agree" } });
}

async function submitSurvey(req, b) {
  const R = ["overall", "accuracy", "speed", "install", "support"];
  const ratings = {};
  for (const k of R) {
    const v = Math.round(Number(b.ratings && b.ratings[k]));
    if (!(v >= 1 && v <= 5)) return json({ ok: false, error: "rating_" + k }, 400);
    ratings[k] = v;
  }
  const opinion = str(b.opinion, 2000);
  if (opinion.replace(/\s/g, "").length < 5) return json({ ok: false, error: "opinion_short" }, 400);

  const s = store();
  let client = null;
  if (b.clientId) client = await s.get(TYPES.clients + str(b.clientId, 40));
  const company = client ? client.name : str(b.company, 80);
  if (!company) return json({ ok: false, error: "company_required" }, 400);

  const id = refNo("SV");
  const rec = {
    id, createdAt: now(), clientId: client ? client.id : "", company, site: client ? client.site : str(b.site, 160),
    respondent: str(b.respondent, 40), ratings, avg: Math.round(R.reduce((a, k) => a + ratings[k], 0) / R.length * 10) / 10,
    used: str(b.used, 20), opinion, improve: str(b.improve, 2000), recipientChange: str(b.recipientChange, 500),
    client: meta(req),
  };
  await s.setJSON(TYPES.surveys + id, rec);
  await alert({
    kind: "alarm_survey", label: "알리미 만족도 조사", interest: `만족도 조사 · 평균 ${rec.avg}점`,
    company, name: rec.respondent, memo: opinion, ip: rec.client.ip, ref: id,
  }, {
    "접수번호": id, "설치 현장": rec.site,
    "별점": `전반 ${ratings.overall} · 정확도 ${ratings.accuracy} · 속도 ${ratings.speed} · 설치 ${ratings.install} · 응대 ${ratings.support}`,
    "실제 대응 경험": rec.used, "개선 요청": rec.improve, "★ 수신자 변경 요청": rec.recipientChange,
    "결과 보기": SITE + "/contract-admin",
  });
  if (client) { client.surveyAt = rec.createdAt; client.surveyId = id; await s.setJSON(TYPES.clients + client.id, client); }
  const monday = await pushSurvey(rec);
  if (monday && monday.id) { rec.mondayItemId = monday.id; await s.setJSON(TYPES.surveys + id, rec); }
  return json({ ok: true, ref: id });
}

async function submitConsent(req, b) {
  const s = store();
  const client = b.clientId && await s.get(TYPES.clients + str(b.clientId, 40));
  if (!client) return json({ ok: false, error: "client_not_found" }, 404);
  const agree = b.decision === "agree";
  const cFixed = (client.products || []).length > 0;
  const cProds = cFixed ? client.products : products(b.products || (b.sla && b.sla.products));
  if (agree && !cProds.length) return json({ ok: false, error: "products_required" }, 400);
  if (agree && !(b.signature && /^data:image\/png;base64,/.test(b.signature.image || "") && b.sla && b.sla.agreedAt)) {
    return json({ ok: false, error: "missing_signature" }, 400);
  }
  const ref = refNo("MKS");
  const rec = {
    ref, createdAt: now(), clientId: client.id, company: client.name, site: client.site,
    decision: agree ? "agree" : "not-now",
    sla: { version: SLA_VERSION, viewedAt: str(b.sla && b.sla.viewedAt, 40), agreedAt: agree ? str(b.sla.agreedAt, 40) : "",
           readPct: Number(b.sla && b.sla.readPct) || 0, effectiveFrom: agree ? date(b.sla.effectiveFrom) : "", products: cProds, productsChosenBy: cFixed ? "staff" : "customer",
           acknowledged: agree && Array.isArray(b.sla.acknowledged) ? b.sla.acknowledged.slice(0, 20).map((x) => str(x, 80)) : [] },
    signature: agree ? { name: str(b.signature.name, 40), role: str(b.signature.role, 40), signedOn: date(b.signature.signedOn), image: b.signature.image } : null,
    client: meta(req),
  };
  await s.setJSON(TYPES.consents + ref, rec);
  await alert({
    kind: "alarm_consent", label: agree ? "알리미 SLA 동의" : "알리미 SLA 미동의", interest: agree ? "SLA 동의" : "SLA 동의하지 않음",
    company: client.name, name: client.mgr, email: client.email, ip: rec.client.ip, ref,
    memo: agree ? `${SLA_VERSION} · ${rec.sla.effectiveFrom}부터 적용 · 서명 ${rec.signature.name}` : "기존 계약 조건 유지",
  }, { "접수번호": ref, "설치 현장": client.site, "전문 열람": `${rec.sla.viewedAt} · ${rec.sla.readPct}% 읽음`, "동의서 보기": SITE + "/contract-admin" });
  // 한 번 동의한 기록은 덮어쓰지 않는다
  if (client.consentDecision !== "agree") {
    client.consentAt = rec.createdAt; client.consentDecision = rec.decision; client.consentRef = ref;
    if (!cFixed && cProds.length) client.products = cProds;
    await s.setJSON(TYPES.clients + client.id, client);
  }
  const monday = await pushConsent(rec, client);
  if (monday && monday.id) { rec.mondayItemId = monday.id; await s.setJSON(TYPES.consents + ref, rec); }
  return json({ ok: true, ref });
}

/* ───────── 알림 ─────────
   notify(): 사이트의 다른 접수와 같은 경로(StaticForms → Web3Forms → Brevo)로 대표님 메일함에.
   note():   /ops/notices 알림함에 한 줄. 둘 다 절대 throw 하지 않는다. */
async function alert(lead, fields) {
  const l = { ts: now(), channel: "알리미", source: "/promo/alarm", ...lead };
  let r = null;
  try { r = await notify(l, fields); } catch (e) { r = { ok: false, tried: [String(e && e.message || e)] }; }
  try {
    await note({ ts: l.ts, src: "lead", kind: l.kind, mailed: !!(r && r.ok), via: (r && r.via) || "",
      why: r && r.ok ? "" : "메일 발송 실패: " + String((r && r.tried) || ""),
      subject: `[모넷·${l.label}] ${l.interest} — ${l.company || l.name || ""}`,
      company: l.company, name: l.name, phone: l.phone, email: l.email, ref: l.ref, summary: fields });
  } catch (e) { /* 무시 */ }
  return !!(r && r.ok);
}

/* 계약 체결 고객에게 확인 메일 — Brevo 가 설정된 경우에만. 실패해도 접수는 유지. */
async function customerMail(rec) {
  const key = process.env.BREVO_API_KEY;
  const to = String(rec.customer.email || "").trim();
  if (!key || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) return false;
  const t = rec.terms, won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";
  const text = [
    `${rec.customer.manager}님, 안녕하세요. 모넷코리아입니다.`, "",
    `긴급 경보 알리미 구독 계약이 접수되었습니다. (접수번호 ${rec.ref})`, "",
    `· 고객: ${rec.customer.name} (대표 ${rec.customer.ceo})`, `· 설치 현장: ${rec.customer.site}`,
    `· 납품 솔루션: ${t.solution} · ${t.sites}개소`,
    `· 월 청구액: ${won(t.monthly)} (부가세 별도)${t.discount ? " — 정가 " + won(t.listPrice) + "에서 " + won(t.discount) + " 할인" : ""}`,
    `· 계약 기간: ${t.from} ~ ${t.to}`, `· 지급: ${t.payDay} · ${t.bank}`, "",
    `서비스수준협약(SLA) 전문 — 공통 본문과 ${(t.products || []).map((k) => PRODUCT_LABEL[k]).join("·")} 부속서: ${SITE}${(t.products || []).length === 1 ? "/alarm/sla-" + t.products[0] + ".pdf" : "/alarm/sla.pdf"}`, "",
    "담당자가 내용을 확인한 뒤 설치 일정과 세금계산서 발행 절차를 안내드리겠습니다.",
    "문의 02-2088-1454 · korea@monnit.com", "", "주식회사 모넷코리아",
  ].join("\n");
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "모넷코리아", email: process.env.MAIL_FROM || "no-reply@monnit.co.kr" },
        to: [{ email: to, name: rec.customer.manager }],
        replyTo: { name: "모넷코리아", email: process.env.MAIL_REPLYTO || "korea@monnit.com" },
        subject: `[모넷코리아] 긴급 경보 알리미 구독 계약 접수 확인 (${rec.ref})`, textContent: text, tags: ["alarm-contract"],
      }), signal: AbortSignal.timeout(8000),
    });
    return r.status === 201;
  } catch (e) { return false; }
}

/* ───────── 유틸 ───────── */
function isAdmin(req) {
  const want = String(process.env.ALARM_ADMIN_KEY || process.env.OPS_PASS || "");
  const got = req.headers.get("x-admin-key") || "";
  if (want.length < 8 || got.length !== want.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch (e) { return false; }
}
async function body(req) {
  const t = await req.text();
  if (t.length > MAX_BODY) throw Object.assign(new Error("too_large"), { status: 413 });
  try { return JSON.parse(t || "{}"); } catch { throw Object.assign(new Error("bad_json"), { status: 400 }); }
}
function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
function str(v, max) { return String(v == null ? "" : v).trim().slice(0, max); }
function date(v) { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; }
function now() { return new Date().toISOString(); }
function token(n) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789", b = randomBytes(n);
  let s = ""; for (let i = 0; i < n; i++) s += abc[b[i] % abc.length]; return s;
}
function refNo(p) {
  const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
  return `${p}-${d}-${token(4).toUpperCase()}`;
}
function meta(req) {
  return { ip: req.headers.get("x-nf-client-connection-ip") || req.headers.get("cf-connecting-ip") || "",
           ua: str(req.headers.get("user-agent"), 300) };
}
