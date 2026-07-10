-- 랜딩페이지 #80971134 "신사옵티마의원 오픈 이벤트" 병원 이관
--   루비성형외과(#24) → 옵티마의원(#25)
--
-- 배경: 옵티마의원 오픈 이벤트 랜딩페이지가 루비성형외과에 배정돼 있었다.
--       URL(/lp?id=80971134)은 PK 기반이라 이관 후에도 그대로 유지된다.
--       리드 웹훅은 landing_pages.clinic_id 를 진실의 원천으로 삼으므로
--       이관 시점부터 신규 리드는 옵티마의원으로 귀속된다.
--
-- 이관 시점 기준 이 LP의 수집 리드 0건, 참조 광고 소재(ad_creatives) 0건,
-- gtm_id/redirect_url NULL — 부수 데이터 정리 불필요.
--
-- 반복 실행해도 안전(idempotent). 라이브 DB는 동일 내용으로 반영 완료.

UPDATE landing_pages
SET clinic_id = 25, updated_at = NOW()
WHERE id = 80971134
  AND clinic_id IS DISTINCT FROM 25;
