import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import fs from 'fs'
import path from 'path'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

function sanitizeFileName(raw: string, mimeType: string): string {
  const nameOnly = path.basename(raw, path.extname(raw))
  const safe = nameOnly.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').replace(/_{2,}/g, '_')
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

    const fileName = sanitizeFileName(file.name, file.type)
    const uploadDir = path.join(process.cwd(), 'public', 'creatives')

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // 중복 파일명 처리
    let finalName = fileName
    const ext = path.extname(finalName)
    const baseName = path.basename(finalName, ext)
    let counter = 1
    while (fs.existsSync(path.join(uploadDir, finalName))) {
      finalName = `${baseName}_${counter}${ext}`
      counter++
    }

    const content = await file.arrayBuffer()
    fs.writeFileSync(path.join(uploadDir, finalName), Buffer.from(content))

    return apiSuccess({ fileName: finalName, fileType: file.type })
  } catch (e: any) {
    return apiError('파일 업로드 실패: ' + (e.message || String(e)), 500)
  }
})
