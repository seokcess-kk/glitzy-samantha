'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, ChevronDown, ChevronUp, Check, AlertCircle, Calendar, List, ChevronLeft, ChevronRight, Clock, Phone, Edit2, Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useClinic } from '@/components/ClinicContext'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { PageHeader, StatusBadge, EmptyState } from '@/components/common'
import { formatDate, formatDateTime, formatTime, toUtcDate } from '@/lib/date'

// 상수
const STATUS_CONFIG: Record<string, { label: string; variant: 'info' | 'success' | 'default' | 'secondary' | 'destructive' }> = {
  confirmed:             { label: '예약확정', variant: 'info' },
  visited:               { label: '방문완료', variant: 'success' },
  treatment_confirmed:   { label: '시술확정', variant: 'default' },
  cancelled:             { label: '취소',     variant: 'secondary' },
  noshow:                { label: '노쇼',     variant: 'destructive' },
}

// 10분 단위 시간 옵션 생성 (00:00 ~ 23:50)
const TIME_OPTIONS = Array.from({ length: 24 * 6 }, (_, i) => {
  const h = Math.floor(i / 6)
  const m = (i % 6) * 10
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// booking_datetime → { date, time } 파싱 (KST 기준, 10분 단위 반올림)
function parseBookingDateTime(dt: string | null | undefined): { date: string; time: string } {
  if (!dt) return { date: '', time: '' }
  const d = toUtcDate(dt)
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) // YYYY-MM-DD
  const hh = Number(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).replace(/\D/g, ''))
  const mm = d.toLocaleString('en-US', { timeZone: 'Asia/Seoul', minute: '2-digit' }).replace(/\D/g, '')
  const rounded = Math.round(Number(mm) / 10) * 10
  const adjH = rounded >= 60 ? hh + 1 : hh
  const adjM = rounded >= 60 ? 0 : rounded
  const time = `${String(adjH).padStart(2, '0')}:${String(adjM).padStart(2, '0')}`
  return { date, time }
}

// 예약 정보 수정 폼
function BookingEditForm({ booking, onSave }: { booking: any; onSave: () => void }) {
  const { date: initDate, time: initTime } = parseBookingDateTime(booking.booking_datetime)

  const [form, setForm] = useState({
    status: booking.status || 'confirmed',
    booking_date: initDate,
    booking_time: initTime,
    notes: booking.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.booking_date || !form.booking_time) {
      toast.error('예약 일시를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const booking_datetime = new Date(`${form.booking_date}T${form.booking_time}:00+09:00`).toISOString()
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, status: form.status, booking_datetime, notes: form.notes }),
      })
      if (!res.ok) throw new Error()
      toast.success('예약 정보가 저장되었습니다.')
      onSave()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">예약 상태</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">예약 날짜</Label>
          <Input
            type="date"
            value={form.booking_date}
            onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">예약 시간</Label>
          <Select value={form.booking_time} onValueChange={v => setForm(f => ({ ...f, booking_time: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="시간 선택" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TIME_OPTIONS.map(val => (
                <SelectItem key={val} value={val}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">메모</Label>
          <Input
            type="text"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="예약 관련 메모"
          />
        </div>
      </div>
      <div className="flex gap-4">
        {booking.created_at && (
          <p className="text-[11px] text-muted-foreground">
            등록: {formatDateTime(booking.created_at)}
          </p>
        )}
        {booking.updated_at && booking.updated_at !== booking.created_at && (
          <p className="text-[11px] text-muted-foreground">
            수정: {formatDateTime(booking.updated_at)}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
          {saving ? '저장 중...' : '예약 저장'}
        </Button>
      </div>
    </div>
  )
}

// 상담 기록 폼
function ConsultationForm({ customerId, current, onSave }: { customerId: number; current: any; onSave: () => void }) {
  const [form, setForm] = useState({
    status: current?.status || '',
    notes: current?.notes || '',
    consultationDate: current?.consultation_date ? current.consultation_date.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${customerId}/consultation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('상담 내용이 저장되었습니다.')
      onSave()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">상담 상태</Label>
        <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="선택" />
          </SelectTrigger>
          <SelectContent>
            {['예약완료', '방문완료', '노쇼', '상담중', '취소'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">상담 일시</Label>
        <Input
          type="date"
          value={form.consultationDate}
          onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">메모</Label>
        <Input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="상담 내용 메모"
        />
      </div>
      <div className="sm:col-span-3 flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
          {saving ? '저장 중...' : '상담 저장'}
        </Button>
      </div>
    </div>
  )
}

// 결제 섹션
function PaymentSection({ customerId, payments, onSave, isSuperAdmin }: { customerId: number; payments: any[]; onSave: () => void; isSuperAdmin?: boolean }) {
  const [form, setForm] = useState({ treatmentName: '', paymentAmount: '', paymentDate: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.treatmentName.trim()) errs.treatmentName = '시술명을 입력하세요.'
    const amount = Number(form.paymentAmount)
    if (!form.paymentAmount || isNaN(amount) || amount <= 0) errs.paymentAmount = '올바른 금액을 입력하세요.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${customerId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, paymentAmount: Number(form.paymentAmount) }),
      })
      if (!res.ok) throw new Error()
      setForm({ treatmentName: '', paymentAmount: '', paymentDate: '' })
      toast.success('결제 내역이 등록되었습니다.')
      onSave()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3">
      {payments.length > 0 && (
        <Table className="mb-4">
          <TableHeader>
            <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">시술명</TableHead>
              <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">금액</TableHead>
              <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">결제일</TableHead>
              {isSuperAdmin && <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p: any) => (
              <TableRow key={p.id} className="border-b border-border dark:border-white/5">
                <TableCell className="text-foreground">{p.treatment_name}</TableCell>
                <TableCell className="text-emerald-400 font-semibold">₩{Number(p.payment_amount).toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(p.payment_date)}</TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <button
                      onClick={async () => {
                        if (!confirm('이 결제 내역을 삭제하시겠습니까?')) return
                        try {
                          const res = await fetch(`/api/payments/${p.id}`, { method: 'DELETE' })
                          if (!res.ok) throw new Error()
                          toast.success('결제 내역이 삭제되었습니다.')
                          onSave()
                        } catch { toast.error('삭제에 실패했습니다.') }
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">시술명 *</Label>
          <Input
            type="text"
            value={form.treatmentName}
            onChange={e => { setForm(f => ({ ...f, treatmentName: e.target.value })); setErrors(e => ({ ...e, treatmentName: '' })) }}
            placeholder="쌍꺼풀, 보톡스 등"
            className={`bg-muted dark:bg-white/5 text-foreground placeholder:text-muted-foreground/60 ${errors.treatmentName ? 'border-red-500' : 'border-border dark:border-white/10'}`}
          />
          {errors.treatmentName && <p className="text-red-400 text-xs">{errors.treatmentName}</p>}
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">결제 금액 (원) *</Label>
          <Input
            type="number"
            value={form.paymentAmount}
            onChange={e => { setForm(f => ({ ...f, paymentAmount: e.target.value })); setErrors(e => ({ ...e, paymentAmount: '' })) }}
            placeholder="500000"
            min="0"
            className={`bg-muted dark:bg-white/5 text-foreground placeholder:text-muted-foreground/60 ${errors.paymentAmount ? 'border-red-500' : 'border-border dark:border-white/10'}`}
          />
          {errors.paymentAmount && <p className="text-red-400 text-xs">{errors.paymentAmount}</p>}
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">결제 일시</Label>
          <Input
            type="date"
            value={form.paymentDate}
            onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-3 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus size={14} /> {saving ? '저장 중...' : '결제 내역 추가'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// 예약 행
function BookingRow({ booking, onRefresh, isSuperAdmin }: { booking: any; onRefresh: () => void; isSuperAdmin?: boolean }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'booking' | 'consult' | 'payment'>('booking')
  const [changingStatus, setChangingStatus] = useState(false)

  const customer = booking.customer
  const cfg = STATUS_CONFIG[booking.status] || { label: booking.status, variant: 'secondary' as const }
  const totalPayment = (customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const latestConsult = customer?.consultations?.[0]

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === booking.status) return
    setChangingStatus(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, status: newStatus }),
      })
      if (!res.ok) throw new Error()
      const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus
      toast.success(`예약 상태가 "${statusLabel}"(으)로 변경되었습니다.`)
      onRefresh()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <Card variant="glass" className="overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted dark:hover:bg-white/[0.03] transition-colors text-left"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={`${customer?.name || '고객'} 상세정보 ${open ? '접기' : '펼치기'}`}
      >
        <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">
          {customer?.name?.[0] || '?'}
        </div>
        <div className="w-40 shrink-0 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{customer?.name || '이름 없음'}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate"><Phone size={10} /> {customer?.phone_number}</p>
        </div>
        <div className="w-40 shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={11} />
            {booking.booking_datetime ? formatDateTime(booking.booking_datetime) : '-'}
          </div>
          {booking.created_at && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">등록: {formatDateTime(booking.created_at)}</p>
          )}
        </div>
        <div className="flex-1" />
        <div className="w-28 shrink-0" onClick={e => e.stopPropagation()}>
          <Select value={booking.status} onValueChange={handleStatusChange} disabled={changingStatus}>
            <SelectTrigger className="h-7 px-2 text-xs border-0 bg-transparent hover:bg-muted dark:hover:bg-white/5 focus:ring-0 w-full">
              <Badge variant={cfg.variant} className="whitespace-nowrap">{changingStatus ? '변경 중...' : cfg.label}</Badge>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  <Badge variant={v.variant} className="text-[10px] px-1.5 py-0">{v.label}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-20 shrink-0">
          {latestConsult
            ? <Badge variant="secondary">{latestConsult.status}</Badge>
            : <span className="text-muted-foreground/60 text-xs">-</span>}
        </div>
        <div className="w-28 shrink-0 text-right">
          {totalPayment > 0
            ? <span className="text-sm font-semibold text-emerald-400">₩{totalPayment.toLocaleString()}</span>
            : <span className="text-muted-foreground/60 text-sm">-</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border dark:border-white/5 px-5 py-4">
          <div className="flex gap-2 mb-4">
            {([
              { key: 'booking' as const, label: '예약 정보', icon: Edit2 },
              { key: 'consult' as const, label: '상담 기록', icon: List },
              { key: 'payment' as const, label: '결제 내역', icon: Plus },
            ]).map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={tab === key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTab(key)}
                className={tab === key ? 'bg-brand-600' : ''}
              >
                <Icon size={13} /> {label}
              </Button>
            ))}
          </div>
          {tab === 'booking' && <BookingEditForm booking={booking} onSave={onRefresh} />}
          {tab === 'consult' && <ConsultationForm customerId={customer?.id} current={latestConsult} onSave={onRefresh} />}
          {tab === 'payment' && <PaymentSection customerId={customer?.id} payments={customer?.payments || []} onSave={onRefresh} isSuperAdmin={isSuperAdmin} />}

          {isSuperAdmin && (
            <div className="mt-4 pt-4 border-t border-border dark:border-white/5 flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm('이 예약을 삭제하시겠습니까?')) return
                  try {
                    const res = await fetch(`/api/bookings?id=${booking.id}`, { method: 'DELETE' })
                    if (!res.ok) throw new Error()
                    toast.success('예약이 삭제되었습니다.')
                    onRefresh()
                  } catch { toast.error('삭제에 실패했습니다.') }
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={14} /> 예약 삭제
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm(`${customer?.name || '이 고객'}의 모든 데이터(리드, 예약, 상담, 결제)가 삭제됩니다. 계속하시겠습니까?`)) return
                  try {
                    const res = await fetch(`/api/patients/${customer?.id}`, { method: 'DELETE' })
                    if (!res.ok) throw new Error()
                    toast.success('고객 데이터가 삭제되었습니다.')
                    onRefresh()
                  } catch { toast.error('삭제에 실패했습니다.') }
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={14} /> 고객 전체 삭제
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// 메인 페이지
export default function PatientsPage() {
  const { selectedClinicId } = useClinic()
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === 'superadmin'
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  // 예약 등록 다이얼로그
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', phone_number: '',
    booking_date: '', booking_time: '',
    source: 'walk-in', notes: '',
  })
  const [creating, setCreating] = useState(false)

  const initCreateForm = () => {
    const now = new Date()
    const mins = Math.ceil(now.getMinutes() / 10) * 10
    now.setMinutes(mins, 0, 0)
    if (mins >= 60) now.setHours(now.getHours() + 1, 0, 0, 0)
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setCreateForm({
      name: '', phone_number: '',
      booking_date: dateStr, booking_time: timeStr,
      source: 'walk-in', notes: '',
    })
  }

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/bookings${qs}`)
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const handleCreate = async () => {
    if (!createForm.phone_number) {
      toast.error('전화번호를 입력해주세요.')
      return
    }
    if (!createForm.booking_date || !createForm.booking_time) {
      toast.error('예약 일시를 입력해주세요.')
      return
    }
    setCreating(true)
    try {
      const booking_datetime = new Date(`${createForm.booking_date}T${createForm.booking_time}:00+09:00`).toISOString()
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/bookings${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          phone_number: createForm.phone_number,
          booking_datetime,
          source: createForm.source,
          notes: createForm.notes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success('예약이 등록되었습니다.')
      setCreateOpen(false)
      fetchBookings()
    } catch (e: any) {
      toast.error(e.message || '예약 등록 실패')
    } finally {
      setCreating(false)
    }
  }

  const filtered = bookings.filter(b => {
    const matchSearch = !search || b.customer?.name?.includes(search) || b.customer?.phone_number?.includes(search)
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: bookings.length,
    treatmentConfirmed: bookings.filter(b => b.status === 'treatment_confirmed').length,
    noshow: bookings.filter(b => b.status === 'noshow').length,
    revenue: bookings.reduce((s, b) => s + (b.customer?.payments || []).reduce((ps: number, p: any) => ps + Number(p.payment_amount), 0), 0),
  }

  // 캘린더
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const bookingsByDate: Record<string, any[]> = {}
  for (const b of bookings) {
    if (!b.booking_datetime) continue
    const key = toUtcDate(b.booking_datetime).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    if (!bookingsByDate[key]) bookingsByDate[key] = []
    bookingsByDate[key].push(b)
  }

  return (
    <>
      <PageHeader
        title="예약 / 결제 관리"
        description="예약 현황, 상담 기록 및 결제 내역 통합 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { initCreateForm(); setCreateOpen(true) }} className="bg-brand-600 hover:bg-brand-700">
              <Plus size={14} /> 예약 등록
            </Button>
            <Card variant="glass" className="flex p-1 gap-1">
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                className={view === 'list' ? 'bg-brand-600' : ''}
              >
                <List size={14} /> 목록
              </Button>
              <Button
                variant={view === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('calendar')}
                className={view === 'calendar' ? 'bg-brand-600' : ''}
              >
                <Calendar size={14} /> 캘린더
              </Button>
            </Card>
          </div>
        }
      />

      {/* 예약 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 예약 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">이름</Label>
                <Input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">전화번호 *</Label>
                <Input
                  type="tel"
                  value={createForm.phone_number}
                  onChange={e => setCreateForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder="010-1234-5678"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">예약 날짜 *</Label>
                <Input
                  type="date"
                  value={createForm.booking_date}
                  min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })}
                  onChange={e => setCreateForm(f => ({ ...f, booking_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">예약 시간 *</Label>
                <Select value={createForm.booking_time} onValueChange={v => setCreateForm(f => ({ ...f, booking_time: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="시간 선택" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map(val => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">유입 경로</Label>
                <Select value={createForm.source} onValueChange={v => setCreateForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">방문 (Walk-in)</SelectItem>
                    <SelectItem value="phone">전화 예약</SelectItem>
                    <SelectItem value="kakao">카카오톡</SelectItem>
                    <SelectItem value="naver">네이버 예약</SelectItem>
                    <SelectItem value="referral">지인 소개</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">메모</Label>
              <Textarea
                value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="예약 관련 메모"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-brand-600 hover:bg-brand-700">
              {creating ? '등록 중...' : '예약 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: '전체 예약', value: stats.total },
          { label: '시술확정', value: stats.treatmentConfirmed },
          { label: '노쇼', value: stats.noshow },
          { label: '총 결제액', value: `₩${stats.revenue.toLocaleString()}` },
        ].map(({ label, value }) => (
          <Card key={label} variant="glass" className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
            {loading ? <Skeleton className="h-6 mt-1" /> : <p className="text-xl font-bold text-foreground">{value}</p>}
          </Card>
        ))}
      </div>

      {view === 'list' ? (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Card variant="glass" className="flex items-center px-3 py-2">
              <Search size={14} className="text-muted-foreground mr-2" />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름 또는 전화번호"
                className="bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 w-44 p-0 h-auto"
              />
            </Card>
            <div className="flex gap-2 flex-wrap">
              {[{ key: 'all', label: '전체' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={statusFilter === key ? 'default' : 'glass'}
                  size="sm"
                  onClick={() => setStatusFilter(key)}
                  className={statusFilter === key ? 'bg-brand-600' : ''}
                >
                  {label}
                  {key !== 'all' && <span className="ml-1 opacity-60">{bookings.filter(b => b.status === key).length}</span>}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          ) : filtered.length === 0 ? (
            <Card variant="glass" className="p-12 text-center">
              <p className="text-muted-foreground text-sm">{search || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '예약 데이터가 없습니다.'}</p>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              {/* 컬럼 헤더 */}
              <Card variant="glass" className="flex items-center gap-4 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 min-w-[640px]">
                <div className="w-9 shrink-0" />
                <div className="w-40 shrink-0">고객명</div>
                <div className="w-40 shrink-0">예약 일시</div>
                <div className="flex-1" />
                <div className="w-28 shrink-0">예약 상태</div>
                <div className="w-20 shrink-0">상담 상태</div>
                <div className="w-28 shrink-0 text-right">결제 금액</div>
                <div className="w-4 shrink-0" />
              </Card>
              <div className="space-y-2 min-w-[640px]">
                {filtered.map(b => (
                  <BookingRow key={b.id} booking={b} onRefresh={fetchBookings} isSuperAdmin={isSuperAdmin} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1))}>
              <ChevronLeft size={16} />
            </Button>
            <h2 className="text-foreground font-semibold text-lg">
              {currentMonth.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long' })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1))}>
              <ChevronRight size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground py-2 font-medium">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const dayNum = i + 1
              const dateKey = new Date(year, month, dayNum).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
              const dayBookings = bookingsByDate[dateKey] || []
              const isToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) === dateKey
              return (
                <div key={dayNum} className={`min-h-[60px] sm:min-h-[80px] rounded-xl p-1.5 sm:p-2 border transition-all ${isToday ? 'border-brand-500/40 bg-brand-500/5' : 'border-border dark:border-white/5 hover:bg-muted dark:hover:bg-white/[0.03]'}`}>
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-brand-400' : 'text-muted-foreground'}`}>{dayNum}</p>
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((b: any) => {
                      const c = STATUS_CONFIG[b.status] || { label: b.status, variant: 'secondary' as const }
                      return (
                        <div key={b.id} className="text-[10px] truncate">
                          <Badge variant={c.variant} className="text-[10px] px-1 py-0">
                            {formatTime(b.booking_datetime)} {b.customer?.name}
                          </Badge>
                        </div>
                      )
                    })}
                    {dayBookings.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{dayBookings.length - 3}건</p>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-border dark:border-white/5">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <Badge variant={v.variant} className="w-2.5 h-2.5 p-0 rounded-full" />
                <span className="text-xs text-muted-foreground">{v.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
