-- clinic_ad_markup 초기 시드 캠페인 정정 (멱등 · 복구 안전)
--
-- 배경: 최초 시드(20260623_clinic_ad_markup.sql)가 잘못된 campaign_id('34778572',
--       실제로는 랜딩페이지 ID)로 들어가 가산이 캠페인에 병합되지 않고 별도 행으로 표시됨.
--       실제 Meta 캠페인은 id=120244814169380738 / name='2605_브릴린의원_울쎄라피'.
--       라이브 DB는 수동 정정했으나, 그 수정을 마이그레이션으로 남겨 어떤 환경/복구에서도
--       올바른 설정으로 수렴하도록 한다. (반복 실행해도 안전 = idempotent)

-- 1) 올바른 캠페인 설정 보장 (없으면 삽입, 있으면 유지)
INSERT INTO clinic_ad_markup
  (clinic_id, platform, campaign_id, campaign_name, daily_amount, effective_from, effective_to, label)
VALUES
  (21, 'meta_ads', '120244814169380738', '2605_브릴린의원_울쎄라피', 40000, '2026-06-13', NULL, '관리비 포함')
ON CONFLICT (clinic_id, campaign_id, effective_from) DO NOTHING;

-- 2) 잘못 시드된 행 제거 (존재하지 않으면 no-op)
DELETE FROM clinic_ad_markup
WHERE clinic_id = 21 AND campaign_id = '34778572';
