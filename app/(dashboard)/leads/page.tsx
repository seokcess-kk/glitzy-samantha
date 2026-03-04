'use client'
import { useState, useEffect } from 'react'
import { Search, User, Phone, Calendar } from 'lucide-react'

const SOURCE_COLORS: Record<string, string> = {
  Meta: 'bg-blue-500/20 text-blue-400',
  Google: 'bg-red-500/20 text-red-400',
  TikTok: 'bg-pink-500/20 text-pink-400',
  Unknown: 'bg-slate-500/20 text-slate-400',
}

function CustomerDetail({ lead }: { lead: any }) {
  const c = lead.customer
  const consult = c?.consultations?.[0]
  const payments = c?.payments || []
  const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)

  return (
    <div className="glass-card p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-lg shrink-0">
          {c?.name?.[0] || '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">{c?.name || '이름 없음'}</h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SOURCE_COLORS[c?.first_source] || SOURCE_COLORS.Unknown}`}>
              {c?.first_source || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Phone size={11} />{c?.phone_number}</span>
            <span className="flex items-center gap-1"><Calendar size={11} />{new Date(lead.created_at).toLocaleDateString('ko')}</span>
          </div>
        </div>
        {totalPayment > 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">총 결제액</p>
            <p className="text-lg font-bold text-emerald-400">₩{totalPayment.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-300">광고 인입</p>
            <p className="text-xs text-slate-500">{c?.first_source} 광고 → 랜딩페이지 DB 등록</p>
          </div>
          <span className="ml-auto text-xs text-slate-600">{new Date(lead.created_at).toLocaleDateString('ko')}</span>
        </div>

        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${lead.chatbot_sent ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          <div>
            <p className="text-xs font-semibold text-slate-300">챗봇 발송</p>
            <p className="text-xs text-slate-500">
              {lead.chatbot_sent
                ? `✅ 발송 완료 (${new Date(lead.chatbot_sent_at).toLocaleTimeString('ko')})`
                : '⏳ 발송 대기 중'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${consult ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          <div>
            <p className="text-xs font-semibold text-slate-300">상담</p>
            <p className="text-xs text-slate-500">{consult ? `${consult.status} — ${consult.notes || '메모 없음'}` : '상담 기록 없음'}</p>
          </div>
          {consult?.consultation_date && (
            <span className="ml-auto text-xs text-slate-600">{new Date(consult.consultation_date).toLocaleDateString('ko')}</span>
          )}
        </div>

        {payments.map((p: any) => (
          <div key={p.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-300">결제</p>
              <p className="text-xs text-slate-500">{p.treatment_name} — ₩{Number(p.payment_amount).toLocaleString()}</p>
            </div>
            <span className="ml-auto text-xs text-slate-600">{new Date(p.payment_date).toLocaleDateString('ko')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    fetch('/api/leads')
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = leads.filter(l =>
    l.customer?.name?.includes(search) ||
    l.customer?.phone_number?.includes(search)
  )

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">고객(CDP) 관리</h1>
          <p className="text-sm text-slate-400 mt-1">광고 인입 → 챗봇 → 상담 → 결제 전체 여정을 추적합니다.</p>
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

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 space-y-2">
          {loading
            ? Array(8).fill(0).map((_, i) => <div key={i} className="glass-card h-16 animate-pulse" />)
            : filtered.map(lead => {
              const c = lead.customer
              const isSelected = selected?.id === lead.id
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelected(isSelected ? null : lead)}
                  className={`w-full glass-card px-4 py-3 flex items-center gap-3 text-left transition-all ${isSelected ? 'ring-1 ring-brand-500' : 'hover:bg-white/[0.03]'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
                    {c?.name?.[0] || <User size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c?.name || '이름 없음'}</p>
                    <p className="text-xs text-slate-500 truncate">{c?.phone_number}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${SOURCE_COLORS[c?.first_source] || SOURCE_COLORS.Unknown}`}>
                    {c?.first_source || '-'}
                  </span>
                </button>
              )
            })
          }
          {!loading && filtered.length === 0 && (
            <div className="glass-card p-8 text-center text-slate-500 text-sm">
              {search ? `'${search}' 검색 결과 없음` : '인입된 고객이 없습니다.'}
            </div>
          )}
        </div>

        <div className="col-span-3">
          {selected
            ? <CustomerDetail lead={selected} />
            : (
              <div className="glass-card p-12 text-center">
                <User size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">좌측 목록에서 고객을 선택하면<br />전체 여정을 확인할 수 있습니다.</p>
              </div>
            )
          }
        </div>
      </div>
    </>
  )
}
