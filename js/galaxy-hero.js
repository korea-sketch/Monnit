/*!
 * Monnit Korea — Galaxy Hero (About us / Who we are 배경)
 * ---------------------------------------------------------------------------
 * 무엇을 그리는가
 *
 *   깊이가 다른 별 4개 층(layer)을 겹쳐 그립니다. 각 층은 격자로 나뉘고 칸마다
 *   해시로 별 하나를 배치합니다. 층마다 스케일이 달라서 — 가까운 층은 성기고 크게,
 *   먼 층은 촘촘하고 작게 — 전체가 아주 느리게 회전할 때 깊이 시차가 생깁니다.
 *   별은 저마다 다른 주기로 반짝이고(twinkle), 큰 별에는 십자 플레어가 붙습니다.
 *
 * ---------------------------------------------------------------------------
 * 원본 셰이더: React Bits `<Galaxy />` (React + ogl)
 * 이 파일: React·ogl·TypeScript 없이 WebGL1 + DOM 으로 포팅.
 *          외부 의존성 0, 전역 오염 없음(단일 IIFE, window.MonnitGalaxyHero 만 노출).
 *
 * 원본과 달라진 점
 *   1) 팔레트를 Monnit 블루로. hueShift 215° + saturation 0.45 로 청백색 별이
 *      되게 했습니다. 원본 기본값(140°)은 초록이라 페이지와 맞지 않습니다.
 *   2) 회전 속도를 0.1 → 0.03 으로. 히어로 뒤에서 계속 도는 배경은 0.1 이면
 *      글을 읽는 동안 눈에 걸립니다.
 *   3) mouseRepulsion 을 끄고 미세 패럴랙스만 남겼습니다. 커서가 별을 밀어내는
 *      연출은 카피가 얹힌 히어로에서는 산만합니다.
 *   4) 검정 대신 페이지 배경(#05070E) 위에 가산 합성합니다.
 *   5) 프래그먼트당 4층 × 9칸 = 36회 별 계산이라 비용이 해상도에 정비례합니다.
 *      DPR 상한과 renderScale 로 픽셀 수를 눌렀습니다.
 *
 * 자동 마운트:  <figure data-galaxy-hero>...</figure>  → 자동으로 캔버스 삽입
 * 수동 사용:    var h = MonnitGalaxyHero.mount(el, { density: 1.4 });  h.destroy();
 *
 * 안전장치: prefers-reduced-motion(정지 프레임 1장) / 탭 비활성 / 화면 밖 →
 *          자동 정지. WebGL 미지원이나 컨텍스트 유실 시 아무것도 하지 않고
 *          원래 정적 이미지와 CSS 배경만 남습니다.
 */
(function () {
  'use strict';

  /* ── 셰이더 ───────────────────────────────────────────────────────────── */

  var VERT = [
    'attribute vec2 position;',
    'varying vec2 vUv;',
    'void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',

    'uniform float uTime;',
    'uniform vec2  uResolution;',
    'uniform vec2  uFocal;',
    'uniform vec2  uRotation;',
    'uniform float uStarSpeed;',
    'uniform float uDensity;',
    'uniform float uHueShift;',
    'uniform float uSpeed;',
    'uniform vec2  uMouse;',
    'uniform float uGlowIntensity;',
    'uniform float uSaturation;',
    'uniform float uTwinkleIntensity;',
    'uniform float uRotationSpeed;',
    'uniform float uParallax;',
    'uniform float uMouseActiveFactor;',
    'uniform vec3  uBg0;',        /* 중심 */
    'uniform vec3  uBg1;',        /* 42% */
    'uniform vec3  uBg2;',        /* 가장자리 */
    'uniform vec2  uBgCenter;',
    'uniform float uBgRadius;',
    'uniform vec3  uTint;',
    'varying vec2 vUv;',

    '#define NUM_LAYER 4.0',
    '#define STAR_COLOR_CUTOFF 0.2',
    '#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)',
    '#define PERIOD 3.0',

    'float Hash21(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    'float tri(float x){ return abs(fract(x) * 2.0 - 1.0); }',
    'float tris(float x){ float t = fract(x); return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0)); }',
    'float trisn(float x){ float t = fract(x); return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0; }',

    'vec3 hsv2rgb(vec3 c){',
    '  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
    '  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
    '  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
    '}',

    /* 별 하나: 중심 광점 + 십자 플레어(45도 겹침) */
    'float Star(vec2 uv, float flare){',
    '  float d = length(uv);',
    '  float m = (0.05 * uGlowIntensity) / d;',
    '  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));',
    '  m += rays * flare * uGlowIntensity;',
    '  uv *= MAT45;',
    '  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));',
    '  m += rays * 0.3 * flare * uGlowIntensity;',
    '  m *= smoothstep(1.0, 0.2, d);',
    '  return m;',
    '}',

    'vec3 StarLayer(vec2 uv){',
    '  vec3 col = vec3(0.0);',
    '  vec2 gv = fract(uv) - 0.5;',
    '  vec2 id = floor(uv);',
    '  for (int y = -1; y <= 1; y++){',
    '    for (int x = -1; x <= 1; x++){',
    '      vec2 offset = vec2(float(x), float(y));',
    '      vec2 si = id + offset;',
    '      float seed = Hash21(si);',
    '      float size = fract(seed * 345.32);',
    '      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));',
    '      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;',
    '      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;',
    '      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;',
    '      float grn = min(red, blu) * seed;',
    '      vec3 base = vec3(red, grn, blu);',
    '      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;',
    '      hue = fract(hue + uHueShift / 360.0);',
    '      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;',
    '      float val = max(max(base.r, base.g), base.b);',
    '      base = hsv2rgb(vec3(hue, sat, val));',
    '      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0),',
    '                      tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;',
    '      float star = Star(gv - offset - pad, flareSize);',
    '      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;',
    '      twinkle = mix(1.0, twinkle, uTwinkleIntensity);',
    '      star *= twinkle;',
    '      col += star * size * base;',
    '    }',
    '  }',
    '  return col;',
    '}',

    'void main(){',
    '  vec2 focalPx = uFocal * uResolution.xy;',
    '  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;',
    /* 원본의 반발(repulsion) 대신 아주 얕은 패럴랙스만. 카피 위에서 산만하지 않게. */
    '  uv += (uMouse - vec2(0.5)) * uParallax * uMouseActiveFactor;',
    '  float a = uTime * uRotationSpeed;',
    '  uv = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv;',
    '  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;',
    '  vec3 col = vec3(0.0);',
    '  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER){',
    '    float depth = fract(i + uStarSpeed * uSpeed);',
    '    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);',
    '    float fade  = depth * smoothstep(1.0, 0.9, depth);',
    '    col += StarLayer(uv * scale + i * 453.32) * fade;',
    '  }',
    '  col *= uTint;',
    /* 배경: images/about-hero-pulse.svg 의 radialGradient 를 그대로 재현합니다.
       폴백 이미지에서 캔버스로 넘어갈 때 바탕색이 튀지 않게 하려는 것입니다.
       SVG 는 objectBoundingBox 단위라 종횡비 보정을 하지 않습니다 — 원이 아니라
       박스에 맞춰 늘어난 타원이 되어야 원본과 같아집니다. */
    '  float r = length(vUv - uBgCenter) / uBgRadius;',
    '  vec3 bg = r < 0.42 ? mix(uBg0, uBg1, r / 0.42)',
    '                     : mix(uBg1, uBg2, clamp((r - 0.42) / 0.58, 0.0, 1.0));',
    '  vec3 outc = clamp(bg + col, 0.0, 1.0);',
    /* 8bit 어두운 남색에서 생기는 띠 제거용 미세 디더 */
    '  float dit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;',
    '  gl_FragColor = vec4(outc + dit / 255.0, 1.0);',
    '}'
  ].join('\n');

  /* ── 기본값 ───────────────────────────────────────────────────────────── */

  var DEFAULTS = {
    focal: [0.5, 0.5],
    rotation: [1.0, 0.0],
    starSpeed: 0.35,        // 층이 흘러가는 속도
    density: 1.08,          // 별 밀도. 클수록 촘촘하고 작아진다
    hueShift: 215,          // Monnit 블루. 원본 기본 140°(초록) 대신
    /* 셰이더는 별마다 base 색에서 hue 를 따로 뽑아 shift 를 더합니다. 그래서
       saturation 을 올리면 주황·자주 별이 섞여 브랜드 톤이 깨집니다. 0.18 로
       낮춰 청백색만 남기고, 전체 색조는 아래 tint 가 담당하게 했습니다. */
    saturation: 0.18,
    glowIntensity: 0.32,
    twinkleIntensity: 0.35,
    rotationSpeed: 0.03,    // 히어로 배경용으로 원본(0.1)보다 훨씬 느리게
    speed: 0.85,
    parallax: 0.10,         // 포인터 패럴랙스 폭
    tint: '#BFD6F2',        // 별빛 전체에 곱해지는 색
    /* 배경 3-스톱. images/about-hero-pulse.svg 의 #bgrad 와 같은 값입니다. */
    bg0: '#0E1A2E', bg1: '#0A1220', bg2: '#05080F',
    bgCenter: [0.72, 0.56],   // SVG 의 cx 72% / cy 44% (셰이더는 y 가 위로 향함)
    bgRadius: 0.82,
    renderScale: 1,         // 1 미만이면 저해상도로 그려 CSS 가 확대(가벼움)
    maxDPR: 1.6,
    interactive: true,
    paused: false
  };

  /* ── 유틸 ─────────────────────────────────────────────────────────────── */

  function toRGB(color) {
    var c = String(color || '').trim();
    if (c.charAt(0) === '#') {
      var hex = c.slice(1);
      var full = hex.length === 3
        ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
        : hex.slice(0, 6);
      var n = parseInt(full, 16);
      if (isNaN(n)) return [1, 1, 1];
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    var m = c.match(/(\d+(?:\.\d+)?)/g);
    if (m && m.length >= 3) return [+m[0] / 255, +m[1] / 255, +m[2] / 255];
    return [1, 1, 1];
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
    return sh;
  }

  /* ── 인스턴스 ─────────────────────────────────────────────────────────── */

  function mount(host, userOptions) {
    if (!host) return null;
    if (host.__galaxyHero) return host.__galaxyHero;

    var C = {}, key;
    for (key in DEFAULTS) if (DEFAULTS.hasOwnProperty(key)) C[key] = DEFAULTS[key];
    if (userOptions) {
      for (key in userOptions) {
        if (userOptions.hasOwnProperty(key) && userOptions[key] !== undefined) C[key] = userOptions[key];
      }
    }

    var canvas = document.createElement('canvas');
    canvas.className = 'oh-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    var glOpts = { alpha: false, antialias: false, depth: false, stencil: false,
                   premultipliedAlpha: false, powerPreference: 'low-power' };
    var gl = null;
    try {
      gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
    } catch (e) { gl = null; }
    if (!gl) return null;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uTime', 'uResolution', 'uFocal', 'uRotation', 'uStarSpeed', 'uDensity', 'uHueShift',
     'uSpeed', 'uMouse', 'uGlowIntensity', 'uSaturation', 'uTwinkleIntensity',
     'uRotationSpeed', 'uParallax', 'uMouseActiveFactor',
     'uBg0', 'uBg1', 'uBg2', 'uBgCenter', 'uBgRadius', 'uTint'
    ].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    host.insertBefore(canvas, host.firstChild);
    host.classList.add('oh-on');

    var reduced = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var width = 0, height = 0;
    var t = reduced ? 6.0 : 0;
    var lastFrame = 0;
    var running = true, visible = true, lost = false, raf = 0, ready = false;
    var mx = 0.5, my = 0.5, smx = 0.5, smy = 0.5, act = 0, actT = 0;

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return false;
      var dpr = Math.min(window.devicePixelRatio || 1, C.maxDPR) * C.renderScale;
      var pw = Math.max(1, Math.round(w * dpr));
      var ph = Math.max(1, Math.round(h * dpr));
      if (pw === width && ph === height) return true;
      width = pw; height = ph;
      canvas.width = pw; canvas.height = ph;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      gl.viewport(0, 0, pw, ph);
      return true;
    }

    function render() {
      if (lost) return;
      gl.useProgram(prog);
      gl.uniform1f(U.uTime, t);
      gl.uniform2f(U.uResolution, width, height);
      gl.uniform2f(U.uFocal, C.focal[0], C.focal[1]);
      gl.uniform2f(U.uRotation, C.rotation[0], C.rotation[1]);
      /* 원본과 동일: uStarSpeed 는 매 프레임 시간에서 다시 계산된다 */
      gl.uniform1f(U.uStarSpeed, t * C.starSpeed / 10.0);
      gl.uniform1f(U.uDensity, C.density);
      gl.uniform1f(U.uHueShift, C.hueShift);
      gl.uniform1f(U.uSpeed, C.speed);
      gl.uniform2f(U.uMouse, smx, smy);
      gl.uniform1f(U.uGlowIntensity, C.glowIntensity);
      gl.uniform1f(U.uSaturation, C.saturation);
      gl.uniform1f(U.uTwinkleIntensity, C.twinkleIntensity);
      gl.uniform1f(U.uRotationSpeed, C.rotationSpeed);
      gl.uniform1f(U.uParallax, C.parallax);
      gl.uniform1f(U.uMouseActiveFactor, act);
      var b0 = toRGB(C.bg0), b1 = toRGB(C.bg1), b2 = toRGB(C.bg2), tint = toRGB(C.tint);
      gl.uniform3f(U.uBg0, b0[0], b0[1], b0[2]);
      gl.uniform3f(U.uBg1, b1[0], b1[1], b1[2]);
      gl.uniform3f(U.uBg2, b2[0], b2[1], b2[2]);
      gl.uniform2f(U.uBgCenter, C.bgCenter[0], C.bgCenter[1]);
      gl.uniform1f(U.uBgRadius, C.bgRadius);
      gl.uniform3f(U.uTint, tint[0], tint[1], tint[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!ready) { ready = true; host.classList.add('oh-ready'); }
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible || C.paused || lost) { lastFrame = 0; return; }
      if (!resize()) return;
      if (!lastFrame) lastFrame = now;
      var dt = Math.min((now - lastFrame) * 0.001, 0.05);
      lastFrame = now;
      t += dt;
      var k = Math.min(dt * 3.0, 1);
      smx += (mx - smx) * k;
      smy += (my - smy) * k;
      act += (actT - act) * k;
      render();
    }

    function onPointer(ev) {
      if (!C.interactive) return;
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      mx = (ev.clientX - r.left) / r.width;
      my = 1.0 - (ev.clientY - r.top) / r.height;
      actT = 1;
    }
    function onLeave() { actT = 0; }

    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () { resize(); if (reduced || C.paused) render(); });
      ro.observe(host);
    } else {
      window.addEventListener('resize', resize);
    }

    var io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(function (e) {
        visible = e[0] ? e[0].isIntersecting : true;
        if (!visible) lastFrame = 0;
      }, { threshold: 0 });
      io.observe(host);
    }

    function onVisibility() { visible = !document.hidden; lastFrame = 0; }
    document.addEventListener('visibilitychange', onVisibility);
    host.addEventListener('pointermove', onPointer);
    host.addEventListener('pointerleave', onLeave);

    function onLost(ev) {
      ev.preventDefault();
      lost = true; running = false;
      cancelAnimationFrame(raf);
      host.classList.remove('oh-ready');   // 정적 이미지가 다시 올라온다
    }
    canvas.addEventListener('webglcontextlost', onLost, false);

    if (reduced) {
      running = false;
      if (resize()) render();
    } else {
      raf = requestAnimationFrame(frame);
    }

    var api = {
      el: host,
      set: function (patch) {
        for (var k in patch) if (patch.hasOwnProperty(k)) C[k] = patch[k];
        width = 0;                       // 다음 프레임에 강제 리사이즈
        if (!running || C.paused) { resize(); render(); }
      },
      destroy: function () {
        running = false;
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        host.removeEventListener('pointermove', onPointer);
        host.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('webglcontextlost', onLost);
        try {
          var ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        } catch (e) {}
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        host.classList.remove('oh-on', 'oh-ready');
        host.__galaxyHero = null;
      }
    };
    host.__galaxyHero = api;
    return api;
  }

  /* ── 반응형 프리셋 ──────────────────────────────────────────────────────
     별밭은 화면을 가득 채우므로 위치가 아니라 밀도·비용을 조절한다.
     좁은 화면에서는 같은 density 라도 별이 더 촘촘해 보이므로 낮춘다.
     저사양에서는 renderScale 로 픽셀 수 자체를 줄인다 — 이 셰이더는
     프래그먼트당 4층 × 9칸을 돌기 때문에 해상도가 곧 비용이다. */
  function presetFor(narrow, lowPower) {
    return {
      focal: narrow ? [0.5, 0.42] : [0.62, 0.5],
      density: narrow ? 0.90 : 1.08,
      glowIntensity: narrow ? 0.28 : 0.32,
      parallax: narrow ? 0 : 0.10,
      interactive: !narrow,
      renderScale: lowPower ? 0.7 : (narrow ? 0.85 : 1),
      maxDPR: lowPower ? 1.25 : 1.6
    };
  }

  function isLowPower() {
    try {
      var mem = navigator.deviceMemory;
      var cores = navigator.hardwareConcurrency;
      if (typeof mem === 'number' && mem <= 4) return true;
      if (typeof cores === 'number' && cores <= 4) return true;
    } catch (e) {}
    return false;
  }

  /* ── 자동 마운트 ───────────────────────────────────────────────────── */

  function autoMount(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-galaxy-hero]');
    var narrowMQ = window.matchMedia('(max-width: 767px)');
    var low = isLowPower();

    Array.prototype.forEach.call(nodes, function (el) {
      if (el.__galaxyHero) return;
      var custom = {};
      var raw = el.getAttribute('data-galaxy-hero');
      if (raw && raw.trim().charAt(0) === '{') {
        try { custom = JSON.parse(raw); } catch (e) { custom = {}; }
      }
      var opts = presetFor(narrowMQ.matches, low);
      for (var k in custom) if (custom.hasOwnProperty(k)) opts[k] = custom[k];
      var inst = mount(el, opts);
      if (!inst) return;   // WebGL 미지원 → 정적 이미지가 그대로 남는다

      var onChange = function () {
        var next = presetFor(narrowMQ.matches, low);
        for (var k2 in custom) if (custom.hasOwnProperty(k2)) next[k2] = custom[k2];
        inst.set(next);
      };
      if (narrowMQ.addEventListener) narrowMQ.addEventListener('change', onChange);
      else if (narrowMQ.addListener) narrowMQ.addListener(onChange);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { autoMount(); });
  } else {
    autoMount();
  }
  /* 이 사이트는 app.js 가 .view 를 껐다 켜는 SPA 입니다. About 뷰가 숨겨진 채로
     마운트되면 clientWidth 가 0 이라 첫 프레임을 못 그립니다. 그 상태는
     IntersectionObserver·ResizeObserver 가 알아서 복구하지만, 라우팅으로 뷰가
     나중에 DOM 에 들어오는 경우를 대비해 한 번 더 훑습니다. */
  window.addEventListener('hashchange', function () { setTimeout(autoMount, 150); });
  window.addEventListener('popstate',  function () { setTimeout(autoMount, 150); });

  window.MonnitGalaxyHero = { mount: mount, autoMount: autoMount };
})();
