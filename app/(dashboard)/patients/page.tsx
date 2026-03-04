'use client'
import { useState, useEffect } from 'react'
import { Search, Plus, ChevronDown, ChevronUp, Check, AlertCircle } from 'lucide-react'

function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium z-50 ${type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />} {message}
    </div>
  )
}

function ConsultationForm({ customerId, current, onSave }: { customerId: number; current: any; onSave: (msg: string, type: string) => void }) {
  const [form, setForm] = useState({
    status: current?.status || '',
    notes: current?.notes || '',
    consultationDate: current?.consultation_date ? current.consultation_date.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)
  const statusOptions = ['예약완료', '방문완료', '노쇼', '상담중', '취소']

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
        <select
          value={form.status}
          onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">선택</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">상담 일시</label>
        <input
          type="date"
          value={form.consultationDate}
          onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">메모</label>
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="상담 내용 메모"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
        />
      </div>
      <div className="col-span-3 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
        >
          {saving ? '저장 중...' : '상담 저장'}
        </button>
      </div>
    </div>
  )
}

function PaymentForm({ customerId, onSave }: { customerId: number; onSave: (msg: string, type: string) => void }) {
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
    <div className="grid grid-cols-3 gap-3 mt-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">시술명 *</label>
        <input
          type="text"
          value={form.treatmentName}
          onChange={e => { setForm(f => ({ ...f, treatmentName: e.target.value })); setErrors(e => ({ ...e, treatmentName: '' })) }}
          placeholder="쌍꺼풀, 보톡스 등"
          className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 ${errors.treatmentName ? 'border-red-500' : 'border-white/10'}`}
        />
        {errors.treatmentName && <p className="text-red-400 text-xs mt-1">{errors.treatmentName}</p>}
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">결제 금액 (원) *</label>
        <input
          type="number"
          value={form.paymentAmount}
          onChange={e => { setForm(f => ({ ...f, paymentAmount: e.target.value })); setErrors(e => ({ ...e, paymentAmount: '' })) }}
          placeholder="500000"
          min="0"
          className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 ${errors.paymentAmount ? 'border-red-500' : 'border-white/10'}`}
        />
        {errors.paymentAmount && <p className="text-red-400 text-xs mt-1">{errors.paymentAmount}</p>}
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">결제 일시</label>
        <input
          type="date"
          value={form.paymentDate}
          onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        />
      </div>
      <div className="col-span-3 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
        >
          <Plus size={14} /> {saving ? '저장 중...' : '결제 내역 추가'}
        </button>
      </div>
    </div>
  )
}

function CustomerRow({ customer, onToast }: { customer: any; onToast: (msg: string, type: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('consult')
  const [payments, setPayments] = useState(customer.payments || [])
  const latestConsult = customer.consultations?.[0]
  const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)

  const handleSave = (msg: string, type: string) => {
    onToast(msg, type)
    if (type === 'success' && tab === 'payment') {
      fetch('/api/patients').then(r => r.json()).then(data => {
        const updated = data.find((c: any) => c.id === customer.id)
        if (updated) setPayments(updated.payments || [])
      }).catch(() => {})
    }
  }

  return (
    <div className="glass-card overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">
          {customer.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm">{customer.name || '이름 없음'}</p>
          <p className="text-xs text-slate-500">{customer.phone_number}</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-600/20 text-brand-400">{customer.first_source || '-'}</span>
        {latestConsult && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${latestConsult.status === '방문완료' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
            {latestConsult.status}
          </span>
        )}
        {totalPayment > 0 && <span className="text-sm font-semibold text-emerald-400">₩{totalPayment.toLocaleString()}</span>}
        {open ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-white/5 px-5 py-4">
          <div className="flex gap-3 mb-4">
            {['consult', 'payment'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-all ${tab === t ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {t === 'consult' ? '상담 기록' : '결제 내역'}
              </button>
            ))}
          </div>

          {tab === 'consult' && (
            <ConsultationForm customerId={customer.id} current={latestConsult} onSave={handleSave} />
          )}

          {tab === 'payment' && (
            <div>
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
                        <td className="py-2 text-slate-400">{new Date(p.payment_date).toLocaleDateString('ko')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <PaymentForm customerId={customer.id} onSave={handleSave} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PatientsPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  useEffect(() => {
    fetch('/api/patients')
      .then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter(c =>
    c.name?.includes(search) || c.phone_number?.includes(search)
  )

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">병원 데이터 입력</h1>
          <p className="text-sm text-slate-400 mt-1">인입된 고객의 상담 결과 및 결제 내역을 기록합니다.</p>
        </div>
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <Search size={14} className="text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호 검색"
            className="bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="glass-card h-16 animate-pulse" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(c => (
            <CustomerRow key={c.id} customer={c} onToast={(msg, type) => setToast({ msg, type })} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-slate-400">
            {search ? `'${search}' 검색 결과가 없습니다.` : '인입된 고객이 없습니다.'}
          </p>
        </div>
      )}
    </>
  )
}
