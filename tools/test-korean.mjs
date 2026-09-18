/** 한국어 말뭉치 검사 — 규칙만으로 몇 %를 알아듣는가 (2026-09-18)
 *
 *  사람이 실제로 칠 법한 말을 항목별로 모아 두고, AI 없이 몇 개를 처리하는지 센다.
 *  여기서 떨어지는 말이 곧 AI 호출이고 곧 돈이다. 그래서 떨어진 말은 전부 찍어 준다.
 *
 *  실행:  node tools/test-korean.mjs          (요약)
 *         node tools/test-korean.mjs -v       (통과한 것까지 전부)
 */
import { ruleParse, LABELS } from '../netlify/lib/proposal/chat.mjs';
import KO from '../netlify/lib/proposal/ko.mjs';

const V = process.argv.includes('-v');
let pass = 0, fail = 0;
const misses = [];

/* want: 기대값. 'x' 로 시작하면 「값을 받으면 안 된다(되물어야 한다)」는 뜻 */
function T(asking, input, want) {
  const p = ruleParse(input, asking, {});
  const got = asking === 'company' ? (p.fields.company || '')
    : asking === 'name' ? [p.fields.name, p.fields.title].filter(Boolean).join(' ')
    : asking === 'email' ? (p.fields.email || (p.emailAsk ? '?' + p.emailAsk : p.emailBad ? '!' : ''))
    : asking === 'fac' ? (p.fields.fac || (p.skipAsk ? 'skip' : ''))
    : asking === 'con' ? (p.fields.con || (p.skipAsk ? 'skip' : ''))
    : p.confirmed ? 'yes' : p.edit ? 'edit' : '';
  const ok = want === '*' ? p.understood : want.startsWith('x') ? !p.understood || !!p.again : got === want;
  if (ok) { pass++; if (V) console.log('  ok   [' + asking + '] ' + input + ' → ' + (got || '(되물음)') + (p.how ? ' · ' + p.how : '')); }
  else {
    fail++;
    misses.push({ asking, input, want, got, miss: p.miss || '' });
    console.log('  AI행 [' + asking + '] ' + input + '   기대=' + want + ' 받음=' + (got || '(없음)'));
  }
}

console.log('\n■ 회사명 — 말머리·말끝·조사·자판·오타');
[['대한정밀', '대한정밀'], ['대한정밀입니다', '대한정밀'], ['저희 회사는 대한정밀이에요', '대한정밀'],
 ['(주)대한정밀', '(주)대한정밀'], ['주식회사 대한정밀', '주식회사 대한정밀'], ['대한정밀요', '대한정밀'],
 ['대한정밀 평택공장', '대한정밀 평택공장'], ['평택 2공장이요', '평택 2공장'], ['한국타이어 대전공장', '한국타이어 대전공장'],
 ['대한정밀입니다ㅎㅎ', '대한정밀'], ['대한정밀...', '대한정밀'], ['대한정밀!!', '대한정밀'],
 ['eogkswjdalf', '대한정밀'], ['우리는 삼성전자', '삼성전자'], ['상호는 누리에프앤비', '누리에프앤비'],
 ['SK하이닉스', 'SK하이닉스'], ['CJ대한통운 이천', 'CJ대한통운 이천'], ['농협하나로마트', '농협하나로마트'],
 ['대한', '대한'], ['한국가스공사', '한국가스공사'],
 ['잘 모르겠어요', 'x'], ['아니 그니까 그거요', 'x'], ['음...', 'x'], ['ㅁㄴㅇㄹ', 'x'], ['비밀입니다', 'x']
].forEach(([i, w]) => T('company', i, w));

console.log('\n■ 성함 — 직함 앞뒤·붙임·띄움·조사');
[['김철수', '김철수'], ['김철수 팀장', '김철수 팀장'], ['팀장 김철수', '김철수 팀장'], ['김철수팀장', '김철수 팀장'],
 ['김철수 과장입니다', '김철수 과장'], ['저는 김철수입니다', '김철수'], ['제 이름은 박영희예요', '박영희'],
 ['박영희 대리요', '박영희 대리'], ['이순신 부장', '이순신 부장'], ['김 철수', '김철수'],
 ['김철수(설비팀)', '김철수'], ['김철수 010-1234-5678', '김철수'], ['김철수 / 설비팀', '김철수'],
 ['정소장', '정소장'], ['최현장 공장장', '최현장 공장장'], ['rlacjftn', '김철수'],
 ['남궁민수 차장', '남궁민수 차장'], ['황보람', '황보람'], ['Kim Chulsoo', 'Kim Chulsoo'],
 ['몰라요', 'x'], ['그냥 저요', 'x']
].forEach(([i, w]) => T('name', i, w));

console.log('\n■ 이메일 — 오타·변형·한글 섞임');
[['kim@daehan.co.kr', 'kim@daehan.co.kr'], ['kim@daehan.co.kr 입니다', 'kim@daehan.co.kr'],
 ['KIM@DAEHAN.CO.KR', 'KIM@daehan.co.kr'], ['kim at daehan.co.kr', 'kim@daehan.co.kr'],
 ['kim 골뱅이 daehan.co.kr', 'kim@daehan.co.kr'], ['kim@ daehan.co.kr', 'kim@daehan.co.kr'],
 ['hong@gmial.com', '?hong@gmail.com'], ['hong@navr.com', '?hong@naver.com'],
 ['hong@naver', '?hong@naver.com'], ['hong@daum', '?hong@daum.net'],
 ['hong@gmail.con', '?hong@gmail.com'], ['이메일은 park@abc.co.kr 입니다', 'park@abc.co.kr'],
 ['abc.co.kr', '!'], ['그냥 전화주세요', 'x']
].forEach(([i, w]) => T('email', i, w));

console.log('\n■ 현장 — 업종을 자기 말로');
[['공장', 'factory'], ['공장이요', 'factory'], ['평택 공장입니다', 'factory'], ['반도체 라인', 'factory'],
 ['도금 공정', 'factory'], ['사출 공장', 'factory'], ['레미콘', 'factory'], ['염색 공장', 'factory'],
 ['냉동창고', 'logistics'], ['냉동 창고', 'logistics'], ['냉창', 'logistics'], ['물류센터', 'logistics'],
 ['3PL 창고', 'logistics'], ['풀필먼트 센터', 'logistics'], ['택배 허브', 'logistics'],
 ['양계장', 'agri'], ['양돈장', 'agri'], ['비닐하우스', 'agri'], ['버섯 재배사', 'agri'], ['스마트팜', 'agri'],
 ['횟집', 'food'], ['급식소', 'food'], ['제빵 공장', 'food'], ['방앗간', 'food'], ['도시락 업체', 'food'],
 ['요양병원', 'pharma'], ['동물병원', 'pharma'], ['클린룸', 'pharma'], ['검체 보관', 'pharma'],
 ['전산실', 'datacenter'], ['서버실', 'datacenter'], ['IDC', 'datacenter'], ['데이타센터', 'datacenter'],
 ['오피스 빌딩', 'commercial'], ['백화점', 'commercial'], ['헬스장', 'commercial'], ['주차장', 'commercial'],
 ['아파트 관리사무소', 'resident'], ['오피스텔', 'resident'], ['고시원', 'resident'], ['펜션', 'resident'],
 ['시청', 'public'], ['군부대', 'public'], ['대학교 실습동', 'public'], ['박물관', 'public'],
 ['정수장', 'energy'], ['태양광 발전소', 'energy'], ['열병합', 'energy'], ['하수처리장', 'energy'],
 ['터널 공사현장', 'construction'], ['교량 시공', 'construction'], ['리모델링 현장', 'construction'],
 ['ㄱㅈ', 'factory'], ['rhdwkd', 'factory'], ['3번이요', 'datacenter'], ['1', 'factory'],
 ['잘 모르겠어요', 'etc'], ['그 외', 'etc']
].forEach(([i, w]) => T('fac', i, w));

console.log('\n■ 고민 — 현상을 사람 말로');
[['화재', 'fire'], ['불', 'fire'], ['불나면 큰일이라', 'fire'], ['분전반 온도', 'fire'], ['타는 냄새가 나서', 'fire'],
 ['누전 걱정', 'fire'], ['아크 사고', 'fire'], ['큐비클 발열', 'fire'],
 ['누수', 'leak'], ['물', 'leak'], ['물이 새요', 'leak'], ['동파', 'leak'], ['지하 집수정', 'leak'],
 ['배관 터질까봐', 'leak'], ['빗물 역류', 'leak'],
 ['온도', 'temp'], ['온습도 관리', 'temp'], ['결로', 'temp'], ['곰팡이', 'temp'], ['항온항습', 'temp'],
 ['냉장', 'cold'], ['초저온', 'cold'], ['콜드체인', 'cold'], ['쇼케이스 온도', 'cold'], ['해동 관리', 'cold'],
 ['설비', 'equip'], ['모터 진동', 'equip'], ['컴프레서 고장', 'equip'], ['콤프레샤 고장', 'equip'],
 ['갑자기 멈춰서', 'equip'], ['베어링 소음', 'equip'], ['예지보전', 'equip'], ['라인정지', 'equip'],
 ['정전', 'power'], ['전기요금', 'power'], ['피크 관리', 'power'], ['차단기 트립', 'power'],
 ['가스 누출', 'air'], ['CO2', 'air'], ['암모니아 냄새', 'air'], ['분진', 'air'],
 ['야간 무인', 'security'], ['문 열림', 'security'], ['주말에 사람이 없어서', 'security'],
 ['통합관제', 'control'], ['MODBUS 연동', 'control'], ['한눈에 보고 싶어요', 'control'], ['PLC 연동', 'control'],
 ['해썹', 'comply'], ['해쌉', 'comply'], ['HACCP 기록', 'comply'], ['수기 일지', 'comply'], ['식약처 감사', 'comply'],
 ['5번', 'equip'], ['잘 모르겠어요', 'skip'], ['다 걱정돼요', 'skip']
].forEach(([i, w]) => T('con', i, w));

console.log('\n■ 확인 — 긍정·부정·수정');
[['네', 'yes'], ['넵', 'yes'], ['넹', 'yes'], ['ㅇㅇ', 'yes'], ['ㅇㅋ', 'yes'], ['예스', 'yes'],
 ['좋습니다', 'yes'], ['보내주세요', 'yes'], ['부탁드립니다', 'yes'], ['진행해주세요', 'yes'], ['오케이', 'yes'],
 ['네네네', 'yes'], ['ok', 'yes'], ['그렇게 해주세요', 'yes'],
 ['아니요', 'edit'], ['ㄴㄴ', 'edit'], ['잠깐만요', 'edit'], ['수정할게요', 'edit'],
 ['이메일 틀렸어요', 'edit'], ['회사명 바꿔주세요', 'edit'], ['아까 이름 잘못 썼어요', 'edit']
].forEach(([i, w]) => T('done', i, w));

const total = pass + fail;
console.log('\n' + '─'.repeat(64));
console.log('규칙만으로 처리: ' + pass + '/' + total + ' (' + Math.round(pass / total * 100) + '%)');
if (fail) {
  console.log('\nAI 로 넘어갈 말 ' + fail + '건 — 이게 곧 비용이다:');
  for (const m of misses) console.log('  [' + m.asking + '] ' + m.input + '  (' + (m.miss || '값 다름') + ')');
}
console.log('');
process.exit(fail ? 1 : 0);
