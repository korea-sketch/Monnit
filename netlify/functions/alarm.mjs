/** 긴급 경보 알리미 — 계약 링크·계약 접수·설문·SLA 동의 API
 *
 *  Netlify v2 함수 형식. Cloudflare Worker(cloudflare/worker.mjs) 가 V2 목록에서 불러 실행한다.
 *  저장: @netlify/blobs 저장소 "alarm" → Cloudflare 에서는 R2 (wrangler.toml alias)
 *        offers/<id> 계약 링크(조건) · contracts/<ref> 발급 계약 · files/<ref>/<fid> 회신 파일 · clients/<id> 기존 고객 ·
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
import { pushContract, pushConsent, pushSurvey, setContractKind } from "./_alarm_monday.mjs";
import { noticeMail, sendNotice } from "./_alarm_mail.mjs";

export const config = { path: [
  "/api/alarm/offer", "/api/alarm/contract", "/api/alarm/contract/file", "/api/alarm/client", "/api/alarm/survey", "/api/alarm/consent",
  "/api/alarm/admin/ping", "/api/alarm/admin/list", "/api/alarm/admin/item",
  "/api/alarm/admin/offer", "/api/alarm/admin/offer/void", "/api/alarm/admin/client", "/api/alarm/admin/client/mail", "/api/alarm/admin/delete",
  "/api/alarm/admin/file", "/api/alarm/admin/file/delete", "/api/alarm/admin/contract/status"
] };
//
// 공개(고객)                                관리자 (헤더 x-admin-key = 환경변수 ALARM_ADMIN_KEY)
//   GET  /api/alarm/offer?id=…  계약 조건     GET  /api/alarm/admin/list?type=offers|contracts|clients|surveys|consents
//   POST /api/alarm/contract    계약서 발급   GET  /api/alarm/admin/item?type=…&id=…
//   POST /api/alarm/contract/file?offer&ref&kind&name  (본문=파일) 날인 계약서·사업자등록증 회신
//                                            GET  /api/alarm/admin/file?ref&id      회신 파일 내려받기
//                                            POST /api/alarm/admin/file?ref&kind&name 담당자가 메일로 받은 파일 등록
//                                            POST /api/alarm/admin/file/delete {ref,id}
//                                            POST /api/alarm/admin/contract/status {ref,status} 체결 완료 처리
//   GET  /api/alarm/client?id=… 기존 고객     POST /api/alarm/admin/offer        계약 링크(조건) 만들기
//   POST /api/alarm/survey      만족도 조사   POST /api/alarm/admin/offer/void   계약 링크 무효화
//   POST /api/alarm/consent     SLA 동의      POST /api/alarm/admin/client       기존 고객 등록(설문·SLA 링크)
//

const MAX_BODY = 2 * 1024 * 1024;            // JSON 요청 (파일은 /contract/file 로 따로)
const FILE_MAX = 10 * 1024 * 1024;           // 회신 파일 1개 (PDF·이미지)
const FILE_KINDS = { contract: "날인 계약서", license: "사업자등록증", other: "기타" };
// 계약 링크 상태: open(링크 발송) → issued(계약서 발급·회신 대기) → returned(회신 접수) → signed(체결 완료) · void(무효)
const CONTRACT_STATUS = ["issued", "returned", "signed"];
const TYPES = { offers: "offers/", contracts: "contracts/", clients: "clients/", surveys: "surveys/", consents: "consents/" };
const FILES = "files/";                      // files/<ref>/<fid> — 회신 파일 원본(바이너리)
const SLA_VERSION = "Rev. 3.0";
const PRODUCTS = ["fire", "water", "power", "alarm", "custom"];
const PRODUCT_LABEL = { fire: "화재경보 연동 알리미", water: "물감지 알리미", power: "정전 알리미", alarm: "경보 알리미", custom: "커스텀 알리미" };
const products = (v) => (Array.isArray(v) ? v : []).map((x) => str(x, 10)).filter((x, i, a) => PRODUCTS.includes(x) && a.indexOf(x) === i);

const SITE = String(process.env.URL || "https://monnit.co.kr").replace(/\/$/, "");
const ST = getStore("alarm");
const store = () => ({
  setJSON: (k, v) => ST.setJSON(k, v),
  get: (k) => ST.get(k, { type: "json" }).catch(() => null),
  setFile: (k, buf, meta) => ST.set(k, buf, { metadata: meta }),
  getFile: (k) => ST.getWithMetadata(k, { type: "stream" }).catch(() => null),
  list: (o) => ST.list(o),
  delete: (k) => ST.delete(k),
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
      if (m === "POST" && r === "delete") return deleteItems(await body(req));
      if (m === "GET" && r === "file") return adminFile(url.searchParams.get("ref"), url.searchParams.get("id"));
      if (m === "POST" && r === "file") return uploadFile(req, url, "staff");
      if (m === "POST" && r === "file/delete") return deleteFile(await body(req));
      if (m === "POST" && r === "contract/status") return setStatus(await body(req));
      if (r === "client/mail") return m === "GET" ? clientMailPreview(url.searchParams.get("id")) : clientMailSend(await body(req));
      if (m === "POST" && r === "client") return createClient(await body(req));
      if (m === "GET" && r === "ping") return json({ ok: true });
      return json({ ok: false, error: "not_found" }, 404);
    }

    if (m === "GET" && route === "offer") return getOffer(url.searchParams.get("id"));
    if (m === "POST" && route === "contract") return submitContract(req, await body(req));
    if (m === "POST" && route === "contract/file") return uploadFile(req, url, "customer");
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

/* ───────── 계약 조건 계산 (화면과 같은 규칙) ─────────
   2026-10-23 설치 지역 — metro(서울·경기·인천) 는 지역 출장비 없음, other(그 외 지역) 는
   설치 출장비(1회 약 50만 원)를 따로 청구하지 않고 계약당 월 1만 원 정액을 더한다(개소 수와 무관 — 출장은 방문 1회 기준).
   지역은 사람이 고르지 않는다 — 새 링크는 region "auto" 로 저장되고, 계약서 발급 때 고객이 입력한 설치 현장 주소로
   자동 판정해 금액을 확정한다(settleTerms). 고객에게는 산정 근거를 노출하지 않는다.
   예전 링크(region 없음)는 metro · 0원으로 그대로. */
export const REGION_FEE = 10000;
export function price(t) {
  const unit = Math.max(0, Math.round(Number(t.unit) || 0));
  const qty = Math.max(1, Math.round(Number(t.qty) || 1));
  const region = t.region === "other" || t.region === "metro" ? t.region : "auto";
  const regionFee = region === "other" ? REGION_FEE : 0;   // auto 는 발급 때 주소로 확정
  const list = unit * qty + regionFee;
  const type = ["none", "percent", "amount"].includes(t.discountType) ? t.discountType : "none";
  let value = Math.max(0, Number(t.discountValue) || 0);
  let discount = 0;
  if (type === "percent") { value = Math.min(100, value); discount = Math.round(list * value / 100); }
  if (type === "amount") { value = Math.min(list, Math.round(value)); discount = value; }
  return { unit, region, regionFee, qty, list, discountType: type, discountValue: type === "none" ? 0 : value, discount, monthly: list - discount };
}
/* 설치 주소 → 지역. 주소 검색 결과는 「서울특별시·경기도·인천광역시 …」 또는 「(06000) 서울 …」 형태 */
export function regionOf(addr) {
  const a = String(addr || "").replace(/^\s*\(?\d{5}\)?\s*/, "").trim();
  if (!a) return "metro";
  return /^(서울|경기|인천)/.test(a) ? "metro" : "other";
}
/* 발급 시점 금액 확정 — region "auto" 링크만 주소로 판정한다. 지역 정보가 없는 예전 링크는 그대로 */
export function settleTerms(t, addr) {
  if (!t || t.region !== "auto") return t;
  const region = regionOf(addr);
  const regionFee = region === "other" ? REGION_FEE : 0;
  const list = Math.round(Number(t.unit) || 0) * Math.max(1, Math.round(Number(t.qty) || 1)) + regionFee;
  let discount = 0;
  if (t.discountType === "percent") discount = Math.round(list * Math.min(100, Number(t.discountValue) || 0) / 100);
  if (t.discountType === "amount") discount = Math.min(list, Math.round(Number(t.discountValue) || 0));
  return { ...t, region, regionFee, list, discount, monthly: list - discount };
}
const REGION_LABEL = { metro: "서울·경기·인천", other: "그 외 지역" };
function regionText(t) {
  if (!t || !t.region || t.region === "auto") return "";
  return t.region === "other"
    ? `${REGION_LABEL.other} · 지역 출장비 월 ${Number(t.regionFee || 0).toLocaleString("ko-KR")}원 포함 (개소 수와 무관 · 설치비·출장비 별도 청구 없음)`
    : `${REGION_LABEL.metro} · 설치비 무료`;
}

/* ───────── 관리자 ───────── */
async function createOffer(b) {
  const p = price(b);
  const prod = products(b.products);           // 비어 있으면 고객이 계약 화면에서 직접 고른다
  const terms = {
    products: prod, solNote: str(b.solNote, 120),
    sol: str(b.sol, 160) || (prod.length ? prod.map((k) => PRODUCT_LABEL[k]).join(" · ") + (str(b.solNote, 120) ? " — " + str(b.solNote, 120) : "") : "긴급 경보 알리미"),
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

/* 관리자: 기록 삭제 (테스트 건 정리용). { type, ids:[...] }
   - offers  : 링크 + 그 링크로 체결된 계약
   - contracts: 계약 + 그 계약의 링크
   - clients : 고객 + 그 고객의 설문·SLA 동의 기록
   - surveys / consents : 해당 기록만
   먼데이 보드의 항목은 지우지 않는다(보드에서 직접). */
async function deleteItems(b) {
  const type = String(b.type || ""), ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map((x) => str(x, 60)).filter(Boolean).slice(0, 200);
  if (!TYPES[type] || !ids.length) return json({ ok: false, error: "bad_request" }, 400);
  const s = store(), removed = [];
  const del = async (prefix, id) => { try { await s.delete(prefix + id); removed.push(prefix + id); } catch (e) { /* 없으면 무시 */ } };
  for (const id of ids) {
    if (type === "offers") {
      const o = await s.get(TYPES.offers + id);
      if (o && o.contractRef) { await delFiles(s, o.contractRef, del); await del(TYPES.contracts, o.contractRef); }
      await del(TYPES.offers, id);
    } else if (type === "contracts") {
      const c = await s.get(TYPES.contracts + id);
      if (c && c.offerId) await del(TYPES.offers, c.offerId);
      await delFiles(s, id, del);
      await del(TYPES.contracts, id);
    } else if (type === "clients") {
      for (const t of ["surveys", "consents"]) {
        const { blobs } = await s.list({ prefix: TYPES[t] });
        for (const bl of blobs) { const x = await s.get(bl.key); if (x && x.clientId === id) await del("", bl.key); }
      }
      await del(TYPES.clients, id);
    } else {
      const x = await s.get(TYPES[type] + id);
      /* 고객 카드의 진행 표시도 되돌린다 */
      if (x && x.clientId) {
        const cl = await s.get(TYPES.clients + x.clientId);
        if (cl) {
          if (type === "surveys" && cl.surveyId === id) { cl.surveyAt = ""; cl.surveyId = ""; }
          if (type === "consents" && cl.consentRef === id) { cl.consentAt = ""; cl.consentDecision = ""; cl.consentRef = ""; }
          await s.setJSON(TYPES.clients + cl.id, cl);
        }
      }
      await del(TYPES[type], id);
    }
  }
  return json({ ok: true, removed: removed.length });
}

async function delFiles(s, ref, del) {
  const { blobs } = await s.list({ prefix: FILES + ref + "/" });
  for (const bl of blobs) await del("", bl.key);
}

/* 기존 고객 안내 메일 — 미리보기 / 발송 (2026-10-20) */
async function clientMailPreview(id) {
  const c = await store().get(TYPES.clients + str(id, 40));
  if (!c) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true, mail: noticeMail(c) });
}
async function clientMailSend(b) {
  const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map((x) => str(x, 40)).filter(Boolean).slice(0, 100);
  const s = store(), results = [];
  for (const id of ids) {
    const c = await s.get(TYPES.clients + id);
    if (!c) { results.push({ id, ok: false, error: "not_found" }); continue; }
    const r = await sendNotice(c);
    if (r.ok) { c.mailedAt = now(); c.mailCount = (c.mailCount || 0) + 1; await s.setJSON(TYPES.clients + id, c); }
    results.push({ id, name: c.name, email: c.email, ...r });
  }
  return json({ ok: results.every((r) => r.ok), results });
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
    const files = x.files || [];
    return { ...rest, status: x.status || "signed", files,
             signature: signature ? { name: signature.name, role: signature.role, signedOn: signature.signedOn } : null,
             hasLicense: !!(attachments && attachments.businessLicense) || files.some((f) => f.kind === "license"),
             hasContractFile: files.some((f) => f.kind === "contract") };
  }
  if (type === "consents") {
    const { signature, ...rest } = x;
    return { ...rest, signature: signature ? { name: signature.name, role: signature.role, signedOn: signature.signedOn } : null };
  }
  return x;
}

/* ───────── 공개: 계약 ───────── */
// 고객에게 돌려줄 계약 기록 — 접속 정보·내부 메모·옛 서명 이미지는 뺀다
function pub(rec) {
  if (!rec) return null;
  const { client, mondayItemId, signature, attachments, notes, ...rest } = rec;
  return { ...rest, status: rec.status || "signed", files: (rec.files || []).map(({ by, ...f }) => f) };
}

async function getOffer(id) {
  const s = store();
  const o = id && await s.get(TYPES.offers + str(id, 40));
  if (!o) return json({ ok: false, error: "not_found" }, 404);
  const out = { ok: true, id: o.id, status: o.status, terms: o.terms, customer: o.memo.customer || "" };
  if (o.contractRef && o.status !== "void") out.contract = pub(await s.get(TYPES.contracts + o.contractRef));
  return json(out);
}

/* 계약서 발급 — 고객 정보·SLA 동의를 받아 계약번호를 매긴다. 전자서명은 받지 않는다(날인본 회신으로 체결).
   발급 후 회신 전(issued)에는 같은 링크로 정보를 고쳐 다시 발급할 수 있다(같은 계약번호). */
async function submitContract(req, b) {
  const s = store(), key = TYPES.offers + str(b.offerId, 40);
  const o = await s.get(key);
  if (!o) return json({ ok: false, error: "offer_not_found" }, 404);
  if (o.status !== "open" && o.status !== "issued") return json({ ok: false, error: "offer_" + o.status }, 409);

  const c = b.customer || {};
  for (const k of ["name", "address", "ceo", "manager", "phone", "email", "site", "siteAddr"]) {
    if (!str(c[k], 200)) return json({ ok: false, error: "missing_" + k }, 400);
  }
  if (!b.slaAgreedAt) return json({ ok: false, error: "missing_sla" }, 400);

  const prev = o.status === "issued" && o.contractRef ? await s.get(TYPES.contracts + o.contractRef) : null;
  const ref = prev ? prev.ref : refNo("MK");
  const t = settleTerms(o.terms, c.siteAddr || c.address); // 조건은 언제나 서버에 저장된 값을 쓴다 (링크·화면 조작 방지) · 지역 출장비는 설치 주소로 자동 확정
  const prodFixed = (t.products || []).length > 0;
  const prodList = prodFixed ? t.products : products(b.products);
  if (!prodList.length) return json({ ok: false, error: "products_required" }, 400);
  const solution = prodList.map((k) => PRODUCT_LABEL[k]).join(" · ") + (t.solNote ? " — " + t.solNote : "");
  const ack = Array.isArray(b.acknowledged) ? b.acknowledged.slice(0, 20).map((x) => str(x, 80)).filter(Boolean) : [];
  const rec = {
    ref, offerId: o.id, status: "issued", submittedAt: prev ? prev.submittedAt : now(), ...(prev ? { updatedAt: now() } : {}),
    slaVersion: SLA_VERSION,
    terms: { solution, products: prodList, productsChosenBy: prodFixed ? "staff" : "customer", solNote: t.solNote || "",
             unitPrice: t.unit, region: t.region || "", regionFee: t.regionFee || 0, sites: t.qty, listPrice: t.list,
             discountType: t.discountType, discountValue: t.discountValue, discount: t.discount, discountNote: t.discountNote,
             monthly: t.monthly, from: t.from, to: t.to, payDay: t.pay, bank: t.bank, etc: t.etc },
    customer: {
      name: str(c.name, 120), bizNo: str(c.bizNo, 20), address: str(c.address, 200), ceo: str(c.ceo, 40),
      contractType: c.contractType === "B2C" ? "B2C" : "B2B", manager: str(c.manager, 40), phone: str(c.phone, 30),
      email: str(c.email, 120), site: str(c.site, 200), siteAddr: str(c.siteAddr, 200),
    },
    recipients: (Array.isArray(b.recipients) ? b.recipients : []).slice(0, 10)
      .map((r) => ({ name: str(r.name, 40), phone: str(r.phone, 30), email: str(r.email, 120) })).filter((r) => r.name || r.phone),
    slaViewedAt: str(b.slaViewedAt, 40) || (prev && prev.slaViewedAt) || "", slaAgreedAt: str(b.slaAgreedAt, 40),
    slaReadPct: Math.max(Number(b.slaReadPct) || 0, (prev && prev.slaReadPct) || 0),
    acknowledged: ack.length ? ack : (prev && prev.acknowledged) || [],
    files: (prev && prev.files) || [],
    client: meta(req),
    ...(prev && prev.mondayItemId ? { mondayItemId: prev.mondayItemId } : {}),
  };
  await s.setJSON(TYPES.contracts + ref, rec);
  o.status = "issued"; o.issuedAt = o.issuedAt || rec.submittedAt; o.contractRef = ref;
  await s.setJSON(key, o);

  if (prev) return json({ ok: true, ref, updated: true, contract: pub(rec) });   // 정보 수정·재발급은 알림 없이

  const won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";
  const mailed = await alert({
    kind: "alarm_contract", label: "알리미 계약서 발급", interest: "긴급 경보 알리미 계약서 발급 (날인본 회신 대기)",
    company: rec.customer.name, name: rec.customer.manager, phone: rec.customer.phone, email: rec.customer.email,
    memo: `${solution} · ${t.qty}개소 · 월 ${won(t.monthly)} (부가세 별도)${t.discount ? " · 할인 " + won(t.discount) : ""} · ${t.from} ~ ${t.to}`,
    ip: rec.client.ip, ref,
  }, {
    "계약번호": ref, "진행": "고객이 계약서를 내려받았습니다 — 직인 날인본·사업자등록증 회신 대기 (1015@monnit.com 또는 온라인 회신)",
    "설치 현장": rec.customer.site, "현장 주소": rec.customer.siteAddr, "대표자": rec.customer.ceo, "계약 구분": rec.customer.contractType,
    "월 청구액": won(t.monthly) + " (부가세 별도)", ...(t.region ? { "설치 지역": regionText(t) } : {}), "계약 기간": `${t.from} ~ ${t.to}`,
    "SLA": `${SLA_VERSION} 동의 ${rec.slaAgreedAt}`,
    "알림 수신자": rec.recipients.map((r) => `${r.name} ${r.phone}`).join(" / ") || "—",
    "관리 화면": SITE + "/contract-admin",
  });
  const [, monday] = await Promise.all([customerMail(rec, o.id), pushContract(rec)]);
  if (monday && monday.id) { rec.mondayItemId = monday.id; await s.setJSON(TYPES.contracts + ref, rec); }
  return json({ ok: true, ref, mailed, contract: pub(rec) });
}

/* ───────── 회신 파일 (날인 계약서 · 사업자등록증) ─────────
   본문 = 파일 그대로 (JSON·base64 아님 — Worker CPU 를 쓰지 않도록). R2 files/<ref>/<fid> 에 저장. */
async function uploadFile(req, url, by) {
  const s = store(), q = (k, n) => str(url.searchParams.get(k), n);
  const ref = q("ref", 40), kind = FILE_KINDS[q("kind", 12)] ? q("kind", 12) : "other";
  const rec = ref && await s.get(TYPES.contracts + ref);
  if (!rec) return json({ ok: false, error: "contract_not_found" }, 404);
  let offer = null;
  if (by === "customer") {
    offer = await s.get(TYPES.offers + q("offer", 40));
    if (!offer || offer.contractRef !== ref) return json({ ok: false, error: "forbidden" }, 403);
    if (!["issued", "returned"].includes(offer.status)) return json({ ok: false, error: "offer_" + offer.status }, 409);
  } else {
    offer = rec.offerId ? await s.get(TYPES.offers + rec.offerId) : null;
  }
  const type = String(req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(type) && type !== "application/pdf") return json({ ok: false, error: "bad_type" }, 415);
  const len = Number(req.headers.get("content-length") || 0);
  if (len > FILE_MAX) return json({ ok: false, error: "too_large" }, 413);
  if ((rec.files || []).length >= 30) return json({ ok: false, error: "too_many" }, 409);
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) return json({ ok: false, error: "empty" }, 400);
  if (buf.byteLength > FILE_MAX) return json({ ok: false, error: "too_large" }, 413);

  const name = (q("name", 120) || "file").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_");
  const id = token(8);
  await s.setFile(FILES + ref + "/" + id, buf, { name, type, kind });
  const f = { id, kind, name, type, size: buf.byteLength, uploadedAt: now(), by };
  rec.files = [...(rec.files || []), f];
  const first = !(rec.status === "returned" || rec.status === "signed");
  if (rec.status !== "signed") { rec.status = "returned"; rec.returnedAt = rec.returnedAt || f.uploadedAt; }
  await s.setJSON(TYPES.contracts + ref, rec);
  if (offer && offer.status !== "signed" && offer.status !== "void") { offer.status = rec.status; await s.setJSON(TYPES.offers + offer.id, offer); }

  if (by === "customer") {
    await alert({
      kind: "alarm_contract_return", label: "알리미 계약서 회신", interest: "긴급 경보 알리미 날인 계약서 회신",
      company: rec.customer.name, name: rec.customer.manager, phone: rec.customer.phone, email: rec.customer.email,
      memo: `${FILE_KINDS[kind]} · ${name}`, ref,
    }, {
      "계약번호": ref, "올린 파일": `${FILE_KINDS[kind]} — ${name} (${Math.round(buf.byteLength / 1024)}KB)`,
      "지금까지 받은 파일": rec.files.map((x) => `${FILE_KINDS[x.kind] || x.kind}: ${x.name}`).join(" / "),
      "확인": "관리 화면 → 계약 현황 → 상세에서 파일을 열어 확인한 뒤 「체결 완료」로 처리해 주세요. " + SITE + "/contract-admin",
    });
    if (first && rec.mondayItemId) await mondayStatus(rec, "날인본 회신");
  }
  return json({ ok: true, status: rec.status, files: rec.files.map(({ by: _b, ...x }) => x) });
}

async function adminFile(ref, id) {
  const r = await store().getFile(FILES + str(ref, 40) + "/" + str(id, 20));
  if (!r || !r.data) return json({ ok: false, error: "not_found" }, 404);
  const m = r.metadata || {};
  return new Response(r.data, { headers: {
    "content-type": m.type || "application/octet-stream", "cache-control": "no-store",
    "content-disposition": "inline; filename*=UTF-8''" + encodeURIComponent(m.name || "file"),
  } });
}

async function deleteFile(b) {
  const s = store(), ref = str(b.ref, 40), id = str(b.id, 20);
  const rec = await s.get(TYPES.contracts + ref);
  if (!rec) return json({ ok: false, error: "not_found" }, 404);
  try { await s.delete(FILES + ref + "/" + id); } catch (e) { /* 이미 없음 */ }
  rec.files = (rec.files || []).filter((f) => f.id !== id);
  await s.setJSON(TYPES.contracts + ref, rec);
  return json({ ok: true, files: rec.files });
}

/* 담당자: 날인본 확인 후 체결 완료 처리 (또는 되돌리기) */
async function setStatus(b) {
  const s = store(), ref = str(b.ref, 40), st = str(b.status, 12);
  if (!CONTRACT_STATUS.includes(st)) return json({ ok: false, error: "bad_status" }, 400);
  const rec = await s.get(TYPES.contracts + ref);
  if (!rec) return json({ ok: false, error: "not_found" }, 404);
  rec.status = st;
  if (st === "signed") rec.signedAt = now(); else delete rec.signedAt;
  if (b.note) rec.notes = [...(rec.notes || []), { at: now(), text: str(b.note, 300) }];
  await s.setJSON(TYPES.contracts + ref, rec);
  const o = rec.offerId && await s.get(TYPES.offers + rec.offerId);
  if (o && o.status !== "void") { o.status = st; if (st === "signed") o.signedAt = rec.signedAt; await s.setJSON(TYPES.offers + o.id, o); }
  if (rec.mondayItemId) await mondayStatus(rec, st === "signed" ? "계약 체결" : st === "returned" ? "날인본 회신" : "계약서 발급");
  return json({ ok: true, status: st, signedAt: rec.signedAt || "" });
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

/* 계약서를 발급한 고객에게 회신 안내 메일 — Brevo 가 설정된 경우에만. 실패해도 발급은 유지. */
async function customerMail(rec, offerId) {
  const key = process.env.BREVO_API_KEY;
  const to = String(rec.customer.email || "").trim();
  if (!key || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) return false;
  const t = rec.terms, won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";
  const link = `${SITE}/contract?id=${offerId}`;
  const text = [
    `${rec.customer.manager}님, 안녕하세요. 모넷코리아입니다.`, "",
    `긴급 경보 알리미 구독 계약서가 발급되었습니다. (계약번호 ${rec.ref})`, "",
    "▶ 계약서 내려받기·회신 링크 (보관해 두십시오)", link, "",
    `· 발주처: ${rec.customer.name} (대표 ${rec.customer.ceo})`, `· 설치 현장: ${rec.customer.site} (${rec.customer.siteAddr})`,
    `· 납품 솔루션: ${t.solution} · ${t.sites}개소`,
    `· 월 청구액: ${won(t.monthly)} (부가세 별도)${t.discount ? " — 정가 " + won(t.listPrice) + "에서 " + won(t.discount) + " 할인" : ""}`,
    ...(t.region ? [`· 설치 지역: ${regionText(t)}`] : []),
    `· 계약 기간: ${t.from} ~ ${t.to}`, "",
    "[계약 체결 절차]",
    "1. 아래 링크에서 계약서(A4 양면: 앞면 계약서 · 뒷면 서비스수준협약)를 내려받아 인쇄합니다.",
    "2. 앞면 발주처 대표이사 (인) 란과 계약일을 기재하고 직인을 날인합니다.",
    "3. 날인한 계약서와 사업자등록증 사본을 링크 화면에서 올리시거나 1015@monnit.com 으로 보내 주십시오.",
    `   (메일 제목에 계약번호 ${rec.ref} 를 적어 주십시오)`,
    "4. 모넷코리아가 날인본을 확인하면 계약 체결이 완료되며, 설치 일정과 세금계산서 발행 절차를 안내드립니다.", "",
    "▶ 계약서 내려받기·회신 링크", link, "",
    "링크는 계약이 체결될 때까지 언제든 다시 열어 계약서를 내려받거나 날인본을 올리실 수 있습니다.", "",
    "문의 02-2088-1454 · 1015@monnit.com", "", "주식회사 모넷코리아",
  ].join("\n");
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "모넷코리아", email: process.env.MAIL_FROM || "no-reply@monnit.co.kr" },
        to: [{ email: to, name: rec.customer.manager }],
        replyTo: { name: "모넷코리아", email: "1015@monnit.com" },
        subject: `[모넷코리아] 긴급 경보 알리미 계약서 발급 및 회신 안내 (${rec.ref})`, textContent: text, tags: ["alarm-contract"],
      }), signal: AbortSignal.timeout(8000),
    });
    return r.status === 201;
  } catch (e) { return false; }
}

/* 먼데이 「구분」 값 갱신 — 실패해도 무시 */
async function mondayStatus(rec, label) {
  try { await setContractKind(rec.mondayItemId, label); } catch (e) { /* 무시 */ }
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
