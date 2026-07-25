begin;

-- ══════════════════════════════════════════
-- service_role(secret 키) 권한 누락 수정
--
-- 발견 경위: n8n에서 Supabase secret 키로 newsletter_keywords에 쓰려다가
-- "permission denied for table newsletter_keywords" 발생. 조사 결과
-- service_role이 rolbypassrls=true(RLS 우회)는 갖고 있었지만, public 스키마의
-- 모든 테이블(신규 5개 테이블뿐 아니라 profiles 등 기존 테이블 전부 포함)에
-- SELECT/INSERT/UPDATE/DELETE 기본 권한 자체가 애초에 부여된 적이 없었음
-- (TRUNCATE/REFERENCES/TRIGGER만 있었음). RLS 우회는 행 단위 정책만 건너뛸 뿐
-- 테이블 접근 권한(GRANT) 자체를 대신하지 못하므로 이 상태에서는 n8n이
-- service_role 키로 PostgREST(REST API)를 통해 어떤 테이블도 쓸 수 없었다.
-- (C5B 노드가 profiles를 갱신하는 것도 동일한 이유로 지금까지 실패했을 것)
-- ══════════════════════════════════════════

grant select, insert, update, delete on all tables in schema public to service_role;

-- 앞으로 새로 만드는 테이블에도 자동으로 적용되도록
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

commit;
