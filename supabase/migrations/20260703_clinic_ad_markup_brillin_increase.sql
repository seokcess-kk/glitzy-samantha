-- 클리닉 #21 브릴린의원 광고비 마크업 증액 — 2026-07-03부터 일 60,000원
--
-- 배경: 기존 시드(20260623_clinic_ad_markup*.sql)로 캠페인 120244814169380738
--       (2605_브릴린의원_울쎄라피)에 2026-06-13부터 일 40,000원 가산 중.
--       2026-07-03부터 20,000원 추가하여 일 60,000원으로 증액한다.
--         · 2026-06-13 ~ 2026-07-02 : 40,000원 (유지)
--         · 2026-07-03 ~           : 60,000원 (증액, 진행 중)
--
-- 방식: 기존 진행 중(effective_to=NULL) 40,000원 행을 2026-07-02로 종료하고,
--       2026-07-03부터 새 60,000원 행(진행 중)을 추가한다. 두 구간이 겹치지 않아
--       lib/ad-markup.ts 의 일자별 가산이 각 날짜에 정확히 하나의 정액만 적용한다.
--       UNIQUE(clinic_id, campaign_id, effective_from)로 신규 구간은 별도 행으로 관리.
--       반복 실행해도 안전(idempotent). 라이브 DB는 동일 내용으로 반영 완료.

-- 1) 기존 40,000원 진행 중 행을 2026-07-02로 종료 (이미 종료됐으면 no-op)
UPDATE clinic_ad_markup
SET effective_to = '2026-07-02', updated_at = NOW()
WHERE clinic_id = 21
  AND campaign_id = '120244814169380738'
  AND effective_from = '2026-06-13'
  AND effective_to IS NULL;

-- 2) 2026-07-03부터 60,000원 행 추가 (있으면 60,000원/진행 중으로 수렴)
INSERT INTO clinic_ad_markup
  (clinic_id, platform, campaign_id, campaign_name, daily_amount, effective_from, effective_to, label)
VALUES
  (21, 'meta_ads', '120244814169380738', '2605_브릴린의원_울쎄라피', 60000, '2026-07-03', NULL, '관리비 포함')
ON CONFLICT (clinic_id, campaign_id, effective_from) DO UPDATE
  SET daily_amount = EXCLUDED.daily_amount,
      effective_to = EXCLUDED.effective_to,
      platform     = EXCLUDED.platform,
      campaign_name = EXCLUDED.campaign_name,
      label        = EXCLUDED.label,
      is_active    = true,
      updated_at   = NOW();
