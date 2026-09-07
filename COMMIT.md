커밋 bca359dfcf761e837afd999a1af26ad456987067
작성 2026-09-07 16:25:57 +0900

확정 규칙 3가지에 맞춰 정리

  1) 모든 문의 알림 → 0702yeom@gmail.com · ops 와 먼데이에 동시 기록
  2) 고객 응대 메일은 백서(sendpw)·컨설팅(sendguide)만. 답장 korea@monnit.com.
     알리미·일반 문의는 고객 회신 없이 알림만 나간다.
  3) 발송은 StaticForms 기본 → 실패 시 Web3Forms → 최후 Brevo

변경
  _notify.mjs   발송 순서를 StaticForms → Web3Forms → Brevo 로 재구성.
                무료 250건/월 한도에 한쪽이 걸려도 알림이 끊기지 않는다.
                항목을 표로 보내 사장님이 보시던 형식을 유지한다.
                어느 경로로 나갔는지(via)와 실패 이력(tried)을 항상 반환한다.
  _reply.mjs    삭제. 백서·컨설팅은 sendpw·sendguide 가 이미 담당하고,
                알리미는 고객 회신을 보내지 않기로 확정했다.
  lead.mjs      응대 메일 호출 제거. 알림 + 먼데이만 병렬 실행.

사실 정정
  StaticForms 는 「메일을 안 보낸」 게 아니라 「0702yeom@gmail.com 으로 보낸」
  것이었다. korea@monnit.com 이 수신자에서 빠져 있었고 API 는 계속 success 를
  돌려줬다. StaticForms Inbox 의 Delivery 기록으로 확인했다.
  Web3Forms 수신자도 0702yeom@gmail.com 으로 변경 완료.

검증
  test-rules  규칙 3가지를 코드에 직접 대조 (20개 항목)

