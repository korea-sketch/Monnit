/*!
 * Monnit Korea — 히어로 배경 FX v2 (WebGL1 + Canvas2D, 무의존)
 * ─────────────────────────────────────────────────────────────
 * React Bits 컴포넌트 4종을 React·three·ogl 없이 순수 웹표준으로 옮겨 4겹으로 쌓았습니다.
 *
 *   L0  MoltenMetal   — 은은하게 깔리는 용융 금속 글로우 (아래쪽)
 *   L1  FloatingLines — 가운데 파동 한 벌만 쓴 선다발 (좌우 균형)
 *   L2  DigitFibers   — L1 과 "완전히 같은 파동 궤적"을 타는 숫자 파이버 가닥
 *   L3  Galaxy        — 여기저기 반짝이는 별빛·플레어 (위쪽, 절제해서)
 *
 * L2 는 L1 의 셰이더 수식을 자바스크립트로 역산해 같은 곡선 위에 숫자를 흘립니다.
 * 그래서 "선다발 중 몇 가닥만 숫자로 되어 있는" 것처럼 보입니다.
 *
 * 모바일 / 저사양 / prefers-reduced-motion / 탭 비활성 / 화면 밖 → 자동 정지·감축.
 * 실패하면 아무것도 하지 않고 CSS 그라데이션 배경만 남습니다.
 *
 * 튜닝: 브라우저 콘솔에서
 *   MonnitHeroFX.set({ linesGain: 0.8, moltenGain: 0.3 })
 *   MonnitHeroFX.dump()      // 현재 값을 JSON 으로 출력 → 이 파일 OPT 에 붙여넣기
 */
(function () {
  'use strict';

  var HOST_SEL = '.nh-hero-aurora';

  /* ══════════════════════════════════════════════════════════════
     튜닝값 — 미리보기(hero-fx-미리보기.html)에서 조정한 값을 여기에 반영합니다
     ══════════════════════════════════════════════════════════════ */
  var OPT = {
    /* ── 전체 ── */
    brightness   : 0.85,   // 전 레이어 공통 밝기
    copyDim      : 0,   // 헤드라인 뒤 어둡게 (0=완전히 지움, 1=안 낮춤)
    copyCenterX  : 0.37,   // 헤드라인 블록 중심 (0=좌단, 1=우단)
    copyCenterY  : 0.46,
    copyRadiusX  : 0.14,
    copyRadiusY  : 0.29,

    /* ── L1 FloatingLines ── */
    linesGain    : 1.19,
    lineSpeed    : 0.52,
    lineCount    : 6,     // 가닥 수 (셰이더 상한 40)
    lineDistance : 0.002,   // 가닥별 가로 밀림 — 크면 다발이 비스듬해집니다
    lineSpread   : 0,  // 가닥별 세로 간격 — 나란한 다발을 만드는 값
    phaseStep    : 0.13,   // 가닥별 위상차 — 작을수록 나란히, 크면 사선으로 흐릅니다
    waveX        : -7.4,    // middleWavePosition
    waveY        : 0.08,
    waveRot      : -0.04,   // 로그 나선 휘감기 — 0.20 은 화면이 통째로 기울어 보였습니다
    bendRadius   : 9.9,
    bendStrength : -1.45,
    parallax     : 0.4,    // 0 이면 시차 이동 끔
    lineStops    : ['#0E2A6E', '#1F55E0', '#4FC3FF', '#8B44F0', '#C46BFF'],

    /* ── L0 MoltenMetal ── */
    moltenGain   : 0,   // "은은하게" — 원본 opacity 1.0 을 0.3 으로 눌렀습니다
    moltenSpeed  : 0.39,
    moltenScale  : 3.4,
    moltenDetail : 2,
    moltenGlow   : 1.6,
    moltenCore   : 0.1,
    moltenSwirl  : 1,
    moltenFold   : -0.2,
    moltenBlack  : 0.05,
    moltenBright : 1.3,
    moltenGrain  : 0.05,
    moltenMouse  : 0.3,
    moltenC1     : '#294cff',
    moltenC2     : '#debdff',
    moltenC3     : '#FFFFFF',

    /* ── L3 Galaxy ── */
    galaxyGain      : 0.55,
    galaxyDensity   : 0.2,
    galaxyGlow      : 0.2,
    galaxySaturation: 0.23,
    galaxyHueShift  : 240,
    galaxyTwinkle   : 0.1,
    galaxyFlare     : 0.55,  // 십자 플레어 세기 (첨부 이미지의 반짝임)
    galaxyMouse     : 0.3,

    /* ── L2 DigitFibers ── */
    digitGain      : 0.5,
    digitFibers    : 2,     // 전체 가닥 중 몇 가닥을 숫자로 바꿀지
    digitPerFiber  : 40,    // 가닥당 글자 수
    digitSpeed     : 0.27,
    digitSize      : 9,    // px (기준 폭 1440 기준, 화면 폭에 비례 축소)
    digitColor     : '#5871fe',
    digitSparks    : true,  // 일부 글자를 색으로
    digitSensorMix : 0.32,  // 센서 실측값처럼 보이는 토큰 비율 (0=전부 랜덤 숫자)
    digitTrail     : 0.2   // 잔상 (0=잔상 없음)
  };

  /* ══════════════════════════════════════════════════════════════
     공통 유틸
     ══════════════════════════════════════════════════════════════ */
  function hx(h) {
    return [parseInt(h.slice(1, 3), 16) / 255,
            parseInt(h.slice(3, 5), 16) / 255,
            parseInt(h.slice(5, 7), 16) / 255];
  }
  var TAU = Math.PI * 2;
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  var VS = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';

  /* 좌우 균형 마스크 + 헤드라인 보호 — 세 셰이더가 공유합니다.
     예전 버전은 uv.x 0.18~0.46 을 통째로 깎아 효과가 오른쪽에만 몰렸습니다.
     이제 좌우를 대칭으로 페이드하고, 카피 블록 자리만 부드럽게 낮춥니다. */
  var MASK_GLSL = `
uniform float uCopyDim;uniform vec2 uCopyCenter;uniform vec2 uCopyRadius;
float frameMask(vec2 uv){
  float m = smoothstep(-0.04,0.15,uv.x) * smoothstep(1.04,0.85,uv.x)
          * smoothstep(-0.06,0.18,uv.y) * smoothstep(1.14,0.82,uv.y);
  vec2 d = (uv - uCopyCenter) / max(uCopyRadius, vec2(1e-3));
  m *= mix(uCopyDim, 1.0, clamp(1.0 - exp(-dot(d,d)*1.15), 0.0, 1.0));
  return m;
}`;

  /* ══ L0 · MoltenMetal ══════════════════════════════════════════
     도메인 워프 + fbm 을 쓰는 용융 금속 셰이더입니다. React Bits 원본과
     픽셀 단위로 같지는 않지만 파라미터 이름·거동을 그대로 맞췄습니다. */
  var MM_FS = `precision highp float;
uniform vec2 iResolution;uniform float iTime;uniform vec2 uMouse;
uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;
uniform float uSpeed;uniform float uScale;uniform float uGlow;uniform float uCore;
uniform float uSwirl;uniform float uFold;uniform float uBlack;uniform float uBright;
uniform float uGrain;uniform float uMouseStrength;uniform float uOpacity;uniform int uDetail;
` + MASK_GLSL + `
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  float a=hash21(i),b=hash21(i+vec2(1.,0.)),c=hash21(i+vec2(0.,1.)),d=hash21(i+vec2(1.,1.));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float fbm(vec2 p,int oct){
  float v=0.0,amp=0.55;
  for(int i=0;i<6;i++){ if(i>=oct) break;
    v+=amp*vnoise(p); p=rot(0.63)*p*2.03; amp*=0.5; }
  return v;}
void main(){
  vec2 uvn=gl_FragCoord.xy/iResolution.xy;
  vec2 uv=(gl_FragCoord.xy*2.0-iResolution.xy)/min(iResolution.x,iResolution.y);
  float t=iTime*uSpeed;
  vec2 mo=(uMouse*2.0-1.0);
  vec2 p=uv*uScale + mo*uMouseStrength*0.6;
  p=rot(uSwirl*0.35*length(p)*0.4 + t*0.12)*p;
  vec2 q=vec2(fbm(p+vec2(0.0,t*0.20),uDetail+2),
              fbm(p+vec2(5.2,1.3)-vec2(t*0.15,0.0),uDetail+2));
  float n=fbm(p+2.35*q+vec2(t*0.10,-t*0.12),uDetail+3);
  n=mix(n,abs(n*2.0-1.0),clamp(-uFold,0.0,1.0));
  float d=max(0.0,n-uBlack)/max(1.0-uBlack,1e-3);
  d=pow(d,1.7/max(uGlow,0.05));
  float core=smoothstep(uCore,uCore+0.55,n);
  vec3 col=mix(c1,c2,smoothstep(0.12,0.74,n));
  col=mix(col,c3,pow(core,3.0)*0.8);
  col*=d*uBright;
  col+=(hash21(gl_FragCoord.xy+t)-0.5)*uGrain*0.25;
  col=max(col,vec3(0.0));
  col*=frameMask(uvn)*uOpacity;
  float a=clamp(max(max(col.r,col.g),col.b)*1.35,0.0,1.0);
  gl_FragColor=vec4(col*a,a);
}`;

  /* ══ L1 · FloatingLines ════════════════════════════════════════
     ES 1.00 제약 대응: 유니폼 루프 상한 → 상수 + break,
                       유니폼 배열 동적 인덱싱 → 상수 루프 비교 */
  var FL_FS = `precision highp float;
uniform float iTime;uniform vec3 iResolution;uniform float animationSpeed;
uniform int lineCount;uniform float lineDistance;uniform vec3 wavePosition;
uniform float lineSpread;uniform float phaseStep;
uniform vec2 iMouse;uniform float bendRadius;uniform float bendStrength;uniform float bendInfluence;
uniform vec2 parallaxOffset;uniform vec3 lineGradient[6];uniform int lineGradientCount;
uniform float uGain;
` + MASK_GLSL + `
mat2 rot(float r){return mat2(cos(r),sin(r),-sin(r),cos(r));}
vec3 pick(int idx){vec3 r=lineGradient[0];for(int k=0;k<6;k++){if(k==idx)r=lineGradient[k];}return r;}
vec3 getLineColor(float t){
  if(lineGradientCount<=1)return lineGradient[0]*0.5;
  float ct=clamp(t,0.0,0.9999);
  float sc=ct*float(lineGradientCount-1);
  int i0=int(floor(sc));
  float f=fract(sc);
  int i1=i0+1; if(i1>lineGradientCount-1)i1=lineGradientCount-1;
  return mix(pick(i0),pick(i1),f)*0.5;}
float wave(vec2 uv,float offset,vec2 sUv,vec2 mUv){
  float time=iTime*animationSpeed;
  float amp=sin(offset+time*0.2)*0.3;
  float y=sin(uv.x+offset+time*0.1)*amp;
  vec2 d=sUv-mUv;
  float infl=exp(-dot(d,d)*bendRadius);
  y+=(mUv.y-sUv.y)*infl*bendStrength*bendInfluence;
  return 0.0175/max(abs(uv.y-y)+0.01,1e-3)+0.004;}
void main(){
  vec2 baseUv=(2.0*gl_FragCoord.xy-iResolution.xy)/iResolution.y;
  baseUv.y*=-1.0;
  baseUv+=parallaxOffset;
  vec2 mUv=(2.0*iMouse-iResolution.xy)/iResolution.y;
  mUv.y*=-1.0;
  vec3 col=vec3(0.0);
  vec2 ruv=baseUv*rot(wavePosition.z*log(length(baseUv)+1.0));
  float mid=0.5*float(lineCount-1);
  for(int i=0;i<40;i++){
    if(i>=lineCount)break;
    float fi=float(i);
    /* lineSpread : 가닥을 세로로 나란히 벌립니다 (예전엔 이게 없어서
                    가닥 사이 위상차만으로 벌어져 다발이 통째로 기울어 보였습니다)
       phaseStep  : 가닥별 위상차. 작을수록 서로 나란히, 클수록 비스듬히 흐릅니다 */
    vec2 uvw=ruv+vec2(lineDistance*fi+wavePosition.x,
                      wavePosition.y+lineSpread*(fi-mid));
    col+=getLineColor(fi/max(float(lineCount-1),1.0))
        *wave(uvw,2.0+phaseStep*fi,baseUv,mUv);
  }
  col*=uGain*frameMask(gl_FragCoord.xy/iResolution.xy);
  float a=clamp(max(max(col.r,col.g),col.b)*1.5,0.0,1.0);
  gl_FragColor=vec4(col*a,a);
}`;

  /* ══ L3 · Galaxy ═══════════════════════════════════════════════
     셀마다 별을 하나씩 두고 밀도(density)로 걸러냅니다.
     밝은 별에는 십자 플레어를 얹어 첨부 이미지 같은 반짝임을 냅니다. */
  var GX_FS = `precision highp float;
uniform vec2 iResolution;uniform float iTime;uniform vec2 uMouse;
uniform float uDensity;uniform float uGlow;uniform float uSat;uniform float uHue;
uniform float uTwinkle;uniform float uFlare;uniform float uMouseStrength;uniform float uGain;
` + MASK_GLSL + `
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 hsv2rgb(vec3 c){
  vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);}
vec3 layer(vec2 uv,float seed,float aspect){
  vec3 col=vec3(0.0);
  vec2 gv=fract(uv)-0.5;
  vec2 id=floor(uv);
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 o=vec2(float(x),float(y));
      float h=hash21(id+o+seed);
      if(h>uDensity) continue;
      float h2=hash21(id+o+seed+11.7);
      float h3=hash21(id+o+seed+31.3);
      vec2 pos=o+vec2(h2,h3)-0.5;
      vec2 dv=gv-pos; dv.x*=aspect;
      float d=length(dv);
      float size=0.16+0.85*h/max(uDensity,1e-3);
      float tw=0.55+0.45*sin(iTime*(0.7+h2*2.2)+h3*40.0);
      float b=(0.0045*uGlow*size)/max(d*d+0.00025,1e-5);
      b*=mix(1.0,tw,uTwinkle);
      // 십자 플레어 — 밝은 별에만
      float big=smoothstep(0.72,1.0,h/max(uDensity,1e-3));
      float fx=exp(-abs(dv.y)*260.0)*exp(-abs(dv.x)*13.0);
      float fy=exp(-abs(dv.x)*260.0)*exp(-abs(dv.y)*13.0);
      b+=(fx+fy)*uFlare*big*0.55*mix(1.0,tw,uTwinkle);
      float hue=fract(uHue/360.0+h3*0.14-0.06);
      col+=hsv2rgb(vec3(hue,uSat,1.0))*b;
    }
  }
  return col;}
void main(){
  vec2 uvn=gl_FragCoord.xy/iResolution.xy;
  float aspect=iResolution.x/max(iResolution.y,1.0);
  vec2 mo=(uMouse-0.5)*uMouseStrength;
  vec3 col=vec3(0.0);
  col+=layer(uvn*vec2(aspect,1.0)*7.0 +vec2(iTime*0.006,0.0)-mo*0.35,  3.7,1.0)*1.00;
  col+=layer(uvn*vec2(aspect,1.0)*12.0+vec2(-iTime*0.010,0.0)-mo*0.60,17.1,1.0)*0.55;
  col+=layer(uvn*vec2(aspect,1.0)*19.0+vec2(iTime*0.016,0.0)-mo*0.90,41.9,1.0)*0.30;
  col*=uGain*frameMask(uvn);
  float a=clamp(max(max(col.r,col.g),col.b)*1.4,0.0,1.0);
  gl_FragColor=vec4(col*a,a);
}`;

  /* ══════════════════════════════════════════════════════════════
     사양 판정
     ══════════════════════════════════════════════════════════════ */
  var FORCE = /[?&](aurora|herofx)=force/.test(location.search);
  function tooWeak() {
    if (FORCE) return false;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches && innerWidth < 900) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    if (navigator.connection && navigator.connection.saveData) return true;
    return false;
  }
  /* 중간 사양: 숫자 파이버와 별빛만 줄이고 선다발·용융은 유지 */
  function lite() {
    if (FORCE) return false;
    return (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || innerWidth < 1100;
  }

  function makeLayer(host, cls, frag) {
    var cv = document.createElement('canvas');
    cv.className = cls;
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) { host.removeChild(cv); return null; }
    function mk(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
      return sh;
    }
    var vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) { host.removeChild(cv); return null; }
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { host.removeChild(cv); return null; }
    gl.useProgram(pr);
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
    return {
      gl: gl, cv: cv, pr: pr,
      U: function (n) { return gl.getUniformLocation(pr, n); },
      draw: function () { gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    };
  }

  /* ══════════════════════════════════════════════════════════════
     L2 · DigitFibers — L1 셰이더 궤적을 JS 로 역산해 같은 곡선 위에 숫자를 흘립니다
     ──────────────────────────────────────────────────────────────
     셰이더가 그리는 선은  uv.y == sin(uv.x + offset + t*0.1) * amp  인 자리입니다.
     여기서 uv = ruv + (lineDistance*i + waveX, waveY) 이고
           ruv = baseUv * rot(waveRot * log(|baseUv|+1)) 입니다.
     회전은 길이를 보존하므로 |ruv| == |baseUv| → 회전각을 ruv 만으로 구할 수 있고,
     따라서 uv.x 를 훑으면서 화면 좌표를 정확히 역산할 수 있습니다.
     ══════════════════════════════════════════════════════════════ */
  var SENSOR_TOKENS = ['23.4', '0.82', '61', '4.15', '1.32', '58', '2.81', '0.71', '73',
                       '45', '0.88', '2.08', '12.5', '380', '2950', '99.2', '7.4', '0.05'];
  function randDigit() {
    return Math.random() < 0.5 ? (Math.random() < 0.5 ? '7' : '0')
                               : String(Math.floor(Math.random() * 10));
  }
  function makeToken() {
    return Math.random() < OPT.digitSensorMix
      ? SENSOR_TOKENS[Math.floor(Math.random() * SENSOR_TOKENS.length)]
      : randDigit();
  }

  function DigitFibers(host) {
    var cv = document.createElement('canvas');
    cv.className = 'nh-fx nh-fx-digits';
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    if (!ctx) { host.removeChild(cv); return null; }

    var W = 1, H = 1, dpr = 1;
    var fibers = [], built = false;

    function build() {
      fibers = []; built = true;
      var n = Math.max(0, Math.round(OPT.digitFibers));
      if (!n) return;
      var total = Math.max(2, Math.round(OPT.lineCount));
      /* 15가닥 중 골고루 흩어진 인덱스를 고릅니다 (한쪽에 몰리지 않게) */
      for (var f = 0; f < n; f++) {
        var idx = Math.round((f + 0.5) * (total - 1) / n);
        var parts = [];
        var m = Math.max(4, Math.round(OPT.digitPerFiber));
        for (var k = 0; k < m; k++) {
          parts.push({
            u: k / m + rand(-0.004, 0.004),
            v: rand(0.55, 1.35),                 // 개별 속도 편차
            off: rand(-0.012, 0.012),            // 선에서 살짝 벗어난 정도
            size: rand(0.78, 1.22),
            life: rand(0.45, 1.0),
            hue: rand(190, 320),
            spark: Math.random() < 0.22,
            ch: makeToken(),
            swap: rand(0.002, 0.010)             // 글자 교체 확률
          });
        }
        fibers.push({ i: idx, parts: parts, glow: rand(0.7, 1.0) });
      }
    }

    /* uv.x → 캔버스 좌표 (셰이더 수식의 정확한 역산)
       ─────────────────────────────────────────────────────────
       셰이더의 wave() 는 커서 근처에서 선을 휘게 합니다.
         y += (mUv.y - baseUv.y) * exp(-|baseUv-mUv|²*bendRadius) * bendStrength * bendInfluence
       그런데 baseUv 는 우리가 지금 구하려는 값이라 그대로는 못 넣습니다.
       → 안 휜 상태로 baseUv 를 구한 뒤, 휨량 → 재역산을 되풀이하는 고정점 반복으로
         수렴시킵니다. 휨은 커서 주변에서만 exp 로 살아 있으므로 대부분의 글자는
         첫 회에 바로 수렴해 빠져나옵니다(멀리 있으면 휨량 0). 커서 근처만 최대 6회.
       (이 보정이 없으면 커서를 올렸을 때 선만 휘고 숫자는 제자리에 남습니다) */
    var bend = { mx: 0, my: 0, k: 0, r: 5 };

    function invert(ux, uy, i, px, py, out) {
      var mid = 0.5 * (Math.round(OPT.lineCount) - 1);
      var rx = ux - (OPT.lineDistance * i + OPT.waveX);
      var ry = uy - (OPT.waveY + OPT.lineSpread * (i - mid));
      var th = OPT.waveRot * Math.log(Math.sqrt(rx * rx + ry * ry) + 1.0);
      var c = Math.cos(th), s = Math.sin(th);
      out.bx = rx * c - ry * s;
      out.by = rx * s + ry * c;
      out.x = ((out.bx - px) * H + W) * 0.5;
      out.y = H * (1 + (out.by - py)) * 0.5;
      return out;
    }

    /* fixedBend 를 주면 반복 없이 그 휨량으로 한 번만 역산합니다
       (접선 계산용 보조점 — 0.02 밖에 안 떨어져 있어 휨량이 사실상 같습니다) */
    function point(i, ux, tm, px, py, out, fixedBend) {
      var off = 2.0 + OPT.phaseStep * i;
      var time = tm * OPT.lineSpeed;
      var amp = Math.sin(off + time * 0.2) * 0.3;
      var base = Math.sin(ux + off + time * 0.1) * amp;

      if (Math.abs(bend.k) < 1e-3) { invert(ux, base, i, px, py, out); out.bd = 0; return out; }
      if (fixedBend !== undefined) { invert(ux, base + fixedBend, i, px, py, out); out.bd = fixedBend; return out; }

      invert(ux, base, i, px, py, out);
      var bd = 0, prev = 0;
      for (var n = 0; n < 6; n++) {
        var dx = out.bx - bend.mx, dy = out.by - bend.my;
        bd = (bend.my - out.by) * Math.exp(-(dx * dx + dy * dy) * bend.r) * bend.k;
        if (Math.abs(bd - prev) < 1e-4) break;   // 커서에서 먼 글자는 여기서 바로 끝
        prev = bd;
        invert(ux, base + bd, i, px, py, out);
      }
      out.bd = bd;
      return out;
    }

    var pA = { x: 0, y: 0, bx: 0, by: 0, bd: 0 }, pB = { x: 0, y: 0, bx: 0, by: 0, bd: 0 };

    return {
      cv: cv,
      build: build,
      size: function (w, h, d) {
        W = w; H = h; dpr = d;
        cv.width = Math.max(1, Math.floor(w * d));
        cv.height = Math.max(1, Math.floor(h * d));
        ctx.setTransform(d, 0, 0, d, 0, 0);
      },
      draw: function (tm, px, py, bendInfluence, mx, my) {
        if (!built) build();
        /* 셰이더와 같은 좌표계로 커서 위치를 옮겨 둡니다
           (iMouse 는 픽셀·아래에서 위 기준 → mUv = (2*iMouse - iRes)/iRes.y, y 반전) */
        bend.mx = W * (2 * mx - 1) / H;
        bend.my = 1 - 2 * my;
        bend.k  = OPT.bendStrength * bendInfluence;
        bend.r  = OPT.bendRadius;
        /* 잔상: 투명 캔버스라 destination-out 으로 서서히 지웁니다 */
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (OPT.digitTrail > 0.001) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,' + OPT.digitTrail + ')';
          ctx.fillRect(0, 0, W, H);
        } else {
          ctx.clearRect(0, 0, W, H);
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        /* uv.x 훑는 범위 — 화면을 확실히 덮도록 여유를 둡니다 */
        var half = W / Math.max(H, 1);
        var span = (half + 0.9) * 2;
        var base = W / 1440;
        var fs = Math.max(7, OPT.digitSize * Math.min(1.25, Math.max(0.62, base)));

        for (var f = 0; f < fibers.length; f++) {
          var fb = fibers[f];
          for (var k = 0; k < fb.parts.length; k++) {
            var p = fb.parts[k];
            p.u += 0.00022 * p.v * (OPT.digitSpeed / 0.4);
            if (p.u >= 1) p.u -= 1;
            if (Math.random() < p.swap) p.ch = makeToken();

            var ux = -half - 0.9 + p.u * span + OPT.lineDistance * fb.i + OPT.waveX;
            point(fb.i, ux, tm, px, py, pA);

            /* 화면 밖이면 건너뜁니다 */
            if (pA.x < -60 || pA.x > W + 60 || pA.y < -40 || pA.y > H + 40) continue;

            /* 접선 방향으로 살짝 벗어나게 → 가닥이 굵어 보입니다 */
            point(fb.i, ux + 0.02, tm, px, py, pB, pA.bd);
            var dx = pB.x - pA.x, dy = pB.y - pA.y;
            var len = Math.hypot(dx, dy) || 1;
            var nx = -dy / len, ny = dx / len;
            var x = pA.x + nx * p.off * H;
            var y = pA.y + ny * p.off * H;

            /* 좌우 균형 마스크 + 카피 보호 (셰이더와 같은 식) */
            var uxn = x / W, uyn = 1 - y / H;
            var m = sstep(-0.04, 0.15, uxn) * sstep(1.04, 0.85, uxn)
                  * sstep(-0.06, 0.18, uyn) * sstep(1.14, 0.82, uyn);
            var ddx = (uxn - OPT.copyCenterX) / OPT.copyRadiusX;
            var ddy = (uyn - OPT.copyCenterY) / OPT.copyRadiusY;
            m *= OPT.copyDim + (1 - OPT.copyDim) * (1 - Math.exp(-(ddx * ddx + ddy * ddy) * 1.15));
            if (m <= 0.01) continue;

            var a = (0.30 * p.life + 0.03) * m * OPT.digitGain * fb.glow * OPT.brightness;
            if (a <= 0.004) continue;
            ctx.font = (fs * p.size).toFixed(1) + 'px ui-monospace, "SFMono-Regular", Menlo, "IBM Plex Mono", monospace';
            ctx.fillStyle = (OPT.digitSparks && p.spark)
              ? 'hsla(' + p.hue.toFixed(0) + ',65%,68%,' + a.toFixed(3) + ')'
              : rgba(OPT.digitColor, a);
            ctx.fillText(p.ch, x, y);
          }
        }
      }
    };
  }
  function sstep(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6)));
    return t * t * (3 - 2 * t);
  }
  function rgba(hex, a) {
    var c = hx(hex);
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
           Math.round(c[2] * 255) + ',' + a.toFixed(3) + ')';
  }

  /* ══════════════════════════════════════════════════════════════
     구동
     ══════════════════════════════════════════════════════════════ */
  var API = null;

  function start(host) {
    var LITE = lite();

    var M = makeLayer(host, 'nh-fx nh-fx-molten', MM_FS);   // L0
    var L = makeLayer(host, 'nh-fx nh-fx-lines',  FL_FS);   // L1
    var D = LITE ? null : DigitFibers(host);                 // L2
    var G = makeLayer(host, 'nh-fx nh-fx-galaxy', GX_FS);   // L3
    if (!L) { if (M) M.cv.remove(); if (G) G.cv.remove(); if (D) D.cv.remove(); return; }

    function applyMask(X) {
      if (!X) return;
      X.gl.useProgram(X.pr);
      X.gl.uniform1f(X.U('uCopyDim'), OPT.copyDim);
      X.gl.uniform2f(X.U('uCopyCenter'), OPT.copyCenterX, OPT.copyCenterY);
      X.gl.uniform2f(X.U('uCopyRadius'), OPT.copyRadiusX, OPT.copyRadiusY);
    }

    function applyMolten() {
      if (!M) return;
      var g = M.gl, U = M.U; g.useProgram(M.pr);
      g.uniform3fv(U('c1'), hx(OPT.moltenC1));
      g.uniform3fv(U('c2'), hx(OPT.moltenC2));
      g.uniform3fv(U('c3'), hx(OPT.moltenC3));
      g.uniform1f(U('uSpeed'), OPT.moltenSpeed);
      g.uniform1f(U('uScale'), OPT.moltenScale);
      g.uniform1i(U('uDetail'), Math.max(1, Math.round(OPT.moltenDetail)));
      g.uniform1f(U('uGlow'), OPT.moltenGlow);
      g.uniform1f(U('uCore'), OPT.moltenCore);
      g.uniform1f(U('uSwirl'), OPT.moltenSwirl);
      g.uniform1f(U('uFold'), OPT.moltenFold);
      g.uniform1f(U('uBlack'), OPT.moltenBlack);
      g.uniform1f(U('uBright'), OPT.moltenBright * OPT.brightness);
      g.uniform1f(U('uGrain'), OPT.moltenGrain);
      g.uniform1f(U('uMouseStrength'), OPT.moltenMouse);
      g.uniform1f(U('uOpacity'), OPT.moltenGain);
      applyMask(M);
    }

    function applyLines() {
      var g = L.gl, U = L.U; g.useProgram(L.pr);
      g.uniform1f(U('animationSpeed'), OPT.lineSpeed);
      g.uniform1i(U('lineCount'), Math.max(1, Math.min(40, Math.round(OPT.lineCount))));
      g.uniform1f(U('lineDistance'), OPT.lineDistance);
      g.uniform3f(U('wavePosition'), OPT.waveX, OPT.waveY, OPT.waveRot);
      g.uniform1f(U('lineSpread'), OPT.lineSpread);
      g.uniform1f(U('phaseStep'), OPT.phaseStep);
      g.uniform1f(U('bendRadius'), OPT.bendRadius);
      g.uniform1f(U('bendStrength'), OPT.bendStrength);
      g.uniform1f(U('uGain'), OPT.linesGain * OPT.brightness);
      g.uniform1i(U('lineGradientCount'), OPT.lineStops.length);
      OPT.lineStops.forEach(function (s, i) {
        var c = hx(s);
        g.uniform3f(g.getUniformLocation(L.pr, 'lineGradient[' + i + ']'), c[0], c[1], c[2]);
      });
      applyMask(L);
    }

    function applyGalaxy() {
      if (!G) return;
      var g = G.gl, U = G.U; g.useProgram(G.pr);
      g.uniform1f(U('uDensity'), OPT.galaxyDensity);
      g.uniform1f(U('uGlow'), OPT.galaxyGlow);
      g.uniform1f(U('uSat'), OPT.galaxySaturation);
      g.uniform1f(U('uHue'), OPT.galaxyHueShift);
      g.uniform1f(U('uTwinkle'), OPT.galaxyTwinkle);
      g.uniform1f(U('uFlare'), OPT.galaxyFlare);
      g.uniform1f(U('uMouseStrength'), OPT.galaxyMouse);
      g.uniform1f(U('uGain'), OPT.galaxyGain * OPT.brightness);
      applyMask(G);
    }

    applyMolten(); applyLines(); applyGalaxy();

    var dpr = Math.min(window.devicePixelRatio || 1, 1.4);
    function size() {
      [M, L, G].forEach(function (X) {
        if (!X) return;
        var w = X.cv.clientWidth || host.offsetWidth || 1;
        var h = X.cv.clientHeight || host.offsetHeight || 1;
        X.cv.width = Math.max(1, Math.floor(w * dpr));
        X.cv.height = Math.max(1, Math.floor(h * dpr));
        X.gl.useProgram(X.pr);
        X.gl.viewport(0, 0, X.cv.width, X.cv.height);
        if (X === L) X.gl.uniform3f(X.U('iResolution'), X.cv.width, X.cv.height, 1.0);
        else         X.gl.uniform2f(X.U('iResolution'), X.cv.width, X.cv.height);
      });
      if (D) D.size(host.offsetWidth || 1, host.offsetHeight || 1, dpr);
    }
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(host);
    else addEventListener('resize', size);

    var tg = [0.5, 0.5], cu = [0.5, 0.5], bt = 0, bi = 0, pt = [0, 0], px = [0, 0];
    var moveHost = host.parentNode || host;
    moveHost.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      tg[0] = (e.clientX - r.left) / r.width;
      tg[1] = 1 - (e.clientY - r.top) / r.height;
      bt = 1;
      pt[0] =  ((e.clientX - r.left) / r.width  - 0.5) * 0.16 * OPT.parallax;
      pt[1] = -((e.clientY - r.top)  / r.height - 0.5) * 0.16 * OPT.parallax;
    });
    moveHost.addEventListener('pointerleave', function () {
      tg[0] = 0.5; tg[1] = 0.5; bt = 0; pt[0] = 0; pt[1] = 0;
    });

    var onScreen = true;
    if ('IntersectionObserver' in window)
      new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; }, { threshold: 0 }).observe(host);

    function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden || !onScreen) return;
      cu[0] += 0.05 * (tg[0] - cu[0]);
      cu[1] += 0.05 * (tg[1] - cu[1]);
      bi    += 0.05 * (bt - bi);
      px[0] += 0.05 * (pt[0] - px[0]);
      px[1] += 0.05 * (pt[1] - px[1]);
      var tm = t * 0.001;

      if (M) { M.gl.useProgram(M.pr); M.gl.uniform1f(M.U('iTime'), tm);
               M.gl.uniform2f(M.U('uMouse'), cu[0], cu[1]); M.draw(); }

      L.gl.useProgram(L.pr);
      L.gl.uniform1f(L.U('iTime'), tm);
      L.gl.uniform2f(L.U('iMouse'), cu[0] * L.cv.width, cu[1] * L.cv.height);
      L.gl.uniform1f(L.U('bendInfluence'), bi);
      L.gl.uniform2f(L.U('parallaxOffset'), px[0], px[1]);
      L.draw();

      if (D) D.draw(tm, px[0], px[1], bi, cu[0], cu[1]);

      if (G) { G.gl.useProgram(G.pr); G.gl.uniform1f(G.U('iTime'), tm);
               G.gl.uniform2f(G.U('uMouse'), cu[0], cu[1]); G.draw(); }
    }
    requestAnimationFrame(frame);
    host.dataset.heroFxOn = '1';

    /* 실시간 튜닝 API */
    API = {
      opt: OPT,
      set: function (k, v) {
        if (typeof k === 'object') { for (var n in k) OPT[n] = k[n]; }
        else OPT[k] = v;
        applyMolten(); applyLines(); applyGalaxy();
        if (D) D.build();
        return OPT;
      },
      get: function (k) { return k ? OPT[k] : OPT; },
      dump: function () { var s = JSON.stringify(OPT, null, 2); console.log(s); return s; },
      resize: size
    };
    window.MonnitHeroFX = API;
  }

  function boot() {
    var host = document.querySelector(HOST_SEL);
    if (!host || host.dataset.heroFxOn === '1') return;
    if (tooWeak()) return;
    try { if (!document.createElement('canvas').getContext('webgl')) return; } catch (e) { return; }
    try { start(host); } catch (e) { /* 실패 시 정적 배경 유지 */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('hashchange', function () { setTimeout(boot, 150); });
  if (!window.MonnitHeroFX) window.MonnitHeroFX = { refresh: boot };
  window.MonnitAurora = window.MonnitHeroFX;   // 예전 이름 호환
})();

/* ═══════════════════════════════════════════════════════════
   히어로 인터랙션 — 커서 스포트라이트 / 도트 그리드 / 순차 등장 /
   버튼 자석 / 스크롤 패럴랙스. 배경과 독립적으로 동작합니다.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE   = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;

  function init() {
    var hero = document.querySelector('.nh-hero');
    if (!hero || hero.dataset.fxReady === '1') return;
    hero.dataset.fxReady = '1';

    /* ── 제목을 줄 단위로 감싸기 (<br> 기준) ──
       app.js 가 시트 값으로 제목을 덮어쓰면 래핑이 날아가므로 감시 후 다시 감쌉니다 */
    var title = hero.querySelector('.nh-hero-title');
    function wrapTitle() {
      if (!title || title.querySelector('.ln')) return;
      var parts = title.innerHTML.split(/<br\s*\/?>/i);
      if (!parts.length) return;
      title.innerHTML = parts.map(function (p) {
        return '<span class="ln"><span>' + p + '</span></span>';
      }).join('');
      requestAnimationFrame(function () { hero.classList.add('is-in'); });
    }
    wrapTitle();
    if (title && 'MutationObserver' in window) {
      new MutationObserver(function () { wrapTitle(); })
        .observe(title, { childList: true });
    }

    hero.classList.add('fx-on');

    /* ── 커서 레이어 삽입 ── */
    if (!REDUCE && FINE) {
      ['nh-hero-spot', 'nh-hero-dots'].forEach(function (cls) {
        var el = document.createElement('div');
        el.className = cls;
        el.setAttribute('aria-hidden', 'true');
        hero.insertBefore(el, hero.firstChild);
      });

      var tx = 50, ty = 50, cx = 50, cy = 50, raf = 0;
      hero.addEventListener('pointerenter', function () { hero.classList.add('is-live'); });
      hero.addEventListener('pointerleave', function () { hero.classList.remove('is-live'); });
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width) * 100;
        ty = ((e.clientY - r.top) / r.height) * 100;
        if (!raf) raf = requestAnimationFrame(follow);
      });
      function follow() {
        raf = 0;
        cx += (tx - cx) * 0.14;
        cy += (ty - cy) * 0.14;
        hero.style.setProperty('--mx', cx.toFixed(2) + '%');
        hero.style.setProperty('--my', cy.toFixed(2) + '%');
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(follow);
      }

      /* ── 버튼 커서 자석 ── */
      [].slice.call(hero.querySelectorAll('.nh-hero-cta .nh-btn')).forEach(function (btn) {
        var br = 0;
        btn.addEventListener('pointermove', function (e) {
          if (br) return;
          br = requestAnimationFrame(function () {
            br = 0;
            var r = btn.getBoundingClientRect();
            var dx = ((e.clientX - r.left) / r.width  - 0.5) * 9;
            var dy = ((e.clientY - r.top)  / r.height - 0.5) * 5;
            btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
          });
        });
        btn.addEventListener('pointerleave', function () {
          btn.style.transition = 'transform .45s cubic-bezier(.2,.8,.3,1)';
          btn.style.transform = '';
          setTimeout(function () { btn.style.transition = ''; }, 460);
        });
        btn.addEventListener('pointerenter', function () { btn.style.transition = 'transform .12s ease-out'; });
      });
    }

    /* ── 등장 ── */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { hero.classList.add('is-in'); });
    });

    /* ── 스크롤 패럴랙스 ── */
    if (!REDUCE) {
      var inner = hero.querySelector('.nh-hero-inner');
      if (inner) {
        var sraf = 0;
        addEventListener('scroll', function () {
          if (sraf) return;
          sraf = requestAnimationFrame(function () {
            sraf = 0;
            var y = Math.min(window.scrollY, 600);
            inner.style.transform = 'translateY(' + (y * -0.12).toFixed(1) + 'px)';
            inner.style.opacity = String(Math.max(0, 1 - y / 640));
          });
        }, { passive: true });
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('hashchange', function () { setTimeout(init, 150); });
  window.MonnitHeroFx = { refresh: init };
})();
