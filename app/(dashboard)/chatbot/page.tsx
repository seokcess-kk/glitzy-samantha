'use client'
import { useState, useEffect } from 'react'
import { MessageCircle, Clock, CheckCircle, RefreshCw } from 'lucide-react'

export default function ChatbotPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeads = () => {
    setLoading(true)
    fetch('/api/leads')
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchLeads() }, [])

  const sent = leads.filter(l => l.chatbot_sent)
  const pending = leads.filter(l => !l.chatbot_sent)
  const sentRate = leads.length > 0 ? ((sent.length / leads.length) * 100).toFixed(0) : 0

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">챗봇 현황</h1>
          <p className="text-sm text-slate-400 mt-1">5분 내 카카오 알림톡 자동 발송 현황을 확인합니다.</p>
        </div>
        <button onClick={fetchLeads} disabled={loading} className="glass-card p-2.5 hover:bg-white/10 transition-all disabled:opacity-50">
          <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '전체 인입 리드', value: leads.length, icon: MessageCircle, color: 'text-brand-400' },
          { label: '챗봇 발송 완료', value: sent.length, icon: CheckCircle, color: 'text-emerald-400' },
          { label: '발송 대기 중', value: pending.length, icon: Clock, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <Icon size={18} className={color} />
              <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-3xl font-bold text-white">{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      {!loading && leads.length > 0 && (
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300 font-medium">챗봇 발송률</span>
            <span className="text-sm font-bold text-white">{sentRate}%</span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${sentRate}%` }} />
          </div>
        </div>
      )}

      <div className="glass-card p-6">
        <h2 className="font-semibold text-white mb-5">리드별 챗봇 발송 현황</h2>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : leads.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                {['고객명', '연락처', '유입 채널', '인입 시각', '챗봇 상태', '발송 시각'].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead: any) => {
                const c = lead.customer
                return (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-3 font-medium text-white">{c?.name || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{c?.phone_number}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-600/20 text-brand-400">{c?.first_source || '-'}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-xs">{new Date(lead.created_at).toLocaleString('ko')}</td>
                    <td className="py-3 px-3">
                      {lead.chatbot_sent ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                          <CheckCircle size={13} /> 발송 완료
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                          <Clock size={13} /> 대기 중
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      {lead.chatbot_sent_at ? new Date(lead.chatbot_sent_at).toLocaleString('ko') : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500 text-sm text-center py-8">인입된 리드가 없습니다.</p>
        )}
      </div>
    </>
  )
}
