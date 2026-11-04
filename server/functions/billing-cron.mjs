/** 긴급 경보 알리미 — 정기결제 예약 작업 (매시 23분, UTC)
 *
 *  결제 예정 색인(billing/due/<날짜>/<구독>)에서 오늘(한국 날짜)까지 도래한 건만 꺼내 처리한다.
 *    · 카드: 토스페이먼츠 빌링 승인 → 성공 시 다음 달 같은 날로, 실패 시 1·2·4일 뒤 재시도 → 그래도 실패면 「결제 실패」
 *    · 세금계산서: 청구 기록(발행 대기) 생성 → 관리 화면에서 나라빌 엑셀로 내려받아 발행
 *    · 해지 예약일이 된 구독은 해지로 마무리
 *  결제는 한국 시간 09~20시에만 한다(밤중 승인 문자 방지). 한 번에 최대 25건 — 남으면 다음 시간에 이어서.
 *  무료 플랜 CPU 한도(10ms): 카드 승인은 네트워크 대기라 CPU 를 거의 쓰지 않는다.
 *  멈추려면 대시보드 변수 BILLING_CRON_OFF = 1 (다른 예약 작업은 그대로).
 */
import { db, getSub, runCycle, closeIfDue, kstToday, kstHour, setDue, saveSub } from "./_billing_core.mjs";

export const config = { schedule: "23 * * * *" };

export async function runDue({ force = false, limit = 25 } = {}) {
  if (!force && process.env.BILLING_CRON_OFF === "1") return { ok: true, skipped: "off" };
  const h = kstHour();
  if (!force && (h < 9 || h > 20)) return { ok: true, skipped: "night", hour: h };
  const today = kstToday();
  const keys = (await db.list("due/")).map((b) => b.key).filter((k) => k.slice(4, 14) <= today).sort();
  const out = { ok: true, today, due: keys.length, done: [] };
  const t0 = Date.now();
  for (const key of keys.slice(0, limit)) {
    if (Date.now() - t0 > 8 * 60e3) break;               // 승인 대기가 길어지면 남은 건은 다음 시간에 (예약 작업 시간 한도 보호)
    const id = key.split("/")[2];
    const sub = await getSub(id);
    if (!sub || sub.dueKey !== key) { await db.del(key); continue; }          // 지난 색인
    try {
      if (await closeIfDue(sub)) { out.done.push({ id, action: "closed" }); continue; }
      if (!["active", "past_due"].includes(sub.status)) { await setDue(sub, ""); await saveSub(sub); out.done.push({ id, action: "unindexed", status: sub.status }); continue; }
      const r = await runCycle(sub, { by: "cron", date: sub.nextChargeAt || today });
      out.done.push({ id, action: sub.method === "invoice" ? "invoiced" : "charged", ok: r.ok, amount: r.pay && r.pay.amount, status: r.pay && r.pay.status });
    } catch (e) {
      console.error("[billing-cron]", id, e && e.stack || e);
      out.done.push({ id, action: "error", error: String(e && e.message || e) });
    }
  }
  out.left = Math.max(0, keys.length - out.done.length);
  return out;
}

export default async () => {
  const r = await runDue();
  if (r.done && r.done.length) console.log("[billing-cron]", JSON.stringify(r));
  return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
};
