-- research_history에 검색 당시 사용한 고급옵션(기간/국가/포함·제외 도메인/제외 키워드)을
-- 스냅샷으로 저장하기 위한 컬럼 추가.
-- 목적: "재검색" 시 지금 화면에 세팅된 옵션이 아니라, 그 검색을 실행했던 시점의 옵션을
-- 다시 보여주고 확인/수정할 수 있게 하기 위함 (js/research-results.js openRetrySearchModal 참고).
alter table research_history add column if not exists options jsonb default '{}'::jsonb;
