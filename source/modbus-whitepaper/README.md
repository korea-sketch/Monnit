# Monnit Korea — 무선센서 Modbus 연동 백서

PLC · BMS · SCADA를 교체하지 않고 무선센서 데이터를 Modbus로 연결하는 방법을 다룬
기술 백서(32p PDF)와, 광고에서 유입되는 다운로드 랜딩페이지의 소스입니다.

## 디렉터리

```
whitepaper/
  whitepaper.html          백서 원본 (HTML → PDF)
  figs/                    본문 화면 캡처 22컷 (일부는 번호 주석 포함)
landing/
  landing_template.html    랜딩페이지 템플릿 ({{...}} 자리표시자 포함)
  build.py                 템플릿 + 이미지 → 배포용 HTML 빌드
  assets/ads/              광고 크리에이티브 (PLC편 / BMS편 / 구성도편)
  assets/shots/            랜딩에 노출되는 주석 화면 3컷
dist/
  무선센서_Modbus_연동_백서_MonnitKorea.pdf    최종 백서
  modbus_landing.html                          빌드된 랜딩페이지
  og-image.jpg                                 링크 미리보기용 이미지 (1200×630)
확인필요-백서보완.md       제품 확인이 필요해 아직 백서에 넣지 못한 항목
```

## 광고를 켜기 전에 — 반드시 채워야 하는 3가지

`landing/build.py` 상단을 열고 아래 세 값을 채운 뒤 다시 빌드하십시오.
비워 두면 빌드는 되지만 링크 미리보기와 성과 측정이 동작하지 않습니다.

```python
SITE_URL      = ""   # 랜딩이 올라갈 최종 주소 (끝에 / 포함)
GA4_ID        = ""   # 예: "G-XXXXXXXXXX"
META_PIXEL_ID = ""   # 예: "123456789012345"
```

빌드하면 아직 비어 있는 항목을 마지막 줄에 알려 줍니다.

## 랜딩페이지 빌드

```bash
cd landing
python3 build.py            # 기본: PDF 분리 (웹서버 배포용, 권장)
python3 build.py --inline   # PDF까지 품은 단일 HTML (파일 하나로 전달할 때)
```

기본 모드에서는 **HTML과 PDF, og-image.jpg 세 파일을 같은 폴더에 함께 올려야** 합니다.
PDF를 분리하면 HTML이 4.8MB에서 1MB 아래로 줄어, 모바일 첫 로딩이 빨라집니다.

서버가 한글 파일명을 제대로 처리하지 못하면, PDF를 영문 이름으로 바꿔 올린 뒤
`build.py` 의 `PDF_URL_NAME` 에 그 이름을 적으면 됩니다. 저장될 때의 파일명은 그대로 한글입니다.

## 백서 빌드

WeasyPrint와 한글 폰트(Noto Sans CJK KR)가 필요합니다.

```bash
pip install weasyprint
cd whitepaper
weasyprint whitepaper.html "../dist/무선센서_Modbus_연동_백서_MonnitKorea.pdf"
```

`figs/`는 `whitepaper.html` 기준 상대 경로로 참조되므로 두 파일은 같은 디렉터리에 두어야 합니다.
백서를 다시 만든 뒤 `--inline` 으로 빌드할 계획이라면 랜딩페이지도 다시 빌드해야 PDF가 갱신됩니다.

## 다운로드 버튼 동작

다운로드 버튼은 표준 `<a href download>` 링크입니다. 자바스크립트가 막혀 있어도 눌리며,
`--inline` 빌드에서는 Blob + `createObjectURL` 로 저장합니다.
**이전 버전에 있던 claude.ai 전용 저장 코드는 제거했습니다** — 일반 웹서버에서는 동작하지 않았습니다.

메타(페이스북·인스타그램) 앱 안의 브라우저로 들어온 경우에는 저장이 막힐 수 있어,
해당 환경에서만 상단에 "다른 브라우저에서 열기" 안내 띠가 자동으로 나타납니다.

## 전환 이벤트

`GA4_ID` 또는 `META_PIXEL_ID` 를 채우면 아래 두 이벤트가 전송됩니다.
둘 다 비어 있으면 아무것도 전송되지 않습니다.

| 이벤트 | 시점 |
| --- | --- |
| `whitepaper_download` | 백서 다운로드 버튼 클릭 (`placement` 로 히어로/하단 구분) |
| `support_form_compose` | 기술지원 문의 내용 정리 버튼 클릭 |

메타 광고의 전환 최적화는 `whitepaper_download` 를 기준으로 잡으시면 됩니다.

## 문의 폼

기술지원 문의 폼은 서버로 아무것도 보내지 않습니다. 입력값을 브라우저 안에서
정리된 텍스트로 만들어 복사하거나 `mailto:` 로 여는 방식이라, 개인정보가 페이지에
저장되지 않습니다. 수신 주소는 `korea@monnit.com` 이며
`landing_template.html` 에서 문자열로 검색해 바꿀 수 있습니다.

다만 앱 내 브라우저에서는 클립보드 복사와 `mailto:` 가 막히는 경우가 있습니다.
메타 광고를 본격적으로 돌린다면 서버로 받는 폼(자사 폼 또는 구글폼)으로 바꾸는 편이 안전합니다.

## 수치 검증 메모

백서의 레지스터 값과 스케일은 실제 캡처 화면과 대조해 확정했습니다.

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 슬롯 N 시작 주소 | `40101 + 16 × (N − 1)` | 제품 문서 (그림 4-1) |
| 온습도 Data1 / Data2 | 읽은 값 ÷ 100 | 2291 / 3955 → 22.91℃ / 39.55 %RH, 플랫폼 화면과 일치 |
| 배터리 전압 | 읽은 값 ÷ 100 | 321 → 3.21V |
| 조도 | `(Data1 × 65536 + Data2) ÷ 100` | 0x58080 = 360576 → 3,605.76 Lux |
| Application ID | 온습도 43 · 누수 4 · 조도 107 · 모션플러스 138 · CO₂ 106 | 실측 화면 |

## 상표 · 공개 전 확인

Monnit, iMonnit, ALTA, Encrypt-RF는 Monnit Corporation의 상표입니다.
화면 캡처에 담긴 IP · 센서 ID · 측정값은 캡처 당시의 실제 값이므로, 외부 공개 전에
공개해도 되는 정보인지 한 번 확인하시기 바랍니다.

백서에 아직 채우지 못한 항목은 `확인필요-백서보완.md` 에 정리해 두었습니다.
특히 **KC 인증·국내 주파수**와 **영하 온도 표현 방식**은 광고 유입 전에 정리하시길 권합니다.
