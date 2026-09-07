커밋 65df3021001a02f812559de28ac9f675e08b33c8
작성 2026-09-07 16:56:03 +0900

회귀 수정 — 자체 sendLead 를 쓰는 랜딩의 원장 기록이 사라졌다

무엇이 깨졌나
  track() 에서 record() 를 빼면서, app.js 의 sendLead 를 쓰지 않고
  자기 사본을 가진 랜딩 페이지들이 원장 기록 경로를 통째로 잃었다.
    /promo/alarm     자체 sendLead + track() 만 호출  → 기록 0
    /promo/proposal  성공 시 track(), 실패 시에만 record() → 기록 0
  실측: 1004test 로 3개 페이지에 접수 → 먼데이에 residence 1건만 생성.
  alarm 과 proposal 은 ops·알림·먼데이 어디에도 남지 않았다.

수정
  monnit-lead.js  _submitted 플래그 도입.
                  submit() 이 성공하면 세우고, track() 은 그때만 건너뛴다.
                  submit() 이 실패하면 track() 이 백업으로 기록한다.
                  build() 때마다 초기화한다.
  캐시 버전       monnit-lead.js v=3 → v=4

정리
  netlify/functions 에 남아 있던 테스트 잔재 3개 제거
  (_ops_test.mjs · _deals_test.mjs · _store_mem.mjs)
  test-e2e.mjs 에 뒷정리 추가 — 안 지우면 배포본에 딸려 간다

검증
  test-landing (신규)  랜딩 4개 페이지의 원장 기록 경로를 직접 확인.
                       수정을 되돌리면 실패하는 것까지 확인했다.

