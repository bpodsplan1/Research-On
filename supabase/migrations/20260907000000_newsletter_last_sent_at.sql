-- 뉴스레터 구독 관리 화면에 "최근 발송일" 컬럼을 추가하기 위한 스키마 변경.
-- 지금까지는 발송 성공/실패 상태(newsletter_last_send_status)만 있었고 시각 정보가 없었음.
-- newsletter_guest_subscribers에는 발송 상태 컬럼 자체가 아예 없었음(정기 발송이 게스트
-- 구독자에게도 나가지만, 상태 갱신 노드(C5B)가 profiles만 갱신하고 있었던 버그와 연결됨 —
-- research_on_project_context.md 7번 섹션 참고).
alter table profiles add column if not exists newsletter_last_sent_at timestamptz;
alter table newsletter_guest_subscribers add column if not exists newsletter_last_send_status text;
alter table newsletter_guest_subscribers add column if not exists newsletter_last_sent_at timestamptz;
