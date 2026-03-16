import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}
const MAX_SIZE = 50 * 1024 * 1024 // 50MB
const BUCKET = 'creatives'

function sanitizeFileName(raw: string, mimeType: string): string {
  const nameOnly = raw.replace(/\.[^.]+$/, '')
  const safe = nameOnly.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_')
  const ext = ALLOWED_TYPES[mimeType] || '.bin'
  return (safe || 'creative') + ext
}

export const POST = withSuperAdmin(async (req: Request) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return apiError('파일이 첨부되지 않았습니다.', 400)
    }

    if (!ALLOWED_TYPES[file.type]) {
      return apiError('이미지(JPG, PNG, GIF, WebP) 또는 동영상(MP4, WebM)만 업로드 가능합니다.', 400)
    }

    if (file.size > MAX_SIZE) {
      return apiError('파일 크기는 50MB 이하여야 합니다.', 400)
    }

    const supabase = serverSupabase()
    const fileName = `${Date.now()}_${sanitizeFileName(file.name, file.type)}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      return apiError('파일 업로드 실패: ' + error.message, 500)
    }

    // public URL 생성
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName)

    return apiSuccess({
      fileName,
      fileType: file.type,
      publicUrl: urlData.publicUrl,
    })
  } catch (e: any) {
    return apiError('파일 업로드 실패: ' + (e.message || String(e)), 500)
  }
})
