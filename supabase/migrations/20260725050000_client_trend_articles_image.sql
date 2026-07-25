begin;

-- 대시보드 캐러셀을 포털 사이트 배너처럼 썸네일 이미지 포함으로 개선하면서 추가.
-- Serper 뉴스 검색 응답의 imageUrl을 그대로 저장한다(Naver 뉴스 API는 이미지가 없어 null).
alter table public.client_trend_articles add column if not exists image_url text;

commit;
