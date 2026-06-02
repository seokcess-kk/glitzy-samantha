import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const BUCKET = 'landing-pages'
const logger = createLogger('LandingPageUpload')

// 파일명 안전하게 정제 (ASCII만 허용 — Supabase Storage는 non-ASCII 거부)
// 타임스탬프 suffix로 파일명 충돌 방지
// 예: '신사세레아의원.html' → 'lp_20260406_143522.html'
// 예: 'serea_promo.html' → 'serea_promo_1712534400.html'
function sanitizeFileName(raw: string): string {
  const ext = '.html'
  const ts = Math.floor(Date.now() / 1000)
  const nameOnly = raw
    .replace(/\.html?$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
  // ASCII 부분이 없는 경우 (한글 등) → 날짜+시간 기반 파일명 생성
  if (!nameOnly) {
    const now = new Date()
    const isoTs = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14)
    return `lp_${isoTs.slice(0, 8)}_${isoTs.slice(8)}${ext}`
  }
  return `${nameOnly}_${ts}${ext}`
}

// 서명 업로드 URL 발급 (Signed Upload URL)
//
// 파일 바이트를 이 Vercel 함수로 보내지 않는다. Vercel 서버리스 함수의 요청 바디
// 한도는 4.5MB로 고정(설정 불가)이며, base64 인라인 자산이 많은 랜딩페이지 HTML은
// 쉽게 이를 초과해 FUNCTION_PAYLOAD_TOO_LARGE로 차단된다.
// 대신 작은 JSON(파일명)만 받아 서명 URL을 발급하고, 브라우저가 Supabase Storage로
// 파일을 직접 업로드(uploadToSignedUrl)하도록 한다. → 페이로드 한도와 무관.
export const POST = withSuperAdmin(async (req: Request) => {
  try {
    const body = await req.json().catch(() => null)
    const originalName = body && typeof body.originalName === 'string' ? body.originalName : ''
    const overwrite = body && typeof body.overwrite === 'string' && body.overwrite ? body.overwrite : null

    if (!originalName) {
      return apiError('파일명이 필요합니다.', 400)
    }

    if (!originalName.match(/\.html?$/i)) {
      return apiError('HTML 파일만 업로드할 수 있습니다. (.html)', 400)
    }

    const supabase = serverSupabase()
    // 기존 LP 수정 시 동일 파일명으로 덮어쓰기, 신규는 타임스탬프 suffix로 충돌 방지
    const fileName = overwrite || sanitizeFileName(originalName)

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(fileName, { upsert: true })

    if (error || !data) {
      logger.error('서명 업로드 URL 발급 실패', error, { fileName })
      return apiError(`파일 업로드 준비 실패: ${error?.message ?? '알 수 없는 오류'}`, 500)
    }

    return apiSuccess({
      path: data.path,
      token: data.token,
      fileName,
      originalFileName: originalName,
    })
  } catch (error) {
    logger.error('랜딩페이지 업로드 처리 오류', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
