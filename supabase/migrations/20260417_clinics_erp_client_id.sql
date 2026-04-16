-- clinics 테이블에 erp_client_id 추가 (glitzy-web 거래처 UUID 매핑)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS erp_client_id TEXT;
