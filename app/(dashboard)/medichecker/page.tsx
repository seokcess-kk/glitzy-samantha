'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, History, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useClinic } from '@/components/ClinicContext'
import { useVerification } from '@/hooks/use-verification'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TextInputCard } from '@/components/medichecker/text-input-card'
import { AdTypeSelector } from '@/components/medichecker/ad-type-selector'
import { VerifyProgress } from '@/components/medichecker/verify-progress'
import { ResultKpiCards } from '@/components/medichecker/result-kpi-cards'
import { ViolationCard } from '@/components/medichecker/violation-card'
import { HistoryTable } from '@/components/medichecker/history-table'
import type { AdType, Violation } from '@/lib/medichecker/types'
import { getRiskLevel } from '@/lib/medichecker/risk-level'

export default function MediCheckerPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user
  const { selectedClinicId } = useClinic()

  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  const [text, setText] = useState('')
  const [adType, setAdType] = useState<AdType>('blog')
  const [showHistory, setShowHistory] = useState(false)
  const [highlightMode, setHighlightMode] = useState(false)
  const [selectedViolationIndex, setSelectedViolationIndex] = useState<number | null>(null)

  const {
    result,
    progress,
    isLoading,
    error,
    currentStage,
    verify,
    abort,
    reset,
  } = useVerification({ clinicId: selectedClinicId })

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  useEffect(() => {
    if (result && result.violations.length > 0) setHighlightMode(true)
  }, [result])

  const handleVerify = async () => {
    if (!text.trim()) {
      toast.error('광고 문구를 입력해 주세요.')
      return
    }
    setHighlightMode(false)
    setSelectedViolationIndex(null)
    await verify(text, adType)
  }

  const handleReset = () => {
    setText('')
    setHighlightMode(false)
    setSelectedViolationIndex(null)
    reset()
  }

  if (user?.role === 'clinic_staff') return null

  const isComplete = !!result
  const hasProgress = progress.size > 0
  const hasViolations = result && result.violations.length > 0

  // 심각도별 위반 그룹핑 + 글로벌 인덱스 맵
  const highViolations = result?.violations.filter(v => v.confidence >= 90) ?? []
  const mediumViolations = result?.violations.filter(v => v.confidence >= 60 && v.confidence < 90) ?? []
  const lowViolations = result?.violations.filter(v => v.confidence < 60) ?? []

  const globalIndexMap = new Map<Violation, number>()
  result?.violations.forEach((v, i) => globalIndexMap.set(v, i))

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 헤더 */}
      <PageHeader
        title="광고 검수"
        icon={ShieldCheck}
        description="의료광고법 제56조 기반 AI 위반 검증"
        actions={
          <Button
            type="button"
            variant={showHistory ? 'default' : 'glass'}
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className={showHistory ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''}
          >
            <History size={14} />
            검수 이력
          </Button>
        }
      />

      {/* 이력 섹션 */}
      {showHistory && <HistoryTable />}

      {/* === 검증 전: 단일 컬럼 입력 UI === */}
      {!isComplete && (
        <>
          <TextInputCard
            text={text}
            onTextChange={setText}
            violations={[]}
            highlightMode={false}
            disabled={isLoading}
          />

          {/* 매체 선택 + 검증 버튼 */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <AdTypeSelector value={adType} onChange={setAdType} disabled={isLoading} />
            <div className="flex items-center gap-2">
              {isLoading && (
                <Button type="button" variant="ghost" size="sm" onClick={abort}>
                  취소
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleVerify}
                disabled={!text.trim() || isLoading}
                className="bg-brand-600 hover:bg-brand-700 text-white"
              >
                {isLoading ? (
                  <><Loader2 size={14} className="animate-spin" />검증 중...</>
                ) : (
                  <><ShieldCheck size={14} />검증 시작</>
                )}
              </Button>
            </div>
          </div>

          {/* 진행 상황 */}
          {(isLoading || (hasProgress && !isComplete)) && (
            <VerifyProgress progress={progress} currentStage={currentStage} isComplete={isComplete} />
          )}
        </>
      )}

      {/* === 검증 후: 2컬럼 결과 UI (데스크톱) === */}
      {isComplete && (
        <>
          {/* KPI 요약 + 액션 바 */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {(() => {
                const risk = getRiskLevel(result.riskScore)
                const Icon = risk.color === 'emerald' ? CheckCircle : AlertTriangle
                const colorClass = risk.color === 'rose' ? 'text-rose-400' : risk.color === 'amber' ? 'text-amber-400' : 'text-emerald-400'
                return (
                  <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${colorClass}`}>
                    <Icon size={16} />
                    {risk.label} ({result.riskScore}점)
                    {result.violations.length > 0 && ` · 위반 ${result.violations.length}건`}
                  </span>
                )
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                새 검수
              </Button>
              <AdTypeSelector value={adType} onChange={setAdType} disabled />
            </div>
          </div>

          <ResultKpiCards result={result} />

          {/* 요약 */}
          {result.summary && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
              {result.summary}
            </div>
          )}

          {/* 2컬럼 레이아웃: 좌=원문, 우=위반목록 */}
          {hasViolations ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* 좌측: 원문 하이라이트 (데스크톱에서 max-height 고정) */}
              <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
                <TextInputCard
                  text={text}
                  onTextChange={setText}
                  violations={result.violations}
                  highlightMode={highlightMode}
                  onToggleHighlight={() => setHighlightMode(!highlightMode)}
                  selectedViolationIndex={selectedViolationIndex}
                  onSelectViolation={setSelectedViolationIndex}
                  disabled
                />
              </div>

              {/* 우측: 위반 목록 (스크롤) */}
              <div className="space-y-4">
                {/* 심각도별 그룹 */}
                {highViolations.length > 0 && (
                  <ViolationGroup
                    label="높은 위험"
                    count={highViolations.length}
                    color="rose"
                    violations={highViolations}
                    globalIndexMap={globalIndexMap}
                    selectedViolationIndex={selectedViolationIndex}
                    onSelectViolation={(idx) => {
                      setSelectedViolationIndex(prev => prev === idx ? null : idx)
                      if (!highlightMode) setHighlightMode(true)
                    }}
                  />
                )}
                {mediumViolations.length > 0 && (
                  <ViolationGroup
                    label="주의 필요"
                    count={mediumViolations.length}
                    color="amber"
                    violations={mediumViolations}
                    globalIndexMap={globalIndexMap}
                    selectedViolationIndex={selectedViolationIndex}
                    onSelectViolation={(idx) => {
                      setSelectedViolationIndex(prev => prev === idx ? null : idx)
                      if (!highlightMode) setHighlightMode(true)
                    }}
                  />
                )}
                {lowViolations.length > 0 && (
                  <ViolationGroup
                    label="참고"
                    count={lowViolations.length}
                    color="muted"
                    violations={lowViolations}
                    globalIndexMap={globalIndexMap}
                    selectedViolationIndex={selectedViolationIndex}
                    onSelectViolation={(idx) => {
                      setSelectedViolationIndex(prev => prev === idx ? null : idx)
                      if (!highlightMode) setHighlightMode(true)
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            /* 위반 없음 */
            <Card variant="glass" className="p-6 text-center">
              <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">위반 의심 항목이 없습니다</p>
              <p className="text-xs text-muted-foreground">최종 확인은 전문가 검토를 권장합니다</p>
            </Card>
          )}

          {/* 면책 조항 */}
          <p className="text-xs text-muted-foreground text-center py-2">
            본 검수 결과는 AI 기반 참고 자료이며, 최종 법적 판단은 전문가의 검토가 필요합니다.
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================
// 위반 그룹 컴포넌트
// ============================================================

function ViolationGroup({
  label,
  count,
  color,
  violations,
  globalIndexMap,
  selectedViolationIndex,
  onSelectViolation,
}: {
  label: string
  count: number
  color: 'rose' | 'amber' | 'muted'
  violations: Violation[]
  globalIndexMap: Map<Violation, number>
  selectedViolationIndex: number | null
  onSelectViolation: (idx: number) => void
}) {
  const colorMap = {
    rose: {
      dot: 'bg-rose-500',
      text: 'text-rose-400',
      badge: 'bg-rose-500/10 text-rose-400',
    },
    amber: {
      dot: 'bg-amber-500',
      text: 'text-amber-400',
      badge: 'bg-amber-500/10 text-amber-400',
    },
    muted: {
      dot: 'bg-muted-foreground',
      text: 'text-muted-foreground',
      badge: 'bg-muted text-muted-foreground',
    },
  }

  const colors = colorMap[color]

  return (
    <div>
      {/* 그룹 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <span className={`text-xs font-medium ${colors.text}`}>{label}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${colors.badge}`}>{count}</span>
      </div>

      {/* 위반 카드 */}
      <div className="space-y-2">
        {violations.map((violation) => {
          const globalIdx = globalIndexMap.get(violation) ?? 0
          return (
            <ViolationCard
              key={globalIdx}
              violation={violation}
              index={globalIdx}
              isSelected={selectedViolationIndex === globalIdx}
              onSelect={onSelectViolation}
            />
          )
        })}
      </div>
    </div>
  )
}
