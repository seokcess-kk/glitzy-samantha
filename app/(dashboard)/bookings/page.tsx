'use client'
import { useState, useEffect } from 'react'
import { Calendar, List, ChevronLeft, ChevronRight, Clock, User, Phone } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed:  { label: '예약확정', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  visited:    { label: '방문완료', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled:  { label: '취소',     color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  noshow:     { label: '노쇼',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export default function BookingsPage() {
  const { selectedClinicId } = useClinic()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [filter, setFilter] = useState('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/bookings${qs}`)
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBookings() }, [selectedClinicId])

  const updateStatus = async (id: number, status: string) => {
    await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    fetchBookings()
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  // 캘린더 계산
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const bookingsByDate: Record<string, any[]> = {}
  for (const b of bookings) {
    if (!b.booking_datetime) continue
    const d = new Date(b.booking_datetime).toDateString()
    if (!bookingsByDate[d]) bookingsByDate[d] = []
    bookingsByDate[d].push(b)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">예약 관리</h1>
          <p className="text-sm text-slate-400 mt-1">챗봇 확정 예약 현황 및 캘린더</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass-card flex p-1 gap-1">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List size={14} /> 목록
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${view === 'calendar' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar size={14} /> 캘린더
            </button>
          </div>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-6">
        {[{ key: 'all', label: '전체' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === key ? 'bg-brand-600 text-white' : 'glass-card text-slate-400 hover:text-white'}`}
          >
            {label}
            {key !== 'all' && (
              <span className="ml-1.5 opacity-70">{bookings.filter(b => b.status === key).length}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <div className="glass-card">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">예약 데이터가 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  {['고객명', '연락처', '예약일시', '메모', '상태', '변경'].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b: any) => {
                  const cfg = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-slate-500/20 text-slate-400' }
                  return (
                    <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-xs font-bold shrink-0">
                            {b.customer?.name?.[0] || '?'}
                          </div>
                          <span className="text-white font-medium">{b.customer?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        <div className="flex items-center gap-1"><Phone size={10} /> {b.customer?.phone_number || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          {b.booking_datetime ? new Date(b.booking_datetime).toLocaleString('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs max-w-[160px] truncate">{b.notes || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={b.status}
                          onChange={e => updateStatus(b.id, e.target.value)}
                          className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none"
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k} className="bg-slate-900">{v.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* 캘린더 뷰 */
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
                <div
                  key={dayNum}
                  className={`min-h-[72px] rounded-xl p-2 border transition-all ${isToday ? 'border-brand-500/40 bg-brand-500/5' : 'border-white/5 hover:bg-white/[0.03]'}`}
                >
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-brand-400' : 'text-slate-400'}`}>{dayNum}</p>
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((b: any) => {
                      const cfg = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-slate-500/20 text-slate-400' }
                      return (
                        <div key={b.id} className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate border ${cfg.color}`}>
                          {new Date(b.booking_datetime).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })} {b.customer?.name}
                        </div>
                      )
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-[10px] text-slate-500 pl-1">+{dayBookings.length - 3}건</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
