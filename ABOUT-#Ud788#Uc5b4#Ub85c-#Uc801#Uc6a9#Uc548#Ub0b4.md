# About us 히어로 배경 — WebGL 별밭(Galaxy) 적용

`/who-we-are` 상단 히어로의 배경을 정적 SVG 에서 **움직이는 WebGL 별밭**으로 바꿨습니다.

원본은 React Bits 의 `<Galaxy />` 컴포넌트(React + ogl)입니다. 이 저장소는 번들러가
없는 정적 사이트라 **순수 WebGL1 + DOM 으로 다시 작성**했습니다. npm 설치도, 빌드
단계 추가도 없습니다. 외부 의존성 0.

---

## 바뀐 파일 — 3개

| 파일 | 상태 | 내용 |
|---|---|---|
| `js/galaxy-hero.js` | **신규** | 별밭 렌더러 (약 470줄, 의존성 없음) |
| `index.html` | 수정 | 4줄 |
| `style.css` | 수정 | 끝에 블록 추가 (약 45줄) |

`images/about-hero-pulse.svg` 는 **그대로 둡니다.** 폴백으로 계속 씁니다.

### index.html 변경분

```diff
-      <div class="about-hero2">
-        <figure class="ah-media">
+      <div class="about-hero2 about-hero-galaxy">
+        <!-- 배경: WebGL 별밭(js/galaxy-hero.js) … -->
+        <figure class="ah-media" data-galaxy-hero>
```

```diff
   <script src="/js/hero-aurora.js?v=3" defer></script>
+  <script src="/js/galaxy-hero.js?v=1" defer></script>
```

```diff
- <link rel="stylesheet" href="/style.css?v=112">
+ <link rel="stylesheet" href="/style.css?v=113">
```

CSS 를 고쳤으니 캐시 버스팅 버전을 올렸습니다.

`about-hero2` 는 다른 페이지에 쓰이지 않고, `about-hero-galaxy` 와
`data-galaxy-hero` 는 About 히어로 한 곳에만 붙습니다. 다른 뷰에는 영향이 없습니다.

---

## 배포

`build.js` 는 손대지 않았습니다. Netlify 가 평소대로 `node build.js` 를 돌리면
`/who-we-are/index.html` 이 새 마크업으로 다시 만들어집니다. 확인했습니다.

---

## 동작 방식

스크립트가 `[data-galaxy-hero]` 를 찾아 자동으로 붙습니다. 손댈 일이 있으면:

```js
var hero = MonnitGalaxyHero.mount(el, { density: 1.4 });
hero.set({ hueShift: 200 });   // 실행 중 값 변경
hero.destroy();
```

마크업에 JSON 으로 넣어도 됩니다.

```html
<figure class="ah-media" data-galaxy-hero='{"density":1.4,"hueShift":200}'>
```

### 배경색을 폴백 SVG 와 맞춘 이유

셰이더가 그리는 바탕은 `images/about-hero-pulse.svg` 의 `#bgrad` 와 **같은 값**입니다.
(`#0E1A2E` → `#0A1220` → `#05080F`, 중심 72%/44%, 반경 82%)

정적 SVG 가 먼저 보이고 캔버스가 준비되면 0.9초 동안 겹치며 교차하는데, 바탕색이
다르면 이 구간에서 배경이 한 번 출렁입니다. 같은 그라데이션을 셰이더 안에서 다시
그려서 별만 서서히 떠오르게 했습니다.

### 원본 컴포넌트에서 바꾼 값

| 항목 | 원본 | 이 구현 | 이유 |
|---|---|---|---|
| `hueShift` | 140 (초록) | **215** | 사이트 액센트 `#4A82C4` 와 맞춤 |
| `saturation` | 0.0 | **0.18** | 아래 참고 |
| `rotationSpeed` | 0.1 | **0.03** | 0.1 은 글 읽는 동안 배경 회전이 눈에 걸림 |
| `mouseRepulsion` | true | **제거** | 커서가 별을 밀어내는 연출은 카피가 얹힌 히어로에서 산만함. 얕은 패럴랙스로 대체 |
| `transparent` | true | **제거** | 검정 대신 위 그라데이션 위에 가산 합성 |

**`saturation` 은 0.4 이상 올리지 마세요.** 셰이더가 별마다 base 색에서 hue 를 따로
뽑아 `hueShift` 를 더하는 구조라, 채도를 올리면 하나의 색으로 모이는 게 아니라
색상환 전체로 퍼집니다. 주황·자주 별이 섞여 브랜드 톤이 깨집니다. 0.18 로 낮춰
청백색만 남기고, 전체 색조는 `tint`(`#BFD6F2`) 가 담당합니다.

---

## 성능

픽셀마다 **4개 깊이 층 × 9칸 = 36회** 별 계산을 돕니다. 비용이 해상도에 정비례해서
픽셀 수를 두 단계로 눌렀습니다.

- `maxDPR` — 기기 DPR 상한. 기본 1.6, 저사양 1.25
- `renderScale` — 실제 렌더 배율. 데스크톱 1.0 / 모바일 0.85 / 저사양 0.7.
  낮은 해상도로 그린 뒤 CSS 가 확대합니다. 별밭은 이 방식에 관대합니다.

저사양 판정은 `navigator.deviceMemory ≤ 4` 또는 `hardwareConcurrency ≤ 4` 입니다.
`js/hero-aurora.js` 의 `tooWeak()` 과 같은 기준입니다.

자동 정지: 탭 비활성, 화면 밖(`IntersectionObserver`),
`prefers-reduced-motion: reduce`(정지 프레임 1장만 그리고 루프를 아예 안 돕니다).

---

## SPA 대응

이 사이트는 `app.js` 가 `.view` 를 껐다 켭니다. About 뷰가 숨겨진 채 마운트되면
`clientWidth` 가 0 이라 첫 프레임을 그릴 수 없습니다.

이때 **캔버스를 그리지 않고 `.oh-ready` 도 붙이지 않습니다.** 정적 SVG 가 그대로
보입니다. 사용자가 About 으로 이동해 뷰가 켜지면 `IntersectionObserver` 가 감지해
그때 첫 프레임을 그리고 페이드인합니다. 빈 검정 화면이 남는 구간이 없습니다.

---

## 실패 시 동작

| 상황 | 결과 |
|---|---|
| JS 비활성 / 크롤러 | 정적 SVG 그대로 (`alt` 텍스트 포함) |
| WebGL 미지원 | `mount()` 가 `null`, 캔버스 삽입 안 함, 정적 SVG 유지 |
| 셰이더 컴파일·링크 실패 | 위와 동일 |
| GL 컨텍스트 유실 | `.oh-ready` 제거 → 정적 SVG 가 다시 올라옴 |

`.oh-ready` 는 **첫 프레임을 실제로 그린 뒤에만** 붙습니다.

---

## 검증 내역

작업 환경에 헤드리스 브라우저를 띄울 수 없어(ARM) 세 갈래로 확인했습니다.

- **셰이더** — 프래그먼트 셰이더를 numpy 로 다시 구현해 실제 히어로 크기(1240×560)로
  래스터화. 별·플레어·반짝임·깊이 층, 그리고 배경 그라데이션이 SVG 와 맞는지 픽셀로
  확인했습니다.
- **WebGL 배선 + SPA 경로** — jsdom + GL 스텁으로 이 저장소의 실제 `index.html` 에
  붙여 시험했습니다. 뷰가 숨겨진 동안 draw 0회 · `.oh-ready` 없음 → `.active` 가
  붙은 뒤 draw 발생 · `.oh-ready` 부착 · 캔버스 1440→1260px(저사양 경로) 확인,
  `destroy()` 후 캔버스·클래스 정리까지 확인했습니다. `ResizeObserver` 가 없는
  브라우저 경로에서도 동일하게 동작합니다.
- **빌드** — `node build.js` 를 돌려 정적 페이지 117개가 정상 생성되고,
  `/who-we-are/index.html` 에 새 훅 4개가 모두 들어가는 것을 확인했습니다.

**확인하지 못한 것:** 실제 GPU 에서의 렌더 결과와 프레임 속도. 배포 전에 실기기로
한 번 열어봐 주세요. 구형 안드로이드에서 프레임이 떨어지면 `js/galaxy-hero.js` 의
`presetFor()` 에서 `renderScale` 을 먼저 낮추시는 걸 권합니다.

---

## 롤백

```diff
- <div class="about-hero2 about-hero-galaxy">
+ <div class="about-hero2">
- <figure class="ah-media" data-galaxy-hero>
+ <figure class="ah-media">
```

`<script src="/js/galaxy-hero.js…">` 줄을 지우면 끝입니다. `style.css` 의 블록은
`.about-hero-galaxy` 로만 걸려 있어 남겨 둬도 아무 영향이 없습니다.
