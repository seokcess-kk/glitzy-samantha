-- 병원별 광고비 마크업(관리 수수료 등) — 읽기 시점 가산 설정
--
-- 목적: DB 원본(ad_campaign_stats / ad_stats)은 실집행비 그대로 두고,
--       대시보드/광고 성과 분석 "조회 시점"에만 합의된 일일 정액을 해당 캠페인 spend에
--       가산하여 표시한다. 정산용 external/ad-spend(실집행비)에는 가산하지 않는다.
-- 고지: 가산된 광고비가 노출되는 화면에는 항상 label("관리비 포함") 고지를 함께 표시한다.

CREATE TABLE IF NOT EXISTS clinic_ad_markup (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  platform VARCHAR(50),                              -- 대상 캠페인의 매체 (예: 'meta_ads'). 채널 매칭용
  campaign_id VARCHAR(100),                          -- 가산 귀속 캠페인 ID. NULL=클리닉 총액 가산
  campaign_name VARCHAR(500),                        -- 표시/참조용 캠페인명
  daily_amount NUMERIC(12,2) NOT NULL DEFAULT 0,     -- 일일 가산액(원)
  effective_from DATE NOT NULL,                      -- 가산 시작일(포함)
  effective_to DATE,                                 -- 가산 종료일(포함). NULL=중지 전까지 진행
  label VARCHAR(100) NOT NULL DEFAULT '관리비 포함',  -- 화면 고지 문구
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clinic_id, campaign_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_clinic_ad_markup_clinic
  ON clinic_ad_markup(clinic_id) WHERE is_active;

-- RLS 활성화 (정책 없음 — service_role 전용 접근, anon 직접 접근 차단)
ALTER TABLE public.clinic_ad_markup ENABLE ROW LEVEL SECURITY;

-- 초기 설정: 클리닉 #21, 캠페인 120244814169380738(2605_브릴린의원_울쎄라피), 2026-06-13부터 일 40,000원 (중지 전까지)
INSERT INTO clinic_ad_markup
  (clinic_id, platform, campaign_id, campaign_name, daily_amount, effective_from, effective_to, label)
VALUES
  (21, 'meta_ads', '120244814169380738', '2605_브릴린의원_울쎄라피', 40000, '2026-06-13', NULL, '관리비 포함')
ON CONFLICT (clinic_id, campaign_id, effective_from) DO NOTHING;
