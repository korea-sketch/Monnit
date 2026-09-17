/** 알리미 신청자 자동 응답 메일 — /promo/alarm · /promotions 공용
 *
 *  ── 왜 필요한가 ─────────────────────────────────────────────────────
 *  2026-09-07 까지 알리미 접수는 우리 쪽 알림만 나가고 신청자에게는
 *  아무것도 가지 않았다. 담당자가 전화를 걸 때까지 신청자는 무엇을 신청했는지,
 *  얼마인지, 무엇이 오는지 모른 채 기다린다.
 *  그래서 접수 즉시 제품별 소개 메일을 보내고, 전화는 그걸 읽었다는 전제로 건다.
 *
 *  sendguide.js 와 같은 구조다 — Brevo 로 보내고, 실패해도 접수를 막지 않는다.
 *  다른 점은 두 가지.
 *    · 본문이 HTML 이다 (제품 사진·표·버튼이 들어간다)
 *    · 제품 4종(소방·정전·경보·물감지)마다 문구와 이미지가 다르다
 *
 *  ── HTML 메일이 되는가 ──────────────────────────────────────────────
 *  된다. Brevo API 의 htmlContent 필드가 그 용도다.
 *  textContent 를 같이 넣으면 HTML 을 못 읽는 환경(구형 클라이언트·문자 요약)에서
 *  자동으로 대체본이 쓰인다. 둘 다 보내는 게 표준이라 그렇게 한다.
 *
 *  ── 이미지 ─────────────────────────────────────────────────────────
 *  메일에 첨부(CID)하지 않고 https://monnit.co.kr/email/images/... 로 부른다.
 *  메일 용량이 가볍고, 나중에 이미지만 바꿔도 이미 보낸 메일에 반영된다.
 *  받는 쪽이 이미지를 차단해도 alt 텍스트로 내용이 전달되도록 만들어 두었다.
 *
 *  환경변수
 *    BREVO_API_KEY   없으면 메일만 조용히 건너뛴다. 접수는 그대로 성공한다.
 *    SITE_ORIGIN     이미지·PDF 절대주소 기준 (기본 https://monnit.co.kr)
 *    ALARM_MAIL_OFF  '1' 이면 자동 응답을 끈다 (긴급 차단용)
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

/* ── 폼 값 → 템플릿 키 ────────────────────────────────────────────
   체크박스 value 는 '소방 알리미' 처럼 들어온다. 표기가 흔들려도 잡히도록
   공백을 지우고 부분일치로 본다. '커스텀'은 맞는 소개문이 없으므로 제외한다. */
const MATCH = [
  [/소방|화재|fire/i,        'fire'],
  [/물감지|누수|침수|water/i, 'water'],
  [/정전|차단기|power/i,      'power'],
  [/경보|알람|alarm/i,        'alarm']   /* '알리미' 오탐을 막으려 맨 뒤에 둔다 */
];

export function productOf(raw) {
  const s = String(raw || '').replace(/\s+/g, '');
  if (!s) return null;
  if (/커스텀|custom/i.test(s) && !/소방|화재|물감지|누수|침수|정전/.test(s)) return null;
  for (const [re, key] of MATCH) if (re.test(s)) return key;
  return null;
}

/** '소방 알리미, 물감지 알리미' → ['fire','water'] (중복 제거, 순서 유지) */
export function productsOf(raw) {
  const out = [];
  for (const part of String(raw || '').split(/[,·/|]/)) {
    const k = productOf(part);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/* ── 템플릿 로딩 (콜드스타트 1회) ─────────────────────────────────── */
let _cache = null;
async function load() {
  if (_cache) return _cache;
  const roots = [process.env.LAMBDA_TASK_ROOT, process.cwd(), path.join(process.cwd(), '..', '..')].filter(Boolean);
  let last;
  for (const r of roots) {
    try {
      const [template, products] = await Promise.all([
        readFile(path.join(r, 'email', 'template.html'), 'utf8'),
        readFile(path.join(r, 'email', 'products.json'), 'utf8')
      ]);
      _cache = { template, products: JSON.parse(products) };
      return _cache;
    } catch (e) { last = e; }
  }
  throw last || new Error('email template not found');
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = `font-family:'Apple SD Gothic Neo','Noto Sans KR','맑은 고딕','Malgun Gothic',sans-serif`;

function featureRows(features = []) {
  return features.map(f =>
    `            <tr>
              <td width="20" valign="top" style="${FONT};font-size:14px;line-height:24px;color:#1D6FE0;padding-bottom:6px;">◆</td>
              <td valign="top" style="${FONT};font-size:14px;line-height:24px;color:#41506B;letter-spacing:-0.3px;padding-bottom:6px;">${esc(f)}</td>
            </tr>`
  ).join('\n');
}

/** HTML 을 못 읽는 환경에서 쓰이는 대체본 */
function textOf(v) {
  return `안녕하세요, 모넷코리아입니다.

${v.CUSTOMER_NAME}님, ${v.PRODUCT} 알리미 신청이 정상 접수되었습니다.
담당자가 내용을 확인한 뒤 순차적으로 연락드릴 예정입니다.

[자료 바로가기]
· 제품 카탈로그 : ${v.CATALOG_URL}
· ${v.PRODUCT} 알리미 블로그 : ${v.BLOG_URL}
· 알리미 프로모션 홈페이지 : ${v.PROMO_URL}

[${v.PRODUCT} 알리미 구성]
· ${v.SENSOR_NAME} 1개
· 게이트웨이 1개
· 관제 플랫폼 (SMS 수신 비용 포함)
>> 월 30,000원 (수량에 따라 할인 프로모션 적용)

게이트웨이 1대당 센서 250대까지 연동 가능하며, 통신 거리는 개활지 기준 300m입니다.
설치 환경과 수량에 따라 구성이 달라집니다. 현장 조건을 알려주시면 맞춤 견적을 안내해 드리겠습니다.

[안내 자료]
· 알리미 서비스 4종 소개 : ${v.DOC_SERVICE_URL}
· 2026 S-CUBE 플랫폼 소개 : ${v.DOC_PLATFORM_URL}
· 모넷코리아 회사소개서 : ${v.DOC_COMPANY_URL}

[도입 사례]
· 화재 알리미 시스템 : ${v.FIRE_BLOG_URL}
· 전북 관공서 도입 사례 : ${v.CASE_BLOG_URL}

감사합니다.
모넷코리아 드림
서울시 서초구 효령로 380, 세안빌딩 2층 (06727) · T. 02-2088-1454
monnit.co.kr

수신거부 : ${v.UNSUBSCRIBE_URL}`;
}

/**
 * 메일 한 통을 만든다. 발송은 하지 않는다.
 * @param {string} product  'alarm'|'fire'|'power'|'water' 또는 '소방 알리미' 같은 폼 값
 * @param {object} vars     CUSTOMER_NAME, IMG_BASE, UNSUBSCRIBE_URL 등 덮어쓸 값
 */
export async function renderEmail(product, vars = {}) {
  const { template, products } = await load();
  const key = productOf(product) || product;
  const data = products[key];
  if (!data) throw new Error('unknown product: ' + product);

  const origin = (vars.SITE_ORIGIN || process.env.SITE_ORIGIN || 'https://monnit.co.kr').replace(/\/+$/, '');
  const base = { ...products._common };
  /* 절대주소는 배포 도메인 기준으로 다시 잡는다 (스테이징에서도 이미지가 뜬다) */
  for (const k of ['IMG_BASE', 'DOC_SERVICE_URL', 'DOC_PLATFORM_URL', 'DOC_COMPANY_URL', 'PROMO_URL']) {
    if (base[k]) base[k] = String(base[k]).replace(/^https?:\/\/[^/]+/, origin);
  }

  const v = { ...base, ...data, ...vars };
  v.CUSTOMER_NAME = esc(v.CUSTOMER_NAME || '고객');

  const html = template
    .replace(/\{\{FEATURE_ROWS\}\}/g, featureRows(v.FEATURES))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (v[k] !== undefined && typeof v[k] !== 'object' ? v[k] : m));

  return { product: key, subject: v.SUBJECT, html, text: textOf(v) };
}

/* ── 발송 ──────────────────────────────────────────────────────────
   sendguide.js 와 같은 이유로 발신은 no-reply@monnit.co.kr 이다.
   monnit.com 은 본사 도메인이라 DMARC 가 p=reject 이고 SPF·DKIM 에 Brevo 가
   없어서, 그 주소로 보내면 수신측이 스푸핑으로 보고 거부한다.
   답장 주소는 korea@monnit.com 이므로 고객 회신은 기존 메일함으로 온다. */
const SENDER   = { name: '모넷코리아', email: process.env.MAIL_FROM || 'no-reply@monnit.co.kr' };
const REPLY_TO = { name: '모넷코리아', email: process.env.MAIL_REPLYTO || 'korea@monnit.com' };

async function brevo(payload) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    /* Brevo 가 응답하지 않으면 함수 전체가 타임아웃되어 접수 응답까지 늦어진다 */
    signal: AbortSignal.timeout(8000)
  });
  if (r.status === 201) return { ok: true };
  let detail = '';
  try { detail = (await r.text()).slice(0, 200); } catch { /* 무시 */ }
  return { ok: false, error: `brevo ${r.status} ${detail}` };
}

/**
 * 접수 한 건에 대한 자동 응답. 절대 throw 하지 않는다 — 메일 실패가 접수를 막으면 안 된다.
 * @returns {{sent:boolean, product?:string, skipped?:string, error?:string}}
 */
export async function sendAlarmReply({ product, email, name, origin }) {
  if (process.env.ALARM_MAIL_OFF === '1') return { sent: false, skipped: 'off' };
  if (!process.env.BREVO_API_KEY)         return { sent: false, skipped: 'no_key' };

  const to = String(email || '').trim();
  /* 형식이 틀리거나 (미기재) 로 들어온 주소로는 보내지 않는다 — 반송률이 올라간다 */
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) return { sent: false, skipped: 'no_email' };

  /* 알리미 접수일 때만 보낸다.
     lead.interest 에는 '문의항목' 같은 자유 입력도 들어온다. 거기에 '화재'가
     섞였다고 소방 알리미 소개문을 보내면 엉뚱한 메일이 나간다.
     그래서 '알리미' 라는 말이 붙어 있거나 제품 키를 직접 준 경우로 한정한다. */
  const raw = String(product || '');
  if (!/알리미/.test(raw) && !['alarm', 'fire', 'power', 'water'].includes(raw.trim()))
    return { sent: false, skipped: 'not_alarm' };

  const keys = productsOf(product);
  if (!keys.length) return { sent: false, skipped: 'no_product' };

  try {
    /* 여러 종을 함께 신청하면 첫 번째 제품 메일을 보내고 나머지는 담당자가 통화에서 다룬다.
       4통을 한꺼번에 보내면 스팸으로 분류된다. */
    const { subject, html, text } = await renderEmail(keys[0], {
      CUSTOMER_NAME: String(name || '').split('/')[0].trim() || '고객',
      SITE_ORIGIN: origin
    });

    const r = await brevo({
      sender: SENDER,
      to: [{ email: to }],
      replyTo: REPLY_TO,
      subject,
      htmlContent: html,
      textContent: text,
      tags: ['alarm-auto', keys[0]]
    });

    return r.ok
      ? { sent: true, product: keys[0], also: keys.slice(1) }
      : { sent: false, product: keys[0], error: r.error };
  } catch (e) {
    return { sent: false, error: String((e && e.message) || e) };
  }
}

export function configured() {
  return {
    brevo: !!process.env.BREVO_API_KEY,
    off: process.env.ALARM_MAIL_OFF === '1',
    from: SENDER.email,
    replyTo: REPLY_TO.email,
    products: ['alarm', 'fire', 'power', 'water']
  };
}
