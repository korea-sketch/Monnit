/*!
 * Monnit Korea — WHY MONNIT 배경 롤링
 * 기존 섹션 모양은 그대로 두고, 배경 사진만 일정 간격으로 크로스페이드 전환.
 * · 전환 간격: .nh-why-bg 의 data-roll-interval (기본 5600ms)
 * · 탭이 백그라운드이거나 섹션이 화면 밖이면 정지
 * · 다음 장은 미리 로드, 나머지는 lazy 유지
 * · SPA 라우팅으로 홈이 다시 그려져도 자동 재초기화
 */
(function () {
  'use strict';

  var DEFAULT_INTERVAL = 5600;

  function init(bg) {
    if (!bg || bg.dataset.rollReady === '1') return;

    var slides = Array.prototype.slice.call(bg.querySelectorAll('.nh-roll-slide'));
    if (slides.length < 2) return;

    bg.dataset.rollReady = '1';
    bg.classList.add('is-roll');

    var interval = parseInt(bg.getAttribute('data-roll-interval'), 10) || DEFAULT_INTERVAL;
    var idx = Math.max(0, slides.findIndex(function (s) { return s.classList.contains('is-active'); }));
    var visible = true;

    slides.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
    warm(idx + 1);

    /* 차례가 오기 직전 한 장만 실제로 내려받습니다.
       2번째 이후 슬라이드는 HTML 에 data-src 로만 적혀 있어, 여기서 src 를 채우기 전까지
       네트워크 요청이 발생하지 않습니다. (예전 warm 은 loading 속성만 바꿔 효과가 없었음) */
    function warm(n) {
      var s = slides[n % slides.length];
      var img = s && s.querySelector('img');
      if (!img) return;
      var src = img.getAttribute('data-src');
      if (src && !img.getAttribute('src')) {
        img.setAttribute('src', src);
        img.removeAttribute('data-src');
        img.setAttribute('loading', 'eager');
      }
    }

    function next() {
      if (document.hidden || !visible) return;
      idx = (idx + 1) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
      warm(idx + 1);
    }

    setInterval(next, interval);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 }).observe(bg);
    }
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('.nh-why-bg'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('hashchange', function () { setTimeout(boot, 120); });
  window.addEventListener('popstate', function () { setTimeout(boot, 120); });
  window.MonnitWhyRoll = { refresh: boot };
})();
