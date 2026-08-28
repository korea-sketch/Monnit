/*!
 * Monnit Korea · 쿠키 동의 관리 (Google Consent Mode v2)
 * ---------------------------------------------------------------------------
 * · 동의 전에는 광고·분석 쿠키를 저장하지 않습니다 (기본값 denied).
 * · Google Tag Manager / GA4 는 동의모드를 지원하므로 로드는 하되,
 *   동의 전에는 쿠키 없이 익명 신호만 보냅니다.
 * · Microsoft Clarity 는 동의모드가 없으므로 동의 전에는 아예 로드하지 않습니다.
 * · 개인정보보호법(대한민국) · GDPR(EU) 의 옵트인 원칙에 맞춘 구성입니다.
 *
 * 사용법 — <head> 안, GTM 스니펫보다 "먼저" 넣으세요.
 *   <script>window.MONNIT_CONSENT_CONFIG={gtmId:'GTM-T8H73VW',ga4Id:'G-49THHRYKR4',clarityId:'x38egtft64'};</script>
 *   <script src="/js/monnit-consent.js"></script>
 *
 * 재설정: 화면 어디서든 MonnitConsent.open() 호출 (푸터 '쿠키 설정' 링크 등)
 */
(function (w, d) {
  'use strict';
  var CFG = w.MONNIT_CONSENT_CONFIG || {};
  var GTM_ID     = CFG.gtmId     || 'GTM-T8H73VW';
  var GA4_ID     = CFG.ga4Id     || 'G-49THHRYKR4';
  var CLARITY_ID = CFG.clarityId || 'x38egtft64';
  var STORE_KEY  = 'mnk_cookie_consent_v1';
  var VERSION    = 1;
  var PRIVACY_URL = CFG.privacyUrl || '/privacy.html';

  /* ── 저장/불러오기 ───────────────────────────────────────────── */
  function load() {
    try {
      var raw = w.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== VERSION) return null;
      return o;
    } catch (e) { return null; }
  }
  function save(state) {
    var o = { v: VERSION, analytics: !!state.analytics, marketing: !!state.marketing, ts: new Date().toISOString() };
    try { w.localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch (e) {}
    return o;
  }

  /* ── Google Consent Mode v2 ─────────────────────────────────── */
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;

  var saved = load();
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    personalization_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 600
  });

  function pushConsent(state) {
    gtag('consent', 'update', {
      analytics_storage: state.analytics ? 'granted' : 'denied',
      ad_storage: state.marketing ? 'granted' : 'denied',
      ad_user_data: state.marketing ? 'granted' : 'denied',
      ad_personalization: state.marketing ? 'granted' : 'denied',
      personalization_storage: state.marketing ? 'granted' : 'denied'
    });
    w.dataLayer.push({
      event: 'cookie_consent_update',
      consent_analytics: !!state.analytics,
      consent_marketing: !!state.marketing
    });
  }

  /* ── 스크립트 로더 ──────────────────────────────────────────── */
  var loaded = { gtm: false, ga4: false, clarity: false };
  function inject(src, attrs) {
    var s = d.createElement('script'); s.async = true; s.src = src;
    if (attrs) for (var k in attrs) s.setAttribute(k, attrs[k]);
    (d.head || d.getElementsByTagName('script')[0].parentNode).appendChild(s);
  }
  function loadGoogle() {
    if (!loaded.gtm && GTM_ID) {
      loaded.gtm = true;
      w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      inject('https://www.googletagmanager.com/gtm.js?id=' + GTM_ID);
    }
    if (!loaded.ga4 && GA4_ID) {
      loaded.ga4 = true;
      inject('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID);
      gtag('js', new Date());
      gtag('config', GA4_ID, { anonymize_ip: true });
    }
  }
  function loadClarity() {
    if (loaded.clarity || !CLARITY_ID) return;
    loaded.clarity = true;
    w.clarity = w.clarity || function () { (w.clarity.q = w.clarity.q || []).push(arguments); };
    inject('https://www.clarity.ms/tag/' + CLARITY_ID);
  }

  /* ── 상태 적용 ──────────────────────────────────────────────── */
  function apply(state, persist) {
    if (persist !== false) save(state);
    pushConsent(state);
    loadGoogle();                       // 동의모드를 따르므로 항상 로드 (거부 시 쿠키 미저장)
    if (state.analytics) loadClarity(); // Clarity 는 동의했을 때만 로드
    w.MonnitConsent.state = { analytics: !!state.analytics, marketing: !!state.marketing };
    try { w.dispatchEvent(new CustomEvent('monnit:consent', { detail: w.MonnitConsent.state })); } catch (e) {}
  }

  /* ── UI ─────────────────────────────────────────────────────── */
  var CSS = [
    '.mnk-cc,.mnk-cc *{box-sizing:border-box}',
    '.mnk-cc{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;',
    'background:rgba(8,12,20,.62);backdrop-filter:blur(4px);opacity:0;transition:opacity .22s ease;',
    "font-family:'Pretendard',-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}",
    '.mnk-cc.show{opacity:1}',
    '.mnk-cc-box{width:100%;max-width:560px;max-height:86vh;overflow-y:auto;background:#fff;color:#1b2437;',
    'border-radius:14px;box-shadow:0 26px 70px rgba(0,0,0,.4);padding:30px 28px;line-height:1.62;',
    'transform:translateY(14px);transition:transform .24s cubic-bezier(.22,1,.36,1)}',
    '.mnk-cc.show .mnk-cc-box{transform:none}',
    '.mnk-cc-box h2{font-size:22px;font-weight:800;margin:0 0 14px;letter-spacing:-.02em;color:#111}',
    '.mnk-cc-box p{font-size:14px;margin:0 0 12px;color:#39404f;word-break:keep-all}',
    '.mnk-cc-box a.lnk{color:#1567d6;text-decoration:underline}',
    '.mnk-cc-btns{display:flex;flex-direction:column;gap:9px;margin-top:20px}',
    '.mnk-cc-btn{display:block;width:100%;padding:14px 16px;border-radius:9px;font-size:15px;font-weight:700;',
    'cursor:pointer;border:0;font-family:inherit;text-align:center;transition:.15s}',
    '.mnk-cc-btn-main{background:#2f7d32;color:#fff}.mnk-cc-btn-main:hover{background:#276b2a}',
    '.mnk-cc-btn-sub{background:#2f7d32;color:#fff}.mnk-cc-btn-sub:hover{background:#276b2a}',
    '.mnk-cc-btn-ghost{background:#fff;color:#2f7d32;border:1.5px solid #2f7d32}',
    '.mnk-cc-btn-ghost:hover{background:#f3faf3}',
    '.mnk-cc-grp{border-top:1px solid #e4e8ef;padding:16px 0 4px}',
    '.mnk-cc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:9px 0}',
    '.mnk-cc-row .t{flex:1;min-width:0}',
    '.mnk-cc-row .t b{display:block;font-size:15px;font-weight:700;color:#1b2437}',
    '.mnk-cc-row .t small{display:block;font-size:12.5px;color:#69707f;margin-top:3px;word-break:keep-all}',
    '.mnk-cc-sw{flex:0 0 auto;position:relative;width:52px;height:29px;border-radius:99px;background:#d6dae2;',
    'border:0;cursor:pointer;transition:background .18s;padding:0}',
    '.mnk-cc-sw::after{content:"";position:absolute;top:3px;left:3px;width:23px;height:23px;border-radius:50%;',
    'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s}',
    '.mnk-cc-sw[aria-checked="true"]{background:#2f7d32}',
    '.mnk-cc-sw[aria-checked="true"]::after{transform:translateX(23px)}',
    '.mnk-cc-sw[disabled]{background:#2f7d32;opacity:.55;cursor:not-allowed}',
    '.mnk-cc-gh{font-size:16px;font-weight:800;color:#111;margin:0 0 2px}',
    '.mnk-cc-note{font-size:11.5px;color:#79808f;margin-top:14px;line-height:1.6}',
    '.mnk-cc-tools{font-size:12px;color:#69707f;margin:6px 0 0;padding-left:16px}',
    '.mnk-cc-tools li{margin:2px 0}',
    '@media(max-width:520px){.mnk-cc-box{padding:24px 18px}.mnk-cc-box h2{font-size:19px}}',

    /* ── 1단계 · 하단 안내 배너 ─────────────────────────────── */
    '.mnk-cc.bar{align-items:flex-end;justify-content:center;padding:0;background:transparent;backdrop-filter:none;pointer-events:none}',
    '.mnk-cc.bar .mnk-cc-bar{pointer-events:auto;width:100%;max-width:none;background:#001b24;color:#eef7f8;',
    'border-top:1px solid rgba(0,201,192,.28);box-shadow:0 -14px 40px rgba(0,0,0,.45);',
    'padding:26px 28px 24px;transform:translateY(100%);transition:transform .3s cubic-bezier(.22,1,.36,1)}',
    '.mnk-cc.bar.show .mnk-cc-bar{transform:none}',
    '.mnk-cc-bar-in{max-width:1180px;margin:0 auto}',
    '.mnk-cc-bar h2{font-size:23px;font-weight:800;letter-spacing:-.03em;margin:0 0 12px;color:#fff}',
    '.mnk-cc-bar p{font-size:14.5px;line-height:1.75;color:#c3d9dd;margin:0 0 14px;word-break:keep-all;max-width:1000px}',
    '.mnk-cc-bar .lnks{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:20px}',
    '.mnk-cc-bar .lnks a,.mnk-cc-bar .lnks button{background:none;border:0;padding:0;font-family:inherit;cursor:pointer;',
    'font-size:14px;color:#4dd0c7;text-decoration:none}',
    '.mnk-cc-bar .lnks a:hover,.mnk-cc-bar .lnks button:hover{text-decoration:underline}',
    '.mnk-cc-bar .acts{display:grid;grid-template-columns:1fr 1fr;gap:16px}',
    '.mnk-cc-bar .acts button{padding:15px 18px;border:0;border-radius:3px;font-family:inherit;font-size:16px;',
    'font-weight:700;cursor:pointer;background:#00c9c0;color:#00232b;transition:.15s}',
    '.mnk-cc-bar .acts button:hover{background:#2ee0d7}',
    '@media(max-width:640px){.mnk-cc-bar{padding:22px 18px 20px}.mnk-cc-bar h2{font-size:19px}',
    '.mnk-cc-bar p{font-size:13.5px}.mnk-cc-bar .acts{grid-template-columns:1fr}}'
  ].join('');

  function ensureCss() {
    if (d.getElementById('mnk-cc-css')) return;
    var st = d.createElement('style'); st.id = 'mnk-cc-css'; st.textContent = CSS;
    (d.head || d.documentElement).appendChild(st);
  }
  function close() {
    var el = d.getElementById('mnk-cc');
    if (el) { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 240); }
  }
  function shell(html, asBar) {
    ensureCss(); close();
    var w2 = d.createElement('div');
    w2.id = 'mnk-cc'; w2.className = 'mnk-cc' + (asBar ? ' bar' : '');
    w2.setAttribute('role', 'dialog');
    if (!asBar) w2.setAttribute('aria-modal', 'true');
    w2.setAttribute('aria-label', '쿠키 사용 동의');
    w2.innerHTML = asBar
      ? '<div class="mnk-cc-bar"><div class="mnk-cc-bar-in">' + html + '</div></div>'
      : '<div class="mnk-cc-box">' + html + '</div>';
    d.body.appendChild(w2);
    requestAnimationFrame(function () { w2.classList.add('show'); });
    return w2;
  }

  /* 1단계 · 하단 안내 배너 */
  function banner() {
    var el = shell(
      '<h2>귀하의 개인정보를 소중히 여깁니다</h2>' +
      '<p>모든 쿠키 수락을 클릭하면 사이트 탐색 개선, 사이트 사용 분석, 마케팅 및 성능 향상을 위해 ' +
      '귀하의 기기에 쿠키를 저장하고 관련 데이터를 처리하는 데 동의하게 됩니다. ' +
      '수집된 정보는 분석·광고 목적으로 미국(Google LLC · Microsoft Corporation)으로 이전될 수 있습니다. ' +
      '<b>환경설정 관리</b> 버튼을 통해 언제든지 동의를 철회할 수 있습니다.</p>' +
      '<div class="lnks">' +
        '<a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">쿠키 공지</a>' +
        '<button type="button" data-act="settings">환경설정 관리</button>' +
      '</div>' +
      '<div class="acts">' +
        '<button type="button" data-act="necessary">쿠키 거부</button>' +
        '<button type="button" data-act="all">모든 쿠키 수락</button>' +
      '</div>',
      true   /* 하단 배너 모드 */
    );
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'settings') { settings(); return; }
      apply({ analytics: a === 'all', marketing: a === 'all' });
      close();
    });
  }

  /* 2단계 · 상세 설정 */
  function settings() {
    var cur = w.MonnitConsent.state || { analytics: false, marketing: false };
    function row(key, title, desc, on, locked) {
      return '<div class="mnk-cc-row"><div class="t"><b>' + title + '</b><small>' + desc + '</small></div>' +
        '<button class="mnk-cc-sw" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"' +
        (locked ? ' disabled aria-disabled="true"' : ' data-key="' + key + '"') +
        ' aria-label="' + title + '"></button></div>';
    }
    var el = shell(
      '<h2>환경설정 관리</h2>' +
      '<p>개별 쿠키를 활성화 및 비활성화합니다. 필수 쿠키는 사이트 작동에 반드시 필요하여 비활성화할 수 없습니다.</p>' +

      '<div class="mnk-cc-grp"><div class="mnk-cc-gh">필수 쿠키</div>' +
        row('necessary', '사이트 기본 동작', '언어 설정·쿠키 동의 상태 저장 등 사이트 이용에 반드시 필요합니다. 개인을 식별하지 않습니다.', true, true) +
      '</div>' +

      '<div class="mnk-cc-grp"><div class="mnk-cc-gh">분석</div>' +
        row('analytics', '방문 통계 분석', '어떤 페이지가 많이 읽히는지 익명 통계로 확인해 사이트를 개선합니다.', cur.analytics) +
        '<ul class="mnk-cc-tools"><li>Google Analytics 4 — 방문·이용 분석</li><li>Microsoft Clarity — 화면 이용 패턴 분석</li></ul>' +
      '</div>' +

      '<div class="mnk-cc-grp"><div class="mnk-cc-gh">광고 · 마케팅</div>' +
        row('marketing', '광고 성과 측정', '어떤 광고를 통해 방문하셨는지 측정하고, 관련성 높은 광고를 노출합니다.', cur.marketing) +
        '<ul class="mnk-cc-tools"><li>Google Tag Manager — 태그 관리</li><li>Google Ads — 전환 측정 및 리마케팅</li></ul>' +
      '</div>' +

      '<div class="mnk-cc-btns">' +
        '<button class="mnk-cc-btn mnk-cc-btn-main" data-act="save">환경설정 저장</button>' +
        '<button class="mnk-cc-btn mnk-cc-btn-sub" data-act="all">모든 쿠키 수락</button>' +
      '</div>' +
      '<p class="mnk-cc-note">국외 이전: Google LLC · Microsoft Corporation (미국) — 쿠키·이용기록·기기정보·IP / 웹 분석 및 광고 전환 측정 / 각 사업자 정책에 따름<br>' +
      '자세한 내용은 <a class="lnk" href="' + PRIVACY_URL + '" target="_blank" rel="noopener">개인정보처리방침</a>을 참조하세요.</p>'
    );
    var draft = { analytics: cur.analytics, marketing: cur.marketing };
    el.addEventListener('click', function (e) {
      var sw = e.target.closest('.mnk-cc-sw[data-key]');
      if (sw) {
        var k = sw.getAttribute('data-key');
        draft[k] = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', draft[k] ? 'true' : 'false');
        return;
      }
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.getAttribute('data-act') === 'all') draft = { analytics: true, marketing: true };
      apply(draft); close();
    });
  }

  /* ── 공개 API ───────────────────────────────────────────────── */
  w.MonnitConsent = {
    state: saved ? { analytics: !!saved.analytics, marketing: !!saved.marketing } : { analytics: false, marketing: false },
    open: settings,
    reset: function () { try { w.localStorage.removeItem(STORE_KEY); } catch (e) {} location.reload(); },
    hasDecided: function () { return !!load(); }
  };

  /* ── 모바일 판별 ─────────────────────────────────────────────
     모바일에서는 첫 화면을 가리지 않도록 동의 배너를 띄우지 않습니다.
     · 동의 상태는 여전히 'denied'(옵트인 전) 로 유지되므로 광고·분석 쿠키는 저장되지 않습니다.
     · 사용자는 푸터의 '쿠키 설정' 링크로 언제든 직접 설정할 수 있습니다.
     · 배너를 모바일에서도 다시 켜려면 아래 CFG.mobileBanner 를 true 로 두세요.
       (예: window.MONNIT_CONSENT_CONFIG={..., mobileBanner:true}) */
  function isMobile() {
    try {
      if (w.matchMedia && w.matchMedia('(max-width: 820px)').matches) return true;
      if (/Android|iPhone|iPad|iPod|Windows Phone|Mobile|Silk|Opera Mini/i.test(navigator.userAgent || '')) return true;
      // iPadOS 13+ 는 UA 가 Mac 으로 보고되므로 터치 지원 여부로 보완
      if (/Macintosh/.test(navigator.userAgent || '') && (navigator.maxTouchPoints || 0) > 1) return true;
    } catch (e) {}
    return false;
  }
  var SHOW_BANNER_ON_MOBILE = CFG.mobileBanner === true;

  function boot() {
    if (saved) { apply(saved, false); }        // 기존 동의 재적용 (재저장 없음)
    else if (isMobile() && !SHOW_BANNER_ON_MOBILE) {
      loadGoogle();                            // 모바일: 배너 없이 denied 상태로만 로드 (쿠키 미저장)
    }
    else { loadGoogle(); banner(); }           // 미결정 → 동의모드 denied 상태로 로드 + 배너
    d.addEventListener('click', function (e) { // 푸터 '쿠키 설정' 링크
      var t = e.target.closest('[data-cookie-settings]');
      if (t) { e.preventDefault(); settings(); }
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
