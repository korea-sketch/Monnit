/*! Monnit Korea — 리드 접점 공통 규격 v1 (2026-08)
 *  사이트 안의 모든 접수(문의·자료요청·구독)를 같은 형식으로 기록한다.
 *
 *   MonnitLead.source()              유입 출처 (utm/gclid/fbclid/referrer) — 세션 최초 유입 보존
 *   MonnitLead.build(유형,접점,제목,값) 공통필드·제목규격을 채운 payload 반환
 *   MonnitLead.track(유형,{page,interest})  전송 성공 후 광고·분석 신호 발사
 *
 *  유형 3종
 *   contact      문의·신청 (무료체험/현장진단/상담/프로모션/교회) → 즉시 연락
 *   doc_request  제안서 PDF 신청                                → 자료 발송·후속
 *   subscribe    뉴스레터 구독                                  → 정기 발송
 */
(function (w, d) {
  'use strict';
  if (w.MonnitLead) return;

  var KEY = 'mk_src_v1';

  var TYPES = {
    contact:     { label: '접수', event: 'lead_contact',     ga: 'generate_lead' },
    doc_request: { label: '자료', event: 'lead_doc_request', ga: 'generate_lead' },
    subscribe:   { label: '구독', event: 'lead_subscribe',   ga: 'sign_up' }
  };

  var PARAMS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
                'gclid','gbraid','wbraid','fbclid','naver_ad','kakao_ad','promo'];

  function capture() {
    try {
      var p = new URLSearchParams(w.location.search), out = [];
      PARAMS.forEach(function (k) { var v = p.get(k); if (v) out.push(k + '=' + v); });
      if (!out.length && d.referrer && d.referrer.indexOf(w.location.hostname) === -1) {
        out.push('ref=' + d.referrer);
      }
      return out.join(' · ');
    } catch (e) { return ''; }
  }

  /* 세션 내 "최초 유입"을 보존 — 광고로 들어와 다른 페이지에서 신청해도 출처가 남는다 */
  function source() {
    var cur = capture(), saved = '';
    try { saved = w.sessionStorage.getItem(KEY) || ''; } catch (e) {}
    if (!saved && cur) { saved = cur; try { w.sessionStorage.setItem(KEY, cur); } catch (e) {} }
    return saved || cur || 'direct';
  }

  function subject(type, title) {
    var t = TYPES[type] || TYPES.contact;
    return '[모넷·' + t.label + '] ' + (title || '');
  }

  /* payload 에 공통 필드와 제목 규격을 채워 돌려준다 (전송은 하지 않는다) */
  function build(type, page, title, payload) {
    var t = TYPES[type] || TYPES.contact;
    payload = payload || {};
    if (!payload['_subject'])     payload['_subject'] = subject(type, title);
    if (!payload['접수 유형'])     payload['접수 유형'] = t.label;
    if (!payload['접점'])         payload['접점'] = page || '';
    if (!payload['출처'])         payload['출처'] = source();
    if (!payload['유입 페이지'])   payload['유입 페이지'] = String(w.location.href).split('#')[0];
    return payload;
  }

  /* 전송이 성공한 뒤에 호출한다 — 실패 건이 전환으로 잡히지 않게 */
  function track(type, detail) {
    var t = TYPES[type] || TYPES.contact;
    detail = detail || {};
    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: t.event,
        lead_type: type,
        lead_page: detail.page || '',
        lead_interest: detail.interest || ''
      });
    } catch (e) {}
    try {
      if (w.gtag) w.gtag('event', t.ga, {
        lead_type: type, form: detail.page || '', item_name: detail.interest || '',
        currency: 'KRW', value: 1
      });
    } catch (e) {}
    try { if (w.clarity) w.clarity('event', t.event); } catch (e) {}
  }

  try { source(); } catch (e) {}   /* 진입 즉시 출처 저장 */

  w.MonnitLead = { TYPES: TYPES, source: source, subject: subject, build: build, track: track };
  if (!w.MK_SOURCE) w.MK_SOURCE = source;
})(window, document);
