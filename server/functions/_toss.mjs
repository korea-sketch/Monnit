/** 토스페이먼츠 자동결제(빌링) API — 서버 전용
 *
 *  흐름
 *    1. 브라우저: TossPayments(clientKey).payment({customerKey}).requestBillingAuth({method:"CARD", successUrl, failUrl})
 *       → 카드 등록 후 successUrl?customerKey=…&authKey=… 로 돌아온다
 *    2. 서버: issueBillingKey(authKey, customerKey) → billingKey (카드 정보 포함)
 *    3. 서버: chargeBilling(billingKey, {customerKey, amount, orderId, orderName, …}) — 매달 정기결제
 *
 *  환경변수 (Cloudflare → Worker → Settings → Variables and Secrets)
 *    TOSS_CLIENT_KEY  test_ck_… / live_ck_…   (공개 — 결제 화면에 내려감)
 *    TOSS_SECRET_KEY  test_sk_… / live_sk_…   (Secret 으로 저장. 절대 화면에 내려가지 않음)
 *    TOSS_API_BASE    기본 https://api.tosspayments.com (로컬 검증용 모의 서버 주소로 바꿀 때만)
 *
 *  ※ 자동결제(빌링)는 토스페이먼츠와 별도 계약이 필요합니다. 계약 전에는 테스트 키로만 전체 흐름이 동작합니다.
 */

const BASE = () => String(process.env.TOSS_API_BASE || "https://api.tosspayments.com").replace(/\/$/, "");
export const tossClientKey = () => String(process.env.TOSS_CLIENT_KEY || "").trim();
const secret = () => String(process.env.TOSS_SECRET_KEY || "").trim();
export const tossReady = () => !!(tossClientKey() && secret());
export const tossTestMode = () => /^test_/.test(tossClientKey()) || /^test_/.test(secret());

async function call(path, body, { idem, method = "POST" } = {}) {
  if (!secret()) return { ok: false, status: 0, code: "NO_SECRET_KEY", message: "TOSS_SECRET_KEY 가 설정되지 않았습니다" };
  const headers = {
    Authorization: "Basic " + Buffer.from(secret() + ":").toString("base64"),
    "Content-Type": "application/json",
  };
  if (idem) headers["Idempotency-Key"] = String(idem).slice(0, 300);
  let r, data = null;
  try {
    r = await fetch(BASE() + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(65000)   /* 토스 문서: 자동결제 승인은 최대 60초 — 타임아웃 60초 이상 */ });
  } catch (e) {
    return { ok: false, status: 0, code: "NETWORK", message: String(e && e.message || e) };
  }
  try { data = await r.json(); } catch (e) { data = null; }
  if (r.ok) return { ok: true, status: r.status, data };
  return { ok: false, status: r.status, code: (data && data.code) || "HTTP_" + r.status, message: (data && data.message) || "" , data };
}

/** authKey → billingKey. 반환 data: { billingKey, customerKey, cardCompany, cardNumber, card:{ issuerCode, acquirerCode, number, cardType, ownerType }, method, authenticatedAt } */
export function issueBillingKey(authKey, customerKey) {
  return call("/v1/billing/authorizations/issue", { authKey, customerKey });
}

/** 정기결제 승인. 반환 data = Payment 객체 { paymentKey, orderId, status:"DONE", approvedAt, totalAmount, card:{…}, receipt:{url} } */
export function chargeBilling(billingKey, { customerKey, amount, orderId, orderName, customerEmail, customerName, customerMobilePhone }) {
  const body = { customerKey, amount, orderId, orderName: String(orderName || "").slice(0, 100), taxFreeAmount: 0 };
  if (customerEmail) body.customerEmail = customerEmail;
  if (customerName) body.customerName = String(customerName).slice(0, 100);
  if (customerMobilePhone) body.customerMobilePhone = String(customerMobilePhone).replace(/\D/g, "").slice(0, 11);
  /* 같은 주문번호로 두 번 승인되지 않도록 멱등키 = 주문번호 */
  return call("/v1/billing/" + encodeURIComponent(billingKey), body, { idem: orderId });
}

/** 결제 취소(전액·부분) */
export function cancelPayment(paymentKey, reason, amount) {
  const body = { cancelReason: String(reason || "고객 요청").slice(0, 200) };
  if (amount) body.cancelAmount = amount;
  return call("/v1/payments/" + encodeURIComponent(paymentKey) + "/cancel", body, { idem: "cancel-" + paymentKey + "-" + (amount || "all") });
}

/** 빌링키 삭제(카드 변경·해지 후). 실패해도 무시해도 되는 정리 작업 */
export function deleteBillingKey(billingKey) {
  return call("/v1/billing/" + encodeURIComponent(billingKey), null, { method: "DELETE" });
}

/** 카드 정보 → 화면 표시용 (카드번호는 토스가 이미 마스킹해서 준다) */
export function cardLabel(d) {
  if (!d) return null;
  const c = d.card || {};
  const company = d.cardCompany || COMPANY[c.issuerCode] || "카드";
  const num = String(d.cardNumber || c.number || "");
  /* 토스는 끝자리 일부도 가린다(예: 4330****123*) — 보이는 그대로 마지막 4자리 */
  return { company, number: num, last4: num.slice(-4), type: c.cardType || "", owner: c.ownerType || "" };
}
/* 토스 카드사 코드 일부 (issuerCode) */
const COMPANY = { "3K": "기업BC", "46": "광주", "71": "롯데", "30": "산업", "31": "BC", "51": "삼성", "38": "새마을", "41": "신한", "62": "신협", "36": "씨티", "33": "우리", "W1": "우리", "37": "우체국", "39": "저축", "35": "전북", "42": "제주", "15": "카카오뱅크", "3A": "케이뱅크", "24": "토스뱅크", "21": "하나", "61": "현대", "11": "국민", "91": "NH농협", "34": "수협" };
