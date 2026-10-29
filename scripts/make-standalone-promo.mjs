import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(path.dirname(root), 'Monnit-사전예약-프로모션-최신-공유용.html');
const appText = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const match = appText.match(/function flameReservationHTML\(\)\{\s*return `([\s\S]*?)`;\s*\}/);
if (!match) throw new Error('프로모션 상세 HTML을 찾지 못했습니다.');
let content = match[1];
let css = fs.readFileSync(path.join(root, 'style.css'), 'utf8').replaceAll('</style>', '<\\/style>');

const assets = [
  ['images/flame-coincell-cutout.png', 'image/png'],
  ['images/flame-coincell-sensor.png', 'image/png'],
  ['images/flame-detector-cutout.png', 'image/png'],
  ['images/flame-detector-detail.png', 'image/png'],
  ['images/flame-edge-cutout.png', 'image/png'],
  ['images/flame-edge-gateway-lineup.png', 'image/png'],
  ['images/flame-product-overview.png', 'image/png'],
  ['images/flame-p-type-fireshield.png', 'image/png'],
  ['images/flame-p-type-fireshield-cutout.png', 'image/png'],
  ['images/promo-flame-reservation-thumb-v3.png', 'image/png'],
  ['videos/flame-immersive-4k-web.mp4', 'video/mp4'],
];
for (const [asset, mime] of assets) {
  const uri = `data:${mime};base64,${fs.readFileSync(path.join(root, asset)).toString('base64')}`;
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  content = content.replace(new RegExp(`/${escaped}(?:\\?v=\\d+)?`, 'g'), uri);
}
content = content.replaceAll('/videos/flame-immersive-4k.mp4?v=2', `data:video/mp4;base64,${fs.readFileSync(path.join(root, 'videos/flame-immersive-4k-web.mp4')).toString('base64')}`);

const js = `
function applyForPromo(){ document.getElementById('confirmContact').showModal(); }
function scrollToFlameReservationForm(){const form=document.getElementById('flameReservationForm');if(form)form.scrollIntoView({behavior:'smooth',block:'start'});}
function submitFlameReservationApply(event){
 event.preventDefault();const g=id=>(document.getElementById(id)?.value||'').trim();
 const subject='[프로모션 사전신청] 사전 예약 프로모션 — '+g('frfCompany');
 const body=['신청 프로모션: 사전 예약 프로모션','예약 희망 제품: '+g('frfProduct'),'이름 / 직급: '+g('frfName'),'회사명: '+g('frfCompany'),'전화번호: '+g('frfPhone'),'이메일: '+g('frfEmail'),'문의 사항: '+(g('frfMemo')||'(없음)')].join('\n');
 location.href='mailto:korea@monnit.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);return false;
}
function submitStandaloneReservation(event){
 event.preventDefault(); const form=event.currentTarget,fd=new FormData(form);
 const subject='[프로모션 사전신청] 사전 예약 프로모션 — '+(fd.get('company')||'');
 const body=['신청 프로모션: 사전 예약 프로모션','예약 희망 제품: '+fd.get('product'),'이름 / 직급: '+fd.get('name'),'회사명: '+fd.get('company'),'전화번호: '+fd.get('phone'),'이메일: '+fd.get('email'),'문의 사항: '+(fd.get('memo')||'(없음)')].join('\\n');
 location.href='mailto:korea@monnit.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body); return false;
}
function updateFlameImmersive(){
 const section=document.querySelector('.flame-immersive'); if(!section)return;
 const rect=section.getBoundingClientRect(),travel=Math.max(1,section.offsetHeight-innerHeight),progress=Math.max(0,Math.min(1,-rect.top/travel));
 const expand=1-Math.pow(1-progress,1.45),compact=innerWidth<=640,startWidth=compact?90:78,startHeight=compact?56:58;
 section.classList.toggle('is-active',rect.top<=0&&rect.bottom>=innerHeight); section.classList.toggle('is-past',rect.bottom<innerHeight);
 if(!section.classList.contains('is-paused')){section.style.setProperty('--flame-immersive-progress',progress.toFixed(4));section.style.setProperty('--flame-frame-width',(startWidth+expand*(100-startWidth))+'vw');section.style.setProperty('--flame-frame-height',(startHeight+expand*(100-startHeight))+'vh');section.style.setProperty('--flame-frame-radius',Math.max(0,34*(1-expand))+'px');}
}
function toggleFlameImmersive(button){const section=button.closest('.flame-immersive'),paused=section.classList.toggle('is-paused'),video=section.querySelector('video');button.setAttribute('aria-pressed',paused?'true':'false');button.setAttribute('aria-label',paused?'모션 재생':'모션 일시정지');button.querySelector('span').textContent=paused?'▶':'Ⅱ';if(video){paused?video.pause():video.play().catch(()=>{});}if(!paused)updateFlameImmersive();}
function selectFlameFeature(button){const section=button.closest('.flame-explorer'),stage=section.querySelector('.flame-explorer-stage');if(stage.classList.contains('is-expanded')&&button.classList.contains('is-active')){closeFlameFeature(button);return;}const index=Number(button.dataset.index||0);stage.classList.add('is-expanded');stage.dataset.activeIndex=String(index);stage.dataset.view=String(index);section.querySelectorAll('.flame-explorer-tab').forEach(tab=>{const active=tab===button;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',active?'true':'false');tab.setAttribute('aria-expanded',active?'true':'false');});const image=section.querySelector('.flame-explorer-visual img');if(image&&button.dataset.image){image.src=button.dataset.image;image.alt='Monnit '+(button.dataset.title||'제품');image.classList.remove('is-moving');void image.offsetWidth;image.classList.add('is-moving');}}
function closeFlameFeature(control){const section=control.closest('.flame-explorer'),stage=section.querySelector('.flame-explorer-stage');stage.classList.remove('is-expanded');delete stage.dataset.activeIndex;delete stage.dataset.view;section.querySelectorAll('.flame-explorer-tab').forEach(tab=>{tab.classList.remove('is-active');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-expanded','false');});}
function stepFlameFeature(control,direction){const section=control.closest('.flame-explorer'),tabs=[...section.querySelectorAll('.flame-explorer-tab')],stage=section.querySelector('.flame-explorer-stage'),current=Number(stage.dataset.activeIndex||0),next=(current+direction+tabs.length)%tabs.length;selectFlameFeature(tabs[next]);}
addEventListener('DOMContentLoaded',()=>{const video=document.querySelector('.flame-immersive video');if(video){video.muted=true;video.play().catch(()=>{});}updateFlameImmersive();let ticking=false;const run=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{updateFlameImmersive();ticking=false;});};addEventListener('scroll',run,{passive:true});addEventListener('resize',run,{passive:true});});
`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monnit 사전 예약 프로모션</title><style>html,body{margin:0;background:#000;color:#fff}body{overflow-x:hidden}.standalone-note{position:fixed;z-index:9999;left:16px;bottom:16px;padding:9px 13px;border-radius:999px;background:rgba(0,0,0,.58);color:#aaa;font:12px sans-serif;backdrop-filter:blur(10px)}.standalone-form{width:min(620px,calc(100vw - 36px));max-height:86vh;overflow:auto;border:0;border-radius:26px;padding:32px;background:#1d1d1f;color:#fff;box-shadow:0 28px 90px rgba(0,0,0,.58)}.standalone-form::backdrop{background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}.standalone-form h2{margin:0 0 8px;font-size:30px}.standalone-form>p{margin:0 0 24px;color:#999}.standalone-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.standalone-grid label{display:grid;gap:7px;color:#bbb;font-size:13px}.standalone-grid .wide{grid-column:1/-1}.standalone-grid input,.standalone-grid select{width:100%;box-sizing:border-box;border:1px solid #3a3a3c;border-radius:12px;padding:13px 14px;background:#29292c;color:#fff;font:15px inherit}.standalone-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}.standalone-actions button,.standalone-close{border:0;border-radius:999px;padding:12px 20px;color:#fff;cursor:pointer}.standalone-submit{background:#147ce5}.standalone-cancel{background:#333}.standalone-close{float:right;width:36px;height:36px;padding:0;background:#333;font-size:20px}@media(max-width:600px){.standalone-grid{grid-template-columns:1fr}.standalone-grid .wide{grid-column:auto}.standalone-form{padding:24px}}${css}</style></head><body>${content}<dialog id="confirmContact" class="standalone-form" onclick="if(event.target===this)this.close()"><button class="standalone-close" type="button" aria-label="닫기" onclick="this.closest('dialog').close()">×</button><h2>프로모션 사전 신청</h2><p>정보를 남겨주시면 담당자가 빠르게 연락드립니다.</p><form onsubmit="return submitStandaloneReservation(event)"><div class="standalone-grid"><label class="wide">신청 프로모션<select name="promo" disabled><option>사전 예약 프로모션</option></select></label><label class="wide">예약 희망 제품 *<select name="product" required><option value="">제품을 선택하세요</option><option>불꽃 감지기</option><option>P형 화재 감지 센서</option><option>코인셀 센서</option><option>엣지 게이트웨이</option></select></label><label>이름 / 직급 *<input name="name" required placeholder="예: 홍길동 / 설비팀장"></label><label>회사명 *<input name="company" required placeholder="예: (주)모넷코리아"></label><label>전화번호 *<input name="phone" type="tel" required placeholder="010-1234-5678"></label><label>이메일 *<input name="email" type="email" required placeholder="name@company.com"></label><label class="wide">문의 사항<input name="memo" placeholder="추가로 남기실 내용 (선택)"></label></div><div class="standalone-actions"><button class="standalone-cancel" type="button" onclick="this.closest('dialog').close()">취소</button><button class="standalone-submit" type="submit">신청하기</button></div></form></dialog><span class="standalone-note">컨펌용 단일 HTML</span><script>${js.replaceAll('</script>','<\\/script>')}</script></body></html>`;
fs.writeFileSync(out, html);
console.log(out); console.log(fs.statSync(out).size);
