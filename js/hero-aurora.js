/*!
 * Monnit Korea — 히어로 배경 Soft Aurora (WebGL)
 * React Bits <SoftAurora /> 를 React 없이 돌아가도록 옮긴 것. 셰이더 원본 그대로.
 * · ogl 은 CDN(ESM)에서 받아 옵니다. 실패하면 아무것도 하지 않고 기존 배경만 남습니다.
 * · 모바일 / 저사양 / prefers-reduced-motion / 탭 비활성 / 화면 밖 → 자동 정지
 */
(function () {
  'use strict';

  var HOST_SEL = '.nh-hero-aurora';
  var OPT = { speed:0.6, scale:1.5, brightness:1.0,
              color1:'#202f7a', color2:'#1300ff',
              noiseFrequency:2.5, noiseAmplitude:1.0, bandHeight:0.5, bandSpread:1.0,
              octaveDecay:0.1, layerOffset:0, colorSpeed:1.0,
              enableMouseInteraction:true, mouseInfluence:0.25 };

  var VERT = `attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}`;
  var FRAG = `precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uNoiseFreq;
uniform float uNoiseAmp;
uniform float uBandHeight;
uniform float uBandSpread;
uniform float uOctaveDecay;
uniform float uLayerOffset;
uniform float uColorSpeed;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define TAU 6.28318

vec3 gradientHash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 234.6)),
    dot(p, vec3(269.5, 183.3, 198.3)),
    dot(p, vec3(169.5, 283.3, 156.9))
  );
  vec3 h = fract(sin(p) * 43758.5453123);
  float phi = acos(2.0 * h.x - 1.0);
  float theta = TAU * h.y;
  return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
}

float quinticSmooth(float t) {
  float t2 = t * t;
  float t3 = t * t2;
  return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
}

vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
  float x = px * frequency;
  float y = py * frequency;

  float fx = floor(x); float fy = floor(y); float fz = floor(pz);
  float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);

  vec3 g000 = gradientHash(vec3(fx, fy, fz));
  vec3 g100 = gradientHash(vec3(cx, fy, fz));
  vec3 g010 = gradientHash(vec3(fx, cy, fz));
  vec3 g110 = gradientHash(vec3(cx, cy, fz));
  vec3 g001 = gradientHash(vec3(fx, fy, cz));
  vec3 g101 = gradientHash(vec3(cx, fy, cz));
  vec3 g011 = gradientHash(vec3(fx, cy, cz));
  vec3 g111 = gradientHash(vec3(cx, cy, cz));

  float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
  float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
  float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
  float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
  float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
  float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
  float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
  float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));

  float sx = quinticSmooth(x - fx);
  float sy = quinticSmooth(y - fy);
  float sz = quinticSmooth(pz - fz);

  float lx00 = mix(d000, d100, sx);
  float lx10 = mix(d010, d110, sx);
  float lx01 = mix(d001, d101, sx);
  float lx11 = mix(d011, d111, sx);

  float ly0 = mix(lx00, lx10, sy);
  float ly1 = mix(lx01, lx11, sy);

  return amplitude * mix(ly0, ly1, sz);
}

float auroraGlow(float t, vec2 shift) {
  vec2 uv = gl_FragCoord.xy / uResolution.y;
  uv += shift;

  float noiseVal = 0.0;
  float freq = uNoiseFreq;
  float amp = uNoiseAmp;
  vec2 samplePos = uv * uScale;

  for (float i = 0.0; i < 3.0; i += 1.0) {
    noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
    amp *= uOctaveDecay;
    freq *= 2.0;
  }

  float yBand = uv.y * 10.0 - uBandHeight * 10.0;
  return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * abs(noiseVal + yBand))), 0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float t = uSpeed * 0.4 * uTime;

  vec2 shift = vec2(0.0);
  if (uEnableMouse) {
    shift = (uMouse - 0.5) * uMouseInfluence;
  }

  vec3 col = vec3(0.0);
  col += 0.99 * auroraGlow(t, shift) * cosineGradient(uv.x + uTime * uSpeed * 0.2 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20)) * uColor1;
  col += 0.99 * auroraGlow(t + uLayerOffset, shift) * cosineGradient(uv.x + uTime * uSpeed * 0.1 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25)) * uColor2;

  col *= uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

  function hexToVec3(hex){
    var h=hex.replace('#','');
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
  }
  /* ?aurora=force 를 붙이면 저사양 판정을 건너뜁니다 (미리보기·디버깅용) */
  var FORCE = /[?&]aurora=force/.test(location.search);

  function tooWeak(){
    if (FORCE) return false;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches && innerWidth < 900) return true; // 모바일
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    if (navigator.connection && navigator.connection.saveData) return true;
    return false;
  }

  function start(host, ogl){
    var Renderer=ogl.Renderer, Program=ogl.Program, Mesh=ogl.Mesh, Triangle=ogl.Triangle;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.6);   // 고DPI 기기에서 픽셀 과다 방지
    var renderer = new Renderer({ alpha:true, premultipliedAlpha:true, antialias:false, dpr:dpr });
    var gl = renderer.gl;
    gl.clearColor(0,0,0,0);
    gl.canvas.style.cssText = 'width:100%;height:100%;display:block';

    var uni = {
      uTime:{value:0}, uResolution:{value:[1,1,1]},
      uSpeed:{value:OPT.speed}, uScale:{value:OPT.scale}, uBrightness:{value:OPT.brightness},
      uColor1:{value:hexToVec3(OPT.color1)}, uColor2:{value:hexToVec3(OPT.color2)},
      uNoiseFreq:{value:OPT.noiseFrequency}, uNoiseAmp:{value:OPT.noiseAmplitude},
      uBandHeight:{value:OPT.bandHeight}, uBandSpread:{value:OPT.bandSpread},
      uOctaveDecay:{value:OPT.octaveDecay}, uLayerOffset:{value:OPT.layerOffset},
      uColorSpeed:{value:OPT.colorSpeed}, uMouse:{value:[0.5,0.5]},
      uMouseInfluence:{value:OPT.mouseInfluence}, uEnableMouse:{value:OPT.enableMouseInteraction}
    };
    var program = new Program(gl, { vertex:VERT, fragment:FRAG, uniforms:uni, transparent:true });
    var mesh = new Mesh(gl, { geometry:new Triangle(gl), program:program });
    host.appendChild(gl.canvas);

    function resize(){
      var w = host.offsetWidth || 1, h = host.offsetHeight || 1;
      renderer.setSize(w, h);
      uni.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width/gl.canvas.height];
    }
    resize();
    var ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host); else addEventListener('resize', resize);

    var target=[0.5,0.5], cur=[0.5,0.5];
    if (OPT.enableMouseInteraction){
      host.addEventListener('mousemove', function(e){
        var r=host.getBoundingClientRect();
        target[0]=(e.clientX-r.left)/r.width; target[1]=1.0-(e.clientY-r.top)/r.height;
      });
      host.addEventListener('mouseleave', function(){ target[0]=0.5; target[1]=0.5; });
    }

    var onScreen = true, raf = 0;
    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(e){ onScreen = e[0].isIntersecting; }, {threshold:0}).observe(host);
    }
    function frame(t){
      raf = requestAnimationFrame(frame);
      if (document.hidden || !onScreen) return;      // 안 보이면 GPU 놀린다
      uni.uTime.value = t * 0.001;
      cur[0] += 0.05*(target[0]-cur[0]);
      cur[1] += 0.05*(target[1]-cur[1]);
      uni.uMouse.value[0] = cur[0]; uni.uMouse.value[1] = cur[1];
      renderer.render({ scene: mesh });
    }
    raf = requestAnimationFrame(frame);
    host.dataset.auroraOn = '1';
  }

  function boot(){
    var host = document.querySelector(HOST_SEL);
    if (!host || host.dataset.auroraOn === '1') return;
    if (tooWeak()) return;                            // 정적 그라데이션 배경 그대로 사용
    try { if (!document.createElement('canvas').getContext('webgl')) return; } catch(e){ return; }
    import('https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm')
      .then(function(m){ start(host, m); })
      .catch(function(){ /* CDN 실패 시 조용히 포기 */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('hashchange', function(){ setTimeout(boot,150); });
  window.MonnitAurora = { refresh: boot };
})();
