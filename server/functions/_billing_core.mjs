/** 긴급 경보 알리미 — 구독 결제 공통 모듈 (billing.mjs · billing-cron.mjs 가 함께 씀)
 *
 *  저장소 "billing" (R2)
 *    subs/<id>            구독 (고객·구성·결제 수단·다음 결제일·상태)
 *    pays/<orderId>       결제·청구 기록 (카드 승인 / 세금계산서 청구)
 *    due/<YYYY-MM-DD>/<id> 결제 예정 색인 — 예약 작업이 날짜순으로 읽는다(전체 구독을 훑지 않음)
 *    byemail/<hash>       이메일 → 구독 id 목록 (회원·비회원 조회)
 *    members/<hash>       회원 (이메일 인증 가입 · 저장된 고객 정보)
 *    otp/<hash>           이메일 인증코드 (해시만 저장) · sess/<token> 로그인 세션
 *    settings             공급자(모넷코리아) 세금계산서 정보 — 관리 화면에서 수정
 *
 *  금액 규칙 (/promo/alarm 빌더 · 계약과 같음)
 *    서울·경기·인천 1곳 월 30,000원 · 그 외 지역 1곳 월 40,000원 · 설치비 무료 (부가세 별도)
 *    계약 링크로 들어오면 계약서에 확정된 금액(할인·설치비 포함)을 그대로 쓴다 — 화면 값은 믿지 않는다.
 *    카드 결제액 = 공급가액 + 부가세(10%, 원 미만 절사)
 */
import { getStore } from "../lib/blobs.mjs";
import { randomBytes, createHash, webcrypto } from "node:crypto";
import { notify } from "./_notify.mjs";
import { note } from "./_staffnote.mjs";
import { chargeBilling, cardLabel } from "./_toss.mjs";

export const SITE = () => String(process.env.URL || "https://monnit.co.kr").replace(/\/$/, "");
const ST = getStore("billing");
export const db = {
  get: (k) => ST.get(k, { type: "json" }).catch(() => null),
  set: (k, v) => ST.setJSON(k, v),
  del: (k) => ST.delete(k).catch(() => {}),
  list: (prefix) => ST.list({ prefix }).then((r) => r.blobs).catch(() => []),
};

/* ───────── 제품 · 금액 ───────── */
export const PRODUCTS = {
  fire:  { label: "화재경보 연동 알리미", short: "화재", note: "기존 소방수신기 화재경보 접점 신호 원격 알림" },
  water: { label: "물감지 알리미",       short: "물감지", note: "누수·침수 감지 센서 신호 원격 알림" },
  power: { label: "정전 알리미",         short: "정전", note: "감시 회로 전원 차단(정전) 원격 알림" },
  alarm: { label: "경보 알리미",         short: "경보", note: "기존 설비 경보 접점 신호 원격 알림" },
};
export const UNIT = { metro: 30000, other: 40000 };
export const MAX_SELF_SITES = 9;          // 10곳 이상은 별도 견적 (랜딩과 같음)
export const vatOf = (supply) => Math.floor(Math.max(0, supply) * 0.1);
export const won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";

/** 랜딩(직접 구독) 구성 → 금액. lines: [{product, qty}] */
export function landingPlan(b) {
  const region = b && b.region === "other" ? "other" : "metro";
  const seen = {};
  for (const l of Array.isArray(b && b.lines) ? b.lines : []) {
    const p = String(l && l.product || "");
    const q = Math.round(Number(l && l.qty) || 0);
    if (PRODUCTS[p] && q > 0) seen[p] = Math.min(MAX_SELF_SITES, (seen[p] || 0) + q);
  }
  const lines = Object.keys(PRODUCTS).filter((k) => seen[k]).map((k) => ({ product: k, label: PRODUCTS[k].label, qty: seen[k] }));
  const qty = lines.reduce((a, l) => a + l.qty, 0);
  if (!lines.length) return { error: "products_required" };
  if (qty > MAX_SELF_SITES) return { error: "too_many_sites" };
  const unit = UNIT[region];
  const supply = unit * qty;
  return {
    source: "landing", region, unit, lines, qty, installFee: 0, discount: 0,
    label: lines.length > 1 ? "긴급 경보 알리미 (" + lines.map((l) => PRODUCTS[l.product].short).join("·") + ")" : lines[0].label,
    supply, vat: vatOf(supply), total: supply + vatOf(supply),
  };
}

/** 계약(alarm 저장소 contracts/<ref>) → 금액. 계약서에 확정된 값만 쓴다 */
export function contractPlan(c) {
  const t = c && c.terms || {};
  const supply = Math.max(0, Math.round(Number(t.monthly) || 0));
  const prods = (t.products || []).filter((k) => PRODUCTS[k]);
  const qty = Math.max(1, Math.round(Number(t.sites) || 1));
  const installFee = Math.max(0, Math.round(Number(t.installFee) || 0));
  return {
    source: "contract", region: t.region || "", unit: Number(t.unitPrice) || 0, qty, discount: Number(t.discount) || 0,
    lines: prods.length === 1 ? [{ product: prods[0], label: PRODUCTS[prods[0]].label, qty }] : prods.map((k) => ({ product: k, label: PRODUCTS[k].label, qty: null })),
    label: t.solution || "긴급 경보 알리미", installFee, installVat: vatOf(installFee),
    supply, vat: vatOf(supply), total: supply + vatOf(supply), from: t.from || "", to: t.to || "", termMonths: t.termMonths || 0,
  };
}

/** 담당자 견적(quotes/<id>) → 금액. 커스텀 알리미 등 자유 항목명 허용 */
export function quotePlan(q) {
  const lines = (q.lines || []).map((l) => ({ product: PRODUCTS[l.product] ? l.product : "custom", label: String(l.label || (PRODUCTS[l.product] && PRODUCTS[l.product].label) || "커스텀 알리미").slice(0, 60), qty: Math.max(1, Math.round(Number(l.qty) || 1)) }));
  const qty = lines.reduce((a, l) => a + l.qty, 0) || 1;
  const unit = Math.max(0, Math.round(Number(q.unit) || 0));
  const list = unit * qty;
  let discount = 0;
  if (q.discountType === "percent") discount = Math.round(list * Math.min(100, Math.max(0, Number(q.discountValue) || 0)) / 100);
  if (q.discountType === "amount") discount = Math.min(list, Math.max(0, Math.round(Number(q.discountValue) || 0)));
  const supply = list - discount;
  const installFee = Math.max(0, Math.round(Number(q.installFee) || 0));
  const short = (l) => (PRODUCTS[l.product] ? PRODUCTS[l.product].short : l.label.replace(/\s*알리미$/, ""));
  return {
    source: "quote", quoteId: q.id, region: q.region || "", unit, lines, qty, discount, installFee, installVat: vatOf(installFee),
    label: lines.length > 1 ? "긴급 경보 알리미 (" + lines.map(short).join("·") + ")" : (lines[0] ? lines[0].label : "긴급 경보 알리미"),
    supply, vat: vatOf(supply), total: supply + vatOf(supply), termMonths: Math.max(0, Math.round(Number(q.termMonths) || 0)), list,
  };
}

/* ───────── 날짜 (한국 시간) ───────── */
export const kstNow = () => new Date(Date.now() + 9 * 3600e3);
export const kstToday = () => kstNow().toISOString().slice(0, 10);
export const kstHour = () => kstNow().getUTCHours();
export function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
/** 기준일(anchorDay)을 지키며 n개월 뒤. 31일 기준이면 짧은 달은 말일 */
export function addMonths(dateStr, n, anchorDay) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const a = anchorDay || d;
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(a, last));
  return base.toISOString().slice(0, 10);
}
export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

/* ───────── 의무 사용기간 ─────────
   sub.term = { months, from, to } — 서비스 개시(설치 완료)일부터 months 개월. 계약 링크 구독은 계약서의 기간을 그대로 쓴다.
   기간 중에는 고객이 직접 해지할 수 없다(만기 해지 예약 · 중도 해지 상담만). 만료 뒤에는 매월 자동 연장 · 언제든 해지. */
export function termEndOf(from, months) { return addDays(addMonths(from, months, Number(from.slice(8, 10))), -1); }
export function makeTerm(sub, start) {
  const p = sub.plan || {};
  if (p.source === "contract" && isDate(p.to)) return { months: p.termMonths || 0, from: isDate(p.from) ? p.from : start, to: p.to, by: "contract" };
  const months = Math.max(0, Math.round(Number(p.termMonths) || 0));
  return months ? { months, from: start, to: termEndOf(start, months), by: "plan" } : null;
}
export const inTerm = (sub) => !!(sub && sub.term && sub.term.to && kstToday() <= sub.term.to);
export function monthsLeft(sub) {
  if (!inTerm(sub)) return 0;
  const a = kstToday(), b = sub.term.to;
  return Math.max(0, (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + (Number(b.slice(8)) >= Number(a.slice(8)) ? 1 : 0));
}

/* ───────── 식별자 ───────── */
const ABC = "abcdefghjkmnpqrstuvwxyz23456789";
export function token(n) { const b = randomBytes(n); let s = ""; for (let i = 0; i < n; i++) s += ABC[b[i] % ABC.length]; return s; }
export function subId() { return "SUB-" + kstToday().replace(/-/g, "").slice(2) + "-" + token(5).toUpperCase(); }
export const hashOf = (s) => createHash("sha256").update("mnk-billing:" + String(s || "").trim().toLowerCase()).digest("hex").slice(0, 40);
export const normEmail = (s) => String(s || "").trim().toLowerCase().slice(0, 120);
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(s || ""));
export const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
export const nowIso = () => new Date().toISOString();

/* ───────── 빌링키 암호화 (AES-GCM) ─────────
   빌링키만으로는 결제할 수 없지만(시크릿 키 필요) 저장소가 새더라도 쓸 수 없게 한 번 더 감싼다.
   키: BILLING_ENC_KEY (권장, 한 번 정하면 바꾸지 말 것) — 없으면 TOSS_SECRET_KEY 에서 만든다. */
let KEY = null, KEY_SRC = "";
async function encKey() {
  const src = String(process.env.BILLING_ENC_KEY || process.env.TOSS_SECRET_KEY || "mnk-dev-only");
  if (KEY && KEY_SRC === src) return KEY;
  const raw = createHash("sha256").update("mnk-billing-key:" + src).digest();
  KEY = await webcrypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]); KEY_SRC = src;
  return KEY;
}
export async function seal(text) {
  const iv = randomBytes(12);
  const ct = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, await encKey(), new TextEncoder().encode(text));
  return iv.toString("base64") + "." + Buffer.from(ct).toString("base64");
}
export async function unseal(s) {
  try {
    const [iv, ct] = String(s || "").split(".");
    const pt = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, await encKey(), Buffer.from(ct, "base64"));
    return new TextDecoder().decode(pt);
  } catch (e) { return ""; }
}

/* ───────── 구독 저장 · 색인 ───────── */
export const getSub = (id) => db.get("subs/" + str(id, 40));
export async function saveSub(sub) { sub.updatedAt = nowIso(); await db.set("subs/" + sub.id, sub); return sub; }
export async function indexEmail(email, id) {
  const k = "byemail/" + hashOf(email);
  const cur = (await db.get(k)) || { subs: [] };
  if (!cur.subs.includes(id)) { cur.subs.unshift(id); await db.set(k, cur); }
}
export async function subsOfEmail(email) {
  const cur = await db.get("byemail/" + hashOf(email));
  return cur ? cur.subs : [];
}
/** 다음 결제 예정일 색인 갱신. date 가 비면 색인에서 뺀다 */
export async function setDue(sub, date) {
  if (sub.dueKey) await db.del(sub.dueKey);
  sub.dueKey = date ? `due/${date}/${sub.id}` : "";
  if (date) await db.set(sub.dueKey, { id: sub.id });
}

/** 고객에게 보여 줄 구독 — 빌링키·고객키·접속 정보는 뺀다 */
export function pubSub(s) {
  if (!s) return null;
  const { billingKeyEnc, customerKey, client, dueKey, staffMemo, ...rest } = s;
  return rest;
}

/* ───────── 결제 · 청구 ───────── */
export const STATUS_LABEL = {
  pending: "결제 수단 등록 대기", registered: "설치 대기 (첫 결제 전)", active: "이용 중",
  past_due: "결제 실패 · 카드 확인 필요", canceled: "해지됨",
};
const RETRY_DAYS = [1, 2, 4];             // 카드 결제 실패 시 다시 시도하는 간격(일) — 3번 더 실패하면 past_due

function periodOf(sub, from) {
  const next = addMonths(from, 1, sub.anchorDay);
  return { from, to: addDays(next, -1), next };
}

/** 주기 1회 청구 — 카드는 승인, 세금계산서는 청구 기록 생성. 성공하면 다음 결제일로 넘어간다.
 *  opts.date: 이번 주기 시작일(기본 sub.nextChargeAt) */
export async function runCycle(sub, opts = {}) {
  const date = opts.date || sub.nextChargeAt || kstToday();
  const cycle = (sub.cycle || 0) + 1;
  const per = periodOf(sub, date);
  const items = [{ name: `${sub.plan.label} 월 이용료 (${sub.plan.qty}개소)`, supply: sub.plan.supply, vat: sub.plan.vat }];
  /* 설치비는 첫 결제에 한 번만 (계약 링크에서 정한 경우) */
  if (cycle === 1 && sub.plan.installFee > 0 && !sub.installPaid) items.push({ name: `${sub.plan.label} 설치비 (1회)`, supply: sub.plan.installFee, vat: vatOf(sub.plan.installFee) });
  const supply = items.reduce((a, x) => a + x.supply, 0), vat = items.reduce((a, x) => a + x.vat, 0), amount = supply + vat;
  const orderName = `긴급 경보 알리미 ${cycle}회차 (${per.from.slice(5).replace("-", ".")}~${per.to.slice(5).replace("-", ".")})`;
  const attempt = (sub.failCount || 0) + 1;
  const orderId = `${sub.id}-${String(cycle).padStart(2, "0")}-${attempt}`;
  const pay = {
    orderId, subId: sub.id, cycle, attempt, method: sub.method, createdAt: nowIso(), by: opts.by || "cron",
    period: { from: per.from, to: per.to }, items, supply, vat, amount, orderName,
    customer: { company: sub.customer.company, bizNo: sub.customer.bizNo, ceo: sub.customer.ceo, email: sub.customer.email, address: sub.customer.address, bizType: sub.customer.bizType, bizItem: sub.customer.bizItem, manager: sub.customer.manager },
  };

  if (sub.method === "invoice") {
    pay.status = "invoice_pending";           // 세금계산서 발행 대기 → 발행 → 입금 확인
    pay.issueDate = date;
    await db.set("pays/" + orderId, pay);
    await advance(sub, pay, per);
    return { ok: true, pay };
  }

  const billingKey = await unseal(sub.billingKeyEnc);
  if (!billingKey) {
    pay.status = "failed"; pay.error = { code: "NO_BILLING_KEY", message: "등록된 카드가 없습니다" };
    await db.set("pays/" + orderId, pay);
    await fail(sub, pay);
    return { ok: false, pay };
  }
  const r = await chargeBilling(billingKey, {
    customerKey: sub.customerKey, amount, orderId, orderName,
    customerEmail: sub.customer.email, customerName: sub.customer.company || sub.customer.manager, customerMobilePhone: sub.customer.phone,
  });
  if (r.ok && r.data && (r.data.status === "DONE" || !r.data.status)) {
    const d = r.data;
    Object.assign(pay, { status: "paid", paymentKey: d.paymentKey, approvedAt: d.approvedAt || nowIso(), receiptUrl: d.receipt && d.receipt.url || "",
      card: cardLabel({ cardCompany: d.card && d.card.company, cardNumber: d.card && d.card.number, card: d.card }) || sub.card });
    await db.set("pays/" + orderId, pay);
    await advance(sub, pay, per);
    later(paidMail(sub, pay));
    return { ok: true, pay };
  }
  pay.status = "failed"; pay.error = { code: r.code, message: r.message, http: r.status };
  await db.set("pays/" + orderId, pay);
  await fail(sub, pay);
  return { ok: false, pay };
}

async function advance(sub, pay, per) {
  sub.cycle = pay.cycle;
  if (pay.items.length > 1) sub.installPaid = true;
  sub.lastPay = { orderId: pay.orderId, amount: pay.amount, status: pay.status, at: pay.approvedAt || pay.createdAt, period: pay.period };
  sub.payments = [pay.orderId, ...(sub.payments || [])].slice(0, 120);
  sub.failCount = 0; sub.retryAt = "";
  if (sub.status === "past_due" || sub.status === "registered") sub.status = "active";
  /* 해지 예약일에 닿으면 더 청구하지 않는다 */
  const stop = sub.cancel && sub.cancel.effective && per.next >= sub.cancel.effective;
  sub.nextChargeAt = stop ? "" : per.next;
  sub.paidThrough = per.to;
  /* 의무 사용기간 만료 30여 일 전 — 자동 연장 안내(약관 제16조) 한 번 */
  if (sub.term && sub.term.to && !sub.renewNoticeAt && !stop && addDays(kstToday(), 45) >= sub.term.to && kstToday() <= sub.term.to) {
    sub.renewNoticeAt = nowIso(); later(renewMail(sub));
  }
  await setDue(sub, stop ? sub.cancel.effective : sub.nextChargeAt);   // 해지 예약이면 그날 예약 작업이 마무리한다
  await saveSub(sub);
}

async function fail(sub, pay) {
  sub.failCount = (sub.failCount || 0) + 1;
  sub.payments = [pay.orderId, ...(sub.payments || [])].slice(0, 120);
  sub.lastPay = { orderId: pay.orderId, amount: pay.amount, status: "failed", at: pay.createdAt, error: pay.error };
  const wait = RETRY_DAYS[sub.failCount - 1];
  if (wait) {
    sub.retryAt = addDays(kstToday(), wait);
    await setDue(sub, sub.retryAt);
  } else {
    sub.status = "past_due"; sub.retryAt = "";
    await setDue(sub, "");                    // 카드를 바꾸면(또는 관리자가 다시 시도하면) 다시 청구
  }
  await saveSub(sub);
  later(failMail(sub, pay, !wait));
  if (!wait || sub.failCount === 1) later(staffAlert(sub, wait ? "알리미 정기결제 실패" : "알리미 정기결제 최종 실패", {
    "구독번호": sub.id, "금액": won(pay.amount), "사유": `${pay.error && pay.error.code} ${pay.error && pay.error.message || ""}`,
    "다음 시도": wait ? sub.retryAt : "자동 재시도 끝 — 고객 카드 변경 필요", "관리 화면": SITE() + "/billing-admin",
  }));
}

/** 1회 청구 (중도 해지 위약금 등) — 카드는 즉시 승인, 그 외는 계좌 입금 대기 기록.
 *  위약금은 재화·용역의 대가가 아니라 부가세를 붙이지 않는다(공급가액 = 금액, 세액 0). 세무사 확인 권장. */
export async function oneTimeCharge(sub, { amount, name, kind = "penalty", by = "staff" }) {
  amount = Math.round(Number(amount) || 0);
  if (amount <= 0) return { ok: false, error: "bad_amount" };
  const n = (sub.extraCount || 0) + 1;
  const orderId = `${sub.id}-X${n}`;
  const pay = { orderId, subId: sub.id, cycle: 0, kind, method: sub.method, createdAt: nowIso(), by, period: { from: kstToday(), to: kstToday() },
    items: [{ name, supply: amount, vat: 0 }], supply: amount, vat: 0, amount, orderName: name,
    customer: { company: sub.customer.company, bizNo: sub.customer.bizNo, ceo: sub.customer.ceo, email: sub.customer.email, address: sub.customer.address, manager: sub.customer.manager } };
  sub.extraCount = n;
  const key = sub.method === "card" ? await unseal(sub.billingKeyEnc) : "";
  if (key) {
    const r = await chargeBilling(key, { customerKey: sub.customerKey, amount, orderId, orderName: name, customerEmail: sub.customer.email, customerName: sub.customer.company });
    if (r.ok && r.data && (r.data.status === "DONE" || !r.data.status)) Object.assign(pay, { status: "paid", paymentKey: r.data.paymentKey, approvedAt: r.data.approvedAt || nowIso(), receiptUrl: r.data.receipt && r.data.receipt.url || "", card: sub.card });
    else Object.assign(pay, { status: "failed", error: { code: r.code, message: r.message } });
  } else pay.status = "transfer_pending";                // 계좌 입금 대기 → 관리 화면에서 입금 확인
  await db.set("pays/" + orderId, pay);
  sub.payments = [orderId, ...(sub.payments || [])].slice(0, 120);
  await saveSub(sub);
  return { ok: pay.status !== "failed", pay };
}

export async function refundMail(sub, pay, amount, reason) {
  const card = pay.method === "card";
  return sendMail({ to: sub.customer.email, name: sub.customer.manager, subject: `[모넷코리아] 긴급 경보 알리미 결제 취소 안내 ${won(amount)} (${sub.id})`,
    text: `결제가 취소되었습니다.\n· 취소 금액: ${won(amount)}\n· 주문번호: ${pay.orderId}\n· 사유: ${reason || "—"}\n\n${card ? "카드사에 따라 영업일 기준 3~7일 안에 승인 취소(환불)가 반영됩니다." : ""}\n문의 02-2088-1454`,
    html: mailHtml({ title: `${won(amount)} 결제 취소`, lead: card ? "카드사에 따라 영업일 기준 3~7일 안에 승인 취소가 반영됩니다." : "취소 처리되었습니다.", rows: [["취소 금액", won(amount), true], ["원 결제", `${won(pay.amount)} · ${pay.orderId}`], ["사유", reason || "—"]], button: { label: "구독 관리", href: manageUrl(sub) } }) });
}

async function renewMail(sub) {
  const t = sub.term;
  return sendMail({ to: sub.customer.email, name: sub.customer.manager, subject: `[모넷코리아] 긴급 경보 알리미 의무 사용기간 만료 안내 (${t.to})`,
    text: `긴급 경보 알리미 의무 사용기간이 ${t.to}에 끝납니다.\n\n별도 요청이 없으면 같은 조건(월 ${won(sub.plan.total)}, 부가세 포함)으로 매월 자동 연장되며, 만료 뒤에는 언제든 해지하실 수 있습니다.\n만기에 맞춰 해지하시려면 구독 관리에서 「만기 해지 예약」을 눌러 주십시오: ${manageUrl(sub)}\n\n문의 02-2088-1454`,
    html: mailHtml({ title: "의무 사용기간 만료 안내", lead: `의무 사용기간이 ${t.to}에 끝납니다. 별도 요청이 없으면 같은 조건으로 매월 자동 연장되며, 만료 뒤에는 언제든 해지하실 수 있습니다.`,
      rows: [["의무 사용기간", `${t.from} ~ ${t.to}`], ["연장 후 월 결제액", `${won(sub.plan.total)} (부가세 포함)`]], button: { label: "구독 관리 · 만기 해지 예약", href: manageUrl(sub) } }) });
}

/** 해지 예약일이 지난 구독 마무리 */
export async function closeIfDue(sub) {
  if (sub.status === "canceled") return false;
  if (sub.cancel && sub.cancel.effective && sub.cancel.effective <= kstToday() && (!sub.nextChargeAt || sub.nextChargeAt >= sub.cancel.effective)) {
    sub.status = "canceled"; sub.canceledAt = nowIso(); sub.nextChargeAt = "";
    await setDue(sub, ""); await saveSub(sub);
    return true;
  }
  return false;
}

/* ───────── 메일 (Brevo) ───────── */
export function later(p) {
  try { Promise.resolve(p).catch(() => {}); const w = globalThis.__MNK_WAIT_UNTIL; if (typeof w === "function") w(Promise.resolve(p)); } catch (e) { /* 무시 */ }
}
export async function sendMail({ to, name, subject, text, html, tag }) {
  const key = process.env.BREVO_API_KEY;
  if (!key || !isEmail(to)) return false;
  if (globalThis.__MNK_MAIL_SINK) { globalThis.__MNK_MAIL_SINK({ to, subject, text }); return true; }   // 로컬 검증용
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "모넷코리아", email: process.env.MAIL_FROM || "no-reply@monnit.co.kr" },
        to: [{ email: to, name: name || to }], replyTo: { name: "모넷코리아", email: "1015@monnit.com" },
        subject, textContent: text, ...(html ? { htmlContent: html } : {}), tags: [tag || "alarm-billing"],
      }), signal: AbortSignal.timeout(8000),
    });
    return r.status === 201;
  } catch (e) { return false; }
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** 애플 영수증 느낌의 간단한 HTML 메일 */
export function mailHtml({ title, lead, rows = [], button, foot }) {
  const tr = rows.map(([k, v, strong]) => `<tr><td style="padding:10px 0;color:#6e6e73;font-size:14px;border-bottom:1px solid #e8e8ed">${esc(k)}</td><td style="padding:10px 0;text-align:right;font-size:14px;border-bottom:1px solid #e8e8ed;${strong ? "font-weight:700;color:#1d1d1f" : "color:#1d1d1f"}">${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Malgun Gothic',sans-serif;color:#1d1d1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:18px;padding:36px 32px">
<tr><td style="font-size:13px;color:#6e6e73;letter-spacing:.02em">MONNIT KOREA · 긴급 경보 알리미</td></tr>
<tr><td style="padding-top:10px;font-size:26px;font-weight:700;letter-spacing:-.02em">${esc(title)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#424245">${esc(lead)}</td></tr>
<tr><td style="padding-top:22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tr}</table></td></tr>
${button ? `<tr><td style="padding-top:26px"><a href="${esc(button.href)}" style="display:inline-block;background:#0071e3;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:980px">${esc(button.label)}</a></td></tr>` : ""}
<tr><td style="padding-top:28px;font-size:12px;line-height:1.6;color:#86868b">${esc(foot || "")}${foot ? "<br>" : ""}주식회사 모넷코리아 · 사업자등록번호 242-88-01218 · 서울 서초구 효령로 380, 2층 · 02-2088-1454 · 1015@monnit.com</td></tr>
</table></td></tr></table></body></html>`;
}

export function manageUrl(sub) { return `${SITE()}/account?sub=${encodeURIComponent(sub.id)}`; }

export async function welcomeMail(sub) {
  const c = sub.customer, card = sub.method === "card";
  const first = sub.status === "active" ? `첫 결제 완료 · 다음 결제일 ${sub.nextChargeAt}` : "설치가 완료되는 날 첫 결제가 진행됩니다";
  const rows = [["구독번호", sub.id], ["구성", `${sub.plan.label} · ${sub.plan.qty}개소`], ["월 이용료", `${won(sub.plan.total)} (부가세 포함)`],
    ...(sub.plan.installFee ? [["설치비 (1회)", `${won(sub.plan.installFee + vatOf(sub.plan.installFee))} (부가세 포함 · 첫 결제에 포함)`]] : []),
    ["결제 수단", card ? `${sub.card && sub.card.company || "카드"} ${sub.card && sub.card.last4 ? "•••• " + sub.card.last4 : ""} 자동결제` : "세금계산서 발행 · 계좌이체"], ["결제", first],
    ["의무 사용기간", sub.plan.source === "contract" && sub.plan.to ? `${sub.plan.from} ~ ${sub.plan.to} (계약서 기준)` : sub.plan.termMonths ? `서비스 시작일부터 ${sub.plan.termMonths}개월 (기간 중 해지 불가 · 만료 후 매월 자동 연장)` : "없음"]];
  const text = [`${c.manager || c.company}님, 긴급 경보 알리미 구독 신청이 완료되었습니다.`, "", ...rows.map(([k, v]) => `· ${k}: ${v}`), "",
    "구독 관리(결제 내역·카드 변경·해지): " + manageUrl(sub), "", "담당자가 설치 일정을 안내드리기 위해 곧 연락드립니다.", "", "문의 02-2088-1454 · 1015@monnit.com"].join("\n");
  return sendMail({ to: c.email, name: c.manager, subject: `[모넷코리아] 긴급 경보 알리미 구독 신청 완료 (${sub.id})`, text,
    html: mailHtml({ title: "구독 신청이 완료되었습니다.", lead: `${c.manager || c.company}님, 감사합니다. 담당자가 설치 일정을 안내드리기 위해 곧 연락드립니다.`, rows, button: { label: "구독 관리", href: manageUrl(sub) },
      foot: card ? "정기결제는 구독 관리 화면에서 언제든 해지할 수 있으며, 해지하면 다음 결제일부터 청구되지 않습니다." : "세금계산서는 매월 결제일에 발행되며, 안내드린 계좌로 입금해 주시면 됩니다." }) });
}

async function paidMail(sub, pay) {
  const rows = [["결제 금액", won(pay.amount), true], ["공급가액 · 부가세", `${won(pay.supply)} · ${won(pay.vat)}`], ["이용 기간", `${pay.period.from} ~ ${pay.period.to}`],
    ["결제 카드", `${pay.card && pay.card.company || ""} ${pay.card && pay.card.last4 ? "•••• " + pay.card.last4 : ""}`.trim()], ["주문번호", pay.orderId], ["다음 결제일", sub.nextChargeAt || "—"]];
  const text = [`긴급 경보 알리미 ${pay.cycle}회차 결제가 완료되었습니다.`, "", ...rows.map(([k, v]) => `· ${k}: ${v}`), "", pay.receiptUrl ? "카드 매출전표: " + pay.receiptUrl : "", "구독 관리: " + manageUrl(sub)].join("\n");
  return sendMail({ to: sub.customer.email, name: sub.customer.manager, subject: `[모넷코리아] 긴급 경보 알리미 결제 완료 ${won(pay.amount)} (${pay.period.from.slice(0, 7)})`, text,
    html: mailHtml({ title: `${won(pay.amount)} 결제 완료`, lead: `긴급 경보 알리미 ${pay.cycle}회차 이용료가 결제되었습니다.`, rows, button: pay.receiptUrl ? { label: "카드 매출전표 보기", href: pay.receiptUrl } : { label: "구독 관리", href: manageUrl(sub) },
      foot: "카드 결제분은 카드 매출전표가 부가세 증빙이 되며, 같은 금액으로 세금계산서는 따로 발행되지 않습니다." }) });
}

async function failMail(sub, pay, final) {
  const text = [`긴급 경보 알리미 이용료 ${won(pay.amount)} 결제가 이루어지지 않았습니다.`, `사유: ${pay.error && pay.error.message || pay.error && pay.error.code || "카드사 거절"}`, "",
    final ? "자동 재시도가 끝났습니다. 아래 링크에서 카드를 바꿔 주시면 바로 다시 결제됩니다." : `${sub.retryAt}에 다시 시도합니다. 카드를 바꾸시려면 아래 링크를 이용해 주십시오.`, manageUrl(sub), "", "문의 02-2088-1454 · 1015@monnit.com"].join("\n");
  return sendMail({ to: sub.customer.email, name: sub.customer.manager, subject: `[모넷코리아] 긴급 경보 알리미 결제 실패 안내 (${sub.id})`, text,
    html: mailHtml({ title: "결제가 완료되지 않았습니다.", lead: final ? "자동 재시도가 끝났습니다. 카드를 바꿔 주시면 바로 다시 결제됩니다." : `${sub.retryAt}에 다시 시도합니다.`,
      rows: [["금액", won(pay.amount), true], ["사유", pay.error && pay.error.message || pay.error && pay.error.code || "카드사 거절"], ["구독번호", sub.id]], button: { label: "카드 변경하기", href: manageUrl(sub) } }) });
}

/* ───────── 담당자 알림 (사이트의 다른 접수와 같은 경로) ───────── */
export async function staffAlert(sub, label, fields) {
  const c = sub.customer || {};
  const lead = { ts: nowIso(), channel: "알리미", source: "/pay", kind: "alarm_billing", label, interest: `${label} — ${sub.plan && sub.plan.label || ""}`,
    company: c.company, name: c.manager, phone: c.phone, email: c.email, ref: sub.id, memo: `${sub.plan && sub.plan.qty}개소 · 월 ${won(sub.plan && sub.plan.total)} (VAT 포함) · ${sub.method === "card" ? "카드 자동결제" : "세금계산서·계좌이체"}` };
  let r = null;
  try { r = await notify(lead, fields); } catch (e) { r = { ok: false, tried: [String(e && e.message || e)] }; }
  try {
    await note({ ts: lead.ts, src: "lead", kind: lead.kind, mailed: !!(r && r.ok), via: (r && r.via) || "", why: r && r.ok ? "" : "메일 발송 실패",
      subject: `[모넷·${label}] ${lead.interest} — ${c.company || c.manager || ""}`, company: c.company, name: c.manager, phone: c.phone, email: c.email, ref: sub.id, summary: fields });
  } catch (e) { /* 무시 */ }
  return !!(r && r.ok);
}

/* ───────── 설정 (공급자 정보 · 세금계산서) ───────── */
export const DEFAULT_SETTINGS = {
  supplier: { bizNo: "2428801218", subNo: "", name: "주식회사 모넷코리아", ceo: "염정훈", address: "서울특별시 서초구 효령로 380, 2층", bizType: "", bizItem: "", email: "korea@monnit.com" },
  invoiceItem: "긴급 경보 알리미 구독 이용료", bank: "", chargeAt: "activation",
  termMonths: 36,            // 의무 사용기간(개월) — 서비스 시작일부터. 신청 시점 값이 구독에 고정된다
};
export async function getSettings() {
  const s = (await db.get("settings")) || {};
  return { ...DEFAULT_SETTINGS, ...s, supplier: { ...DEFAULT_SETTINGS.supplier, ...(s.supplier || {}) } };
}
