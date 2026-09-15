#!/usr/bin/env python3
"""랜딩페이지 빌드 — 템플릿의 자리표시자를 채워 배포용 HTML을 만듭니다.

    python3 build.py

landing/ 디렉터리에서 실행하세요.

백서 PDF는 페이지 안에 담지 않고, 같은 폴더에 나란히 올려 두고 링크로 겁니다.
발급 API(DOC_API)를 설정하면 그쪽을 우선 사용하고, 비어 있으면 직접 링크로 동작합니다.

배포 전 아래 SITE_URL / GA4_ID / META_PIXEL_ID 를 채우면
링크 미리보기(OG)와 전환 추적이 함께 들어갑니다. 비워 두면 그 부분만 빠집니다.
"""

import base64
import pathlib
import re
import sys
import unicodedata
from urllib.parse import quote

# ─────────────────────────────────────────────────────────────
# 배포 설정
# ─────────────────────────────────────────────────────────────

SITE_URL = "https://monnit.co.kr/promo/modbus/"

# 이미 사이트 전역에 GTM이 들어가 있다면 비워 두십시오 (중복 삽입 방지).
GA4_ID = ""
META_PIXEL_ID = ""

# 서버가 한글 파일명을 처리하지 못할 때만 사용합니다.
# PDF를 영문 이름으로 바꿔 올렸다면 그 이름을 적으십시오. (저장될 때의 이름은 그대로 한글입니다)
PDF_URL_NAME = ""

# ─────────────────────────────────────────────────────────────

HERE = pathlib.Path(__file__).resolve().parent
DIST = HERE.parent / "dist"

TEMPLATE = HERE / "landing_template.html"
THEME = HERE / "theme.css"
OUTPUT = DIST / "promo-modbus.html"
PDF_NAME = "무선센서_Modbus_연동_백서_MonnitKorea.pdf"
OG_IMAGE = DIST / "og-image.jpg"
OG_SOURCE = HERE / "assets/ads/plc.jpg"   # 링크 미리보기용 (광고 소재)

IMAGES = {
    # 실제 제품 사진 (Monnit Component 자산)
    "{{PROD_HERO}}": HERE / "assets/product/hero-products.png",
    # 다운로드 패널 구성도
    "{{IMG_BP}}": HERE / "assets/ads/bp.jpg",
}

OG_TITLE = "Modbus 구성 제안 | Monnit Korea"
OG_DESC = (
    "PLC·BMS·SCADA를 그대로 두고 무선센서를 Modbus로 붙이는 구성 제안 4종. "
    "현장 유형별 센서 수량과 점유 레지스터 주소까지 43페이지로 정리했습니다."
)


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def make_og_image() -> bool:
    """OG용 1200×630 이미지를 광고 소재에서 잘라 만듭니다. Pillow가 없으면 건너뜁니다."""
    try:
        from PIL import Image
    except ImportError:
        print("  ! Pillow가 없어 og-image.jpg를 만들지 못했습니다 (pip install pillow)")
        return False

    src = Image.open(OG_SOURCE).convert("RGB")
    tw, th = 1200, 630
    scale = max(tw / src.width, th / src.height)
    resized = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    left = (resized.width - tw) // 2
    top = max(0, min(round(resized.height * 0.06), resized.height - th))
    resized.crop((left, top, left + tw, top + th)).save(OG_IMAGE, quality=88, optimize=True)
    return True


def head_social() -> str:
    out = []
    if SITE_URL:
        base = SITE_URL if SITE_URL.endswith("/") else SITE_URL + "/"
        out += [
            f'<link rel="canonical" href="{base}">',
            '<meta property="og:type" content="website">',
            '<meta property="og:locale" content="ko_KR">',
            '<meta property="og:site_name" content="Monnit Korea">',
            f'<meta property="og:title" content="{OG_TITLE}">',
            f'<meta property="og:description" content="{OG_DESC}">',
            f'<meta property="og:url" content="{base}">',
            f'<meta property="og:image" content="{base}og-image.jpg">',
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{OG_TITLE}">',
            f'<meta name="twitter:description" content="{OG_DESC}">',
            f'<meta name="twitter:image" content="{base}og-image.jpg">',
        ]
    else:
        out.append("<!-- SITE_URL 미설정: 링크 미리보기(OG) 태그가 빠졌습니다. -->")

    if GA4_ID:
        out += [
            f'<script async src="https://www.googletagmanager.com/gtag/js?id={GA4_ID}"></script>',
            "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
            f"gtag('js',new Date());gtag('config','{GA4_ID}');</script>",
        ]
    else:
        out.append("<!-- GA4: 사이트 전역 GTM에서 처리 (여기서는 삽입하지 않음) -->")

    if META_PIXEL_ID:
        out += [
            "<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?"
            "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;"
            "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;"
            "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}"
            "(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');"
            f"fbq('init','{META_PIXEL_ID}');fbq('track','PageView');</script>",
            f'<noscript><img height="1" width="1" style="display:none" alt=""'
            f' src="https://www.facebook.com/tr?id={META_PIXEL_ID}&ev=PageView&noscript=1"></noscript>',
        ]
    else:
        out.append("<!-- Meta Pixel: 사이트 전역 GTM에서 처리 (여기서는 삽입하지 않음) -->")

    return "\n".join(out)


def main() -> int:
    missing = [str(p) for p in [TEMPLATE, THEME, *IMAGES.values()] if not p.exists()]
    if missing:
        print("파일을 찾을 수 없습니다:", *missing, sep="\n  ")
        return 1

    html = TEMPLATE.read_text(encoding="utf-8")
    for slot, path in IMAGES.items():
        html = html.replace(slot, b64(path))
    html = html.replace("{{THEME_CSS}}", THEME.read_text(encoding="utf-8"))
    html = html.replace("{{HEAD_SOCIAL}}", head_social())
    pdf_name = unicodedata.normalize("NFC", PDF_NAME)
    html = html.replace("{{PDF_NAME}}", pdf_name)
    # PDF 는 공개 주소가 없습니다. sendpw 게이트로만 전달되므로 직접 링크는 쓰지 않습니다.
    html = html.replace("{{PDF_HREF}}", "#download")

    if "{{" in html:
        leftover = sorted({html[i:i + 40] for i in range(len(html)) if html.startswith("{{", i)})
        print("채워지지 않은 자리표시자가 남아 있습니다:", *leftover, sep="\n  ")
        return 1

    DIST.mkdir(exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"{OUTPUT}  ({len(html.encode()) / 1048576:.2f} MB)")

    if make_og_image():
        print(f"{OG_IMAGE}  (1200×630)")

    pdf = DIST / pdf_name
    if not pdf.exists():
        for p in DIST.glob("*.pdf"):
            if unicodedata.normalize("NFC", p.name) == pdf_name:
                pdf = p
                break

    # ── 저장소(Monnit-main) 배치 경로 ──────────────────────────
    print("\n저장소에 넣을 위치")
    print(f"  promo-modbus.html                              ← {OUTPUT.name}")
    print("  promo/modbus/index.html                        ← 같은 파일 사본 (build.js 가 자동 생성)")
    print(f"  promo/modbus/og-image.jpg                      ← {OG_IMAGE.name}")
    print(f"  proposals/modbus-integration-whitepaper.pdf    ← {pdf_name}")

    m = re.search(r'var\s+DOC_TITLE\s*=\s*"([^"]+)"', html)
    print(f"\n· 자료 게이트: sendpw → getdoc   DOC_TITLE = {m.group(1) if m else '(없음)'}")
    print("  이 제목이 netlify/functions/_docmap.js 의 키와 한 글자라도 다르면 not_ready 로 떨어집니다.")
    if 'name="robots"' in html:
        print("  ⚠ robots 메타가 남아 있습니다 — /promotions 노출이면 빼야 합니다.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
