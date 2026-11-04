/** 긴급 경보 알리미 — 구독 결제 API (/api/billing/*)
 *
 *  화면
 *    /pay            결제(구독 신청) — 랜딩에서 바로(?plan=fire&qty=2&region=metro) 또는 계약 링크에서(?offer=<계약 링크 id>)
 *    /account        구독 관리 — 회원(이메일 인증 로그인) · 비회원(구독번호 + 이메일 인증)
 *    /billing-admin  관리자 — 구독·결제·세금계산서(나라빌 엑셀)·설정 (관리 키 = ALARM_ADMIN_KEY, /contract-admin 과 같음)
 *
 *  회원 · 비회원
 *    회원   = 이메일 인증코드로 가입·로그인 (비밀번호 없음 — 무료 플랜 CPU 한도 때문에 비밀번호 해시를 쓰지 않는다).
 *             고객 정보가 저장돼 다음 신청 때 자동으로 채워지고, 같은 이메일의 구독이 모두 보인다.
 *    비회원 = 로그인 없이 바로 신청. 신청한 브라우저에서는 그대로 관리되고,
 *             다른 기기에서는 구독번호 + 이메일 인증코드로 조회한다.
 *
 *  결제 수단
 *    card    토스페이먼츠 카드 자동결제(빌링). 카드 등록 → 설치 완료(관리자 「서비스 개시」) 날 첫 결제 → 매달 같은 날 자동 결제.
 *            (설정 chargeAt = "signup" 이면 카드 등록 즉시 첫 결제)
 *    invoice 세금계산서 발행 · 계좌이체 (법인). 매달 결제일에 청구 기록이 생기고, 관리 화면에서 나라빌 대량발행 엑셀로 내려받는다.
 *
 *  공개                                       관리자 (헤더 x-admin-key)
 *    GET  config        결제 설정·키           GET  admin/list · admin/sub?id · admin/pays?month=YYYY-MM · admin/settings
 *    GET  quote?offer=  계약 조건 불러오기      POST admin/activate {id,start}    서비스 개시(첫 결제)
 *    POST otp/send      인증코드 보내기          POST admin/charge {id}            지금 결제(재시도)
 *    POST otp/verify    인증 → 로그인            POST admin/refund {orderId,amount?,reason}
 *    POST logout                                 POST admin/cancel {id,mode}       해지(예약·즉시·철회)
 *    GET  me            내 구독                  POST admin/update {id,…}          다음 결제일·메모·고객 정보
 *    POST checkout      구독 신청                POST admin/invoice {orderIds,status} 세금계산서 발행·입금 표시
 *    POST card/confirm  카드 등록 완료(authKey)  POST admin/settings · admin/delete {ids} · admin/cron
 *    POST card/change   카드 변경 시작
 *    GET  pays?sub=     결제 내역
 *    POST cancel        해지 신청
 */
import { getStore } from "../lib/blobs.mjs";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { tossClientKey, tossReady, tossTestMode, tossKeyProblem, issueBillingKey, cardLabel, cancelPayment, deleteBillingKey } from "./_toss.mjs";
import {
  SITE, db, PRODUCTS, UNIT, MAX_SELF_SITES, landingPlan, contractPlan, vatOf, won, kstToday, isDate, addDays,
  token, subId, hashOf, normEmail, isEmail, str, nowIso, seal, unseal, getSub, saveSub, indexEmail, subsOfEmail, setDue,
  quotePlan, pubSub, runCycle, STATUS_LABEL, later, sendMail, mailHtml, welcomeMail, staffAlert, getSettings, DEFAULT_SETTINGS, manageUrl, closeIfDue,
  makeTerm, inTerm, monthsLeft, oneTimeCharge, refundMail,
} from "./_billing_core.mjs";
import { runDue } from "./billing-cron.mjs";
import leadFn from "./lead.mjs";   /* 현금 결제 상담 — 사이트의 다른 문의와 같은 리드 원장·담당자 배분(1015@·5959@)·먼데이로 */

const P = "/api/billing/";
const ROUTES = ["config", "quote", "otp/send", "otp/verify", "logout", "me", "checkout", "card/confirm", "card/change", "pays", "cancel", "profile",
  "admin/ping", "admin/list", "admin/sub", "admin/pays", "admin/settings", "admin/activate", "admin/charge", "admin/refund", "admin/cancel",
  "admin/update", "admin/invoice", "admin/delete", "admin/cron",
  "cash-inquiry", "admin/inquiries", "admin/inquiry", "admin/quotes", "admin/quote"];
export const config = { path: ROUTES.map((r) => P + r) };

const COOKIE = "mnk_bill";
const MEMBER_DAYS = 30, GUEST_DAYS = 2;
const ALARM = getStore("alarm");
const alarmGet = (k) => ALARM.get(k, { type: "json" }).catch(() => null);

export default async (req) => {
  try {
    const url = new URL(req.url);
    const r = url.pathname.slice(P.length).replace(/\/+$/, "");
    const m = req.method;
    if (r.startsWith("admin/")) {
      if (!isAdmin(req)) return json({ ok: false, error: "unauthorized" }, 401);
      return admin(req, url, r.slice(6), m);
    }
    if (m === "POST" && !sameOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);
    if (m === "GET" && r === "config") return getConfig();
    if (m === "GET" && r === "quote") return url.searchParams.get("q") ? quoteLink(url.searchParams.get("q")) : quote(url.searchParams.get("offer"));
    if (m === "POST" && r === "otp/send") return otpSend(req, await body(req));
    if (m === "POST" && r === "otp/verify") return otpVerify(req, await body(req));
    if (m === "POST" && r === "logout") return logout(req);
    if (m === "GET" && r === "me") return me(req);
    if (m === "POST" && r === "checkout") return checkout(req, await body(req));
    if (m === "POST" && r === "card/confirm") return cardConfirm(req, await body(req));
    if (m === "POST" && r === "card/change") return cardChange(req, await body(req));
    if (m === "GET" && r === "pays") return customerPays(req, url.searchParams.get("sub"));
    if (m === "POST" && r === "cancel") return customerCancel(req, await body(req));
    if (m === "POST" && r === "profile") return saveProfile(req, await body(req));
    if (m === "POST" && r === "cash-inquiry") return cashInquiry(req, await body(req));
    return json({ ok: false, error: "not_found" }, 404);
  } catch (e) {
    if (e && e.status) return json({ ok: false, error: e.message }, e.status);
    console.error("[billing]", e && e.stack || e);
    return json({ ok: false, error: "server" }, 500);
  }
};

/* ───────── 설정 · 견적 ───────── */
async function getConfig() {
  const s = await getSettings();
  return json({ ok: true, ready: tossReady(), test: tossTestMode(), clientKey: tossClientKey(),
    unit: UNIT, maxSites: MAX_SELF_SITES, chargeAt: s.chargeAt, bank: s.bank || "", termMonths: s.termMonths,
    products: Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, { label: v.label, note: v.note }])) });
}

/** 계약 링크 → 결제 조건. 계약서가 발급(issued)된 뒤부터 결제를 등록할 수 있다 */
async function loadOffer(offerId) {
  const id = str(offerId, 40);
  if (!id) return { error: "offer_required", status: 400 };
  const o = await alarmGet("offers/" + id);
  if (!o) return { error: "offer_not_found", status: 404 };
  if (o.status === "void") return { error: "offer_void", status: 409 };
  if (!o.contractRef) return { error: "contract_not_issued", status: 409, offer: o };
  const c = await alarmGet("contracts/" + o.contractRef);
  if (!c) return { error: "contract_not_found", status: 404 };
  return { offer: o, contract: c };
}
async function quote(offerId) {
  const x = await loadOffer(offerId);
  if (x.error) return json({ ok: false, error: x.error }, x.status);
  const { offer, contract } = x;
  const plan = contractPlan(contract);
  let existing = null;
  if (contract.billingSubId) {
    const s = await getSub(contract.billingSubId);
    if (s && s.status !== "pending" && s.status !== "canceled") existing = { id: s.id, status: s.status };
  }
  const c = contract.customer || {};
  return json({ ok: true, offer: offer.id, ref: contract.ref, plan, existing,
    customer: { company: c.name, bizNo: c.bizNo, ceo: c.ceo, manager: c.manager, phone: c.phone, email: c.email, address: c.address, site: c.site, siteAddr: c.siteAddr },
    payDay: contract.terms && contract.terms.payDay || "" });
}

/* ───────── 담당자 견적 → 결제 링크 (/pay?q=<id>) ─────────
   담당자가 관리 화면에서 견적(구성·단가·할인·설치비·의무기간)을 확정해 링크를 보내면,
   고객은 그 링크에서 정보 확인 → 약관·의무기간 동의 → 카드 등록까지 한 번에 끝낸다(문의 → 답변 → 재문의 없이). */
async function loadQuote(id) {
  const q = await db.get("quotes/" + str(id, 40).toUpperCase());
  if (!q) return { error: "quote_not_found", status: 404 };
  if (q.status === "void") return { error: "quote_void", status: 409, q };
  if (q.status !== "used" && q.expiresAt && q.expiresAt < kstToday()) return { error: "quote_expired", status: 409, q };
  return { q };
}
async function quoteLink(id) {
  const x = await loadQuote(id);
  if (x.error) return json({ ok: false, error: x.error }, x.status);
  const q = x.q;
  let existing = null;
  if (q.subId) { const s = await getSub(q.subId); if (s && s.status !== "pending" && s.status !== "canceled") existing = { id: s.id, status: s.status }; }
  if (!q.viewedAt) { q.viewedAt = nowIso(); await db.set("quotes/" + q.id, q); }
  return json({ ok: true, kind: "quote", quote: { id: q.id, expiresAt: q.expiresAt, note: q.note || "", createdAt: q.createdAt }, plan: quotePlan(q), customer: q.customer || {}, existing });
}

/* ───────── 이메일 인증 (회원 로그인 · 비회원 조회) ───────── */
const codeHash = (email, code) => createHash("sha256").update("mnk-otp:" + email + ":" + code).digest("hex");
async function otpSend(req, b) {
  const email = normEmail(b.email);
  if (!isEmail(email)) return json({ ok: false, error: "bad_email" }, 400);
  const purpose = b.purpose === "lookup" ? "lookup" : "login";
  let sid = "";
  if (purpose === "lookup") {
    sid = str(b.subId, 40).toUpperCase();
    const s = sid && await getSub(sid);
    /* 구독번호·이메일이 맞지 않아도 같은 응답 — 다른 사람의 구독 존재 여부를 알 수 없게 */
    if (!s || normEmail(s.customer.email) !== email) return json({ ok: true, sent: true });
  }
  const k = "otp/" + hashOf(email);
  const prev = (await db.get(k)) || {};
  const nowMs = Date.now();
  const sends = (prev.sends || []).filter((t) => nowMs - t < 3600e3);
  if (sends.length && nowMs - sends[sends.length - 1] < 45e3) return json({ ok: false, error: "too_soon", wait: 45 }, 429);
  if (sends.length >= 6) return json({ ok: false, error: "too_many" }, 429);
  const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  await db.set(k, { h: codeHash(email, code), exp: nowMs + 10 * 60e3, tries: 0, purpose, subId: sid, sends: [...sends, nowMs] });
  const mailed = await sendMail({ to: email, subject: `[모넷코리아] 인증코드 ${code}`, tag: "alarm-billing-otp",
    text: `모넷코리아 긴급 경보 알리미 인증코드: ${code}\n\n10분 안에 입력해 주십시오. 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.`,
    html: mailHtml({ title: code, lead: "모넷코리아 긴급 경보 알리미 인증코드입니다. 10분 안에 입력해 주십시오.", foot: "요청하지 않으셨다면 이 메일을 무시하셔도 됩니다." }) });
  const out = { ok: true, sent: mailed };
  if (process.env.BILLING_DEV_OTP === "1") out.devCode = code;          // 로컬 검증 전용 — 운영에서는 절대 켜지 마세요
  if (!mailed && !out.devCode) return json({ ok: false, error: "mail_unavailable" }, 503);
  return json(out);
}
async function otpVerify(req, b) {
  const email = normEmail(b.email), code = str(b.code, 6);
  const k = "otp/" + hashOf(email);
  const o = await db.get(k);
  if (!o || !o.h || Date.now() > o.exp) return json({ ok: false, error: "expired" }, 400);
  if (o.tries >= 5) return json({ ok: false, error: "too_many_tries" }, 429);
  const want = Buffer.from(o.h), got = Buffer.from(codeHash(email, code));
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    o.tries = (o.tries || 0) + 1; await db.set(k, o);
    return json({ ok: false, error: "wrong_code", left: 5 - o.tries }, 400);
  }
  await db.set(k, { sends: o.sends || [] });                      // 한 번 쓰면 끝
  let sess;
  if (o.purpose === "lookup") {
    sess = { scope: "sub", subId: o.subId, email };
  } else {
    sess = { scope: "member", email };
    const mk = "members/" + hashOf(email);
    const mem = await db.get(mk);
    if (!mem) await db.set(mk, { email, createdAt: nowIso(), profile: {}, lastLoginAt: nowIso() });
    else { mem.lastLoginAt = nowIso(); await db.set(mk, mem); }
    sess.isNew = !mem;
  }
  const { cookie } = await newSession(sess, o.purpose === "lookup" ? GUEST_DAYS : MEMBER_DAYS);
  return json({ ok: true, scope: sess.scope, subId: sess.subId || "", isNew: !!sess.isNew }, 200, { "set-cookie": cookie });
}
async function newSession(sess, days) {
  const t = token(32);
  await db.set("sess/" + t, { ...sess, exp: Date.now() + days * 864e5, createdAt: nowIso() });
  return { cookie: `${COOKIE}=${t}; Path=/; Max-Age=${days * 86400}; HttpOnly; Secure; SameSite=Lax`, t };
}
async function session(req) {
  const m = /(?:^|;\s*)mnk_bill=([a-z0-9]{32})/.exec(req.headers.get("cookie") || "");
  if (!m) return null;
  const s = await db.get("sess/" + m[1]);
  if (!s || Date.now() > s.exp) return null;
  return { ...s, token: m[1] };
}
async function logout(req) {
  const s = await session(req);
  if (s) await db.del("sess/" + s.token);
  return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
}
/** 세션이 이 구독을 볼 수 있는가 */
function canAccess(sess, sub) {
  if (!sess || !sub) return false;
  if (sess.scope === "sub") return sess.subId === sub.id || (sess.subs || []).includes(sub.id);
  if (sess.scope === "member") return normEmail(sub.customer.email) === sess.email || normEmail(sub.memberEmail) === sess.email;
  return false;
}
async function me(req) {
  const sess = await session(req);
  if (!sess) return json({ ok: true, member: null, subs: [] });
  let ids = [];
  let member = null;
  if (sess.scope === "member") {
    const mem = await db.get("members/" + hashOf(sess.email));
    member = { email: sess.email, profile: mem && mem.profile || {} };
    ids = await subsOfEmail(sess.email);
  } else ids = [sess.subId, ...(sess.subs || [])].filter(Boolean);
  const subs = (await Promise.all([...new Set(ids)].slice(0, 30).map(getSub))).filter((s) => s && s.status !== "pending" && canAccess(sess, s));
  return json({ ok: true, scope: sess.scope, member, email: sess.email, subs: subs.map(pubSub) });
}
async function saveProfile(req, b) {
  const sess = await session(req);
  if (!sess || sess.scope !== "member") return json({ ok: false, error: "login_required" }, 401);
  const mk = "members/" + hashOf(sess.email);
  const mem = (await db.get(mk)) || { email: sess.email, createdAt: nowIso() };
  mem.profile = cleanCustomer(b.customer || {}, sess.email);
  await db.set(mk, mem);
  return json({ ok: true, profile: mem.profile });
}

/* ───────── 구독 신청 ───────── */
function cleanCustomer(c, forceEmail) {
  return {
    company: str(c.company, 120), bizNo: str(c.bizNo, 20).replace(/[^\d-]/g, ""), ceo: str(c.ceo, 40), manager: str(c.manager, 40),
    phone: str(c.phone, 30), email: forceEmail || normEmail(c.email), address: str(c.address, 200),
    bizType: str(c.bizType, 60), bizItem: str(c.bizItem, 60), site: str(c.site, 160), siteAddr: str(c.siteAddr, 200),
  };
}
/* 설치 주소 → 지역 (alarm.mjs regionOf 와 같은 규칙) */
const regionOf = (addr) => {
  const a = String(addr || "").replace(/^\s*\(?\d{5}\)?\s*/, "").trim();
  return !a || /^(서울|경기|인천)/.test(a) ? "metro" : "other";
};

async function checkout(req, b) {
  const sess = await session(req);
  const asMember = b.asMember === true;
  if (asMember && (!sess || sess.scope !== "member")) return json({ ok: false, error: "login_required" }, 401);
  const method = b.method === "invoice" ? "invoice" : "card";
  const cust = cleanCustomer(b.customer || {}, asMember ? sess.email : "");
  for (const k of ["company", "manager", "phone", "email", "site", "siteAddr"]) if (!cust[k]) return json({ ok: false, error: "missing_" + k }, 400);
  if (!isEmail(cust.email)) return json({ ok: false, error: "bad_email" }, 400);
  if (!/^0\d{8,10}$/.test(cust.phone.replace(/\D/g, ""))) return json({ ok: false, error: "bad_phone" }, 400);
  if (method === "invoice") {
    if (cust.bizNo.replace(/\D/g, "").length !== 10) return json({ ok: false, error: "missing_bizNo" }, 400);
    if (!cust.ceo) return json({ ok: false, error: "missing_ceo" }, 400);
    if (!cust.address) return json({ ok: false, error: "missing_address" }, 400);
  }
  const ag = b.agree || {};
  if (!ag.terms || !ag.privacy || !ag.term || (method === "card" && !ag.autopay)) return json({ ok: false, error: "missing_agree" }, 400);
  if (method === "card" && !tossReady()) return json({ ok: false, error: "pg_not_ready" }, 503);

  /* 구성·금액 — 언제나 서버가 정한다 */
  let plan, offerId = "", contractRef = "", quoteId = "";
  if (b.quote) {
    const x = await loadQuote(b.quote);
    if (x.error) return json({ ok: false, error: x.error }, x.status);
    if (x.q.subId) { const old = await getSub(x.q.subId); if (old && old.status !== "pending" && old.status !== "canceled") return json({ ok: false, error: "already_subscribed", subId: old.id }, 409); }
    plan = quotePlan(x.q); quoteId = x.q.id;
    if (!plan.supply) return json({ ok: false, error: "zero_amount" }, 400);
  } else if (b.offer) {
    const x = await loadOffer(b.offer);
    if (x.error) return json({ ok: false, error: x.error }, x.status);
    if (x.contract.billingSubId) {
      const old = await getSub(x.contract.billingSubId);
      if (old && old.status !== "pending" && old.status !== "canceled") return json({ ok: false, error: "already_subscribed", subId: old.id }, 409);
    }
    plan = contractPlan(x.contract); offerId = x.offer.id; contractRef = x.contract.ref;
    if (!plan.supply) return json({ ok: false, error: "zero_amount" }, 400);
  } else {
    plan = landingPlan({ lines: b.lines, region: regionOf(cust.siteAddr) });
    if (plan.error) return json({ ok: false, error: plan.error }, 400);
    plan.termMonths = (await getSettings()).termMonths;      // 신청 시점의 의무 사용기간을 구독에 고정
  }

  const id = subId();
  const sub = {
    id, createdAt: nowIso(), status: method === "card" ? "pending" : "registered", method, source: plan.source,
    offerId, contractRef, quoteId, member: asMember, memberEmail: asMember ? sess.email : "",
    customer: cust, plan, customerKey: "ck_" + token(24), cycle: 0, failCount: 0, payments: [],
    via: str(b.via, 20),
    agree: { terms: true, privacy: true, term: true, termMonths: plan.termMonths || 0, autopay: method === "card", at: nowIso(), ip: ip(req), text: str(ag.text, 600) },
    client: { ip: ip(req), ua: str(req.headers.get("user-agent"), 300) },
  };
  await saveSub(sub);
  await indexEmail(cust.email, id);
  if (asMember) {
    const mk = "members/" + hashOf(sess.email);
    const mem = (await db.get(mk)) || { email: sess.email, createdAt: nowIso() };
    if (b.saveProfile !== false) { mem.profile = { ...cust }; await db.set(mk, mem); }
  }
  /* 비회원도 신청한 브라우저에서는 바로 관리할 수 있도록 이 구독 전용 세션 */
  const headers = {};
  if (!sess) headers["set-cookie"] = (await newSession({ scope: "sub", subId: id, email: cust.email }, GUEST_DAYS)).cookie;
  else if (sess.scope === "sub") { const cur = await db.get("sess/" + sess.token); if (cur) { cur.subs = [...new Set([...(cur.subs || []), id])]; await db.set("sess/" + sess.token, cur); } }

  if (method === "invoice") {
    await afterRegistered(sub);
    return json({ ok: true, subId: id, method, sub: pubSub(sub) }, 200, headers);
  }
  return json({ ok: true, subId: id, method, customerKey: sub.customerKey,
    successUrl: `${origin(req)}/pay?sub=${id}&r=ok${offerId ? "&offer=" + offerId : ""}${quoteId ? "&q=" + quoteId : ""}`,
    failUrl: `${origin(req)}/pay?sub=${id}&r=fail${offerId ? "&offer=" + offerId : ""}${quoteId ? "&q=" + quoteId : ""}`,
    customerEmail: cust.email, customerName: cust.company }, 200, headers);
}

/** 카드 등록(빌링키 발급) — 신규 구독과 카드 변경 모두 */
async function cardConfirm(req, b) {
  const sub = await getSub(b.subId);
  if (!sub) return json({ ok: false, error: "not_found" }, 404);
  if (str(b.customerKey, 64) !== sub.customerKey) return json({ ok: false, error: "key_mismatch" }, 400);
  const authKey = str(b.authKey, 300);
  if (!authKey) return json({ ok: false, error: "missing_authKey" }, 400);
  if (sub.status === "canceled") return json({ ok: false, error: "canceled" }, 409);
  const changing = !!sub.billingKeyEnc;
  if (changing) {                                   // 카드 변경은 로그인(또는 신청 브라우저) 필요
    const sess = await session(req);
    if (!canAccess(sess, sub)) return json({ ok: false, error: "login_required" }, 401);
  }
  if (sub.lastAuthKey === authKey) return json({ ok: true, subId: sub.id, sub: pubSub(sub), repeated: true });   // 새로고침
  const r = await issueBillingKey(authKey, sub.customerKey);
  if (!r.ok || !r.data || !r.data.billingKey) return json({ ok: false, error: "issue_failed", code: r.code, message: r.message }, 400);
  const oldEnc = sub.billingKeyEnc;
  sub.billingKeyEnc = await seal(r.data.billingKey);
  sub.card = cardLabel(r.data);
  sub.cardAt = nowIso(); sub.lastAuthKey = authKey;
  if (changing) {
    later((async () => { const old = await unseal(oldEnc); if (old) await deleteBillingKey(old); })());
    sub.cardChanges = (sub.cardChanges || 0) + 1;
    await saveSub(sub);
    /* 결제가 밀려 있던 구독은 바뀐 카드로 바로 결제 */
    let charged = null;
    if (sub.status === "past_due" || (sub.retryAt && sub.retryAt > kstToday())) { const x = await runCycle(sub, { by: "card_change", date: sub.nextChargeAt || kstToday() }); charged = x.pay && { status: x.pay.status, amount: x.pay.amount }; }
    later(staffAlert(sub, "알리미 결제 카드 변경", { "구독번호": sub.id, "카드": `${sub.card.company} •••• ${sub.card.last4}`, ...(charged ? { "밀린 결제": `${won(charged.amount)} ${charged.status}` } : {}) }));
    return json({ ok: true, subId: sub.id, changed: true, charged, sub: pubSub(await getSub(sub.id)) });
  }
  sub.status = "registered";
  await saveSub(sub);
  const s = await getSettings();
  if (s.chargeAt === "signup") await activate(sub, kstToday(), "signup");
  await afterRegistered(await getSub(sub.id));
  return json({ ok: true, subId: sub.id, sub: pubSub(await getSub(sub.id)) });
}

async function afterRegistered(sub) {
  if (sub.quoteId) {                                // 견적에 결제 등록 표시 (한 견적 = 한 구독)
    const q = await db.get("quotes/" + sub.quoteId);
    if (q) { q.status = "used"; q.subId = sub.id; q.usedAt = nowIso(); await db.set("quotes/" + q.id, q);
      if (q.inquiryId) { const iq = await db.get("inquiries/" + q.inquiryId); if (iq) { iq.status = "converted"; iq.subId = sub.id; await db.set("inquiries/" + iq.id, iq); } } }
  }
  if (sub.contractRef) {                            // 계약 기록에 결제 등록 표시
    const c = await alarmGet("contracts/" + sub.contractRef);
    if (c) { c.billingSubId = sub.id; c.billingMethod = sub.method; c.billingAt = nowIso(); await ALARM.setJSON("contracts/" + c.ref, c).catch(() => {}); }
  }
  later(welcomeMail(sub));
  later(staffAlert(sub, sub.method === "card" ? "알리미 구독 결제 등록" : "알리미 구독 신청(세금계산서)", {
    "구독번호": sub.id, "경로": sub.source === "contract" ? `계약 ${sub.contractRef}` : sub.source === "quote" ? `담당자 견적 ${sub.quoteId} → 고객 바로 결제` : sub.via === "apply" ? "신청 폼 → 바로 결제" : "홈페이지 직접 신청", "회원": sub.member ? "회원" : "비회원",
    "구성": `${sub.plan.label} · ${sub.plan.qty}개소`, "월 결제액": `${won(sub.plan.total)} (공급가 ${won(sub.plan.supply)} + 부가세 ${won(sub.plan.vat)})`,
    ...(sub.plan.installFee ? { "설치비": won(sub.plan.installFee) + " (VAT 별도 · 첫 결제)" } : {}),
    "결제 수단": sub.method === "card" ? `카드 자동결제 ${sub.card ? sub.card.company + " •••• " + sub.card.last4 : ""}` : "세금계산서 · 계좌이체",
    "설치 현장": `${sub.customer.site} (${sub.customer.siteAddr})`, "첫 결제": sub.status === "active" ? "완료" : "관리 화면에서 「서비스 개시」 누르는 날",
    "관리 화면": SITE() + "/billing-admin",
  }));
}

async function cardChange(req, b) {
  const sub = await getSub(b.subId);
  const sess = await session(req);
  if (!sub || !canAccess(sess, sub)) return json({ ok: false, error: "login_required" }, 401);
  if (sub.method !== "card" || sub.status === "canceled") return json({ ok: false, error: "not_card" }, 409);
  if (!tossReady()) return json({ ok: false, error: "pg_not_ready" }, 503);
  return json({ ok: true, customerKey: sub.customerKey, customerEmail: sub.customer.email, customerName: sub.customer.company,
    successUrl: `${origin(req)}/account?sub=${sub.id}&card=ok`, failUrl: `${origin(req)}/account?sub=${sub.id}&card=fail` });
}

async function customerPays(req, id) {
  const sub = await getSub(id);
  const sess = await session(req);
  if (!sub || !canAccess(sess, sub)) return json({ ok: false, error: "login_required" }, 401);
  const pays = (await Promise.all((sub.payments || []).slice(0, 36).map((o) => db.get("pays/" + o)))).filter(Boolean)
    .map(({ customer, error, ...p }) => ({ ...p, error: error ? { message: error.message || error.code } : undefined }));
  return json({ ok: true, pays });
}

/** 고객 해지 — 직접 신청 구독은 다음 결제일부터 중단, 계약 구독은 담당자 확인(의무 이용기간·위약금 조항) */
async function customerCancel(req, b) {
  const sub = await getSub(b.subId);
  const sess = await session(req);
  if (!sub || !canAccess(sess, sub)) return json({ ok: false, error: "login_required" }, 401);
  if (sub.status === "canceled") return json({ ok: true, sub: pubSub(sub) });
  const reason = str(b.reason, 300);
  if (b.undo) {
    if (sub.consult && !sub.consult.done && !sub.cancel) { delete sub.consult; await saveSub(sub); return json({ ok: true, sub: pubSub(sub) }); }
    if (!sub.cancel || sub.cancel.by !== "customer") return json({ ok: false, error: "nothing_to_undo" }, 409);
    delete sub.cancel;
    if (sub.status !== "registered" && !sub.nextChargeAt && sub.paidThrough) { sub.nextChargeAt = addDays(sub.paidThrough, 1); await setDue(sub, sub.nextChargeAt); }
    await saveSub(sub);
    later(staffAlert(sub, "알리미 해지 철회", { "구독번호": sub.id }));
    return json({ ok: true, sub: pubSub(sub) });
  }
  const mailTerm = (title, lead, rows) => later(sendMail({ to: sub.customer.email, name: sub.customer.manager, subject: `[모넷코리아] 긴급 경보 알리미 ${title} (${sub.id})`,
    text: `${lead}\n${rows.map(([k, v]) => `· ${k}: ${v}`).join("\n")}\n\n문의 02-2088-1454 · 1015@monnit.com`, html: mailHtml({ title, lead, rows, button: { label: "구독 관리", href: manageUrl(sub) } }) }));
  if (sub.status === "registered" && !sub.cycle) {               // 서비스 시작(설치 완료) 전 — 바로 해지, 청구 없음
    sub.status = "canceled"; sub.canceledAt = nowIso(); sub.cancel = { requestedAt: nowIso(), by: "customer", reason, effective: kstToday() };
    await setDue(sub, ""); await saveSub(sub);
  } else if (inTerm(sub)) {
    /* 의무 사용기간 중 — 직접 해지 불가. ① 만기 해지 예약 ② 중도 해지 상담(담당자) 만 가능 */
    const t = sub.term;
    if (b.mode === "term_end") {
      const eff = addDays(t.to, 1);
      sub.cancel = { requestedAt: nowIso(), by: "customer", reason, effective: eff, atTermEnd: true };
      if (!sub.nextChargeAt || sub.nextChargeAt >= eff) { sub.nextChargeAt = ""; await setDue(sub, eff); }   // 만기 전 회차는 그대로 결제
      await saveSub(sub);
      later(staffAlert(sub, "알리미 만기 해지 예약", { "구독번호": sub.id, "의무 사용기간": `${t.from} ~ ${t.to}`, "결제 중단": eff, "사유": reason || "—", "할 일": "만기일 맞춰 센서 회수 일정 안내" }));
      mailTerm("만기 해지 예약 완료", `의무 사용기간이 끝나는 ${t.to}까지 이용하시고, 이후에는 결제되지 않습니다.`, [["의무 사용기간", `${t.from} ~ ${t.to}`], ["결제 중단", eff]]);
      return json({ ok: true, atTermEnd: true, sub: pubSub(sub) });
    }
    if (b.mode === "consult") {
      sub.consult = { at: nowIso(), reason, done: false };
      await saveSub(sub);
      later(staffAlert(sub, "알리미 중도 해지 상담 요청", { "구독번호": sub.id, "의무 사용기간": `${t.from} ~ ${t.to} (남은 ${monthsLeft(sub)}개월)`, "사유": reason || "—", "처리": "고객 통화 후 관리 화면에서 중도 해지(위약금) 또는 유지 처리" }));
      return json({ ok: true, consult: true, sub: pubSub(sub) });
    }
    return json({ ok: false, error: "in_term", term: t, monthsLeft: monthsLeft(sub) }, 409);
  } else {                                                       // 의무 사용기간이 끝났거나 없음 — 다음 결제일부터 중단
    const eff = sub.nextChargeAt || kstToday();
    sub.cancel = { requestedAt: nowIso(), by: "customer", reason, effective: eff };
    sub.nextChargeAt = ""; await setDue(sub, eff); await saveSub(sub);   // 해지일에 예약 작업이 마무리
    await closeIfDue(sub);
  }
  later(staffAlert(sub, "알리미 구독 해지", { "구독번호": sub.id, "적용": sub.status === "canceled" ? "즉시 해지(결제 전)" : `${sub.cancel.effective}부터 결제 중단 · ${sub.paidThrough || ""}까지 이용`, "사유": reason || "—", "할 일": "센서 회수 일정 안내" }));
  later(sendMail({ to: sub.customer.email, name: sub.customer.manager, subject: `[모넷코리아] 긴급 경보 알리미 해지 접수 (${sub.id})`,
    text: `구독 해지가 접수되었습니다.\n· 구독번호: ${sub.id}\n· ${sub.status === "canceled" ? "결제 전 해지 — 청구 금액 없음" : `${sub.paidThrough}까지 이용 · 이후 결제 없음`}\n\n장비 회수 일정은 담당자가 안내드립니다. 문의 02-2088-1454`,
    html: mailHtml({ title: "해지가 접수되었습니다.", lead: sub.status === "canceled" ? "결제 전 해지로 청구되는 금액이 없습니다." : `${sub.paidThrough}까지 이용하실 수 있으며, 이후에는 결제되지 않습니다.`, rows: [["구독번호", sub.id]], foot: "장비 회수 일정은 담당자가 안내드립니다." }) }));
  return json({ ok: true, sub: pubSub(sub) });
}

/* ───────── 현금 결제 상담 (2026-11-03) ─────────
   현금(계좌이체·세금계산서)으로 내려는 고객은 온라인으로 바로 가입시키지 않고 담당자가 연락한다.
   저장: inquiries/<id> · 리드 원장(/api/lead)으로도 넘겨 알림 메일(1015@·5959@·대표님)·먼데이 리드 보드에 함께 남긴다.
   담당자는 통화 후 계약 링크(/contract-admin) 또는 관리 화면 「구독으로 등록」으로 이어 간다. */
async function cashInquiry(req, b) {
  const c = cleanCustomer(b.customer || {});
  for (const k of ["company", "manager", "phone"]) if (!c[k]) return json({ ok: false, error: "missing_" + k }, 400);
  if (!/^0\d{8,10}$/.test(c.phone.replace(/\D/g, ""))) return json({ ok: false, error: "bad_phone" }, 400);
  if (c.email && !isEmail(c.email)) return json({ ok: false, error: "bad_email" }, 400);
  if (!b.agree || !b.agree.privacy) return json({ ok: false, error: "missing_agree" }, 400);
  let plan = null, offerId = "", contractRef = "", quoteId = "";
  if (b.quote) {
    const x = await loadQuote(b.quote);
    if (!x.error) { plan = quotePlan(x.q); quoteId = x.q.id; }
  } else if (b.offer) {
    const x = await loadOffer(b.offer);
    if (!x.error) { plan = contractPlan(x.contract); offerId = x.offer.id; contractRef = x.contract.ref; }
  } else {
    const lp = landingPlan({ lines: b.lines, region: c.siteAddr ? regionOf(c.siteAddr) : (b.region === "other" ? "other" : "metro") });   // 주소가 없으면 화면에서 고른 지역
    if (!lp.error) plan = lp;
  }
  const id = "CQ-" + kstToday().replace(/-/g, "").slice(2) + "-" + token(4).toUpperCase();
  const inq = { id, createdAt: nowIso(), status: "new", customer: c, plan, offerId, contractRef, quoteId,
    payType: b.payType === "transfer" ? "transfer" : "invoice", when: str(b.when, 40), memo: str(b.memo, 1000), client: { ip: ip(req), ua: str(req.headers.get("user-agent"), 300) } };
  await db.set("inquiries/" + id, inq);
  const planText = plan ? `${plan.label} · ${plan.qty}개소 · 월 ${won(plan.supply)} (부가세 별도)${plan.installFee ? " · 설치비 " + won(plan.installFee) : ""}` : "구성 미정";
  /* 리드 원장으로 — 응답을 늦추지 않게 뒤에서 */
  const payload = {
    "회사명": c.company, "담당자명": c.manager, "전화번호": c.phone, "이메일": c.email || "(미기재)",
    "문의항목": "알리미 구독 — 현금 결제 상담", "지역": c.siteAddr,
    "문의 사항": [`[${id}] 현금 결제 상담 (${inq.payType === "invoice" ? "세금계산서 발행 · 계좌이체" : "계좌이체"})`, planText,
      contractRef ? `계약번호 ${contractRef}` : "", c.site ? `설치 현장: ${c.site} (${c.siteAddr})` : "", inq.when ? `연락 희망: ${inq.when}` : "", inq.memo].filter(Boolean).join(" / "),
    "접점": "/pay 현금 결제 상담", "유입 페이지": "/pay", "출처": "direct",
  };
  later(leadFn(new Request(SITE() + "/api/lead", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip(req), "user-agent": str(req.headers.get("user-agent"), 300), origin: SITE() },
    body: JSON.stringify({ lead_type: "contact", page: "/pay", ts: inq.createdAt, payload }) })).catch((e) => console.error("[billing] lead", e)));
  if (c.email) later(sendMail({ to: c.email, name: c.manager, subject: `[모넷코리아] 긴급 경보 알리미 현금 결제 상담 접수 (${id})`,
    text: `${c.manager}님, 현금 결제 상담 요청이 접수되었습니다.\n· 접수번호: ${id}\n· 구성: ${planText}\n\n담당자가 영업일 기준 1일 안에 ${c.phone}로 연락드려 계약과 입금 방법을 안내드립니다.\n급하시면 02-2088-1454 · 1015@monnit.com 으로 연락 주십시오.`,
    html: mailHtml({ title: "상담 요청이 접수되었습니다.", lead: `담당자가 영업일 기준 1일 안에 ${c.phone}로 연락드려 계약과 입금 방법을 안내드립니다.`, rows: [["접수번호", id], ["구성", planText], ["결제 방식", inq.payType === "invoice" ? "세금계산서 발행 · 계좌이체" : "계좌이체"], ...(inq.when ? [["연락 희망", inq.when]] : [])], foot: "급하시면 02-2088-1454 · 1015@monnit.com 으로 연락 주십시오." }) }));
  return json({ ok: true, id });
}

/* ───────── 서비스 개시 (첫 결제) ───────── */
async function activate(sub, start, by) {
  const d = isDate(start) ? start : kstToday();
  sub.startedAt = d;
  sub.term = makeTerm(sub, d);                       // 의무 사용기간은 서비스 시작일부터
  sub.anchorDay = Number(d.slice(8, 10));
  sub.nextChargeAt = d;
  if (sub.status === "registered") sub.status = "active";
  await saveSub(sub);
  if (d <= kstToday()) return runCycle(sub, { by, date: d });
  await setDue(sub, d); await saveSub(sub);
  return { ok: true, scheduled: d };
}

/* ───────── 관리자 ───────── */
async function admin(req, url, r, m) {
  const q = (k) => url.searchParams.get(k);
  if (r === "ping") return json({ ok: true, ready: tossReady(), test: tossTestMode(), keyProblem: tossKeyProblem() });
  if (m === "GET" && r === "list") {
    const keys = await db.list("subs/");
    const subs = (await Promise.all(keys.slice(0, 1000).map((k) => db.get(k.key)))).filter(Boolean)
      .map(({ billingKeyEnc, customerKey, client, ...s }) => s);
    subs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json({ ok: true, subs, labels: STATUS_LABEL, ready: tossReady(), test: tossTestMode(), keyProblem: tossKeyProblem() });
  }
  if (m === "GET" && r === "quotes") {
    const keys = await db.list("quotes/");
    const items = (await Promise.all(keys.slice(0, 1000).map((k) => db.get(k.key)))).filter(Boolean).map((q) => ({ ...q, plan: quotePlan(q), expired: q.status === "open" && q.expiresAt && q.expiresAt < kstToday() }));
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json({ ok: true, items, site: SITE() });
  }
  if (m === "GET" && r === "inquiries") {
    const keys = await db.list("inquiries/");
    const items = (await Promise.all(keys.slice(0, 1000).map((k) => db.get(k.key)))).filter(Boolean).map(({ client, ...x }) => x);
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json({ ok: true, items });
  }
  if (m === "GET" && r === "sub") {
    const s = await getSub(q("id"));
    if (!s) return json({ ok: false, error: "not_found" }, 404);
    const pays = (await Promise.all((s.payments || []).map((o) => db.get("pays/" + o)))).filter(Boolean);
    const { billingKeyEnc, customerKey, ...rest } = s;
    const left = monthsLeft(s);
    return json({ ok: true, sub: { ...rest, hasBillingKey: !!billingKeyEnc, monthsLeft: left, remainingFees: left * (s.plan.supply || 0) }, pays });
  }
  if (m === "GET" && r === "pays") {
    const month = /^\d{4}-\d{2}$/.test(q("month") || "") ? q("month") : "";
    const keys = await db.list("pays/");
    let pays = (await Promise.all(keys.slice(0, 3000).map((k) => db.get(k.key)))).filter(Boolean);
    if (month) pays = pays.filter((p) => String(p.issueDate || p.approvedAt || p.createdAt || "").slice(0, 7) === month || (p.period && p.period.from.slice(0, 7) === month));
    pays.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json({ ok: true, pays, settings: await getSettings() });
  }
  if (r === "settings") {
    if (m === "GET") return json({ ok: true, settings: await getSettings(), defaults: DEFAULT_SETTINGS });
    const b = await body(req), cur = await getSettings();
    const sp = b.supplier || {};
    const next = {
      supplier: Object.fromEntries(Object.keys(DEFAULT_SETTINGS.supplier).map((k) => [k, str(sp[k] != null ? sp[k] : cur.supplier[k], 200)])),
      invoiceItem: str(b.invoiceItem != null ? b.invoiceItem : cur.invoiceItem, 100) || DEFAULT_SETTINGS.invoiceItem,
      bank: str(b.bank != null ? b.bank : cur.bank, 200),
      chargeAt: b.chargeAt === "signup" ? "signup" : b.chargeAt === "activation" ? "activation" : cur.chargeAt,
      termMonths: b.termMonths != null ? Math.max(0, Math.min(60, Math.round(Number(b.termMonths) || 0))) : cur.termMonths,
    };
    await db.set("settings", next);
    return json({ ok: true, settings: next });
  }
  if (m !== "POST") return json({ ok: false, error: "not_found" }, 404);
  const b = await body(req);

  if (r === "quote") {
    if (b.action === "void") { const q = await db.get("quotes/" + str(b.id, 40)); if (!q) return json({ ok: false, error: "not_found" }, 404); if (q.status === "used") return json({ ok: false, error: "already_used" }, 409); q.status = "void"; q.voidedAt = nowIso(); await db.set("quotes/" + q.id, q); return json({ ok: true, quote: q }); }
    if (b.action === "send") {
      const q = await db.get("quotes/" + str(b.id, 40)); if (!q) return json({ ok: false, error: "not_found" }, 404);
      const to = normEmail(b.email || (q.customer && q.customer.email));
      if (!isEmail(to)) return json({ ok: false, error: "bad_email" }, 400);
      const p = quotePlan(q), link = `${SITE()}/pay?q=${q.id}`, c = q.customer || {};
      const rows = [["견적번호", q.id], ["구성", `${p.label} · ${p.qty}개소`], ["매월 결제 금액", `${won(p.total)} (공급가 ${won(p.supply)} + 부가세)`], ...(p.discount ? [["할인", `월 ${won(p.discount)} 적용`]] : []),
        ["설치비", p.installFee ? `${won(p.installFee)} (부가세 별도 · 첫 결제)` : "무료"], ["의무 사용기간", p.termMonths ? `설치 완료일부터 ${p.termMonths}개월` : "없음"], ["견적 유효기간", `${q.expiresAt}까지`]];
      const okm = await sendMail({ to, name: c.manager, subject: `[모넷코리아] 긴급 경보 알리미 견적 및 구독 신청 링크 (${q.id})`, tag: "alarm-quote",
        text: [`${c.manager || c.company || "고객"}님, 요청하신 긴급 경보 알리미 견적입니다.`, "", ...rows.map(([k, v]) => `· ${k}: ${v}`), q.note ? `\n${q.note}` : "", "", "▶ 아래 링크에서 내용 확인 후 바로 구독 신청(카드 자동결제)까지 하실 수 있습니다.", link, "", "문의 02-2088-1454 · 1015@monnit.com"].join("\n"),
        html: mailHtml({ title: "견적이 준비되었습니다.", lead: (q.note ? q.note + " " : "") + "아래 버튼에서 내용을 확인하고 바로 구독 신청까지 하실 수 있습니다.", rows, button: { label: "견적 확인하고 구독 신청", href: link }, foot: "카드 자동결제 또는 현금 결제(담당자 안내) 중 선택하실 수 있습니다." }) });
      if (okm) { q.sentAt = nowIso(); q.sentTo = to; await db.set("quotes/" + q.id, q); }
      return json({ ok: okm, error: okm ? undefined : "mail_failed" });
    }
    /* 견적 만들기 */
    const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 10).map((l) => ({ product: PRODUCTS[l.product] ? l.product : "custom", label: str(l.label, 60), qty: Math.max(1, Math.min(999, Math.round(Number(l.qty) || 1))) }));
    if (!lines.length) return json({ ok: false, error: "products_required" }, 400);
    const unit = Math.round(Number(b.unit) || 0);
    if (unit <= 0) return json({ ok: false, error: "bad_unit" }, 400);
    const days = Math.max(1, Math.min(90, Math.round(Number(b.expiresDays) || 14)));
    const settings = await getSettings();
    const q = {
      id: "Q-" + kstToday().replace(/-/g, "").slice(2) + "-" + token(4).toUpperCase(), createdAt: nowIso(), status: "open",
      expiresAt: addDays(kstToday(), days), lines, unit, region: ["metro", "other", "fixed"].includes(b.region) ? b.region : "fixed",
      discountType: ["percent", "amount"].includes(b.discountType) ? b.discountType : "none", discountValue: Math.max(0, Number(b.discountValue) || 0),
      installFee: Math.max(0, Math.round(Number(b.installFee) || 0)), termMonths: b.termMonths != null && b.termMonths !== "" ? Math.max(0, Math.min(120, Math.round(Number(b.termMonths) || 0))) : settings.termMonths,
      note: str(b.note, 500), staffMemo: str(b.staffMemo, 1000), inquiryId: str(b.inquiryId, 40),
      customer: cleanCustomer(b.customer || {}),
    };
    await db.set("quotes/" + q.id, q);
    if (q.inquiryId) { const iq = await db.get("inquiries/" + q.inquiryId); if (iq) { iq.status = iq.status === "new" ? "contacted" : iq.status; iq.quoteId = q.id; await db.set("inquiries/" + iq.id, iq); } }
    return json({ ok: true, quote: { ...q, plan: quotePlan(q) }, url: `${SITE()}/pay?q=${q.id}` });
  }
  if (r === "inquiry") {
    const k = "inquiries/" + str(b.id, 40), q = await db.get(k);
    if (!q) return json({ ok: false, error: "not_found" }, 404);
    if (b.action === "status") { q.status = ["new", "contacted", "closed"].includes(b.status) ? b.status : q.status; q.staffMemo = b.staffMemo != null ? str(b.staffMemo, 1000) : q.staffMemo; q.updatedAt = nowIso(); await db.set(k, q); return json({ ok: true, inquiry: q }); }
    if (b.action === "delete") { await db.del(k); return json({ ok: true }); }
    if (b.action === "convert") {
      /* 통화로 확정한 현금 고객을 세금계산서 구독으로 등록 → 「구독」 탭에서 서비스 개시 */
      const cust = cleanCustomer({ ...q.customer, ...(b.customer || {}) });
      if (cust.bizNo.replace(/\D/g, "").length !== 10) return json({ ok: false, error: "missing_bizNo" }, 400);
      if (!cust.email || !isEmail(cust.email)) return json({ ok: false, error: "bad_email" }, 400);
      let plan = q.plan;
      if (q.contractRef) { const c = await alarmGet("contracts/" + q.contractRef); if (c) plan = contractPlan(c); }
      if (!plan) return json({ ok: false, error: "no_plan" }, 400);
      if (plan.source !== "contract") plan = { ...plan, termMonths: plan.termMonths || (await getSettings()).termMonths };
      const sid = subId();
      const sub = { id: sid, createdAt: nowIso(), status: "registered", method: "invoice", source: plan.source, offerId: q.offerId || "", contractRef: q.contractRef || "",
        member: false, memberEmail: "", customer: cust, plan, customerKey: "ck_" + token(24), cycle: 0, failCount: 0, payments: [], fromInquiry: q.id,
        agree: { byStaff: true, at: nowIso(), termMonths: plan.termMonths || 0, text: str(b.agreeNote, 300) || "현금 결제 상담 후 담당자 등록 — 약정·이용약관 동의는 서면 계약서로 받음" } };
      await saveSub(sub); await indexEmail(cust.email, sid);
      q.status = "converted"; q.subId = sid; q.updatedAt = nowIso(); await db.set(k, q);
      if (q.contractRef) { const c = await alarmGet("contracts/" + q.contractRef); if (c) { c.billingSubId = sid; c.billingMethod = "invoice"; await ALARM.setJSON("contracts/" + c.ref, c).catch(() => {}); } }
      if (b.welcome !== false) later(welcomeMail(sub));
      return json({ ok: true, subId: sid, inquiry: q });
    }
    return json({ ok: false, error: "bad_action" }, 400);
  }
  if (r === "cron") return json(await runDue({ force: true, limit: Math.min(50, Number(b.limit) || 25) }));
  if (r === "invoice") {
    const st = ["invoice_pending", "issued", "paid", "void"].includes(b.status) ? b.status : null;
    if (!st) return json({ ok: false, error: "bad_status" }, 400);
    const done = [];
    for (const o of (Array.isArray(b.orderIds) ? b.orderIds : []).slice(0, 500)) {
      const p = await db.get("pays/" + str(o, 80));
      if (!p || (p.method !== "invoice" && p.status !== "transfer_pending" && !(p.kind === "penalty" && st === "paid"))) continue;
      if (p.paymentKey) continue;                           // 카드 승인 건은 「취소」로만
      p.status = st;
      if (st === "issued") { p.invoiceIssuedAt = p.invoiceIssuedAt || nowIso(); if (b.exported) p.narabillExportedAt = nowIso(); }
      if (st === "paid") { p.paidAt = nowIso(); p.invoiceIssuedAt = p.invoiceIssuedAt || nowIso(); }
      if (st === "invoice_pending") { delete p.invoiceIssuedAt; delete p.paidAt; }
      if (st === "void") { p.voidedAt = nowIso(); p.voidReason = str(b.reason, 200); }
      await db.set("pays/" + p.orderId, p); done.push(p.orderId);
      const s = await getSub(p.subId);
      if (s && s.lastPay && s.lastPay.orderId === p.orderId) { s.lastPay.status = st; await saveSub(s); }
    }
    return json({ ok: true, done });
  }
  if (r === "refund") {
    const p = await db.get("pays/" + str(b.orderId, 80));
    if (!p || p.status !== "paid" && p.status !== "partial_canceled" || !p.paymentKey) return json({ ok: false, error: "not_refundable" }, 409);
    const amount = b.amount ? Math.round(Number(b.amount)) : 0;
    if (amount > p.amount - (p.canceledAmount || 0)) return json({ ok: false, error: "over_amount" }, 400);
    const x = await cancelPayment(p.paymentKey, b.reason || "관리자 취소", amount || undefined);
    if (!x.ok) return json({ ok: false, error: "cancel_failed", code: x.code, message: x.message }, 400);
    const left = p.amount - (p.canceledAmount || 0);
    const this_ = amount || left;
    const canceled = (p.canceledAmount || 0) + this_;
    p.canceledAmount = canceled; p.status = canceled >= p.amount ? "canceled" : "partial_canceled";
    p.cancels = [...(p.cancels || []), { at: nowIso(), amount: this_, reason: str(b.reason, 200) }];
    await db.set("pays/" + p.orderId, p);
    const s = await getSub(p.subId);
    if (s && b.notify !== false) later(refundMail(s, p, this_, str(b.reason, 200)));
    return json({ ok: true, pay: p });
  }
  const sub = await getSub(b.id);
  if (!sub && r !== "delete") return json({ ok: false, error: "not_found" }, 404);
  if (r === "activate") {
    if (!["registered", "active"].includes(sub.status) || sub.cycle) return json({ ok: false, error: "not_activatable" }, 409);
    if (sub.method === "card" && !sub.billingKeyEnc) return json({ ok: false, error: "no_card" }, 409);
    const x = await activate(sub, b.start, "staff");
    return json({ ok: x.ok !== false, result: x.pay ? { status: x.pay.status, amount: x.pay.amount, error: x.pay.error } : x, sub: await getSub(sub.id) });
  }
  if (r === "charge") {
    if (sub.status === "canceled" || sub.status === "registered" || sub.status === "pending") return json({ ok: false, error: "not_chargeable" }, 409);
    const x = await runCycle(sub, { by: "staff", date: sub.nextChargeAt || kstToday() });
    return json({ ok: x.ok, result: { status: x.pay.status, amount: x.pay.amount, error: x.pay.error } });
  }
  if (r === "cancel") {
    if (b.mode === "undo") { delete sub.cancel; if (sub.consult && !sub.consult.done) delete sub.consult; if (sub.status !== "canceled" && !sub.nextChargeAt && sub.paidThrough) { sub.nextChargeAt = addDays(sub.paidThrough, 1); await setDue(sub, sub.nextChargeAt); } await saveSub(sub); return json({ ok: true, sub }); }
    if (b.mode === "term_end") {
      if (!sub.term) return json({ ok: false, error: "no_term" }, 409);
      const eff = addDays(sub.term.to, 1);
      sub.cancel = { ...(sub.cancel || {}), effective: eff, atTermEnd: true, by: (sub.cancel && sub.cancel.by) || "staff", confirmedAt: nowIso(), pendingStaff: false };
      if (!sub.nextChargeAt || sub.nextChargeAt >= eff) { sub.nextChargeAt = ""; await setDue(sub, eff); }
      if (sub.consult) sub.consult.done = true;
      await saveSub(sub); return json({ ok: true, sub });
    }
    if (b.mode === "now") {
      /* 중도 해지 — 위약금(선택)을 먼저 청구한 뒤 해지 */
      let penalty = null;
      if (Number(b.penalty) > 0) {
        const x = await oneTimeCharge(sub, { amount: b.penalty, name: `긴급 경보 알리미 중도 해지 위약금 (의무 사용기간 ${sub.term ? sub.term.to : ""}까지)` });
        penalty = x.pay ? { status: x.pay.status, amount: x.pay.amount, error: x.pay.error } : { error: x.error };
        if (!x.ok && b.requirePenalty !== false) return json({ ok: false, error: "penalty_failed", penalty }, 400);
      }
      sub.penalty = penalty;
      if (sub.consult) sub.consult.done = true;
      sub.status = "canceled"; sub.canceledAt = nowIso(); sub.nextChargeAt = "";
      sub.cancel = { ...(sub.cancel || {}), effective: kstToday(), by: (sub.cancel && sub.cancel.by) || "staff", confirmedAt: nowIso(), pendingStaff: false };
      sub.cancel.early = inTerm(sub); sub.cancel.reason = sub.cancel.reason || str(b.reason, 300);
      await setDue(sub, ""); await saveSub(sub);
      return json({ ok: true, sub, penalty });
    }
    if (b.mode === "keep") { if (sub.consult) { sub.consult.done = true; sub.consult.result = "keep"; } await saveSub(sub); return json({ ok: true, sub }); }
    const eff = isDate(b.effective) ? b.effective : (sub.nextChargeAt || kstToday());
    sub.cancel = { ...(sub.cancel || {}), effective: eff, by: (sub.cancel && sub.cancel.by) || "staff", confirmedAt: nowIso(), pendingStaff: false };
    if (!sub.nextChargeAt || sub.nextChargeAt >= eff) { sub.nextChargeAt = ""; await setDue(sub, eff); }
    await saveSub(sub); await closeIfDue(sub);
    return json({ ok: true, sub: await getSub(sub.id) });
  }
  if (r === "update") {
    if (b.nextChargeAt !== undefined) {
      if (b.nextChargeAt && !isDate(b.nextChargeAt)) return json({ ok: false, error: "bad_date" }, 400);
      sub.nextChargeAt = b.nextChargeAt || "";
      if (b.nextChargeAt) sub.anchorDay = Number(b.nextChargeAt.slice(8, 10));
      sub.retryAt = ""; await setDue(sub, sub.nextChargeAt);
    }
    if (b.staffMemo !== undefined) sub.staffMemo = str(b.staffMemo, 2000);
    if (b.customer) sub.customer = { ...sub.customer, ...cleanCustomer({ ...sub.customer, ...b.customer }) };
    await saveSub(sub);
    return json({ ok: true, sub });
  }
  if (r === "delete") {
    let n = 0;
    for (const id of (Array.isArray(b.ids) ? b.ids : []).slice(0, 200)) {
      const s = await getSub(id);
      if (!s) continue;
      for (const o of s.payments || []) await db.del("pays/" + o);
      if (s.dueKey) await db.del(s.dueKey);
      const ek = "byemail/" + hashOf(s.customer.email), e = await db.get(ek);
      if (e) { e.subs = e.subs.filter((x) => x !== s.id); await db.set(ek, e); }
      if (s.billingKeyEnc) later((async () => { const k = await unseal(s.billingKeyEnc); if (k) await deleteBillingKey(k); })());
      await db.del("subs/" + s.id); n++;
    }
    return json({ ok: true, removed: n });
  }
  return json({ ok: false, error: "not_found" }, 404);
}

/* ───────── 유틸 ───────── */
function isAdmin(req) {
  const want = String(process.env.ALARM_ADMIN_KEY || process.env.OPS_PASS || "");
  const got = req.headers.get("x-admin-key") || "";
  if (want.length < 8 || got.length !== want.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch (e) { return false; }
}
function sameOrigin(req) {
  const o = req.headers.get("origin");
  if (!o) return true;                               // 같은 출처 fetch 는 Origin 이 없을 수도 있다(일부 브라우저 GET·구형)
  try {
    const h = new URL(o).host, self = new URL(req.url).host;
    const hosts = String(process.env.SELF_HOSTS || "").split(/[,\s]+/).filter(Boolean);
    return h === self || hosts.includes(h);
  } catch (e) { return false; }
}
function origin(req) {
  const u = new URL(req.url);
  const hosts = String(process.env.SELF_HOSTS || "").split(/[,\s]+/).filter(Boolean);
  return hosts.includes(u.host) || /^localhost|^127\./.test(u.host) ? u.origin : SITE();
}
const ip = (req) => req.headers.get("cf-connecting-ip") || req.headers.get("x-mnk-client-ip") || "";
async function body(req) {
  const t = await req.text();
  if (t.length > 200000) throw Object.assign(new Error("too_large"), { status: 413 });
  try { return JSON.parse(t || "{}"); } catch { throw Object.assign(new Error("bad_json"), { status: 400 }); }
}
function json(o, status = 200, extra = {}) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });
}
