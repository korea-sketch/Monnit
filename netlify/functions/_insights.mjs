/** 검증과 제안 — 숫자를 보여주는 데서 끝내지 않고 "그래서 뭘 해야 하나"까지 만든다.
 *
 *  두 가지를 낸다.
 *   1) utmAudit — 광고 링크의 utm_content 와 리드 원장의 출처가 실제로 이어지는지
 *   2) actions  — 광고 데이터 + 사이트 데이터를 합쳐서 뽑은 할 일
 *
 *  없는 값을 0으로 채우지 않는다. 모르면 모른다고 낸다. */

import { parseSource } from './_utm.mjs';

const won = v => '₩' + Math.round(v || 0).toLocaleString('ko-KR');

/* ── UTM 검증 ──────────────────────────────────────────── */
export function utmAudit(creatives, adAds, leads) {
  /* 광고 쪽: 소재 키 → utm_content 유무 */
  const adUtm = {}, adNoUtm = {};
  for (const a of (adAds || [])) {
    const k = a.utm_content || a.ad_name || '';
    if (!k) continue;
    if (a.utm_content) adUtm[k] = true; else adNoUtm[k] = true;
  }

  /* 리드 쪽: 실제로 기록된 utm_content 모음 */
  const leadUtm = {};
  for (const r of (leads || [])) {
    const u = parseSource(r.source);
    if (u.utm_content) leadUtm[u.utm_content] = (leadUtm[u.utm_content] || 0) + 1;
  }

  /* 같은 utm_content 를 여러 소재가 쓰고 있는지 */
  const dup = {};
  for (const a of (adAds || [])) {
    if (!a.utm_content) continue;
    (dup[a.utm_content] ||= new Set()).add(a.ad_name || a.ad_id);
  }

  const out = [];
  for (const c of creatives) {
    if (/^\(/.test(c.key)) continue;               /* (광고 외 유입) 같은 묶음은 검증 대상이 아니다 */
    const hasAd = !!adUtm[c.key];
    const hasLead = !!leadUtm[c.key];
    const dupN = dup[c.key] ? dup[c.key].size : 0;

    let status = 'ok', msg = '광고와 리드가 같은 값으로 이어집니다';
    if (dupN > 1) {
      status = 'bad'; msg = '소재 ' + dupN + '개가 같은 utm_content 를 씁니다 — 성과가 한 줄로 섞입니다';
    } else if (!hasAd && c.spend != null && c.spend > 0) {
      status = 'bad'; msg = '광고 링크에 utm_content 가 없습니다 — 지출 ' + won(c.spend) + ' 이 리드와 안 이어집니다';
    } else if (!hasAd && !hasLead) {
      status = 'bad'; msg = '양쪽 다 utm_content 가 없습니다';
    } else if (hasAd && !hasLead) {
      status = c.clicks ? 'wait' : 'off';
      msg = c.clicks ? '광고엔 있는데 접수가 아직 없습니다 (클릭 ' + c.clicks + ')' : '아직 클릭이 없습니다';
    } else if (!hasAd && hasLead) {
      status = 'wait'; msg = '리드엔 남았는데 광고 링크에서 못 찾습니다 — 링크가 바뀌었을 수 있습니다';
    }

    out.push({
      key: c.key, channel: c.channel || '', campaign: c.campaign || '',
      ad_utm: hasAd ? c.key : '', lead_utm: hasLead ? c.key : '',
      lead_n: leadUtm[c.key] || 0, spend: c.spend, clicks: c.clicks,
      status, msg
    });
  }
  const rank = { bad: 0, wait: 1, off: 2, ok: 3 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (b.spend || 0) - (a.spend || 0));
}

/* ── 할 일 ─────────────────────────────────────────────── */
export function actions(ctx) {
  const { creatives, audit, econ, funnel, clarity, summary, adCur, cfg } = ctx;
  const A = [];
  const push = (p, title, why, fix, gain) => A.push({ p, title, why, fix, gain });

  /* 1. utm 이 끊긴 소재의 지출 합 */
  const broken = audit.filter(x => x.status === 'bad' && x.spend);
  const brokenSpend = broken.reduce((s, x) => s + (x.spend || 0), 0);
  if (broken.length)
    push(1, '광고 링크에 utm_content 가 없습니다',
      '지출 ' + won(brokenSpend) + ' 이 어느 소재에서 나왔는지 리드와 못 잇습니다. ' + broken.length + '개 소재가 해당됩니다.',
      '메타 광고 관리자 → 광고 → 추적 → URL 매개변수에 '
      + 'utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}} 을 넣으세요. '
      + '광고마다 값이 자동으로 달라집니다.',
      '소재별 리드당 비용이 그날부터 나옵니다');

  /* 2. 지출은 큰데 리드가 없는 소재 */
  const heavy = creatives
    .filter(c => c.spend != null && c.spend >= 150000 && c.leads <= 1 && !c.learning)
    .sort((a, b) => b.spend - a.spend)[0];
  if (heavy)
    push(1, heavy.key + ' 이(가) 가장 비쌉니다',
      (heavy.age_days != null ? heavy.age_days + '일 동안 ' : '') + won(heavy.spend)
      + ' 를 쓰고 리드 ' + heavy.leads + '건입니다.'
      + (heavy.clicks ? ' 클릭은 ' + heavy.clicks.toLocaleString() + '회 있었습니다.' : ''),
      heavy.clicks && heavy.clicks > 100
        ? '광고는 눌리는데 랜딩에서 막힙니다. 광고 문구와 랜딩 첫 화면을 나란히 놓고 비교하세요.'
        : '노출도 클릭도 적습니다. 타겟과 소재를 함께 손봐야 합니다.',
      '리드당 비용이 절반만 돼도 월 ' + won(heavy.spend / 2) + ' 절감');

  /* 3. 만들어놓고 안 켠 소재 */
  const never = creatives.filter(c => (c.spend === null || c.spend === 0) && c.clicks === null && !c.leads);
  if (never.length)
    push(2, '집행 기록이 없는 소재가 ' + never.length + '개',
      never.slice(0, 3).map(c => c.key).join(', ') + (never.length > 3 ? ' 외' : '') + ' — 지출도 클릭도 0입니다.',
      '켜지 않았다면 기존 광고세트로 복제해 같은 예산 안에서 돌리세요. '
      + '소액 별도 캠페인으로 켜면 학습 단계를 못 벗어납니다.',
      '소재 다양성이 늘면 예산 소진율이 올라갑니다');

  /* 4. 예산을 못 쓰는 캠페인 */
  const under = creatives.filter(c => c.spend != null && c.age_days >= 5 && c.clicks != null && c.clicks < 20 && c.spend > 0);
  if (under.length)
    push(2, '예산을 다 못 쓰는 소재가 ' + under.length + '개',
      under.slice(0, 3).map(c => c.key + '(' + c.clicks + '클릭)').join(', ')
      + ' — 집행 기간 대비 클릭이 적습니다. 타겟이 좁거나 입찰이 밀리고 있습니다.',
      '타겟 상세조건을 풀거나 노출 위치를 넓히세요. 검색이면 키워드를 광범위로 바꿉니다.',
      '같은 예산으로 도달이 늘어납니다');

  /* 5. 무료로 리드가 오는 채널 */
  const paidCh = new Set((adCur || []).filter(a => a.spend > 0).map(a => a.channel));
  for (const [ch, n] of (summary?.channel || [])) {
    if (n >= 2 && !paidCh.has(ch) && !['직접', '기타', '이메일', '우편DM', '전화문자'].includes(ch)) {
      push(2, ch + '는 돈 없이 리드가 옵니다',
        '광고비 0원인데 ' + n + '건이 들어왔습니다.',
        '소액(일 1만원)으로 브랜드 키워드부터 시작해 반응을 보세요.',
        '가장 싼 채널을 아직 안 쓰고 있습니다');
      break;
    }
  }

  /* 6. 견적이 안 나간 채 묵은 건 */
  if (funnel?.stale?.length)
    push(1, '견적이 안 나간 채 묵은 건 ' + funnel.stale.length + '건',
      funnel.stale.slice(0, 3).map(x => x.company + '(' + x.days + '일)').join(', ')
      + ' — 광고비를 써서 받은 리드가 그대로 식고 있습니다.',
      '오늘 전화부터 돌리세요. 견적 리드타임 중앙값이 '
      + (funnel.days_to_quote_median != null ? funnel.days_to_quote_median + '일' : '아직 없음') + '입니다.',
      '가장 싼 리드는 이미 받아둔 리드입니다');

  /* 7. Clarity — 랜딩이 막혔는지 */
  if (clarity && Number(clarity.dead) >= 4)
    push(2, '먹통 클릭이 ' + clarity.dead + '% 입니다',
      '눌렀는데 아무 일도 안 일어난 세션 비율입니다. 광고로 데려온 사람이 랜딩에서 막히고 있습니다.',
      '링크처럼 생긴 텍스트, 확대될 것 같은 사진, 접힐 것 같은 제목을 확인하세요.',
      '전환율이 바로 올라가는 부분입니다');

  /* 8. 연동 대기 */
  const waiting = Object.entries(cfg || {}).filter(([, v]) => !v).map(([k]) => k);
  if (waiting.length)
    push(3, '연동 대기 ' + waiting.length + '개 — ' + waiting.join(', '),
      '키가 없어서 이 채널·지표는 화면에 안 나옵니다.',
      'Netlify → Site configuration → Environment variables 에 키를 넣으면 코드 수정 없이 켜집니다.',
      '빈 칸이 채워집니다');

  /* 9. 자료 요청 쏠림 */
  const top = (summary?.interest || [])[0];
  if (top && top[1] >= 3)
    push(3, '자료 요청이 「' + top[0] + '」에 몰려 있습니다',
      '상위 관심 분야가 ' + top[1] + '건으로 다른 항목을 크게 앞섭니다.',
      '이 주제로 광고 소재와 검색 키워드를 더 만드세요. 반대로 자료가 없는 제품군은 다운로드 접점을 붙이면 리드가 늘어납니다.',
      '이미 검증된 수요를 더 가져옵니다');

  return A.sort((a, b) => a.p - b.p);
}
