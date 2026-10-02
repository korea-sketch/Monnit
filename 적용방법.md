# 적용 방법 — 충돌 없이, 손댈 것 없이

이 폴더는 **충돌이 이미 다 해결된 완성본**입니다. 파일을 열어 고칠 것이 없습니다.

## 순서

### 1. 진행 중인 머지를 취소합니다

```bash
git merge --abort
```

GitHub Desktop 을 쓰신다면 `Abort Merge` 버튼을 누르세요.

> 취소해도 안전합니다. 충돌 상대였던 `910e847` 브랜치는 `object-position:22%` 를 들고 있는
> **옛날 상태**라, 그쪽을 가져올 이유가 없습니다.

### 2. 이 폴더 내용을 저장소에 덮어씁니다

```bash
# 압축을 푼 뒤, Monnit-main 안의 내용을 저장소 루트로 복사
rsync -a --delete Monnit-main/ /경로/내-저장소/ \
  --exclude '.git' --exclude 'node_modules'
```

`rsync` 가 없으면 Finder 에서 `Monnit-main` 안의 파일을 전부 복사해 덮어쓰기 하셔도 됩니다.
(`.git` 폴더는 건드리지 마세요.)

### 3. 커밋

```bash
git add -A
git commit -m "fix: promo 히어로·고정CTA CSS 복구, 롤링배너 프레이밍, 미사용 자산 5.7MB 정리"
git push
```

---

## 이 폴더에 이미 반영된 것

| 항목 | 상태 |
|---|---|
| `object-position` 22% → **72%** (2곳) | 완료 |
| promo-consulting 히어로 CSS 14개 클래스 | 완료 |
| promo-consulting 하단 고정 CTA 바 CSS 3개 | 완료 |
| `howfold` / `proofband` / `feats-divider` CSS | 완료 |
| church 죽은 이미지 참조 | 완료 |
| 미사용 자산 62개 삭제 (5.7 MB) | 완료 |
| 충돌 마커(`<<<<<<<` 등) 잔존 | **0건** |

`js/monnit-consent.js` 는 **손대지 않았습니다.** 원본과 md5 동일(`e9c887de…`), 309줄 그대로입니다.
머지 화면에서 삭제로 보이던 312줄짜리는 루트에 있던 별개의 구버전 사본입니다.

## 최종 검증 결과

- 충돌 마커 잔존 **0건**
- JS 문법 (`app.js` `data.js` `i18n.js` `build.js` `js/*` `netlify/functions/*`) **전체 통과**
- 깨진 로컬 참조 **0건**
- 중복 `id` **0건**
- CSS 중괄호 균형 **정상**
- 스타일 미정의 클래스: promo-consulting **0개**

## 배포 후 2가지만 확인

1. 홈 「WHY MONNIT」 배경 사진이 5.6초마다 바뀌는가 — 2번(모터)·3번(UPS)이 검은 화면이 아닌가
2. `/promo/consulting` 의 `전화 상담` · `체험 신청` 이 파란 밑줄 링크가 아니라 **버튼**으로 보이는가
   (모바일에서는 하단 고정바도 떠야 합니다)
