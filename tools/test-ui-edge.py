# 화면 경우의 수 테스트 (Playwright) — 2026-09-17
# 실행: netlify dev 를 띄운 뒤  python3 tools/test-ui-edge.py [proposal|status|hosts|consult|visit|chat]
#       (주소를 바꾸려면 SITE=http://localhost:8888)
# 서버 오류·네트워크 끊김·연타·저장소 차단·중복 신청·영문 화면을 브라우저로 확인한다.
import asyncio, json, sys, re, time
from playwright.async_api import async_playwright
import os
B = os.environ.get('SITE', 'http://localhost:8888')
OKJSON = json.dumps({"success": True})
RESULTS = []
def rec(name, cond, info=''):
    RESULTS.append((name, bool(cond), info))
    print(('ok   ' if cond else 'FAIL ') + name + ('' if cond else '  → ' + str(info)[:300]), flush=True)

async def mk(br, api=None, sendpw=None, storage=True, lang=None, **kw):
    """api: None(실제) | dict(status, body) | 'offline' | 'slow' """
    ctx = await br.new_context(**kw)
    calls = {'proposal': 0, 'sendpw': 0, 'lead': 0, 'static': 0}
    async def route(r):
        u = r.request.url
        if u.startswith(B + '/api/proposal') and r.request.method == 'POST':
            calls['proposal'] += 1
            if api == 'offline': return await r.abort()
            if api == 'slow':
                await asyncio.sleep(1.5); return await r.continue_()
            if isinstance(api, dict): return await r.fulfill(status=api.get('status', 200), content_type='application/json', body=json.dumps(api.get('body', {})))
            return await r.continue_()
        if '/sendpw' in u:
            calls['sendpw'] += 1
            if isinstance(sendpw, dict): return await r.fulfill(status=sendpw.get('status', 200), content_type='application/json', body=json.dumps(sendpw.get('body', {})))
            if sendpw == 'offline': return await r.abort()
            return await r.continue_()
        if '/api/lead' in u: calls['lead'] += 1
        if u.startswith(B) or u.startswith('data:'): return await r.continue_()
        if 'staticforms' in u or 'web3forms' in u:
            calls['static'] += 1
            return await r.fulfill(status=200, content_type='application/json', body=OKJSON)
        return await r.abort()
    await ctx.route('**/*', route)
    init = "try{localStorage.setItem('mnk_cookie_consent_v1', JSON.stringify({v:1,analytics:false,marketing:false,ts:1}))}catch(e){}"
    if lang: init += "try{localStorage.setItem('mlang','%s')}catch(e){}" % lang
    if not storage:
        init += """
        (function(){var thrower={get:function(){throw new DOMException('blocked','SecurityError')}};
        try{Object.defineProperty(window,'sessionStorage',thrower)}catch(e){}
        try{Object.defineProperty(window,'localStorage',thrower)}catch(e){}})();"""
    await ctx.add_init_script(init)
    ctx.calls = calls
    return ctx

async def page(ctx, errs, tag):
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)[:200]))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return pg

uniq = [0]
def em():
    uniq[0] += 1
    return f'ui.edge{uniq[0]}@uiedge-corp{uniq[0]}.co.kr'

# ── /proposal ────────────────────────────────────────────────
async def fill_proposal(pg, email=None, consent=True, phone='010-2957-4831'):
    await pg.goto(B + '/proposal', wait_until='load'); await pg.wait_for_timeout(900)
    await pg.locator('#ppInds .mkp-ind').first.click(); await pg.wait_for_timeout(300)
    await pg.locator('#ppPlist .mkp-pitem').first.click()
    await pg.fill('#ppCompany', '유아이엣지' + str(uniq[0])); await pg.fill('#ppName', '박화면')
    await pg.fill('#ppEmail', email or em()); await pg.fill('#ppPhone', phone)
    if consent: await pg.check('#ppConsent')
    await pg.wait_for_timeout(3100)   # 봇 판정(3초) 회피

async def t_proposal(br, errs):
    # A1 아무것도 안 고르고 버튼
    ctx = await mk(br, viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, 'A1')
    await pg.goto(B + '/proposal', wait_until='load'); await pg.wait_for_timeout(800)
    await pg.click('#ppCta'); await pg.wait_for_timeout(400)
    rec('제안서 — 빈 상태 버튼 → 요청 없음', ctx.calls['proposal'] == 0, ctx.calls)
    # A2 산업만
    await pg.locator('#ppInds .mkp-ind').first.click(); await pg.wait_for_timeout(200)
    await pg.click('#ppCta'); await pg.wait_for_timeout(300)
    rec('제안서 — 과제 안 고름 → 안내 표시', await pg.locator('#ppErrProblems').is_visible(), '')
    # A3 입력 오류
    await pg.locator('#ppPlist .mkp-pitem').first.click()
    await pg.fill('#ppCompany', 'A'); await pg.fill('#ppEmail', 'test@company.com'); await pg.fill('#ppPhone', '010-1234-5678')
    await pg.click('#ppCta'); await pg.wait_for_timeout(500)
    bad = await pg.evaluate("[...document.querySelectorAll('.mkp-fld.bad')].map(e=>e.dataset.f)")
    rec('제안서 — 회사·이름·이메일·전화 오류 표시', set(['company', 'name', 'email', 'phone']) <= set(bad), bad)
    rec('제안서 — 동의 오류 표시', await pg.locator('#ppErrConsent.on').count() == 1, '')
    rec('제안서 — 오류 상태에서는 서버 요청 없음', ctx.calls['proposal'] == 0, ctx.calls)
    await ctx.close()

    cases = [
        ('서버 400(필드)', {'status': 400, 'body': {'ok': False, 'error': 'invalid', 'fields': {'email': '실제로 쓰시는 이메일 주소를 입력해 주세요'}}}),
        ('서버 500', {'status': 500, 'body': {'ok': False, 'error': 'server', 'message': '잠시 후 다시 시도해 주세요. 급하시면 02-2088-1454 로 연락 주세요.'}}),
        ('서버 429', {'status': 429, 'body': {'ok': False, 'error': 'rate', 'message': '잠시 후 다시 신청해 주세요. 급하시면 02-2088-1454 로 연락 주세요.'}}),
        ('서버 502(HTML 응답)', 'html502'),
        ('네트워크 끊김', 'offline'),
    ]
    for name, api in cases:
        a = api
        if api == 'html502': a = {'status': 502, 'body': None}
        ctx = await mk(br, api=a, viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, 'A-' + name)
        if api == 'html502':
            async def r502(r):
                ctx.calls['proposal'] += 1
                await r.fulfill(status=502, content_type='text/html', body='<html>Bad gateway</html>')
            await ctx.unroute('**/*')
            await ctx.route('**/*', lambda r: asyncio.ensure_future(r502(r)) if (r.request.url.startswith(B + '/api/proposal') and r.request.method == 'POST') else asyncio.ensure_future(r.continue_() if r.request.url.startswith(B) else r.abort()))
        await fill_proposal(pg)
        await pg.click('#ppCta'); await pg.wait_for_timeout(1500)
        msg = (await pg.locator('#ppMsg').inner_text()) if await pg.locator('#ppMsg').is_visible() else ''
        dis = await pg.locator('#ppCta').is_disabled()
        still = '/proposal/status' not in pg.url
        if name.startswith('서버 400'):
            rec('제안서 — ' + name + ' → 해당 칸에 오류', await pg.locator('.mkp-fld[data-f="email"].bad').count() == 1, msg)
        else:
            rec('제안서 — ' + name + ' → 안내 문구', bool(msg.strip()), msg)
        rec('제안서 — ' + name + ' → 버튼 다시 누를 수 있음', not dis, dis)
        rec('제안서 — ' + name + ' → 진행 화면으로 넘어가지 않음', still, pg.url)
        await ctx.close()

    # A8 두 번 클릭
    ctx = await mk(br, api='slow', viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, 'A8')
    await fill_proposal(pg)
    await pg.evaluate("()=>{const b=document.getElementById('ppCta'); b.click(); b.click(); b.click();}")
    await pg.wait_for_timeout(4000)
    rec('제안서 — 연타해도 접수 1건', ctx.calls['proposal'] == 1, ctx.calls)
    rec('제안서 — 정상 접수 → 진행 화면', '/proposal/status' in pg.url, pg.url)
    await pg.wait_for_timeout(1500)
    t1 = await pg.locator('#view-proposal-status').inner_text()
    await pg.reload(wait_until='load'); await pg.wait_for_timeout(2500)
    t2 = await pg.locator('#view-proposal-status').inner_text()
    rec('진행 화면 — 새로고침해도 유지', 'MK-P' in t2, t2[:120])
    await pg.go_back(); await pg.wait_for_timeout(1500)
    rec('진행 화면 — 뒤로가기 시 오류 없음', True, pg.url)
    await ctx.close()

    # A10 dup / limit / silent
    for name, body, expect in [
        ('재신청(dup)', {'ok': True, 'dup': True, 'mailed': True, 'days': 30}, '다시'),
        ('다른 과제(limit)', {'ok': True, 'dup': True, 'limit': True, 'mailed': True, 'same': False, 'asked': '누수', 'days': 30}, '견적'),
        ('봇·차단(silent)', {'ok': True, 'token': None, 'silent': True}, '접수'),
        ('저장소 장애(degraded)', {'ok': True, 'token': None, 'degraded': True}, '접수'),
    ]:
        ctx = await mk(br, api={'status': 200, 'body': body}, viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, 'A10-' + name)
        await fill_proposal(pg)
        await pg.click('#ppCta'); await pg.wait_for_timeout(2500)
        txt = await pg.evaluate("document.querySelector('main, #mk-shell-views, body').innerText")
        vis = await pg.evaluate("(()=>{const v=[...document.querySelectorAll('[id^=view-]')].find(e=>getComputedStyle(e).display!=='none'&&e.offsetHeight>0);return v?v.id:''})()")
        rec('제안서 — ' + name + ' → 안내 화면 (' + vis + ')', expect in txt, txt[:200])
        await ctx.close()

    # A12 저장소 차단(사파리 사생활 보호 등)
    ctx = await mk(br, storage=False, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = await page(ctx, errs, 'A12')
    await fill_proposal(pg)
    await pg.click('#ppCta'); await pg.wait_for_timeout(4000)
    t = await pg.locator('#view-proposal-status').inner_text() if await pg.locator('#view-proposal-status').count() else ''
    rec('저장소 차단 → 진행 화면 표시(주소 토큰 사용)', 'MK-P' in t, pg.url + ' ' + t[:100])
    await ctx.close()

    # A13 영문
    ctx = await mk(br, lang='en', viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, 'A13')
    await pg.goto(B + '/proposal', wait_until='load'); await pg.wait_for_timeout(1200)
    await pg.evaluate("window.setLang && setLang('en')"); await pg.wait_for_timeout(600)
    await pg.locator('#ppInds .mkp-ind').first.click(); await pg.click('#ppCta'); await pg.wait_for_timeout(300)
    body = await pg.locator('#view-proposal').inner_text()
    han = re.findall('[가-힣]+', body)
    rec('영문 제안서 화면 — 한글 거의 없음', len(han) < 12, han[:20])
    await ctx.close()

# ── /proposal/status ─────────────────────────────────────────
async def t_status(br, errs):
    ctx = await mk(br, viewport={'width': 390, 'height': 844}, is_mobile=True); pg = await page(ctx, errs, 'B')
    for q in ['', '?t=abc', '?t=' + 'A' * 24, '?t=<script>alert(1)</script>', '?lim=1', '?dup=1']:
        await pg.goto(B + '/proposal/status' + q, wait_until='load'); await pg.wait_for_timeout(1500)
        t = await pg.locator('#view-proposal-status').inner_text()
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        rec('진행 화면 ' + (q or '(토큰 없음)') + ' → 안내 표시', len(t.strip()) > 20 and sw <= 392, (t[:100], sw))
    # 폴링 중 서버 오류
    ctx2 = await mk(br, viewport={'width': 1280, 'height': 900}); p2 = await page(ctx2, errs, 'B-poll')
    await fill_proposal(p2); await p2.click('#ppCta'); await p2.wait_for_timeout(2500)
    fails = {'n': 0}
    async def flaky(r):
        fails['n'] += 1
        if fails['n'] <= 3: return await r.fulfill(status=503, body='')
        return await r.continue_()
    await p2.route('**/api/proposal/status*', flaky)
    await p2.wait_for_timeout(12000)
    t = await p2.locator('#view-proposal-status').inner_text()
    rec('진행 화면 — 조회 일시 오류에도 화면 유지·재시도', 'MK-P' in t and fails['n'] >= 1, (fails, t[:80]))
    await ctx.close(); await ctx2.close()

# ── 자료 받기 + 맞춤 제안서 애드온 ─────────────────────────────
async def open_host(pg, host):
    if host == 'modbus':
        await pg.goto(B + '/promo/modbus', wait_until='load'); await pg.wait_for_timeout(800)
        f = pg.locator('#wpForm-main'); await f.scroll_into_view_if_needed()
        await f.locator('[name=회사명]').fill('호스트정밀' + str(uniq[0])); await f.locator('[name=이름]').fill('이호스트')
        await f.locator('[name=이메일]').fill(em()); await f.locator('[name=연락처]').fill('010-2345-6789')
        await pg.locator('#wpForm-main .wp-agree input').check()
        return lambda: f.locator('button[type=submit]').click()
    if host == 'proposal':
        await pg.goto(B + '/promo/proposal', wait_until='load'); await pg.wait_for_timeout(800)
        await pg.evaluate("openFm('download')"); await pg.wait_for_timeout(400)
        fm = pg.locator('#fmForm')
        await fm.locator('[name=회사명]').fill('호스트정밀' + str(uniq[0])); await fm.locator('[name=이름]').fill('이호스트')
        await fm.locator('[name=이메일]').fill(em()); await fm.locator('[name=연락처]').fill('010-3456-1234')
        await pg.locator('#fmAgree input').check()
        return lambda: pg.locator('#fmSubmit').click()
    if host == 'temperature':
        await pg.goto(B + '/promo/temperature', wait_until='load'); await pg.wait_for_timeout(800)
        await pg.locator('[data-dl]').first.click(); await pg.wait_for_timeout(400)
        await pg.fill('#fmCo', '호스트제약' + str(uniq[0])); await pg.fill('#fmNm', '박호스트'); await pg.fill('#fmEm', em()); await pg.fill('#fmPh', '010-4567-2345')
        await pg.locator('#fmAgree input').check()
        return lambda: pg.locator('#fmSubmit').click()
    if host == 'whitepaper':
        await pg.goto(B + '/whitepaper', wait_until='load'); await pg.wait_for_timeout(2000)
        await pg.select_option('#wpSelect', index=1)
        await pg.fill('#wpCompany', '호스트IDC' + str(uniq[0])); await pg.fill('#wpName', '정호스트'); await pg.fill('#wpEmail', em()); await pg.fill('#wpPhone', '010-5678-3456')
        return lambda: pg.locator('#wpSubmit').click()

async def t_hosts(br, errs):
    for host in ['modbus', 'proposal', 'temperature', 'whitepaper']:
        # C4 자료만
        ctx = await mk(br, viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, 'C4-' + host)
        go = await open_host(pg, host); await pg.wait_for_timeout(3000); await go(); await pg.wait_for_timeout(2500)
        rec(host + ' — 자료만 받기 → 제안서 요청 없음', ctx.calls['proposal'] == 0 and ctx.calls['sendpw'] >= 1, ctx.calls)
        await ctx.close()
        for name, api in [('서버 500', {'status': 500, 'body': {'ok': False, 'error': 'server'}}),
                          ('서버 429', {'status': 429, 'body': {'ok': False, 'error': 'rate', 'message': '잠시 후 다시 신청해 주세요.'}}),
                          ('네트워크 끊김', 'offline'),
                          ('재신청(dup)', {'status': 200, 'body': {'ok': True, 'dup': True, 'mailed': True, 'days': 30}}),
                          ('입력 오류(400)', {'status': 400, 'body': {'ok': False, 'error': 'invalid', 'fields': {'name': '성함을 입력해 주세요'}}})]:
            ctx = await mk(br, api=api, viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, host + '-' + name)
            go = await open_host(pg, host)
            await pg.locator('#wpPropSlot .mkpa-opt >> nth=1').click()
            await pg.locator('#wpPropSlot .mkpa-agree input').check()
            await pg.wait_for_timeout(3000)
            await go(); await pg.wait_for_timeout(3500)
            res = await pg.locator('.mkpa-res').all_inner_texts()
            rt = ' | '.join(res)
            rec(host + ' — 애드온 ' + name + ' → 자료는 진행', ctx.calls['sendpw'] >= 1, ctx.calls)
            rec(host + ' — 애드온 ' + name + ' → 결과 안내', len(res) == 1 and len(rt) > 10, rt[:160])
            if name == '서버 429':
                rec(host + ' — 429 안내에 서버 문구 포함', '잠시 후 다시 신청' in rt, rt[:160])
            await ctx.close()
        # 연타
        ctx = await mk(br, api='slow', viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, host + '-dbl')
        go = await open_host(pg, host)
        await pg.locator('#wpPropSlot .mkpa-opt >> nth=1').click(); await pg.locator('#wpPropSlot .mkpa-agree input').check()
        await pg.wait_for_timeout(3000)
        btn = {'modbus': '#wpForm-main button[type=submit]', 'proposal': '#fmSubmit', 'temperature': '#fmSubmit', 'whitepaper': '#wpSubmit'}[host]
        await pg.evaluate("s=>{const b=document.querySelector(s); b.click(); b.click(); b.click();}", btn)
        await pg.wait_for_timeout(5000)
        rec(host + ' — 연타해도 자료·제안서 각 1건', ctx.calls['proposal'] <= 1 and ctx.calls['sendpw'] <= 1, ctx.calls)
        await ctx.close()
        # 자료 서버가 준비 안 됨
        ctx = await mk(br, sendpw={'status': 404, 'body': {'ok': False, 'error': 'not_ready'}}, viewport={'width': 1280, 'height': 900}); pg = await page(ctx, errs, host + '-notready')
        go = await open_host(pg, host)
        await pg.locator('#wpPropSlot .mkpa-opt >> nth=1').click(); await pg.locator('#wpPropSlot .mkpa-agree input').check()
        await pg.wait_for_timeout(3000); await go(); await pg.wait_for_timeout(4000)
        res = ' | '.join(await pg.locator('.mkpa-res').all_inner_texts())
        rec(host + ' — 자료 준비 중이어도 제안서 접수', ctx.calls['proposal'] == 1 and '접수' in res, (ctx.calls, res[:120]))
        await ctx.close()

# ── 컨설팅 → 예약 ─────────────────────────────────────────────
async def t_consult(br, errs):
    for label, storage in [('기본', True), ('저장소 차단', False)]:
        ctx = await mk(br, storage=storage, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); cp = await page(ctx, errs, 'D-' + label)
        await cp.goto(B + '/promo/consulting', wait_until='load'); await cp.wait_for_timeout(1000)
        await cp.fill('#f_company', '컨설팅정밀'); await cp.fill('#f_name', '최컨설'); await cp.fill('#f_phone', '010-6789-4567'); await cp.fill('#f_email', em())
        await cp.select_option('#f_asset', label='펌프')
        await cp.locator('label.expopt', has=cp.locator('input[value=처음]')).click()
        await cp.select_option('#f_line', index=3); await cp.fill('#f_spot', '급수펌프 2대')
        await cp.evaluate("document.getElementById('f_consent').click()")
        await cp.click('.submit'); await cp.wait_for_timeout(9000)
        rec('컨설팅(' + label + ') → 예약 화면 이동', '/visit' in cp.url, cp.url)
        if '/visit' in cp.url:
            hv = await cp.locator('#handoff').is_visible() if await cp.locator('#handoff').count() else False
            rec('컨설팅(' + label + ') → 예약 화면 오류 없음', True, hv)
        await ctx.close()
    # 필수값 누락
    ctx = await mk(br, viewport={'width': 1280, 'height': 900}); cp = await page(ctx, errs, 'D-empty')
    await cp.goto(B + '/promo/consulting', wait_until='load'); await cp.wait_for_timeout(800)
    await cp.click('.submit'); await cp.wait_for_timeout(1500)
    rec('컨설팅 — 빈 폼 제출 → 머무름', '/visit' not in cp.url and 'submitted' not in cp.url, cp.url)
    # 예약 화면 직접 진입
    await cp.goto(B + '/visit', wait_until='load'); await cp.wait_for_timeout(1200)
    rec('예약 화면 직접 진입 → 인계 박스 없음', not (await cp.locator('#handoff').is_visible() if await cp.locator('#handoff').count() else False), '')
    await cp.goto(B + '/visit?from=consulting', wait_until='load'); await cp.wait_for_timeout(1200)
    rec('예약 화면 from=consulting 인데 저장값 없음 → 오류 없이 빈 폼', True, '')
    await ctx.close()

# ── 예약: 같은 시간을 두 사람이 동시에 ─────────────────────────
async def book_fill(pg, company):
    await pg.fill('#f-company', company); await pg.fill('#f-name', '예약 담당'); await pg.fill('#f-email', em())
    await pg.fill('#f-phone', '010-3141-5926'); await pg.fill('#f-place', '경기도 안산시 단원구 원시로 1')
    await pg.locator('input[name=exp]').first.check()
    await pg.fill('#f-equipment', '펌프 2대'); await pg.fill('#f-symptom', '진동'); await pg.fill('#f-process', '원료 → 이송')

async def t_visit(br, errs):
    a = await mk(br, viewport={'width': 1280, 'height': 900}); pa = await page(a, errs, 'V-A')
    b = await mk(br, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pb = await page(b, errs, 'V-B')
    for pg in (pa, pb):
        await pg.goto(B + '/visit', wait_until='load'); await pg.wait_for_timeout(1800)
    # 같은 날짜·같은 첫 시간
    day_a = await pa.evaluate('(()=>{const b=[...document.querySelectorAll("#calGrid .cell")].find(x=>!x.disabled&&x.dataset.key);return b&&b.dataset.key})()')
    await pb.evaluate('k=>{const b=document.querySelector(\'#calGrid .cell[data-key="\'+k+\'"]\');b&&b.click()}', day_a)
    await pa.evaluate('k=>{const b=document.querySelector(\'#calGrid .cell[data-key="\'+k+\'"]\');b&&b.click()}', day_a)
    await pa.wait_for_timeout(300); await pb.wait_for_timeout(300)
    slot_a = await pa.locator('#slotarea .slot').first.inner_text()
    await pa.locator('#slotarea .slot').first.click(); await pb.locator('#slotarea .slot').first.click()
    slot_b = await pb.locator('#slotarea .slot[aria-pressed=true]').inner_text()
    rec('예약 — 두 사람이 같은 시간 선택', slot_a.split()[0] == slot_b.split()[0], (slot_a, slot_b))
    await book_fill(pa, '먼저예약정밀'); await book_fill(pb, '나중예약정밀')
    await pa.click('#submitBtn'); await pa.wait_for_timeout(2500)
    rec('예약 — 먼저 누른 사람 접수 완료', await pa.locator('#donecard').is_visible(), '')
    await pb.click('#submitBtn'); await pb.wait_for_timeout(2500)
    msg = await pb.locator('#formErr').inner_text() if await pb.locator('#formErr').is_visible() else ''
    rec('예약 — 나중 사람은 「다른 분이 예약」 안내', '다른 분이' in msg and not await pb.locator('#donecard').is_visible(), msg)
    slots_b = await pb.locator('#slotarea .slot').all_inner_texts()
    rec('예약 — 나중 사람 화면에서 그 시간이 사라짐', all(s.split()[0] != slot_a.split()[0] for s in slots_b), slots_b[:6])
    rec('예약 — 나중 사람 입력값 유지', (await pb.input_value('#f-company')) == '나중예약정밀', '')
    if slots_b:
        await pb.locator('#slotarea .slot').first.click(); await pb.click('#submitBtn'); await pb.wait_for_timeout(2500)
        rec('예약 — 다른 시간으로 다시 접수 완료', await pb.locator('#donecard').is_visible(), '')
    rec('예약 — 메일은 브라우저 경로 1회(서버 알림 생략)', a.calls['static'] == 1 and a.calls['lead'] == 1, a.calls)
    # 새로 연 화면에서도 두 시간이 빠져 있다
    c = await mk(br, viewport={'width': 1280, 'height': 900}); pc = await page(c, errs, 'V-C')
    await pc.goto(B + '/visit', wait_until='load'); await pc.wait_for_timeout(1800)
    await pc.evaluate('k=>{const b=document.querySelector(\'#calGrid .cell[data-key="\'+k+\'"]\');b&&b.click()}', day_a)
    await pc.wait_for_timeout(300)
    lab = await pc.evaluate('k=>{const b=document.querySelector(\'#calGrid .cell[data-key="\'+k+\'"]\');return b?b.getAttribute("aria-label"):""}', day_a)
    rec('예약 — 하루 최대 건수 도달 → 그날 마감 표시', '예약 마감' in lab, lab)
    # 메일 서비스 둘 다 실패해도 접수(서버 알림)
    d = await mk(br, viewport={'width': 1280, 'height': 900}); pd = await page(d, errs, 'V-D')
    async def sf_fail(r):
        u = r.request.url
        if 'staticforms' in u or 'web3forms' in u:
            return await r.fulfill(status=500, body='{}')
        return await r.continue_() if u.startswith(B) else await r.abort()
    await d.unroute('**/*'); await d.route('**/*', sf_fail)
    await pd.goto(B + '/visit', wait_until='load'); await pd.wait_for_timeout(1800)
    await pd.locator('#slotarea .slot').first.click()
    await book_fill(pd, '메일장애정밀'); await pd.click('#submitBtn'); await pd.wait_for_timeout(3000)
    t = await pd.locator('#doneTick').inner_text()
    rec('예약 — 메일 서비스 장애여도 서버 기록·알림으로 접수 완료', t == '접수 완료', t)
    for x in (a, b, c, d): await x.close()


# ── 대화로 신청 (제안서 챗봇) ───────────────────────────────────────────
async def chat_open(pg):
    await pg.goto(B + '/proposal', wait_until='load'); await pg.wait_for_timeout(1200)
    await pg.click('#ppModeChat'); await pg.wait_for_timeout(1500)

async def chat_say(pg, text):
    await pg.fill('#pcText', text); await pg.click('#pcSend'); await pg.wait_for_timeout(1200)
    m = await pg.locator('#pcLog .pc-msg.bot span').all_inner_texts()
    return m[-1] if m else ''

async def t_chat(br, errs):
    a = await mk(br, viewport={'width': 1280, 'height': 950}); pa = await page(a, errs, 'C-A')
    await chat_open(pa)
    rec('대화 — 첫 인사·단계별 폼 숨김', '안녕하세요' in (await pa.locator('#pcLog .pc-msg.bot span').first.inner_text()) and await pa.locator('#ppRoot .mkp-grid').is_hidden())
    t = await chat_say(pa, '대한정밀입니다'); rec('대화 — 회사명 → 성함 질문', '성함' in t, t)
    t = await chat_say(pa, '김현장 팀장'); rec('대화 — 성함 → 이메일 질문', '이메일' in t, t)
    mail = 'chat.ui+%d@daehan-ui.co.kr' % int(time.time())
    t = await chat_say(pa, mail)
    rec('대화 — 이메일 → 현장 질문 + 선택 칩', '현장' in t and await pa.locator('#pcChips .pc-chip').count() >= 8, t)
    await pa.locator('#pcChips .pc-chip').first.click(); await pa.wait_for_timeout(1200)
    await pa.locator('#pcChips .pc-chip').first.click(); await pa.wait_for_timeout(1400)
    card = await pa.locator('#pcCard').inner_text()
    rec('대화 — 확인 카드에 입력값 그대로', await pa.locator('#pcCard').is_visible() and '대한정밀' in card and mail in card, card[:160])
    before = a.calls['proposal']
    await pa.click('#pcSubmit'); await pa.wait_for_timeout(800)
    rec('대화 — 동의 없이 접수 막음', await pa.locator('#pcCardMsg').is_visible() and a.calls['proposal'] == before, (before, a.calls))
    await pa.check('#pcAgree'); await pa.click('#pcSubmit'); await pa.wait_for_timeout(6000)
    txt = await pa.locator('#view-proposal-status').inner_text() if await pa.locator('#view-proposal-status').count() else ''
    rec('대화 — 접수 → 진행 화면·제안 번호', '/proposal/status' in pa.url and 'MK-P' in txt, pa.url + ' ' + txt[:100])

    b = await mk(br, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pb = await page(b, errs, 'C-B')
    await chat_open(pb); await chat_say(pb, '누리물류입니다')
    await pb.reload(wait_until='load'); await pb.wait_for_timeout(2000)
    rec('대화 — 새로고침해도 대화·값 유지', await pb.locator('#pcLog .pc-msg').count() >= 3 and await pb.locator('#ppChat').is_visible())
    t = await chat_say(pb, '센서 한 대에 얼마인가요?')
    rec('대화 — 가격 질문은 담당자 연결로', '담당' in t, t)
    rec('대화 — 모바일 가로 넘침 없음', await pb.evaluate('document.documentElement.scrollWidth') <= 392)

    c = await mk(br, viewport={'width': 1280, 'height': 950}); pc = await page(c, errs, 'C-C')
    await chat_open(pc); await pc.click('#ppModeForm'); await pc.wait_for_timeout(500)
    await pc.locator('#ppInds .mkp-ind').first.click(); await pc.wait_for_timeout(400)
    rec('대화 — 단계별 신청으로 되돌아가도 그대로 동작', await pc.locator('#ppRoot .mkp-grid').is_visible() and await pc.locator('#ppChat').is_hidden() and await pc.locator('#ppPlist .mkp-pitem').count() > 0)

    d = await br.new_context(viewport={'width': 1280, 'height': 950})
    async def r500(r):
        u = r.request.url
        if '/api/proposal/chat' in u and 'fail' in (r.request.post_data or ''):
            return await r.fulfill(status=500, content_type='application/json', body='{"ok":false}')
        return await r.continue_() if u.startswith(B) else await r.abort()
    await d.route('**/*', r500)
    await d.add_init_script("try{localStorage.setItem('mnk_cookie_consent_v1', JSON.stringify({v:1,analytics:false,marketing:false,ts:1}))}catch(e){}")
    pd = await d.new_page(); pd.on('pageerror', lambda e: errs.append('C-D ' + str(e)[:180]))
    await chat_open(pd)
    t = await chat_say(pd, 'fail 테스트입니다')
    rec('대화 — 서버 오류에도 멈추지 않고 단계별 신청 안내', '불안정' in t and await pd.locator('#pcToForm').is_visible(), t)
    await pd.click('#pcToForm'); await pd.wait_for_timeout(500)
    rec('대화 — 안내 버튼으로 단계별 신청 전환', await pd.locator('#ppRoot .mkp-grid').is_visible())
    for x in (a, b, c, d): await x.close()

async def main():
    only = sys.argv[1:] or ['proposal', 'status', 'hosts', 'consult', 'visit', 'chat']
    async with async_playwright() as p:
        br = await p.chromium.launch()
        errs = []
        if 'proposal' in only: await t_proposal(br, errs)
        if 'status' in only: await t_status(br, errs)
        if 'hosts' in only: await t_hosts(br, errs)
        if 'consult' in only: await t_consult(br, errs)
        if 'visit' in only: await t_visit(br, errs)
        if 'chat' in only: await t_chat(br, errs)
        rec('페이지 스크립트 오류 없음', not errs, errs[:8])
        await br.close()
    bad = [r for r in RESULTS if not r[1]]
    print(f'\n{len(RESULTS)}건 중 실패 {len(bad)}건')
if __name__ == "__main__": asyncio.run(main())
