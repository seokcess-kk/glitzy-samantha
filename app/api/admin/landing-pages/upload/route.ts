import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import fs from 'fs'
import path from 'path'

// 파일명 안전하게 정제 (path traversal 방어, 특수문자 제거)
function sanitizeFileName(raw: string): string {
  // 경로 구분자 및 .. 제거
  const base = path.basename(raw)
  // 허용: 영문, 숫자, 한글, 하이픈, 언더스코어, 마지막 .html 확장자용 점 하나
  const ext = '.html'
  const nameOnly = base.replace(/\.html?$/i, '')
  const safe = nameOnly.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').replace(/_{2,}/g, '_')
  return (safe || 'upload') + ext
}

export const POST = withSuperAdmin(async (req: Request) => {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return apiError('파일이 첨부되지 않았습니다.', 400)
  }

  // HTML 파일만 허용 (.htm은 .html로 통일)
  if (!file.name.match(/\.html?$/i)) {
    return apiError('HTML 파일만 업로드할 수 있습니다. (.html)', 400)
  }

  // 파일 크기 제한 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return apiError('파일 크기는 5MB 이하여야 합니다.', 400)
  }

  const fileName = sanitizeFileName(file.name)
  const landingDir = path.join(process.cwd(), 'public', 'landing')

  // landing 디렉토리 생성 (없을 경우)
  if (!fs.existsSync(landingDir)) {
    fs.mkdirSync(landingDir, { recursive: true })
  }

  // 중복 파일명 처리
  let finalName = fileName
  const ext = path.extname(finalName)
  const baseName = path.basename(finalName, ext)
  let counter = 1
  while (fs.existsSync(path.join(landingDir, finalName))) {
    finalName = `${baseName}_${counter}${ext}`
    counter++
  }

  // 파일 저장
  const content = await file.arrayBuffer()
  fs.writeFileSync(path.join(landingDir, finalName), Buffer.from(content))

  return apiSuccess({ fileName: finalName })
})
