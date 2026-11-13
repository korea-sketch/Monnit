/** 긴급 경보 알리미 — 설치 일정 · 안내 메일 자동화
 *
 *  흐름
 *    ① 고객이 결제 화면에서 설치 희망일(다음 주부터 · 평일 · 매월 1~20일)과 시간대를 고른다 → sub.install.status = "requested"
 *       희망일은 확정이 아니다. 화면·메일 모두 「담당자가 일정을 확인해 확정 연락 · 변동될 수 있음」을 알린다.
 *    ② 담당자가 관리 화면에서 설치일을 확정 → "confirmed" · 고객에게 「설치 일정 확정 + 설치 준비 요령」 메일
 *    ③ 설치 전날 오전 → 「내일 설치 · 준비 요령」 메일 한 번 더 (예약 작업)
 *    ④ 설치 완료(서비스 개시) → "done" · 구독 시작일 = 설치 완료일 · 「개통 + 플랫폼 사용 안내」 메일
 *    ⑤ 개통 n일 뒤(기본 7일) → 「플랫폼 사용 안내」 한 번 더
 *    결제는 ④ 이후에만 일어난다(매월 결제일 기준 · _billing_core firstChargeDate).
 *
 *  저장: billing/mailq/<YYYY-MM-DD>/<구독>~<종류>  — 예약 작업이 그날 오전 9시 이후 보낸다.
 */
import { db, getSub, saveSub, getSettings, sendMail, mailHtml, manageUrl, SITE, kstToday, addDays, isDate, won } from "./_billing_core.mjs";

export const SLOT_LABEL = { am: "오전 (9~12시)", pm: "오후 (13~18시)", any: "시간 무관" };
const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const dayLabel = (d) => (isDate(d) ? `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 (${WD[new Date(d + "T00:00:00Z").getUTCDay()]})` : "—");

/* ───────── 희망일 규칙 ───────── */
/** 다음 주 월요일 (오늘이 월요일이어도 다음 주) */
export function nextMonday(today = kstToday()) {
  const dow = new Date(today + "T00:00:00Z").getUTCDay();
  return addDays(today, ((8 - dow) % 7) || 7);
}
export function installRules(s) {
  const r = s.install || {};
  const from = nextMonday();
  return { from, to: addDays(kstToday(), Math.max(14, Number(r.horizonDays) || 60)), lastDay: Math.max(0, Math.min(31, Number(r.lastDay) || 0)),
    weekdaysOnly: r.weekdaysOnly !== false, blackout: (r.blackout || []).filter(isDate) };
}
export function dateAllowed(d, R) {
  if (!isDate(d) || d < R.from || d > R.to) return false;
  const dow = new Date(d + "T00:00:00Z").getUTCDay();
  if (R.weekdaysOnly && (dow === 0 || dow === 6)) return false;
  if (R.lastDay && Number(d.slice(8, 10)) > R.lastDay) return false;
  return !R.blackout.includes(d);
}
/** 결제 화면 입력 검사 → sub.install */
export function cleanInstall(b, R) {
  const x = b || {};
  const wish = String(x.wish || "").slice(0, 10), alt = String(x.alt || "").slice(0, 10);
  if (!dateAllowed(wish, R)) return { error: "bad_install_date" };
  if (alt && (!dateAllowed(alt, R) || alt === wish)) return { error: "bad_install_alt" };
  const slot = SLOT_LABEL[x.slot] ? x.slot : "any";
  return { install: { wish, alt: alt || "", slot, memo: String(x.memo || "").trim().slice(0, 300), status: "requested", requestedAt: new Date().toISOString(), history: [] } };
}

/* ───────── 메일 큐 ───────── */
export async function queueMail(sub, kind, date) {
  if (!isDate(date)) return;
  const key = `mailq/${date}/${sub.id}~${kind}`;
  sub.mailq = { ...(sub.mailq || {}) };
  if (sub.mailq[kind] && sub.mailq[kind] !== key) await db.del(sub.mailq[kind]);
  sub.mailq[kind] = key;
  await db.set(key, { id: sub.id, kind });
}
export async function unqueueMail(sub, kind) {
  if (sub.mailq && sub.mailq[kind]) { await db.del(sub.mailq[kind]); delete sub.mailq[kind]; }
}
/** 예약 작업에서 호출 — 오늘까지 도래한 안내 메일 발송 */
export async function runMailQueue({ limit = 30 } = {}) {
  const today = kstToday();
  const keys = (await db.list("mailq/")).map((b) => b.key).filter((k) => k.slice(6, 16) <= today).sort().slice(0, limit);
  const out = [];
  for (const key of keys) {
    const [id, kind] = key.split("/")[2].split("~");
    const sub = await getSub(id);
    await db.del(key);
    if (!sub || !sub.mailq || sub.mailq[kind] !== key || sub.status === "canceled") { out.push({ id, kind, skipped: true }); continue; }
    delete sub.mailq[kind];
    let ok = false;
    if (kind === "dayBefore" && sub.install && sub.install.status === "confirmed") ok = await installGuideMail(sub, "dayBefore");
    if (kind === "follow" && sub.status !== "canceled") ok = await platformMail(sub, "follow");
    sub.mailLog = [{ kind, at: new Date().toISOString(), ok }, ...(sub.mailLog || [])].slice(0, 30);
    await saveSub(sub);
    out.push({ id, kind, ok });
  }
  return out;
}

/* ───────── 담당자 조작 ───────── */
/** 설치일 확정 · 변경 — 고객에게 확정 + 설치 요령 메일, 전날 안내 예약 */
export async function confirmInstall(sub, { date, slot, note, notify = true, by = "staff" }) {
  if (!isDate(date)) return { ok: false, error: "bad_date" };
  const s = await getSettings();
  const ins = sub.install || { history: [] };
  const changed = ins.status === "confirmed" && ins.date && ins.date !== date;
  ins.history = [{ at: new Date().toISOString(), by, from: ins.date || ins.wish || "", to: date, note: String(note || "").slice(0, 200) }, ...(ins.history || [])].slice(0, 20);
  Object.assign(ins, { status: "confirmed", date, slot: SLOT_LABEL[slot] ? slot : (ins.slot || "any"), note: String(note || "").slice(0, 300), confirmedAt: new Date().toISOString() });
  sub.install = ins;
  const dayBefore = addDays(date, -1);
  if (s.mail.dayBefore && dayBefore > kstToday()) await queueMail(sub, "dayBefore", dayBefore); else await unqueueMail(sub, "dayBefore");
  await saveSub(sub);
  let mailed = false;
  if (notify && s.mail.confirm) mailed = await installGuideMail(sub, changed ? "changed" : "confirmed");
  sub.mailLog = [{ kind: changed ? "changed" : "confirmed", at: new Date().toISOString(), ok: mailed }, ...(sub.mailLog || [])].slice(0, 30);
  await saveSub(sub);
  return { ok: true, mailed, changed };
}
/** 설치 완료(서비스 개시) 직후 — billing.mjs activate() 가 부른다 */
export async function afterInstalled(sub, start) {
  const s = await getSettings();
  sub.install = { ...(sub.install || {}), status: "done", doneDate: start, doneAt: new Date().toISOString() };
  await unqueueMail(sub, "dayBefore");
  const fd = Number(s.mail.followDays) || 0;
  if (fd > 0) await queueMail(sub, "follow", addDays(start > kstToday() ? start : kstToday(), fd));
  if (s.mail.start) {          // 바로 보내고 기록 (뒤에서 저장하면 결제 예약 정보를 덮어쓸 수 있어 기다린다)
    const ok = await platformMail(sub, "start").catch(() => false);
    sub.mailLog = [{ kind: "start", at: new Date().toISOString(), ok }, ...(sub.mailLog || [])].slice(0, 30);
  }
  await saveSub(sub);
}

/* ───────── 메일 ───────── */
const platformLinks = () => [
  { label: "Scube 사용자 매뉴얼 (PDF)", href: SITE() + "/files/scube-user-manual.pdf" },
  { label: "Scube 매뉴얼 · 사용법 문서", href: SITE() + "/kb/scube" },
  { label: "영상: 알람 확인부터 조치까지 (37초)", href: SITE() + "/videos/scube/scube-01-alarm-action.mp4" },
  { label: "영상: 휴대폰에서 보기 (27초)", href: SITE() + "/videos/scube/scube-04-mobile.mp4" },
  { label: "기술지원 모니에게 물어보기", href: SITE() + "/?moni=support&src=alarm-mail" },
];
const textBlocks = (blocks) => blocks.map((b) => [`■ ${b.h}`, ...(b.items || []).map((x, i) => `${i + 1}. ${x}`), ...(b.links || []).map((l) => `- ${l.label}: ${l.href}`)].join("\n")).join("\n\n");

export async function installGuideMail(sub, mode) {
  const s = await getSettings(), c = sub.customer, ins = sub.install || {};
  const when = `${dayLabel(ins.date)} · ${SLOT_LABEL[ins.slot] || "시간 무관"}`;
  const title = mode === "dayBefore" ? "내일 설치가 진행됩니다." : mode === "changed" ? "설치 일정이 변경되었습니다." : "설치 일정이 확정되었습니다.";
  const lead = mode === "dayBefore" ? `${c.manager || c.company}님, 내일 방문 전 아래 준비 요령을 한 번 더 확인해 주세요.`
    : `${c.manager || c.company}님, 아래 일정으로 방문합니다. 현장 사정에 따라 시간은 다소 달라질 수 있으며, 바뀌면 미리 연락드립니다.`;
  const rows = [["설치 일정", when, true], ["설치 장소", `${c.site || ""} ${c.siteAddr ? "· " + c.siteAddr : ""}`.trim()], ["구성", `${sub.plan.label} · ${sub.plan.qty}개소`],
    ...(ins.note ? [["담당자 메모", ins.note]] : []),
    ["구독 시작 · 결제", `설치 완료일부터 구독이 시작되며, 결제도 설치가 완료된 뒤에만 진행됩니다${s.payDay ? ` (매월 ${s.payDay}일)` : ""}`]];
  const blocks = [{ h: "설치 전 준비 요령", items: s.guides.install || [] }];
  const subj = mode === "dayBefore" ? `[모넷코리아] 내일 긴급 경보 알리미 설치 안내 (${ins.date})` : `[모넷코리아] 긴급 경보 알리미 설치 일정 ${mode === "changed" ? "변경" : "확정"} — ${ins.date}`;
  return sendMail({ to: c.email, name: c.manager, subject: subj,
    text: [lead, "", ...rows.map(([k, v]) => `· ${k}: ${v}`), "", textBlocks(blocks), "", "구독 관리: " + manageUrl(sub), "문의 02-2088-1454 · 1015@monnit.com"].join("\n"),
    html: mailHtml({ title, lead, rows, blocks, button: { label: "구독 관리", href: manageUrl(sub) }, foot: "일정 변경이 필요하시면 이 메일에 회신하시거나 02-2088-1454로 연락 주세요." }) });
}

export async function platformMail(sub, mode) {
  const s = await getSettings(), c = sub.customer;
  const follow = mode === "follow";
  const title = follow ? "플랫폼 사용법, 한 번 더 보내드립니다." : "설치가 완료되어 서비스가 시작되었습니다.";
  const lead = follow ? `${c.manager || c.company}님, 알리미를 쓰신 지 일주일쯤 되었습니다. 자주 묻는 사용법을 다시 정리해 드립니다.`
    : `${c.manager || c.company}님, 오늘부터 긴급 경보 알리미가 현장을 지켜봅니다. 알림은 문자·이메일·대시보드로 받으실 수 있습니다.`;
  const rows = follow ? [] : [["구독 시작일 (설치 완료일)", sub.startedAt || kstToday(), true], ["의무 사용기간", sub.term ? `${sub.term.from} ~ ${sub.term.to}` : "—"],
    ["월 이용료", `${won(sub.plan.total)} (부가세 포함)`], [sub.method === "card" ? "첫 결제일" : "첫 세금계산서 발행일", sub.nextChargeAt || (sub.lastPay && String(sub.lastPay.at).slice(0, 10)) || "—"]];
  const blocks = [{ h: "플랫폼(Scube) 사용 안내", items: s.guides.platform || [], links: platformLinks() }];
  return sendMail({ to: c.email, name: c.manager, subject: follow ? "[모넷코리아] 알리미 플랫폼 사용 안내 (다시 보내드립니다)" : `[모넷코리아] 긴급 경보 알리미 개통 · 플랫폼 사용 안내 (${sub.id})`,
    text: [lead, "", ...rows.map(([k, v]) => `· ${k}: ${v}`), "", textBlocks(blocks), "", "구독 관리: " + manageUrl(sub), "문의 02-2088-1454 · 1015@monnit.com"].join("\n"),
    html: mailHtml({ title, lead, rows, blocks, button: { label: "Scube 매뉴얼 열기", href: SITE() + "/kb/scube" }, foot: "센서 추가·위치 변경·사용자 추가가 필요하시면 이 메일에 회신해 주세요." }) });
}
