#!/usr/bin/env python3
"""도식 생성기 — 랜딩(다크)과 백서(인쇄)에 같은 도식을 각 팔레트로 그려 넣습니다.

    python3 diagrams.py

landing/ 에서 실행하면 landing_template.html 과 ../whitepaper/whitepaper.html 의
자리표시자 주석을 찾아 SVG를 채워 넣습니다. 이미 채워져 있으면 다시 채웁니다.
사진은 건드리지 않습니다.
"""

import pathlib
import re
import sys

# ── 팔레트 ────────────────────────────────────────────────────
DARK = dict(
    bg="none", panel="#102B49", panel2="#0C1F36", line="#1C3C60",
    ink="#EAF2FB", ink2="#9DB4D0", ink3="#65809F",
    accent="#6FE3C0", accent_d="#2FB894", wire="#3EA8F5", warn="#F0B85A",
    tint="#10322C", tint_line="#2FB894",
)
PRINT = dict(
    bg="none", panel="#f7fafd", panel2="#eef4fa", line="#c3d1e2",
    ink="#0a1a33", ink2="#33465e", ink3="#5b6b80",
    accent="#1a9c78", accent_d="#127a5e", wire="#2f6fb5", warn="#9a6b06",
    tint="#e9f7f2", tint_line="#1a9c78",
)

# 랜딩(웹)용 — 흰 바탕에 브랜드 블루
WEB = dict(
    bg="none", panel="#f5f5f7", panel2="#ececf0", line="#e4e4e7",
    ink="#16181d", ink2="#53565d", ink3="#86868b",
    accent="#1168AD", accent_d="#0d5590", wire="#1168AD", warn="#b3541e",
    tint="#eaf3fa", tint_line="#1168AD",
)

FONT = 'font-family="IBM Plex Mono, Noto Sans Mono CJK KR, monospace"'
SANS = 'font-family="Pretendard, Noto Sans CJK KR, sans-serif"'


# ── 1. 레지스터 16칸 구조 ──────────────────────────────────────
def reg_strip(p):
    x0, w, y, h = 56, 41, 76, 48
    cells = []
    for i in range(16):
        x = x0 + i * w
        state = i < 8
        cells.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" '
            f'fill="{p["panel"] if state else p["tint"]}" '
            f'stroke="{p["line"] if state else p["tint_line"]}" stroke-width="1"/>'
            f'<text x="{x + w/2:.0f}" y="{y + h/2 + 4:.0f}" {FONT} font-size="11" '
            f'fill="{p["ink3"] if state else p["accent"]}" text-anchor="middle">+{i}</text>'
        )
    mid = x0 + 8 * w
    end = x0 + 16 * w
    return f'''<svg viewBox="0 0 760 232" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="센서 1대에 할당되는 레지스터 16개의 구조. 앞 8개는 센서 상태, 뒤 8개는 측정값입니다.">
  <text x="{x0}" y="34" {FONT} font-size="12" fill="{p['wire']}">40101</text>
  <text x="{end}" y="34" {FONT} font-size="12" fill="{p['wire']}" text-anchor="end">40116</text>
  <text x="{(x0+end)/2:.0f}" y="34" {SANS} font-size="11.5" fill="{p['ink3']}" text-anchor="middle">센서 1대 = 슬롯 1개 = 레지스터 16개</text>
  <line x1="{x0}" y1="44" x2="{end}" y2="44" stroke="{p['line']}" stroke-width="1"/>
  <line x1="{x0}" y1="44" x2="{x0}" y2="{y-6}" stroke="{p['line']}"/>
  <line x1="{end}" y1="44" x2="{end}" y2="{y-6}" stroke="{p['line']}"/>
  {''.join(cells)}
  <line x1="{mid}" y1="{y-14}" x2="{mid}" y2="{y+h+14}" stroke="{p['accent']}" stroke-width="2"/>
  <text x="{mid+8}" y="{y-20}" {SANS} font-size="12" font-weight="600" fill="{p['accent']}">여기부터 측정값</text>
  <path d="M{x0} {y+h+26} v10 h{8*w} v-10" fill="none" stroke="{p['line']}" stroke-width="1.4"/>
  <path d="M{mid} {y+h+26} v10 h{8*w} v-10" fill="none" stroke="{p['tint_line']}" stroke-width="1.4"/>
  <text x="{x0 + 4*w:.0f}" y="{y+h+58}" {SANS} font-size="13" font-weight="700" fill="{p['ink']}" text-anchor="middle">앞 8개 · 센서 상태</text>
  <text x="{x0 + 4*w:.0f}" y="{y+h+78}" {SANS} font-size="11.5" fill="{p['ink3']}" text-anchor="middle">통신 두절 · 배터리 · 신호 세기 · 고장 판정</text>
  <text x="{mid + 4*w:.0f}" y="{y+h+58}" {SANS} font-size="13" font-weight="700" fill="{p['accent']}" text-anchor="middle">뒤 8개 · 측정값</text>
  <text x="{mid + 4*w:.0f}" y="{y+h+78}" {SANS} font-size="11.5" fill="{p['ink3']}" text-anchor="middle">Data 1 ~ Data 8 · 센서 종류마다 정의가 다름</text>
</svg>'''


# ── 2. 슬롯이 쌓이는 방식 ──────────────────────────────────────
def slot_stack(p):
    rows = [("슬롯 1", "40101 – 40116", 0), ("슬롯 2", "40117 – 40132", 1),
            ("슬롯 3", "40133 – 40148", 2), (None, None, 3), ("슬롯 256", "44181 – 44196", 4)]
    bx, bw, bh, gap = 118, 396, 26, 40
    out = []
    for label, addr, i in rows:
        y = 26 + i * gap
        if label is None:
            out.append(f'<text x="{bx + bw/2:.0f}" y="{y+18}" {FONT} font-size="14" '
                       f'fill="{p["ink3"]}" text-anchor="middle">⋮</text>')
            continue
        ticks = ''.join(
            f'<line x1="{bx + bw/16*k:.1f}" y1="{y}" x2="{bx + bw/16*k:.1f}" y2="{y+bh}" '
            f'stroke="{p["line"]}" stroke-width="0.8"/>' for k in range(1, 16))
        half = f'<rect x="{bx + bw/2:.0f}" y="{y}" width="{bw/2:.0f}" height="{bh}" fill="{p["tint"]}" opacity="0.9"/>'
        out.append(
            f'<text x="{bx-14}" y="{y+bh/2+4:.0f}" {SANS} font-size="12.5" fill="{p["ink2"]}" text-anchor="end">{label}</text>'
            f'<rect x="{bx}" y="{y}" width="{bw}" height="{bh}" fill="{p["panel"]}" stroke="{p["line"]}"/>'
            f'{half}{ticks}'
            f'<text x="{bx+bw+16}" y="{y+bh/2+4:.0f}" {FONT} font-size="12" fill="{p["wire"]}">{addr}</text>')
    # 행 사이 간격에 +16 표시 (겹치지 않도록 라벨 열 안쪽에)
    arrows = ''.join(
        f'<text x="{bx-14}" y="{26+i*gap+bh+11}" {FONT} font-size="10.5" '
        f'fill="{p["accent_d"]}" text-anchor="end">↓ +16</text>'
        for i in (0, 1))
    return f'''<svg viewBox="0 0 760 220" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="슬롯이 하나씩 늘어날 때 시작 주소가 16씩 커지는 구조. 슬롯 1은 40101, 슬롯 256은 44181에서 시작합니다.">
  {arrows}{''.join(out)}
</svg>'''


# ── 3. 계측점 하나를 늘릴 때 ───────────────────────────────────
def add_point(p):
    wired = ["배선 설계", "트레이 · 배관", "전원 인출", "결선", "시운전", "도면 갱신"]
    wireless = ["센서 부착", "슬롯 등록", "태그 매핑"]

    # 유선 6단계가 폭을 넘지 않도록 칸 너비를 전체 폭에서 역산합니다.
    x0, xend, g = 92, 756, 8
    cw = (xend - x0 - g * (len(wired) - 1)) / len(wired)

    def chips(items, y, color, fill):
        s = []
        for i, t in enumerate(items):
            cx = x0 + i * (cw + g)
            s.append(f'<rect x="{cx:.1f}" y="{y}" width="{cw:.1f}" height="34" rx="2" fill="{fill}" stroke="{color}"/>'
                     f'<text x="{cx+cw/2:.0f}" y="{y+22}" {SANS} font-size="11.5" fill="{p["ink"]}" text-anchor="middle">{t}</text>')
        return ''.join(s), x0 + len(items) * (cw + g) - g

    a, _ = chips(wired, 46, p["line"], p["panel"])
    b, bend = chips(wireless, 128, p["tint_line"], p["tint"])
    return f'''<svg viewBox="0 0 760 196" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="계측점 하나를 늘릴 때 유선은 여섯 단계에 설비 정지가 필요하고, 무선은 세 단계로 운전 중에 끝납니다.">
  <text x="0" y="26" {SANS} font-size="12" font-weight="700" fill="{p['ink3']}">계측점 1개를 늘릴 때</text>
  <text x="0" y="62" {SANS} font-size="12.5" font-weight="700" fill="{p['ink2']}">유선</text>
  <text x="0" y="80" {SANS} font-size="11" fill="{p['warn']}">설비 정지</text>
  <text x="0" y="144" {SANS} font-size="12.5" font-weight="700" fill="{p['accent']}">무선</text>
  <text x="0" y="162" {SANS} font-size="11" fill="{p['accent_d']}">운전 중</text>
  {a}{b}
  <text x="{bend+16:.0f}" y="149" {SANS} font-size="11.5" fill="{p['ink3']}">막히는 지점은 센서가 아니라 앞줄의 여섯 단계였습니다.</text>
</svg>'''


# ── 4. 산업 아이콘 (랜딩 전용) ─────────────────────────────────
def icon(kind, p):
    c = p["accent"]
    body = {
        "factory": '<path d="M2 22h24M5 22V11l6 4V11l6 4V6h6v16" fill="none" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>' % c,
        "idc": '<rect x="5" y="4" width="18" height="6" fill="none" stroke="%s" stroke-width="1.6"/>'
               '<rect x="5" y="11" width="18" height="6" fill="none" stroke="%s" stroke-width="1.6"/>'
               '<rect x="5" y="18" width="18" height="6" fill="none" stroke="%s" stroke-width="1.6"/>'
               '<circle cx="19" cy="7" r="1.2" fill="%s"/><circle cx="19" cy="14" r="1.2" fill="%s"/>'
               '<circle cx="19" cy="21" r="1.2" fill="%s"/>' % (c, c, c, c, c, c),
        "bms": '<path d="M4 24V6h10v18M14 24V12h8v12M2 24h24" fill="none" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>'
               '<path d="M7 10h2M7 14h2M7 18h2M17 16h2M17 20h2" stroke="%s" stroke-width="1.4"/>' % (c, c),
        "energy": '<path d="M14 3v21M6 24l8-9 8 9M8 12h12M9.5 8h9" fill="none" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>' % c,
    }[kind]
    return (f'<svg class="ind-icon" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" '
            f'aria-hidden="true" focusable="false">{body}</svg>')


# ── 삽입 ──────────────────────────────────────────────────────
HERE = pathlib.Path(__file__).resolve().parent


def fill(path: pathlib.Path, blocks: dict) -> int:
    s = path.read_text(encoding="utf-8")
    n = 0
    for key, svg in blocks.items():
        open_t, close_t = f"<!--DGM:{key}-->", f"<!--/DGM:{key}-->"
        pat = re.compile(re.escape(open_t) + r".*?" + re.escape(close_t), re.S)
        if not pat.search(s):
            print(f"  ! {path.name}: {key} 자리표시자를 찾지 못했습니다")
            continue
        s = pat.sub(lambda _m: open_t + "\n" + svg + "\n" + close_t, s)
        n += 1
    path.write_text(s, encoding="utf-8")
    return n


def main() -> int:
    landing = HERE / "landing_template.html"
    paper = HERE.parent / "whitepaper" / "whitepaper.html"

    n1 = fill(landing, {
        "reg": reg_strip(WEB),
        "slot": slot_stack(WEB),
        "addpoint": add_point(WEB),
        "icon-factory": icon("factory", WEB),
        "icon-idc": icon("idc", WEB),
        "icon-bms": icon("bms", WEB),
        "icon-energy": icon("energy", WEB),
    })
    print(f"{landing.name}: 도식 {n1}개")

    n2 = fill(paper, {
        "reg": reg_strip(PRINT),
        "slot": slot_stack(PRINT),
        "addpoint": add_point(PRINT),
    })
    print(f"{paper.name}: 도식 {n2}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
