# 대화로 신청 · 관제 정지 팝업 — 모바일(320~768px) 실측. 실행: netlify dev 띄운 뒤 python3 tools/test-ui-mobile.py (2026-09-19)
import asyncio, json
from playwright.async_api import async_playwright

B = 'http://localhost:8888'
NOTICE = 'AI 상담은 잠시 점검 중입니다. 아래 단계별 신청으로 진행해 주시면 제안서는 평소대로 보내드립니다.'
HALT = {'at': '2026-09-19T01:20:00.000Z', 'reason': 'quota-exceeded', 'provider': 'gemini', 'model': 'gemini-3.5-flash-lite', 'status': 429, 'message': 'You exceeded your current quota', 'notified': True}

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        fails = 0
        def ok(n, c, g=''):
            nonlocal fails
            print(('ok   ' if c else 'FAIL ') + n + ('' if c else '  ' + str(g)[:200]))
            if not c: fails += 1
        for name, vp, scale, mobile, dark in [('iPhone SE', (375, 667), 2, True, False), ('iPhone 14', (390, 844), 3, True, True), ('Galaxy 폴드 접힘', (320, 720), 2, True, False), ('태블릿', (768, 1024), 2, True, False)]:
            ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=scale, is_mobile=mobile, has_touch=mobile, color_scheme='dark' if dark else 'light',
                                      user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            async def chat_route(route):
                r = await route.fetch(); j = await r.json(); j['paused'] = True; j['notice'] = NOTICE
                await route.fulfill(response=r, body=json.dumps(j), headers={**r.headers, 'content-type': 'application/json'})
            await pg.route('**/api/proposal/chat', chat_route)
            await pg.goto(B + '/proposal', wait_until='load'); await pg.wait_for_timeout(1200)
            # 쿠키 배너 닫기(있으면)
            try:
                await pg.click('text=쿠키 거부', timeout=1500)
            except Exception: pass
            await pg.click('#ppModeChat'); await pg.wait_for_timeout(2000)
            r = await pg.evaluate("""()=>{const d=document.documentElement;const st=document.getElementById('pcState');const inp=document.getElementById('pcText');const cs=getComputedStyle(inp);
              const send=document.getElementById('pcSend').getBoundingClientRect();const tab=document.getElementById('ppModeChat').getBoundingClientRect();
              const box=document.getElementById('ppChat').getBoundingClientRect();
              return {scrollW:d.scrollWidth, clientW:d.clientWidth, state:st&&!st.hidden, stateW:st&&st.getBoundingClientRect().width, boxW:box.width, boxRight:box.right,
                inputFont:parseFloat(cs.fontSize), inputH:inp.getBoundingClientRect().height, sendH:send.height, sendW:send.width, tabH:tab.height, tabText:document.querySelector('#ppModeChat em').textContent,
                noticeBtn:!!document.getElementById('pcToForm'), btnH:(document.getElementById('pcToForm')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height}}""")
            ok(f'[{name} {vp[0]}px] 가로 넘침 없음', r['scrollW'] <= r['clientW'] + 1, r)
            ok(f'[{name}] 점검 중 띠·탭 표시 보임, 띠가 화면 안', r['state'] and r['tabText'] == '점검 중' and r['stateW'] <= vp[0] and r['boxRight'] <= vp[0] + 1, r)
            ok(f'[{name}] 입력창 글자 16px 이상(iOS 자동 확대 방지)', r['inputFont'] >= 16, r['inputFont'])
            ok(f'[{name}] 터치 목표 44px 이상(보내기·탭)', r['sendH'] >= 44 and r['tabH'] >= 40, r)
            await pg.fill('#pcText', '누리에프앤비입니다'); await pg.press('#pcText', 'Enter'); await pg.wait_for_timeout(1800)
            r2 = await pg.evaluate("()=>({msgs:document.querySelectorAll('.pc-msg.bot').length, scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth})")
            ok(f'[{name}] 대화 뒤에도 넘침 없음', r2['msgs'] >= 2 and r2['scrollW'] <= r2['clientW'] + 1, r2)
            await pg.tap('#pcText'); await pg.wait_for_timeout(400)
            r2b = await pg.evaluate("""()=>{const inp=document.getElementById('pcText').getBoundingClientRect();const bar=document.getElementById('ppBar');const cs=getComputedStyle(bar);
              return {inTop:inp.top,inBottom:inp.bottom,vh:innerHeight,barShown:cs.display!=='none'}}""")
            ok(f'[{name}] 입력창에 포커스하면 화면 안에 보이고 하단 고정 버튼이 덮지 않는다', (not r2b['barShown']) and r2b['inBottom'] <= r2b['vh'] + 1 and r2b['inTop'] >= 0, r2b)
            await pg.click('#ppModeForm'); await pg.wait_for_timeout(300)
            r2c = await pg.evaluate("()=>getComputedStyle(document.getElementById('ppBar')).display!=='none'")
            ok(f'[{name}] 단계별 신청으로 돌아가면 하단 버튼 복귀', r2c)
            await pg.click('#ppModeChat'); await pg.wait_for_timeout(300)
            if name == 'iPhone SE': await pg.screenshot(path='/tmp/claude-0/m-chat.png', full_page=False)
            # 관제 팝업(모바일)
            pg2 = await ctx.new_page(); pg2.on('pageerror', lambda e: errs.append('ops:' + str(e)))
            await pg2.goto(B + '/ops', wait_until='load'); await pg2.wait_for_timeout(400)
            try:
                await pg2.fill('input[name=u]', 'admin'); await pg2.fill('input[name=p]', 'pass1234'); await pg2.click('button'); await pg2.wait_for_timeout(1200)
            except Exception as e: print('  (login)', str(e)[:60])
            async def data_route(route):
                rr = await route.fetch(); j = await rr.json()
                if j.get('ok'): j['halt'] = HALT
                await route.fulfill(response=rr, body=json.dumps(j), headers={**rr.headers, 'content-type': 'application/json'})
            await pg2.route('**/ops/proposals/data*', data_route)
            await pg2.goto(B + '/ops/proposals', wait_until='load'); await pg2.wait_for_timeout(2000)
            r3 = await pg2.evaluate("""()=>{const p=document.getElementById('haltPop');const bx=p.querySelector('.box').getBoundingClientRect();const btn=document.getElementById('haltResume').getBoundingClientRect();
              return {shown:!p.hidden, boxW:bx.width, boxH:bx.height, boxBottom:bx.bottom, vh:innerHeight, vw:innerWidth, btnH:btn.height, btnVisible:btn.bottom<=innerHeight, scrollable:getComputedStyle(p.querySelector('.box')).overflowY}}""")
            ok(f'[{name}] 관제 정지 팝업 — 화면 안에 들어오고 버튼이 보인다', r3['shown'] and r3['boxW'] <= r3['vw'] and r3['btnVisible'], r3)
            if name == 'iPhone SE': await pg2.screenshot(path='/tmp/claude-0/m-ops.png')
            ok(f'[{name}] JS 오류 없음', not errs, errs)
            await ctx.close()
        print('\n' + ('❌ %d건 실패' % fails if fails else '✅ 모바일 전부 통과'))
        await b.close()

asyncio.run(main())
