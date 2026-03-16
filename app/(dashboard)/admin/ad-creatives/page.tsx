'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, Image, Trash2, Pencil, Link2, Upload, X, Film } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface LandingPage {
  id: number
  name: string
  file_name: string
  clinic_id: number | null
}

interface AdCreative {
  id: number
  name: string
  description: string | null
  utm_content: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  platform: string | null
  clinic_id: number
  landing_page_id: number | null
  is_active: boolean
  file_name: string | null
  file_type: string | null
  created_at: string
  clinic?: { id: number; name: string } | null
  landing_page?: { id: number; name: string; file_name: string } | null
}

const PLATFORM_OPTIONS = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'naver', label: '네이버' },
  { value: 'kakao', label: '카카오' },
  { value: 'tiktok', label: '틱톡' },
  { value: 'youtube', label: '유튜브' },
  { value: 'other', label: '기타' },
]

function CreativeThumbnail({ creative }: { creative: AdCreative }) {
  if (!creative.file_name) {
    return (
      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-slate-600">
        <Image size={20} />
      </div>
    )
  }

  const src = `/creatives/${creative.file_name}`
  const isVideo = creative.file_type?.startsWith('video/')

  if (isVideo) {
    return (
      <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden relative group">
        <video src={src} className="w-full h-full object-cover" muted preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Film size={16} className="text-white/80" />
        </div>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={creative.name}
      className="w-12 h-12 rounded-lg object-cover bg-white/5"
    />
  )
}

export default function AdCreativesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [adCreatives, setAdCreatives] = useState<AdCreative[]>([])
  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [clinics, setClinics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdCreative | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', utm_content: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '',
    platform: '', clinic_id: '', landing_page_id: '', is_active: true,
    file_name: '' as string | null, file_type: '' as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string | null>(null)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [acRes, lpRes, cRes] = await Promise.all([
        fetch('/api/admin/ad-creatives').then(r => r.json()),
        fetch('/api/admin/landing-pages').then(r => r.json()),
        fetch('/api/admin/clinics').then(r => r.json()),
      ])
      setAdCreatives(Array.isArray(acRes) ? acRes : [])
      if (lpRes.landingPages) {
        setLandingPages(lpRes.landingPages)
      } else {
        setLandingPages(Array.isArray(lpRes) ? lpRes : [])
      }
      setClinics(Array.isArray(cRes) ? cRes : [])
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/ad-creatives/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setForm(f => ({ ...f, file_name: data.fileName, file_type: data.fileType }))
      // 미리보기
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setPreviewType(file.type)
    } catch (e: any) {
      toast.error(e.message || '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearFile = () => {
    setForm(f => ({ ...f, file_name: null, file_type: null }))
    setPreviewUrl(null)
    setPreviewType(null)
  }

  const handleSave = async () => {
    if (!form.name || !form.utm_content || !form.clinic_id) {
      toast.error('소재명, UTM Content, 병원을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/ad-creatives/${editing.id}` : '/api/admin/ad-creatives'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clinic_id: form.clinic_id && form.clinic_id !== 'none' ? Number(form.clinic_id) : null,
          landing_page_id: form.landing_page_id && form.landing_page_id !== 'none' ? Number(form.landing_page_id) : null,
          platform: form.platform && form.platform !== 'none' ? form.platform : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      resetForm()
      setDialogOpen(false)
      toast.success(editing ? '광고 소재가 수정되었습니다.' : '광고 소재가 등록되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm({
      name: '', description: '', utm_content: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '',
      platform: '', clinic_id: '', landing_page_id: '', is_active: true, file_name: null, file_type: null,
    })
    setEditing(null)
    setPreviewUrl(null)
    setPreviewType(null)
  }

  const handleEdit = (creative: AdCreative) => {
    setEditing(creative)
    setForm({
      name: creative.name,
      description: creative.description || '',
      utm_content: creative.utm_content,
      utm_source: creative.utm_source || '',
      utm_medium: creative.utm_medium || '',
      utm_campaign: creative.utm_campaign || '',
      utm_term: creative.utm_term || '',
      platform: creative.platform || '',
      clinic_id: String(creative.clinic_id),
      landing_page_id: creative.landing_page_id ? String(creative.landing_page_id) : '',
      is_active: creative.is_active,
      file_name: creative.file_name,
      file_type: creative.file_type,
    })
    if (creative.file_name) {
      setPreviewUrl(`/creatives/${creative.file_name}`)
      setPreviewType(creative.file_type)
    }
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 광고 소재를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/ad-creatives/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      toast.success('삭제되었습니다.')
      fetchData()
    } catch {
      toast.error('삭제 실패')
    }
  }

  const filteredLandingPages = form.clinic_id
    ? landingPages.filter(lp => lp.clinic_id === Number(form.clinic_id) || !lp.clinic_id)
    : landingPages

  if (user?.role !== 'superadmin') return null

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Image className="text-brand-400" size={24} />
          <h1 className="text-2xl font-bold text-white">광고 소재</h1>
        </div>
        <p className="text-sm text-slate-400">광고 소재 등록 및 UTM 파라미터 관리</p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '광고 소재 수정' : '신규 광고 소재 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 소재 파일 업로드 */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">소재 파일 (이미지/동영상)</Label>
              {previewUrl ? (
                <div className="relative inline-block">
                  {previewType?.startsWith('video/') ? (
                    <video src={previewUrl} className="h-32 rounded-lg bg-white/5" controls muted />
                  ) : (
                    <img src={previewUrl} alt="미리보기" className="h-32 rounded-lg object-contain bg-white/5" />
                  )}
                  <button
                    onClick={clearFile}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-24 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-brand-500/50 hover:text-slate-400 transition-colors"
                >
                  <Upload size={20} />
                  <span className="text-xs">{uploading ? '업로드 중...' : '클릭하여 파일 선택'}</span>
                  <span className="text-[10px] text-slate-600">JPG, PNG, GIF, WebP, MP4, WebM (50MB 이하)</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">소재명 *</Label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 3월 프로모션 영상 30초"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">UTM Content *</Label>
                <Input
                  type="text"
                  value={form.utm_content}
                  onChange={e => setForm(f => ({ ...f, utm_content: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                  placeholder="예: video_30s_promo"
                />
                <p className="text-xs text-slate-500">UTM 링크에 사용될 값 (영문, 숫자, 언더스코어)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">병원 *</Label>
                <Select value={form.clinic_id} onValueChange={v => setForm(f => ({ ...f, clinic_id: v, landing_page_id: '' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="병원 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">광고 플랫폼</Label>
                <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {PLATFORM_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* UTM 파라미터 섹션 */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <p className="text-xs text-slate-400 mb-3">UTM 파라미터 (선택사항 - UTM 생성기에서 자동 적용)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">UTM Source</Label>
                  <Input
                    type="text"
                    value={form.utm_source}
                    onChange={e => setForm(f => ({ ...f, utm_source: e.target.value }))}
                    placeholder="예: meta, google, naver"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">UTM Medium</Label>
                  <Input
                    type="text"
                    value={form.utm_medium}
                    onChange={e => setForm(f => ({ ...f, utm_medium: e.target.value }))}
                    placeholder="예: cpc, display, social"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">UTM Campaign</Label>
                  <Input
                    type="text"
                    value={form.utm_campaign}
                    onChange={e => setForm(f => ({ ...f, utm_campaign: e.target.value }))}
                    placeholder="예: march_promo_2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">UTM Term</Label>
                  <Input
                    type="text"
                    value={form.utm_term}
                    onChange={e => setForm(f => ({ ...f, utm_term: e.target.value }))}
                    placeholder="예: 피부관리, 안티에이징"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-400">연결 랜딩 페이지</Label>
              <Select
                value={form.landing_page_id}
                onValueChange={v => setForm(f => ({ ...f, landing_page_id: v }))}
                disabled={!form.clinic_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.clinic_id ? "랜딩 페이지 선택" : "병원을 먼저 선택하세요"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미지정</SelectItem>
                  {filteredLandingPages.map(lp => (
                    <SelectItem key={lp.id} value={String(lp.id)}>
                      {lp.name} ({lp.file_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">설명 (메모)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="소재에 대한 설명"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-400">활성화</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving || uploading} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '저장 중...' : (editing ? '수정' : '등록')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white">광고 소재 목록 ({adCreatives.length})</h2>
            <p className="text-xs text-slate-500 mt-1">소재별 UTM Content 값과 랜딩 페이지 연결을 관리합니다.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 소재 등록
          </Button>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm py-4 text-center">로딩 중...</p>
        ) : adCreatives.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">등록된 광고 소재가 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/5 hover:bg-transparent">
                <TableHead className="text-xs text-slate-500 font-medium w-[60px]">소재</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">소재명</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">UTM Content</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">플랫폼</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">병원</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">랜딩 페이지</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">상태</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adCreatives.map((creative) => (
                <TableRow key={creative.id} className="border-b border-white/5">
                  <TableCell>
                    <CreativeThumbnail creative={creative} />
                  </TableCell>
                  <TableCell className="text-white font-medium">{creative.name}</TableCell>
                  <TableCell>
                    <code className="text-xs text-brand-400 bg-white/5 px-2 py-1 rounded">
                      {creative.utm_content}
                    </code>
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {PLATFORM_OPTIONS.find(p => p.value === creative.platform)?.label || '-'}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">{creative.clinic?.name || '-'}</TableCell>
                  <TableCell>
                    {creative.landing_page ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-300">{creative.landing_page.name}</span>
                        <a
                          href={`/lp?id=${creative.landing_page.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-white transition-colors"
                          aria-label="랜딩 페이지 열기"
                        >
                          <Link2 size={12} />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">미연결</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={creative.is_active ? 'success' : 'secondary'}>
                      {creative.is_active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(creative)} className="text-slate-400 hover:text-white transition-colors" aria-label="수정">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(creative.id)} className="text-slate-400 hover:text-red-400 transition-colors" aria-label="삭제">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
