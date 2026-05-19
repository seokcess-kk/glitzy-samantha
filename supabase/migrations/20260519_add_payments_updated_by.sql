-- 결제 수정 기능 추가에 따른 updated_by 컬럼 추가
-- bookings/consultations/leads와 동일한 활동 추적 패턴 적용
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
