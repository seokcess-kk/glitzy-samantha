/**
 * 날짜 포맷 유틸리티 — 전체 프로젝트에서 일관된 한국어 날짜 표기 사용
 */

/** 날짜만 (예: 2026. 3. 16.) */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ko')
}

/** 날짜 + 시간 (예: 3월 16일 14:30) */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('ko', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 시간만 (예: 14:30) */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('ko', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
