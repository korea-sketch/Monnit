/*!
 * Monnit Korea — 히어로 배경 FX (WebGL, 무의존)
 * React Bits 세 컴포넌트를 React·three·ogl 없이 순수 WebGL1 로 옮겨 3겹으로 쌓았습니다.
 *   L1  GradientWaves  — 우하단 모서리 레이마칭 파동 (바이올렛)
 *   L2  FloatingLines  — 커서를 따라 휘는 선다발 (screen 블렌드)
 *   L3  ParticleMesh   — 입자 시트 + 컨스털레이션 + 렌즈 플레어 (메인)
 * 모바일 / 저사양 / prefers-reduced-motion / 탭 비활성 / 화면 밖 → 자동 정지
 * 실패하면 아무것도 하지 않고 CSS 그라데이션 배경만 남습니다.
 */
(function () {
  'use strict';

  var HOST_SEL = '.nh-hero-aurora';

  /* ── 튜닝값 (미리보기에서 확정) ───────────────── */
  var OPT = {
    lineGain   : 0.5,   // FloatingLines 세기
    cornerGain : 1.0,   // GradientWaves 세기
    sheetGain  : 0.8,   // 입자 시트
    netGain    : 1.1,   // 그물망
    brightness : 1.3,   // 전체 밝기
    meshSpeed  : 0.20,
    lineSpeed  : 0.55,
    cornerSpeed: 0.16,
    cBlue   : '#1B48CC',
    cCyan   : '#5CCBFF',
    cViolet : '#A63CF0',
    cWhite  : '#EAF4FF',
    lineStops : ['#0E2A6E', '#1F55E0', '#4FC3FF', '#8B44F0', '#C46BFF'],
    edgeStart : 0.22,    // 왼쪽 카피 영역 보호 (0 = 좌단, 1 = 우단)
    edgeEnd   : 0.44
  };

  var VS = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';

  /* ══ L1 · GradientWaves ══ */
  var GW_FS = `precision highp float;
uniform vec2 iResolution;uniform float iTime;
uniform float uSpeed;uniform float uAmplitude;uniform float uWaveScale;uniform float uWaveRatio;
uniform float uSwell;uniform float uTurbulence;uniform float uTilt;uniform float uZoom;
uniform float uHeight;uniform float uFogDepth;uniform float uSteps;
uniform float uBrightness;uniform float uGrainIntensity;
uniform vec2 uMouse;uniform float uParallax;
uniform vec3 uHorizonColor;uniform vec3 uWaveColor;uniform vec3 uCrestColor;
const float MAX_DIST=20000.0;
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float plasma(vec3 r,vec2 f,vec4 tc){
  float mx=r.x+tc.x; mx+=uSwell*sin((r.y+mx)/20.0+tc.y);
  float my=r.y-tc.z; my+=uTurbulence*cos(r.x/23.0+tc.w);
  return r.z-(sin(mx*f.x)*uAmplitude+sin(my*f.y)*uAmplitude+uHeight);}
float march(vec3 p,vec3 d,vec2 f,vec4 tc){
  float dist=0.0;
  for(int i=0;i<64;i++){
    if(float(i)>=uSteps)break;
    float ds=plasma(p+dist*d,f,tc);
    if(abs(ds)<0.1)break;
    dist+=0.9*ds;
    if(!(abs(dist)<MAX_DIST))return MAX_DIST;
  }
  return dist;}
void main(){
  float T=iTime*uSpeed;
  vec2 f=vec2(uWaveScale/7.0,(uWaveScale*uWaveRatio)/3.0);
  vec4 tc=vec4(T/0.130,T/0.810,T/0.200,T/0.710);
  float c,s;
  float vfov=(3.14159/2.3)/max(uZoom,0.05);
  vec3 cam=vec3(0.0,0.0,30.0);
  vec2 uv=(gl_FragCoord.xy/iResolution.xy)-0.5;
  uv.x*=iResolution.x/iResolution.y; uv.y*=-1.0;
  vec3 dir=vec3(0.0,0.0,-1.0);
  float ul=length(uv), xr=vfov*ul;
  c=cos(xr);s=sin(xr); dir=mat3(1.,0.,0.,0.,c,-s,0.,s,c)*dir;
  vec2 nu=ul>1e-5?uv/ul:vec2(1.,0.);
  c=nu.x;s=nu.y; dir=mat3(c,-s,0.,s,c,0.,0.,0.,1.)*dir;
  c=cos(uTilt);s=sin(uTilt); dir=mat3(c,0.,s,0.,1.,0.,-s,0.,c)*dir;
  float yaw=(uMouse.x-0.5)*uParallax*0.4, pit=(uMouse.y-0.5)*uParallax*0.4;
  c=cos(yaw);s=sin(yaw); dir=mat3(c,0.,s,0.,1.,0.,-s,0.,c)*dir;
  c=cos(pit);s=sin(pit); dir=mat3(1.,0.,0.,0.,c,-s,0.,s,c)*dir;
  float dist=march(cam,dir,f,tc);
  vec3 pos=cam+dist*dir;
  float t=clamp(uFogDepth/max(dist,0.001),0.0,1.0);
  vec3 body=mix(uWaveColor,uCrestColor,clamp(pos.z*0.08+0.5,0.0,1.0));
  vec3 col=clamp(mix(uHorizonColor,body,t)*uBrightness,0.0,1.0);
  float a=clamp(t,0.0,1.0);
  a+=(hash21(gl_FragCoord.xy+mod(iTime,64.0)*11.0)-0.5)*uGrainIntensity;
  a=clamp(a,0.0,1.0);
  gl_FragColor=vec4(col*a,a);
}`;

  /* ══ L2 · FloatingLines ══
     ES 1.00 제약 대응 : 유니폼 루프 상한 → 상수 + break,
                        유니폼 배열 동적 인덱싱 → 상수 루프 비교 */
  var FL_FS = `precision highp float;
uniform float iTime;uniform vec3 iResolution;uniform float animationSpeed;
uniform int topLineCount;uniform int middleLineCount;uniform int bottomLineCount;
uniform float topLineDistance;uniform float middleLineDistance;uniform float bottomLineDistance;
uniform vec3 topWavePosition;uniform vec3 middleWavePosition;uniform vec3 bottomWavePosition;
uniform vec2 iMouse;uniform float bendRadius;uniform float bendStrength;uniform float bendInfluence;
uniform vec2 parallaxOffset;uniform vec3 lineGradient[6];uniform int lineGradientCount;
uniform float uGain;uniform float uEdgeStart;uniform float uEdgeEnd;
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
  for(int i=0;i<24;i++){
    if(i>=bottomLineCount)break;
    float fi=float(i);
    vec2 ruv=baseUv*rot(bottomWavePosition.z*log(length(baseUv)+1.0));
    col+=getLineColor(fi/max(float(bottomLineCount-1),1.0))
        *wave(ruv+vec2(bottomLineDistance*fi+bottomWavePosition.x,bottomWavePosition.y),1.5+0.2*fi,baseUv,mUv)*0.2;
  }
  for(int i=0;i<24;i++){
    if(i>=middleLineCount)break;
    float fi=float(i);
    vec2 ruv=baseUv*rot(middleWavePosition.z*log(length(baseUv)+1.0));
    col+=getLineColor(fi/max(float(middleLineCount-1),1.0))
        *wave(ruv+vec2(middleLineDistance*fi+middleWavePosition.x,middleWavePosition.y),2.0+0.15*fi,baseUv,mUv);
  }
  for(int i=0;i<24;i++){
    if(i>=topLineCount)break;
    float fi=float(i);
    vec2 ruv=baseUv*rot(topWavePosition.z*log(length(baseUv)+1.0));
    ruv.x*=-1.0;
    col+=getLineColor(fi/max(float(topLineCount-1),1.0))
        *wave(ruv+vec2(topLineDistance*fi+topWavePosition.x,topWavePosition.y),1.0+0.2*fi,baseUv,mUv)*0.1;
  }
  vec2 uv=gl_FragCoord.xy/iResolution.xy;
  float m=smoothstep(uEdgeStart,uEdgeEnd,uv.x)*smoothstep(-0.05,0.22,uv.y)*smoothstep(1.12,0.78,uv.y);
  col*=uGain*m;
  float a=clamp(max(max(col.r,col.g),col.b)*1.5,0.0,1.0);
  gl_FragColor=vec4(col*a,a);
}`;

  /* ══ L3 · ParticleMesh ══ */
  var PM_FS = `precision highp float;
uniform float uTime;uniform vec3 uResolution;uniform float uSpeed;uniform float uBrightness;
uniform float uSheetGain;uniform float uNetGain;uniform float uEdgeStart;uniform float uEdgeEnd;uniform float uGrainAmt;
uniform vec3 uCBlue;uniform vec3 uCCyan;uniform vec3 uCViolet;uniform vec3 uCWhite;
uniform vec2 uMouse;uniform float uMouseStrength;
float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
vec2 hash22(vec2 p){float n=hash21(p);return vec2(n,hash21(p+n*17.13));}
float surf(float x,float t,float row){
  return sin(x*1.15+t*0.50+row*0.55)*0.115+sin(x*2.30-t*0.33+row*0.95)*0.040+sin(x*0.62+t*0.22+row*0.30)*0.075;}
void main(){
  vec2 uv=gl_FragCoord.xy/uResolution.xy;
  vec2 p=(gl_FragCoord.xy-0.5*uResolution.xy)/uResolution.y;
  float t=uTime*uSpeed;
  p-=(uMouse-0.5)*uMouseStrength*0.09;
  float ca=0.9781,sa=0.2079;
  vec2 q=vec2(p.x*ca-p.y*sa,p.x*sa+p.y*ca);
  float dep=smoothstep(-0.45,0.85,q.x);
  float spread=mix(0.300,0.088,dep), dens=mix(110.0,430.0,dep), rowFade=mix(1.0,0.70,dep);
  float sh=0.0;
  for(int i=0;i<18;i++){
    float fi=float(i)/17.0;
    float y=q.y-(-0.055+(fi-0.5)*spread)-surf(q.x,t,fi*4.0);
    float d=abs(y);
    if(d>0.020)continue;
    float cx=fract(q.x*dens-t*7.0+fi*4.13)-0.5;
    sh+=exp(-cx*cx*22.0)*exp(-d*d*17000.0)*mix(0.45,1.0,fi)*rowFade;
  }
  float rb=0.0;
  for(int i=0;i<3;i++){
    float fi=float(i);
    float y=q.y-(-0.100+fi*0.088)-surf(q.x,t,fi*5.5+1.2);
    float th=0.0024-fi*0.0005;
    float g=th/(abs(y)+th*0.95);
    rb+=g*g*(1.0-fi*0.26);
  }
  vec2 np=p*2.7, gc=floor(np);
  vec2 h0=hash22(gc);
  vec2 c0=gc+vec2(0.22+0.56*(0.5+0.5*sin(t*0.30+h0.x*6.2831)),0.22+0.56*(0.5+0.5*sin(t*0.25+h0.y*6.2831)));
  float lines=0.0,nodes=0.0;
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 cn=gc+vec2(float(i),float(j));
      vec2 h=hash22(cn);
      vec2 pn=cn+vec2(0.22+0.56*(0.5+0.5*sin(t*0.30+h.x*6.2831)),0.22+0.56*(0.5+0.5*sin(t*0.25+h.y*6.2831)));
      if(!(i==0&&j==0)){
        vec2 pa=np-c0,ba=pn-c0;
        float hh=clamp(dot(pa,ba)/max(dot(ba,ba),1e-5),0.0,1.0);
        lines+=smoothstep(0.010,0.0,length(pa-ba*hh))*smoothstep(1.55,0.45,length(ba));
      }
      vec2 dv=np-pn;float dd=dot(dv,dv);
      nodes+=exp(-dd*900.0)+exp(-dd*90.0)*0.18;
    }
  }
  float upper=exp(-pow((q.y-0.200)/0.165,2.0))*smoothstep(-0.10,0.35,q.x);
  lines*=upper;nodes*=upper;
  float fl=0.0;
  for(int i=0;i<2;i++){
    float fi=float(i);
    vec2 fp=(i==0)?vec2(0.585,-0.075):vec2(0.300,0.135);
    float sz=(i==0)?0.34:0.17;
    vec2 dv=p-fp;float r=length(dv);
    float core=exp(-r*r/(sz*sz*0.045)),rays=0.0;
    for(int k=0;k<3;k++){
      float a=1.0471975*float(k)+0.30+fi*0.7;
      vec2 dr=vec2(cos(a),sin(a));
      rays+=exp(-abs(dot(dv,dr))*5.5)*exp(-pow(dot(dv,vec2(-dr.y,dr.x)),2.0)*4200.0);
    }
    fl+=(core*1.4+rays*0.62)*(0.72+0.28*sin(t*1.35+fi*2.1))*((i==0)?1.0:0.45);
  }
  float hot=exp(-dot(p-vec2(0.215,0.010),p-vec2(0.215,0.010))*7.5);
  float vio=smoothstep(0.10,0.72,p.x)*0.72+smoothstep(0.10,-0.32,q.y)*0.55;
  vec3 base=mix(uCBlue,uCCyan,clamp(hot*1.25,0.0,1.0));
  base=mix(base,uCViolet,clamp(vio,0.0,0.88));
  vec3 col=base*sh*1.05*uSheetGain;
  col+=mix(uCCyan,base,0.30)*rb*0.55;
  col+=mix(base,uCCyan,0.35)*lines*0.26*uNetGain;
  col+=mix(uCWhite,uCCyan,0.40)*nodes*0.80*uNetGain;
  col+=mix(uCWhite,uCViolet,0.42)*fl*0.50;
  float lum=max(max(col.r,col.g),col.b);
  col=mix(col,uCWhite*lum,smoothstep(0.65,1.7,lum)*0.42);
  float m=smoothstep(uEdgeStart,uEdgeEnd,uv.x)*smoothstep(-0.05,0.20,uv.y)*smoothstep(1.10,0.74,uv.y);
  col*=uBrightness*m;
  float alpha=clamp(lum*1.55,0.0,1.0)*m;
  float gr=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+uTime)*43758.5453)-0.5)*uGrainAmt;
  gl_FragColor=vec4(clamp(col*alpha+gr,0.0,1.0),clamp(alpha+gr,0.0,1.0));
}`;

  function hx(h){ return [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255]; }

  var FORCE = /[?&]aurora=force/.test(location.search);
  function tooWeak(){
    if (FORCE) return false;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches && innerWidth < 900) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    if (navigator.connection && navigator.connection.saveData) return true;
    return false;
  }
  /* 중간 사양이면 커서 반응 레이어만 끄고 2겹으로 */
  function lite(){
    if (FORCE) return false;
    return (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || innerWidth < 1100;
  }

  function makeLayer(host, cls, frag){
    var cv = document.createElement('canvas');
    cv.className = cls;
    cv.setAttribute('aria-hidden','true');
    host.appendChild(cv);
    var gl = cv.getContext('webgl', {alpha:true, premultipliedAlpha:true, antialias:false});
    if (!gl) { host.removeChild(cv); return null; }
    function mk(type, src){
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0,0,0,0);
    return { gl:gl, cv:cv, pr:pr,
      U:function(n){ return gl.getUniformLocation(pr, n); },
      draw:function(){ gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); } };
  }

  function start(host){
    var LITE = lite();

    var W = makeLayer(host, 'nh-fx nh-fx-corner', GW_FS);
    var L = LITE ? null : makeLayer(host, 'nh-fx nh-fx-lines', FL_FS);
    var M = makeLayer(host, 'nh-fx nh-fx-mesh', PM_FS);
    if (!M) { if (W) W.cv.remove(); if (L) L.cv.remove(); return; }

    if (W){ var g=W.gl, U=W.U;
      g.uniform1f(U('uSpeed'), OPT.cornerSpeed); g.uniform1f(U('uAmplitude'), 2.2);
      g.uniform1f(U('uWaveScale'), 0.62); g.uniform1f(U('uWaveRatio'), 0.9);
      g.uniform1f(U('uSwell'), 34.0); g.uniform1f(U('uTurbulence'), 19.0);
      g.uniform1f(U('uTilt'), 1.14); g.uniform1f(U('uZoom'), 1.0);
      g.uniform1f(U('uHeight'), 5.2); g.uniform1f(U('uFogDepth'), 13.0);
      g.uniform1f(U('uSteps'), 42.0); g.uniform1f(U('uGrainIntensity'), 0.03);
      g.uniform1f(U('uParallax'), 0.42); g.uniform1f(U('uBrightness'), OPT.cornerGain);
      g.uniform3fv(U('uHorizonColor'), hx('#0A1240'));
      g.uniform3fv(U('uWaveColor'),   hx('#6B2FE0'));
      g.uniform3fv(U('uCrestColor'),  hx('#C46BFF'));
    }
    if (L){ var g2=L.gl, U2=L.U;
      g2.uniform1f(U2('animationSpeed'), OPT.lineSpeed);
      g2.uniform1i(U2('topLineCount'), 9);
      g2.uniform1i(U2('middleLineCount'), 13);
      g2.uniform1i(U2('bottomLineCount'), 17);
      g2.uniform1f(U2('topLineDistance'), 0.08);
      g2.uniform1f(U2('middleLineDistance'), 0.06);
      g2.uniform1f(U2('bottomLineDistance'), 0.04);
      g2.uniform3f(U2('topWavePosition'), 10.0, 0.55, -0.40);
      g2.uniform3f(U2('middleWavePosition'), 5.0, 0.02, 0.20);
      g2.uniform3f(U2('bottomWavePosition'), 2.0, -0.72, -1.0);
      g2.uniform1f(U2('bendRadius'), 5.0);
      g2.uniform1f(U2('bendStrength'), -0.5);
      g2.uniform1f(U2('uGain'), OPT.lineGain);
      g2.uniform1f(U2('uEdgeStart'), 0.18);
      g2.uniform1f(U2('uEdgeEnd'), 0.46);
      g2.uniform1i(U2('lineGradientCount'), OPT.lineStops.length);
      OPT.lineStops.forEach(function(s, i){
        var c = hx(s);
        g2.uniform3f(g2.getUniformLocation(L.pr, 'lineGradient[' + i + ']'), c[0], c[1], c[2]);
      });
    }
    (function(){ var g3=M.gl, U3=M.U;
      g3.uniform1f(U3('uEdgeStart'), OPT.edgeStart);
      g3.uniform1f(U3('uEdgeEnd'), OPT.edgeEnd);
      g3.uniform1f(U3('uGrainAmt'), 0.014);
      g3.uniform3fv(U3('uCBlue'),   hx(OPT.cBlue));
      g3.uniform3fv(U3('uCCyan'),   hx(OPT.cCyan));
      g3.uniform3fv(U3('uCViolet'), hx(OPT.cViolet));
      g3.uniform3fv(U3('uCWhite'),  hx(OPT.cWhite));
      g3.uniform1f(U3('uMouseStrength'), 0.26);
      g3.uniform1f(U3('uSpeed'), OPT.meshSpeed);
      g3.uniform1f(U3('uSheetGain'), OPT.sheetGain);
      g3.uniform1f(U3('uNetGain'), OPT.netGain);
      g3.uniform1f(U3('uBrightness'), OPT.brightness);
    })();

    var dpr = Math.min(window.devicePixelRatio || 1, 1.4);
    function size(){
      [W, L, M].forEach(function(X){
        if (!X) return;
        var w = X.cv.clientWidth || host.offsetWidth || 1;
        var h = X.cv.clientHeight || host.offsetHeight || 1;
        X.cv.width  = Math.max(1, Math.floor(w * dpr));
        X.cv.height = Math.max(1, Math.floor(h * dpr));
        X.gl.viewport(0, 0, X.cv.width, X.cv.height);
        if (X === M)      X.gl.uniform3f(X.U('uResolution'), X.cv.width, X.cv.height, X.cv.width / X.cv.height);
        else if (X === L) X.gl.uniform3f(X.U('iResolution'), X.cv.width, X.cv.height, 1.0);
        else              X.gl.uniform2f(X.U('iResolution'), X.cv.width, X.cv.height);
      });
    }
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(host);
    else addEventListener('resize', size);

    var tg=[0.5,0.5], cu=[0.5,0.5], bt=0, bi=0, pt=[0,0], px=[0,0];
    host.parentNode.addEventListener('pointermove', function(e){
      var r = host.getBoundingClientRect();
      tg[0] = (e.clientX - r.left) / r.width;
      tg[1] = 1 - (e.clientY - r.top) / r.height;
      bt = 1;
      pt[0] =  ((e.clientX - r.left) / r.width  - 0.5) * 0.16;
      pt[1] = -((e.clientY - r.top)  / r.height - 0.5) * 0.16;
    });
    host.parentNode.addEventListener('pointerleave', function(){
      tg[0]=0.5; tg[1]=0.5; bt=0; pt[0]=0; pt[1]=0;
    });

    var onScreen = true;
    if ('IntersectionObserver' in window)
      new IntersectionObserver(function(e){ onScreen = e[0].isIntersecting; }, {threshold:0}).observe(host);

    function frame(t){
      requestAnimationFrame(frame);
      if (document.hidden || !onScreen) return;
      cu[0] += 0.05 * (tg[0] - cu[0]);
      cu[1] += 0.05 * (tg[1] - cu[1]);
      bi    += 0.05 * (bt - bi);
      px[0] += 0.05 * (pt[0] - px[0]);
      px[1] += 0.05 * (pt[1] - px[1]);
      var tm = t * 0.001;
      if (W){ W.gl.uniform1f(W.U('iTime'), tm); W.gl.uniform2f(W.U('uMouse'), cu[0], cu[1]); W.draw(); }
      if (L){ L.gl.uniform1f(L.U('iTime'), tm);
              L.gl.uniform2f(L.U('iMouse'), cu[0]*L.cv.width, cu[1]*L.cv.height);
              L.gl.uniform1f(L.U('bendInfluence'), bi);
              L.gl.uniform2f(L.U('parallaxOffset'), px[0], px[1]); L.draw(); }
      M.gl.uniform1f(M.U('uTime'), tm);
      M.gl.uniform2f(M.U('uMouse'), cu[0], cu[1]);
      M.draw();
    }
    requestAnimationFrame(frame);
    host.dataset.auroraOn = '1';
  }

  function boot(){
    var host = document.querySelector(HOST_SEL);
    if (!host || host.dataset.auroraOn === '1') return;
    if (tooWeak()) return;
    try { if (!document.createElement('canvas').getContext('webgl')) return; } catch(e){ return; }
    try { start(host); } catch(e){ /* 실패 시 정적 배경 유지 */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('hashchange', function(){ setTimeout(boot, 150); });
  window.MonnitAurora = { refresh: boot };
})();
