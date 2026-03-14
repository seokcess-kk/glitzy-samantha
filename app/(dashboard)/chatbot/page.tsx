'use client'
import { useState, useEffect } from 'react'
import { MessageCircle, Clock, CheckCircle, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader, StatsCard, ChannelBadge } from '@/components/common'


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
      <PageHeader
        title="챗봇 현황"
        description="5분 내 카카오 알림톡 자동 발송 현황을 확인합니다."
        actions={
          <Button variant="glass" size="icon" onClick={fetchLeads} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: '전체 인입 리드', value: leads.length, icon: MessageCircle, color: 'text-brand-400' },
          { label: '챗봇 발송 완료', value: sent.length, icon: CheckCircle, color: 'text-emerald-400' },
          { label: '발송 대기 중', value: pending.length, icon: Clock, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} variant="glass" className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Icon size={18} className={color} />
              <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
            </div>
            {loading ? <Skeleton className="h-9 w-20" /> : <p className="text-3xl font-bold text-white">{value}</p>}
          </Card>
        ))}
      </div>

      {!loading && leads.length > 0 && (
        <Card variant="glass" className="p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300 font-medium">챗봇 발송률</span>
            <span className="text-sm font-bold text-white">{sentRate}%</span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${sentRate}%` }} />
          </div>
        </Card>
      )}

      <Card variant="glass" className="p-6">
        <h2 className="font-semibold text-white mb-5">리드별 챗봇 발송 현황</h2>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : leads.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/5 hover:bg-transparent">
                {['고객명', '연락처', '유입 채널', '인입 시각', '챗봇 상태', '발송 시각'].map(h => (
                  <TableHead key={h} className="text-xs text-slate-500 uppercase tracking-wider font-medium">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead: any) => {
                const c = lead.customer
                return (
                  <TableRow key={lead.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <TableCell className="font-medium text-white">{c?.name || '-'}</TableCell>
                    <TableCell className="text-slate-400">{c?.phone_number}</TableCell>
                    <TableCell>
                      <ChannelBadge channel={c?.first_source || '-'} />
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">{new Date(lead.created_at).toLocaleString('ko')}</TableCell>
                    <TableCell>
                      {lead.chatbot_sent ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle size={12} /> 발송 완료
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1">
                          <Clock size={12} /> 대기 중
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {lead.chatbot_sent_at ? new Date(lead.chatbot_sent_at).toLocaleString('ko') : '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-slate-500 text-sm text-center py-8">인입된 리드가 없습니다.</p>
        )}
      </Card>
    </>
  )
}
