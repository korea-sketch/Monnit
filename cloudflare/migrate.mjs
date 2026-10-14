/* ============================================================
   데이터 이관 화면 — /ops/migrate  (관제 로그인 필요)
   Netlify Blobs(리드·방문 기록·제안서·관제 설정) → Cloudflare R2
   Netlify 쪽 /api/blob-export 를 불러 복사합니다. 여러 번 눌러도 안전(같은 키는 덮어씀).
   ============================================================ */
import { getStore } from './netlify-compat/blobs.mjs';
import { migrateToken } from '../netlify/functions/blob-export.mjs';
import { refreshConfig } from './env-config.mjs';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function authed(req, opsAuth) {
  try {
    if (!opsAuth.configured()) return false;
    const c = opsAuth.cookieFrom({ cookie: req.headers.get('cookie') || '' });
    return !!(await opsAuth.valid(c));
  } catch (e) { return false; }
}

async function callSource(source, qs, body) {
  const f = globalThis.__MNK_REAL_FETCH || fetch;   /* 자기 자신이 아니라 진짜 원본으로 */
  const r = await f(source.replace(/\/$/, '') + '/api/blob-export?' + qs, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-mnk-migrate': migrateToken(), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch (e) { throw new Error('원본 응답 오류 ' + r.status + ': ' + t.slice(0, 120)); }
  if (!j.ok) throw new Error('원본 오류: ' + (j.error || r.status));
  return j;
}

export async function migrateRoute(req, env, ctx, { opsAuth }) {
  const u = new URL(req.url);
  if (u.pathname !== '/ops/migrate' && u.pathname !== '/ops/migrate/api') return null;
  if (!(await authed(req, opsAuth))) {
    if (u.pathname === '/ops/migrate') return Response.redirect(u.origin + '/ops', 302);
    return json({ ok: false, error: '관제 로그인이 필요합니다' }, 401);
  }
  if (u.pathname === '/ops/migrate') return new Response(PAGE(env.MIGRATE_SOURCE || 'https://monnit26.netlify.app'), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' }
  });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  try {
    const b = await req.json();
    const source = String(b.source || '').trim();
    if (!/^https:\/\//.test(source) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(source.replace(/\/$/, ''))) return json({ ok: false, error: '원본 주소는 https:// 로 시작해야 합니다' }, 400);
    if (b.op === 'env') return json({ ok: true, count: await refreshConfig({ ...env, MIGRATE_SOURCE: source }) });
    if (b.op === 'stores') return json({ ok: true, ...(await callSource(source, 'op=stores')) });
    if (b.op === 'keys') {
      /* 무료 플랜 CPU 10ms — 여기(R2) 목록을 다시 훑지 않는다. 이어서 할 위치(from)는 화면이 기억해 보낸다 */
      const j = await callSource(source, 'op=keys&store=' + encodeURIComponent(b.store));
      const from = Math.max(0, Math.min(j.keys.length, Number(b.from) || 0));
      return json({ ok: true, keys: j.keys.slice(from), total: j.keys.length, from });
    }
    if (b.op === 'copy') {
      const s = getStore(b.store);
      let keys = b.keys, have = 0;
      /* 「새 항목만」 — 이미 여기 있는 키는 덮지 않는다(전환 뒤 이곳에서 바뀐 값을 지키기 위해) */
      if (b.onlyMissing) {
        const ex = await Promise.all(keys.map(k => s.getMetadata(k).then(m => !!m).catch(() => false)));
        keys = keys.filter((k, i) => !ex[i]); have = b.keys.length - keys.length;
        if (!keys.length) return json({ ok: true, copied: 0, missing: 0, skipped: have, next: null });
      }
      const j = await callSource(source, 'op=get', { store: b.store, keys });
      let copied = 0, missing = 0;
      await Promise.all(j.items.map(async it => {
        if (it.missing) { missing++; return; }
        await s.set(it.key, Buffer.from(it.b64, 'base64'), { metadata: it.meta && Object.keys(it.meta).length ? it.meta : undefined });
        copied++;
      }));
      /* 원본이 일부만 돌려줬으면(next) 원래 묶음 기준 위치로 바꿔 알려 준다 */
      let next = j.next;
      if (next != null && b.onlyMissing) { const last = keys[next - 1]; next = last ? b.keys.indexOf(last) + 1 : null; }
      return json({ ok: true, copied, missing, skipped: have, next });
    }
    return json({ ok: false, error: 'op' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

const PAGE = src => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>데이터 이관 · 모넷 관제</title><meta name="robots" content="noindex">
<style>
body{margin:0;background:#0B1220;color:#DCE3EE;font:15px/1.6 -apple-system,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 20px}
h1{font-size:22px;margin:0 0 6px}p{color:#9AA7BD;margin:0 0 18px}
label{display:block;font-size:13px;color:#9AA7BD;margin-bottom:6px}
input{width:100%;box-sizing:border-box;background:#121B2E;border:1px solid #2A3650;border-radius:10px;color:#fff;padding:12px 14px;font-size:15px}
button{margin-top:14px;background:#2B84F5;border:0;color:#fff;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
table{width:100%;border-collapse:collapse;margin-top:22px;font-size:14px}
td,th{padding:9px 8px;border-bottom:1px solid #1F2A40;text-align:left}th{color:#9AA7BD;font-weight:600}
.ok{color:#2DD4BF}.err{color:#F87171}
pre{background:#0E1626;border:1px solid #1F2A40;border-radius:10px;padding:12px;max-height:220px;overflow:auto;font-size:12px;color:#9AA7BD}
</style></head><body><main>
<h1>Netlify → Cloudflare 데이터 이관</h1>
<p>설정값(환경변수)과 리드 원장·방문 기록·맞춤 제안서·관제 설정을 Netlify 저장소에서 이곳(R2)으로 복사합니다. 여러 번 실행해도 안전합니다. DNS 를 옮기기 직전에 한 번 더 실행하세요.</p>
<label for="src">원본(Netlify) 주소</label>
<input id="src" value="${src}">
<label style="display:flex;gap:8px;align-items:center;margin-top:12px;color:#DCE3EE"><input type="checkbox" id="skip" checked style="width:auto"> 방문·추적 기록은 이미 옮긴 것 건너뛰기 (권장 — 제안서·리드·설정은 항상 새로 복사)</label>
<label style="display:flex;gap:8px;align-items:center;margin-top:8px;color:#DCE3EE"><input type="checkbox" id="only" style="width:auto"> 이미 여기 있는 항목은 덮어쓰지 않기 — 도메인 전환 <b>뒤</b>에 Netlify 로 들어온 새 문의·신청만 가져올 때 (설정값은 받지 않음)</label>
<button id="go">복사 시작</button>
<table><thead><tr><th>저장소</th><th>원본</th><th>복사</th><th>상태</th></tr></thead><tbody id="rows"></tbody></table>
<pre id="log"></pre>
</main><script>
const $=s=>document.querySelector(s), log=m=>{$('#log').textContent+=m+'\\n';$('#log').scrollTop=1e9;};
async function api(body){const r=await fetch('/ops/migrate/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!j.ok)throw new Error(j.error||r.status);return j;}
$('#go').onclick=async()=>{
  const source=$('#src').value.trim(); $('#go').disabled=true; $('#rows').innerHTML=''; $('#log').textContent='';
  try{
    const only=$('#only').checked;
    if(!only){ const ev=await api({op:'env',source}); log('설정값 '+ev.count+'개 받음'); } else log('새 항목만 가져오기 — 이미 있는 항목·설정값은 그대로 둡니다');
    const {stores}=await api({op:'stores',source}); log('저장소 '+stores.length+'개: '+stores.join(', '));
    let total=0;
    for(const store of stores){
      const tr=document.createElement('tr'); tr.innerHTML='<td>'+store+'</td><td>…</td><td>0</td><td>진행 중</td>'; $('#rows').appendChild(tr);
      const skip=$('#skip').checked && /^(visits|track|health)$/.test(store), mk='mig:'+source+':'+store;
      let from=0; if(skip){ try{ from=Number(localStorage.getItem(mk))||0; }catch(e){} }
      let kr, kt=0; for(;;){ try{ kr=await api({op:'keys',source,store,from}); break; }catch(e){ if(++kt>=5) throw e; log(store+' 목록 재시도: '+e.message); await new Promise(z=>setTimeout(z,2000*kt)); } }
      const keys=kr.keys, all=kr.total||keys.length; tr.children[1].textContent=all+(from?' (이어서 '+keys.length+')':'');
      let done=0, i=0, B=30, fails=0, kept=0;
      while(i<keys.length){
        const batch=keys.slice(i,i+B); let r;
        try{ r=await api({op:'copy',source,store,keys:batch,onlyMissing:only}); fails=0; if(B<60) B+=2; kept+=r.skipped||0; }
        catch(e){ if(++fails>=12) throw e; B=Math.max(1,Math.floor(B/2)); log(store+' 재시도(묶음 '+B+'): '+e.message); await new Promise(z=>setTimeout(z,1500)); continue; }
        const took = r.next==null ? batch.length : Math.max(1,r.next);
        done+=r.copied; i+=took; tr.children[2].textContent=done;
        if(skip){ try{ localStorage.setItem(mk,String(from+i)); }catch(e){} }
      }
      total+=done; tr.children[3].innerHTML='<span class="ok">완료</span>'+(only?' <span style="color:#9AA7BD">(기존 '+kept+'건 유지)</span>':'');
    }
    log('끝 — 총 '+total+'건 복사');
  }catch(e){ log('오류: '+e.message); }
  $('#go').disabled=false;
};
</script></body></html>`;
