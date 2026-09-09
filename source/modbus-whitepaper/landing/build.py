#!/usr/bin/env python3
"""랜딩페이지 빌드 — 템플릿의 자리표시자를 채워 배포용 HTML을 만듭니다.

    python3 build.py              # 기본: PDF를 별도 파일로 두고 링크 (웹서버 배포용, 권장)
    python3 build.py --inline     # PDF까지 base64로 품은 단일 HTML (파일 하나로 전달할 때)

landing/ 디렉터리에서 실행하세요.

배포 전 아래 SITE_URL / GA4_ID / META_PIXEL_ID 를 채우면
링크 미리보기(OG)와 전환 추적이 함께 들어갑니다. 비워 두면 그 부분만 빠집니다.
"""

import argparse
import base64
import pathlib
import sys
import unicodedata
from urllib.parse import quote

# ─────────────────────────────────────────────────────────────
# 배포 설정 — 광고를 켜기 전에 채워 주세요
# ─────────────────────────────────────────────────────────────

# 랜딩페이지가 올라갈 최종 주소 (끝에 / 포함). 예: "https://www.monnitkorea.com/modbus/"
# 비워 두면 카카오톡·메일 링크 미리보기(OG 태그)가 들어가지 않습니다.
SITE_URL = "https://monnit.co.kr/promo/modbus/"

# Google Analytics 4 측정 ID. 예: "G-XXXXXXXXXX"
GA4_ID = "G-49THHRYKR4"

# Meta(페이스북) 픽셀 ID. 예: "123456789012345"
META_PIXEL_ID = "319816936268197"

# 서버가 한글 파일명을 제대로 처리하지 못할 때만 사용합니다.
# 예: PDF를 "monnit-modbus-whitepaper.pdf" 로 바꿔 올렸다면 그 이름을 여기에 적으세요.
# (다운로드될 때의 파일명은 여전히 한글로 저장됩니다.)
PDF_URL_NAME = ""

# ─────────────────────────────────────────────────────────────

HERE = pathlib.Path(__file__).resolve().parent
DIST = HERE.parent / "dist"

TEMPLATE = HERE / "landing_template.html"
OUTPUT = DIST / "modbus_landing.html"
PDF_NAME = "무선센서_Modbus_연동_백서_MonnitKorea.pdf"
OG_IMAGE = DIST / "og-image.jpg"
OG_SOURCE = HERE / "assets/ads/plc.jpg"


def find_pdf() -> pathlib.Path:
    """백서 PDF를 찾습니다.

    macOS는 한글 파일명을 자모가 분리된 형태(NFD)로 저장하는데, 리눅스 서버나 CI에서는
    이 차이 때문에 같은 이름인데도 파일을 못 찾습니다. 정규화를 맞춰 한 번 더 찾습니다.
    """
    exact = DIST / PDF_NAME
    if exact.exists():
        return exact
    want = unicodedata.normalize("NFC", PDF_NAME)
    for p in DIST.glob("*.pdf"):
        if unicodedata.normalize("NFC", p.name) == want:
            return p
    return exact  # 없으면 아래에서 "파일을 찾을 수 없습니다"로 걸립니다


PDF = find_pdf()

IMAGES = {
    "{{IMG_PLC}}": HERE / "assets/ads/plc.jpg",
    "{{IMG_BMS}}": HERE / "assets/ads/bms.jpg",
    "{{IMG_BP}}": HERE / "assets/ads/bp.jpg",
    "{{SHOT_SETTINGS}}": HERE / "assets/shots/f_settings_lan.jpg",
    "{{SHOT_RWDEF}}": HERE / "assets/shots/f_rwdef.jpg",
    "{{SHOT_POLL}}": HERE / "assets/shots/f_poll_th.jpg",
}

OG_TITLE = "무선센서 Modbus 연동 백서 | Monnit Korea"
OG_DESC = (
    "PLC·BMS·SCADA를 교체하지 않고 무선센서 데이터를 Modbus 레지스터로 읽는 방법. "
    "설정 화면 22컷을 실은 32페이지 기술 백서를 등록 절차 없이 받으실 수 있습니다."
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
    top = round(resized.height * 0.06)  # 헤드라인이 살아 있도록 위쪽 기준으로 자릅니다
    top = max(0, min(top, resized.height - th))
    resized.crop((left, top, left + tw, top + th)).save(OG_IMAGE, quality=88, optimize=True)
    return True


def head_social() -> str:
    """OG·트위터 카드와 분석 스크립트를 만듭니다. 설정이 비어 있으면 해당 부분만 빠집니다."""
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
        out.append("<!-- SITE_URL 미설정: 링크 미리보기(OG) 태그가 빠졌습니다. build.py 상단을 채워 주세요. -->")

    if GA4_ID:
        out += [
            f'<script async src="https://www.googletagmanager.com/gtag/js?id={GA4_ID}"></script>',
            "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
            f"gtag('js',new Date());gtag('config','{GA4_ID}');</script>",
        ]
    else:
        out.append("<!-- GA4_ID 미설정: 방문·다운로드 집계가 되지 않습니다. -->")

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
        out.append("<!-- META_PIXEL_ID 미설정: 메타 광고 전환 최적화가 동작하지 않습니다. -->")

    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="랜딩페이지 빌드")
    ap.add_argument("--inline", action="store_true",
                    help="PDF를 HTML 안에 base64로 포함 (파일 하나로 전달할 때만 사용)")
    args = ap.parse_args()

    missing = [str(p) for p in [TEMPLATE, PDF, *IMAGES.values()] if not p.exists()]
    if missing:
        print("파일을 찾을 수 없습니다:", *missing, sep="\n  ")
        return 1

    html = TEMPLATE.read_text(encoding="utf-8")

    for slot, path in IMAGES.items():
        html = html.replace(slot, b64(path))

    html = html.replace("{{HEAD_SOCIAL}}", head_social())
    html = html.replace("{{PDF_NAME}}", unicodedata.normalize("NFC", PDF.name))

    if args.inline:
        html = html.replace("{{PDF_HREF}}", "#download")
        html = html.replace("{{PDF_B64}}", b64(PDF))
    else:
        # 같은 폴더에 PDF를 함께 올리는 것을 전제로 상대 경로로 겁니다.
        # 한글 파일명은 퍼센트 인코딩해야 서버·브라우저 환경을 덜 탑니다.
        html = html.replace("{{PDF_HREF}}", quote(PDF_URL_NAME or unicodedata.normalize("NFC", PDF.name)))
        html = html.replace("{{PDF_B64}}", "")

    if "{{" in html:
        leftover = sorted({html[i:i + 40] for i in range(len(html)) if html.startswith("{{", i)})
        print("채워지지 않은 자리표시자가 남아 있습니다:", *leftover, sep="\n  ")
        return 1

    DIST.mkdir(exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")

    size = len(html.encode()) / 1048576
    mode = "단일 파일 (PDF 인라인)" if args.inline else "PDF 분리"
    print(f"{OUTPUT}  ({size:.2f} MB, {mode})")

    if make_og_image():
        print(f"{OG_IMAGE}  (1200×630)")

    print("\n업로드할 파일")
    print(f"  - {OUTPUT.name}")
    if not args.inline:
        print(f"  - {unicodedata.normalize('NFC', PDF.name)}          ← 같은 폴더에 함께 올려야 다운로드가 됩니다")
    print(f"  - {OG_IMAGE.name}                    ← 링크 미리보기용")

    todo = [n for n, v in [("SITE_URL", SITE_URL), ("GA4_ID", GA4_ID),
                           ("META_PIXEL_ID", META_PIXEL_ID)] if not v]
    if todo:
        print("\n아직 비어 있는 설정: " + ", ".join(todo) + "  (build.py 상단)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
