'use client'
import { useState, useEffect } from 'react'
import { Plus, FileText, Copy, ExternalLink, Trash2, Pencil } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  description: string | null
  is_active: boolean
  created_at: string
  clinic?: { id: number; name: string } | null
}

export default function LandingPagesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [clinics, setClinics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<number, { lead_count: number; booking_count: number; paying_customers: number; revenue: number; booking_rate: number; conversion_rate: number }>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LandingPage | null>(null)
  const [form, setForm] = useState({ name: '', file_name: '', clinic_id: '', description: '', is_active: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [lpRes, cRes, statsRes] = await Promise.all([
        fetch('/api/admin/landing-pages?includeFiles=true').then(r => r.json()),
        fetch('/api/admin/clinics').then(r => r.json()),
        fetch('/api/admin/landing-pages/stats').then(r => r.json()).catch(() => []),
      ])
      if (lpRes.landingPages) {
        setLandingPages(lpRes.landingPages)
        setAvailableFiles(lpRes.availableFiles || [])
      } else {
        setLandingPages(Array.isArray(lpRes) ? lpRes : [])
      }
      setClinics(Array.isArray(cRes) ? cRes : [])
      // 성과 통계를 landing_page_id 기준 맵으로 변환
      if (Array.isArray(statsRes)) {
        const map: Record<number, any> = {}
        statsRes.forEach((s: any) => { map[s.landing_page_id] = s })
        setStats(map)
      }
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!form.name || !form.file_name) {
      toast.error('이름과 파일을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/landing-pages/${editing.id}` : '/api/admin/landing-pages'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clinic_id: form.clinic_id && form.clinic_id !== 'none' ? Number(form.clinic_id) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setForm({ name: '', file_name: '', clinic_id: '', description: '', is_active: true })
      setEditing(null)
      setDialogOpen(false)
      toast.success(editing ? '랜딩 페이지가 수정되었습니다.' : '랜딩 페이지가 등록되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (lp: LandingPage) => {
    setEditing(lp)
    setForm({
      name: lp.name,
      file_name: lp.file_name,
      clinic_id: lp.clinic_id ? String(lp.clinic_id) : '',
      description: lp.description || '',
      is_active: lp.is_active,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 랜딩 페이지를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/landing-pages/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      toast.success('삭제되었습니다.')
      fetchData()
    } catch {
      toast.error('삭제 실패')
    }
  }

  const copyUrl = (id: number) => {
    const url = `${window.location.origin}/lp?id=${id}`
    navigator.clipboard.writeText(url)
    toast.success('URL이 복사되었습니다.')
  }

  if (user?.role !== 'superadmin') return null

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="text-brand-400" size={24} />
          <h1 className="text-2xl font-bold text-white">랜딩 페이지</h1>
        </div>
        <p className="text-sm text-slate-400">랜딩 페이지 등록 및 병원 배정</p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setEditing(null)
          setForm({ name: '', file_name: '', clinic_id: '', description: '', is_active: true })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '랜딩 페이지 수정' : '신규 랜딩 페이지 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">이름 *</Label>
              <Input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 세레아 3월 프로모션"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">HTML 파일 *</Label>
              <Select value={form.file_name} onValueChange={v => setForm(f => ({ ...f, file_name: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="파일 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableFiles.map((file) => (
                    <SelectItem key={file} value={file}>{file}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">public/landing/ 폴더에 있는 HTML 파일</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">배정 병원</Label>
              <Select value={form.clinic_id} onValueChange={v => setForm(f => ({ ...f, clinic_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="선택 (미배정 가능)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미배정</SelectItem>
                  {clinics.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">설명 (메모)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="관리자 메모"
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
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '저장 중...' : (editing ? '수정' : '등록')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">랜딩 페이지 목록 ({landingPages.length})</h2>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 랜딩 페이지 등록
          </Button>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm py-4 text-center">로딩 중...</p>
        ) : landingPages.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">등록된 랜딩 페이지가 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/5 hover:bg-transparent">
                <TableHead className="text-xs text-slate-500 font-medium">ID</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">이름</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">파일명</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">배정 병원</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">URL</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">리드</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">예약</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">결제</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">매출</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">상태</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {landingPages.map((lp) => (
                <TableRow key={lp.id} className="border-b border-white/5">
                  <TableCell className="text-slate-500 text-xs">#{lp.id}</TableCell>
                  <TableCell className="text-white font-medium">{lp.name}</TableCell>
                  <TableCell className="text-slate-400 font-mono text-xs">{lp.file_name}</TableCell>
                  <TableCell className="text-slate-400 text-xs">{lp.clinic?.name || '미배정'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-brand-400 bg-white/5 px-2 py-1 rounded">/lp?id={lp.id}</code>
                      <button onClick={() => copyUrl(lp.id)} className="text-slate-500 hover:text-white transition-colors" aria-label="URL 복사">
                        <Copy size={12} />
                      </button>
                      <a href={`/lp?id=${lp.id}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors" aria-label="새 탭에서 열기">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.lead_count ? (
                      <Link
                        href={`/leads?landing_page_id=${lp.id}`}
                        className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                      >
                        {stats[lp.id].lead_count}건
                      </Link>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.booking_count ? (
                      <span className="text-blue-400 text-sm">{stats[lp.id].booking_count}<span className="text-slate-600 text-xs ml-1">({stats[lp.id].booking_rate}%)</span></span>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.paying_customers ? (
                      <span className="text-emerald-400 text-sm">{stats[lp.id].paying_customers}<span className="text-slate-600 text-xs ml-1">({stats[lp.id].conversion_rate}%)</span></span>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.revenue ? (
                      <span className="text-emerald-400 font-semibold text-sm">₩{stats[lp.id].revenue.toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={lp.is_active ? 'success' : 'secondary'}>
                      {lp.is_active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(lp)} className="text-slate-400 hover:text-white transition-colors" aria-label="수정">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(lp.id)} className="text-slate-400 hover:text-red-400 transition-colors" aria-label="삭제">
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
