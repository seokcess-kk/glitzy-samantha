'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, ChevronDown, ChevronUp, Check, AlertCircle, Calendar, List, ChevronLeft, ChevronRight, Clock, Phone, Edit2 } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'

// ─── 상수 ────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed:             { label: '예약확정', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  visited:               { label: '방문완료', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  treatment_confirmed:   { label: '시술확정', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  cancelled:             { label: '취소',     color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  noshow:                { label: '노쇼',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

// ─── Toast ───────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium z-50 ${type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />} {message}
    </div>
  )
}

// ─── 예약 정보 수정 폼 ────────────────────────────────────
function BookingEditForm({ booking, onSave }: { booking: any; onSave: (msg: string, type: string) => void }) {
  const [form, setForm] = useState({
    status: booking.status || 'confirmed',
    booking_datetime: booking.booking_datetime ? new Date(booking.booking_datetime).toISOString().slice(0, 16) : '',
    notes: booking.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, ...form }),
      })
      if (!res.ok) throw new Error()
      onSave('예약 정보가 저장되었습니다.', 'success')
    } catch {
      onSave('저장에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 mt-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">예약 상태</label>
        <select
          value={form.status}
          onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k} className="bg-slate-900">{v.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">예약 일시</label>
        <input
          type="datetime-local"
          value={form.booking_datetime}
          onChange={e => setForm(f => ({ ...f, booking_datetime: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">메모</label>
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="예약 관련 메모"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
        />
      </div>
      <div className="col-span-3 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all">
          {saving ? '저장 중...' : '예약 저장'}
        </button>
      </div>
    </div>
  )
}

// ─── 상담 기록 폼 ─────────────────────────────────────────
function ConsultationForm({ customerId, current, onSave }: { customerId: number; current: any; onSave: (msg: string, type: string) => void }) {
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
      onSave('상담 내용이 저장되었습니다.', 'success')
    } catch {
      onSave('저장에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 mt-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">상담 상태</label>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
          <option value="">선택</option>
          {['예약완료', '방문완료', '노쇼', '상담중', '취소'].map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">상담 일시</label>
        <input type="date" value={form.consultationDate} onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">메모</label>
        <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="상담 내용 메모"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
      </div>
      <div className="col-span-3 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all">
          {saving ? '저장 중...' : '상담 저장'}
        </button>
      </div>
    </div>
  )
}

// ─── 결제 섹션 ────────────────────────────────────────────
function PaymentSection({ customerId, payments, onSave }: { customerId: number; payments: any[]; onSave: (msg: string, type: string) => void }) {
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
      onSave('결제 내역이 등록되었습니다.', 'success')
    } catch {
      onSave('저장에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3">
      {payments.length > 0 && (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-white/5">
              <th className="text-left py-1.5 font-medium">시술명</th>
              <th className="text-left py-1.5 font-medium">금액</th>
              <th className="text-left py-1.5 font-medium">결제일</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p: any) => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="py-2 text-white">{p.treatment_name}</td>
                <td className="py-2 text-emerald-400 font-semibold">₩{Number(p.payment_amount).toLocaleString()}</td>
                <td className="py-2 text-slate-400 text-xs">{new Date(p.payment_date).toLocaleDateString('ko')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">시술명 *</label>
          <input type="text" value={form.treatmentName}
            onChange={e => { setForm(f => ({ ...f, treatmentName: e.target.value })); setErrors(e => ({ ...e, treatmentName: '' })) }}
            placeholder="쌍꺼풀, 보톡스 등"
            className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 ${errors.treatmentName ? 'border-red-500' : 'border-white/10'}`} />
          {errors.treatmentName && <p className="text-red-400 text-xs mt-1">{errors.treatmentName}</p>}
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">결제 금액 (원) *</label>
          <input type="number" value={form.paymentAmount}
            onChange={e => { setForm(f => ({ ...f, paymentAmount: e.target.value })); setErrors(e => ({ ...e, paymentAmount: '' })) }}
            placeholder="500000" min="0"
            className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 ${errors.paymentAmount ? 'border-red-500' : 'border-white/10'}`} />
          {errors.paymentAmount && <p className="text-red-400 text-xs mt-1">{errors.paymentAmount}</p>}
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">결제 일시</label>
          <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
        </div>
        <div className="col-span-3 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all">
            <Plus size={14} /> {saving ? '저장 중...' : '결제 내역 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 예약 행 ──────────────────────────────────────────────
function BookingRow({ booking, onToast, onRefresh }: { booking: any; onToast: (msg: string, type: string) => void; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'booking' | 'consult' | 'payment'>('booking')

  const customer = booking.customer
  const cfg = STATUS_CONFIG[booking.status] || { label: booking.status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  const totalPayment = (customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const latestConsult = customer?.consultations?.[0]

  const handleSave = (msg: string, type: string) => {
    onToast(msg, type)
    if (type === 'success') onRefresh()
  }

  return (
    <div className="glass-card overflow-hidden">
      <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors text-left" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">
          {customer?.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm">{customer?.name || '이름 없음'}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {customer?.phone_number}</p>
        </div>
        <div className="w-44 shrink-0 text-xs text-slate-400 flex items-center gap-1">
          <Clock size={11} />
          {booking.booking_datetime ? new Date(booking.booking_datetime).toLocaleString('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
        </div>
        <div className="w-20 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>{cfg.label}</span>
        </div>
        <div className="w-20 shrink-0">
          {latestConsult
            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400">{latestConsult.status}</span>
            : <span className="text-slate-600 text-xs">-</span>}
        </div>
        <div className="w-28 shrink-0 text-right">
          {totalPayment > 0
            ? <span className="text-sm font-semibold text-emerald-400">₩{totalPayment.toLocaleString()}</span>
            : <span className="text-slate-600 text-sm">-</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-white/5 px-5 py-4">
          <div className="flex gap-2 mb-4">
            {([
              { key: 'booking' as const, label: '예약 정보', icon: Edit2 },
              { key: 'consult' as const, label: '상담 기록', icon: List },
              { key: 'payment' as const, label: '결제 내역', icon: Plus },
            ]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg transition-all ${tab === key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          {tab === 'booking' && <BookingEditForm booking={booking} onSave={handleSave} />}
          {tab === 'consult' && <ConsultationForm customerId={customer?.id} current={latestConsult} onSave={handleSave} />}
          {tab === 'payment' && <PaymentSection customerId={customer?.id} payments={customer?.payments || []} onSave={handleSave} />}
        </div>
      )}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function PatientsPage() {
  const { selectedClinicId } = useClinic()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

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
    const key = new Date(b.booking_datetime).toDateString()
    if (!bookingsByDate[key]) bookingsByDate[key] = []
    bookingsByDate[key].push(b)
  }

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">예약 / 결제 관리</h1>
          <p className="text-sm text-slate-400 mt-1">챗봇 확정 예약 현황, 상담 기록 및 결제 내역 통합 관리</p>
        </div>
        <div className="glass-card flex p-1 gap-1">
          <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            <List size={14} /> 목록
          </button>
          <button onClick={() => setView('calendar')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${view === 'calendar' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Calendar size={14} /> 캘린더
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '전체 예약', value: stats.total },
          { label: '시술확정', value: stats.treatmentConfirmed },
          { label: '노쇼', value: stats.noshow },
          { label: '총 결제액', value: `₩${stats.revenue.toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card p-4">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-xl font-bold text-white">{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      {view === 'list' ? (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 glass-card px-3 py-2">
              <Search size={14} className="text-slate-500" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="이름 또는 전화번호"
                className="bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none w-44" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[{ key: 'all', label: '전체' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === key ? 'bg-brand-600 text-white' : 'glass-card text-slate-400 hover:text-white'}`}>
                  {label}
                  {key !== 'all' && <span className="ml-1 opacity-60">{bookings.filter(b => b.status === key).length}</span>}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="glass-card h-16 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-slate-400 text-sm">{search || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '예약 데이터가 없습니다.'}</p>
            </div>
          ) : (
            <>
              {/* 컬럼 헤더 */}
              <div className="flex items-center gap-4 px-5 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-white/5 glass-card mb-1">
                <div className="w-9 shrink-0" />
                <div className="flex-1 min-w-0">고객명</div>
                <div className="w-44 shrink-0">예약 일시</div>
                <div className="w-20 shrink-0">예약 상태</div>
                <div className="w-20 shrink-0">상담 상태</div>
                <div className="w-28 shrink-0 text-right">결제 금액</div>
                <div className="w-4 shrink-0" />
              </div>
              <div className="space-y-2">
                {filtered.map(b => (
                  <BookingRow key={b.id} booking={b} onToast={(msg, type) => setToast({ msg, type })} onRefresh={fetchBookings} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-2 hover:bg-white/10 rounded-lg transition-all">
              <ChevronLeft size={16} className="text-slate-400" />
            </button>
            <h2 className="text-white font-semibold text-lg">
              {currentMonth.toLocaleDateString('ko', { year: 'numeric', month: 'long' })}
            </h2>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-2 hover:bg-white/10 rounded-lg transition-all">
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="text-center text-xs text-slate-500 py-2 font-medium">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const dayNum = i + 1
              const dateKey = new Date(year, month, dayNum).toDateString()
              const dayBookings = bookingsByDate[dateKey] || []
              const isToday = new Date().toDateString() === dateKey
              return (
                <div key={dayNum} className={`min-h-[80px] rounded-xl p-2 border transition-all ${isToday ? 'border-brand-500/40 bg-brand-500/5' : 'border-white/5 hover:bg-white/[0.03]'}`}>
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-brand-400' : 'text-slate-400'}`}>{dayNum}</p>
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((b: any) => {
                      const c = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-slate-500/20 text-slate-400' }
                      return (
                        <div key={b.id} className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate border ${c.color}`}>
                          {new Date(b.booking_datetime).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })} {b.customer?.name}
                        </div>
                      )
                    })}
                    {dayBookings.length > 3 && <p className="text-[10px] text-slate-500 pl-1">+{dayBookings.length - 3}건</p>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-white/5">
            {Object.values(STATUS_CONFIG).map(v => (
              <div key={v.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full border ${v.color}`} />
                <span className="text-xs text-slate-500">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
