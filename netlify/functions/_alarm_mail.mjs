/** 기존 고객 안내 메일 — 긴급 경보 알리미 SLA 시행·개인정보처리방침 개정 안내 + 만족도 조사 (2026-10-20)
 *
 *  noticeMail(client)  → { subject, text, html, links }   관리 화면 미리보기·복사용
 *  sendNotice(client)  → Brevo 로 발송. { ok, error? }
 *
 *  링크는 고객마다 다르다 (k = 고객 id):
 *    안내 페이지   /alarm/notice?k=ID     변경 요지 + 아래 두 링크 + 전문·PDF·개인정보처리방침
 *    SLA 동의     /sla-consent?k=ID
 *    만족도 조사   /survey?k=ID
 *
 *  환경변수: BREVO_API_KEY (없으면 발송 건너뜀) · MAIL_FROM · MAIL_REPLYTO
 */
const SITE = () => String(process.env.URL || "https://monnit.co.kr").replace(/\/$/, "");
const PRODUCT_LABEL = { fire: "화재 알리미", water: "물감지 알리미", power: "정전 알리미", alarm: "경보 알리미", custom: "커스텀 알리미" };
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

export function linksFor(client) {
  const S = SITE(), k = encodeURIComponent(client.id || "");
  const prods = Array.isArray(client.products) ? client.products : [];
  return {
    notice: `${S}/alarm/notice?k=${k}`,
    consent: `${S}/sla-consent?k=${k}`,
    survey: `${S}/survey?k=${k}`,
    terms: `${S}/alarm/terms`,
    pdf: prods.length === 1 ? `${S}/alarm/sla-${prods[0]}.pdf` : `${S}/alarm/sla.pdf`,
    privacy: `${S}/privacy.html`,
  };
}

const POINTS = [
  ["서비스 범위", "알림 발송까지가 서비스 범위입니다. 상시 관제·현장 출동·기관 신고는 포함되지 않습니다."],
  ["보조 수단", "법정 안전설비를 대신하지 않으며, 센서 특성상 오탐·미탐이 생길 수 있습니다."],
  ["책임 한도", "회사의 배상 한도는 직전 12개월간 지급한 이용료 총액입니다(고의·중과실 제외)."],
  ["고객이 하실 일", "월 1회 테스트 알림 점검, 배터리 알림 후 14일 안에 교체, 수신자 정보 최신 유지."],
  ["수신자", "알림 수신자는 최대 10명까지 등록할 수 있으며, 추가·변경은 1015@monnit.com 으로 알려 주시면 반영해 드립니다."],
  ["개인정보", "입력하신 정보와 알림 수신자 정보는 개인정보처리방침에 따라 알림 발송·고객 지원 목적으로만 처리합니다."],
];

export function noticeMail(client) {
  const L = linksFor(client);
  const who = client.mgr ? `${client.mgr}님` : `${client.name} 담당자님`;
  const prods = (Array.isArray(client.products) ? client.products : []).map((k) => PRODUCT_LABEL[k]).filter(Boolean);
  const using = prods.length ? prods.join("·") : "긴급 경보 알리미";
  const site = "";   /* 설치 현장은 여러 곳일 수 있어 인사말에 넣지 않는다 (2026-10-20) */
  const subject = `[모넷코리아] 긴급 경보 알리미 서비스 이용약관(SLA) 확인 요청 및 이용 의견 — ${client.name}`;

  const text = [
    `${who}, 안녕하세요. 모넷코리아입니다.`,
    `${site}${using}를 이용해 주셔서 감사합니다.`, "",
    "긴급 경보 알리미 서비스의 서비스수준협약서(SLA)와 개인정보처리방침을 안내드립니다.",
    "서비스 범위와 책임 기준, 고객께서 확인해 주실 사항을 정리한 문서로, 주요 내용은 아래와 같습니다.", "",
    ...POINTS.map(([t, d]) => `· ${t}: ${d}`), "",
    "1) SLA 확인 및 동의",
    "   아래 링크에서 전문을 확인하시고 동의 여부를 표시해 주십시오. 동의해 주셔야 SLA가 적용되며,",
    "   동의하지 않으셔도 서비스는 기존 계약 조건대로 계속 제공됩니다.",
    `   ▶ ${L.consent}`, "",
    "2) 이용 만족도 조사 (약 2분)",
    "   별점과 짧은 의견을 남겨 주시면 서비스 개선에 반영하겠습니다.",
    `   ▶ ${L.survey}`, "",
    `SLA 요약 안내 페이지: ${L.notice}`,
    `SLA 전문(웹): ${L.terms}`,
    `SLA PDF: ${L.pdf}`,
    `개인정보처리방침: ${L.privacy}`, "",
    "궁금하신 점은 이 메일에 회신하시거나 02-2088-1454 로 연락 주십시오.", "",
    "감사합니다.", "주식회사 모넷코리아", "서울특별시 서초구 효령로 380, 2층 · 02-2088-1454 · korea@monnit.com",
  ].join("\n");

  const btn = (href, label, solid) =>
    `<a href="${href}" style="display:inline-block;padding:13px 22px;margin:4px 6px 4px 0;font-size:15px;font-weight:600;text-decoration:none;border-radius:4px;` +
    (solid ? "background:#0b6b4f;color:#ffffff;" : "background:#ffffff;color:#0b6b4f;border:1px solid #0b6b4f;") + `">${label}</a>`;
  const html = `<!doctype html><html lang="ko"><body style="margin:0;padding:0;background:#f3f5f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f4;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dfe5e2;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;color:#0f1a16;font-size:15px;line-height:1.7">
<tr><td style="padding:22px 30px;border-bottom:2px solid #0b6b4f"><span style="font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#b3261e">MONNIT KOREA</span></td></tr>
<tr><td style="padding:28px 30px 8px">
  <p style="margin:0 0 14px">${esc(who)}, 안녕하세요. 모넷코리아입니다.<br>${esc(site)}${esc(using)}를 이용해 주셔서 감사합니다.</p>
  <h1 style="font-size:20px;line-height:1.4;margin:0 0 12px">긴급 경보 알리미 서비스 이용약관(SLA) 및<br>개인정보처리방침 확인 요청</h1>
  <p style="margin:0 0 18px;color:#41524b">긴급 경보 알리미 서비스의 서비스수준협약서(SLA)와 개인정보처리방침을 안내드립니다. 서비스 범위와 책임 기준, 고객께서 확인해 주실 사항을 정리한 문서이니 한 번 읽어 보시고 동의 여부를 표시해 주십시오.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dfe5e2;margin:0 0 22px;font-size:14px">
    ${POINTS.map(([t, d], i) => `<tr><td style="padding:10px 14px;width:96px;background:#f3f5f4;color:#41524b;font-weight:600;vertical-align:top;${i ? "border-top:1px solid #dfe5e2" : ""}">${esc(t)}</td><td style="padding:10px 14px;vertical-align:top;${i ? "border-top:1px solid #dfe5e2" : ""}">${esc(d)}</td></tr>`).join("")}
  </table>
  <p style="margin:0 0 6px;font-weight:600">1) SLA 확인 및 동의</p>
  <p style="margin:0 0 12px;color:#41524b;font-size:14px">전문을 확인하시고 동의 여부를 표시해 주십시오. 동의해 주셔야 SLA가 적용되며, 동의하지 않으셔도 서비스는 기존 계약 조건대로 계속 제공됩니다.</p>
  <p style="margin:0 0 22px">${btn(L.consent, "SLA 확인하고 동의하기", true)}</p>
  <p style="margin:0 0 6px;font-weight:600">2) 이용 만족도 조사 <span style="font-weight:400;color:#7c8b84">(약 2분)</span></p>
  <p style="margin:0 0 12px;color:#41524b;font-size:14px">별점과 짧은 의견을 남겨 주시면 서비스 개선에 반영하겠습니다.</p>
  <p style="margin:0 0 26px">${btn(L.survey, "만족도 조사 참여", false)}</p>
  <p style="margin:0 0 4px;font-size:13px;color:#41524b">자세히 보기</p>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.9">
    <a href="${L.notice}" style="color:#0b6b4f">SLA 요약 안내 페이지</a> ·
    <a href="${L.terms}" style="color:#0b6b4f">SLA 전문(웹)</a> ·
    <a href="${L.pdf}" style="color:#0b6b4f">SLA PDF</a> ·
    <a href="${L.privacy}" style="color:#0b6b4f">개인정보처리방침</a></p>
  <p style="margin:0 0 8px;font-size:14px;color:#41524b">궁금하신 점은 이 메일에 회신하시거나 <b>02-2088-1454</b> 로 연락 주십시오. 알림 수신자 추가·변경은 <a href="mailto:1015@monnit.com" style="color:#0b6b4f">1015@monnit.com</a> 으로 알려 주시면 반영해 드립니다.</p>
</td></tr>
<tr><td style="padding:16px 30px 24px;border-top:1px solid #dfe5e2;font-size:12px;color:#7c8b84;line-height:1.7">주식회사 모넷코리아 · 서울특별시 서초구 효령로 380, 2층 · 02-2088-1454 · korea@monnit.com<br>이 메일은 긴급 경보 알리미 이용 고객에게 계약 이행을 위해 발송되었습니다.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html, links: L };
}

export async function sendNotice(client) {
  const key = process.env.BREVO_API_KEY;
  const to = String(client.email || "").trim();
  if (!key) return { ok: false, error: "BREVO_API_KEY 없음 — 메일 문구를 복사해 직접 보내 주십시오." };
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) return { ok: false, error: "고객 이메일이 없거나 형식이 맞지 않습니다." };
  const m = noticeMail(client);
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "모넷코리아", email: process.env.MAIL_FROM || "no-reply@monnit.co.kr" },
        to: [{ email: to, name: client.mgr || client.name }],
        replyTo: { name: "모넷코리아", email: process.env.MAIL_REPLYTO || "korea@monnit.com" },
        subject: m.subject, htmlContent: m.html, textContent: m.text, tags: ["alarm-sla-notice"],
      }), signal: AbortSignal.timeout(8000),
    });
    if (r.status !== 201) return { ok: false, error: "brevo " + r.status };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
