'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Trash2, ExternalLink, ChevronDown } from 'lucide-react'

const PLATFORM_PRESETS: Record<string, { source: string; medium: string; label: string }> = {
  meta: { source: 'facebook', medium: 'cpc', label: 'Meta (Facebook/Instagram)' },
  google: { source: 'google', medium: 'cpc', label: 'Google Ads' },
  youtube: { source: 'youtube', medium: 'video', label: 'YouTube' },
  instagram: { source: 'instagram', medium: 'social', label: 'Instagram (오가닉)' },
  tiktok: { source: 'tiktok', medium: 'video', label: 'TikTok' },
  naver: { source: 'naver', medium: 'cpc', label: '네이버 검색광고' },
  kakao: { source: 'kakao', medium: 'cpc', label: '카카오 모먼트' },
  blog: { source: 'naver', medium: 'blog', label: '네이버 블로그' },
  custom: { source: '', medium: '', label: '직접 입력' },
}

interface UtmHistory {
  id: string
  url: string
  label: string
  createdAt: string
}

export default function UtmPage() {
  const [baseUrl, setBaseUrl] = useState('')
  const [platform, setPlatform] = useState('meta')
  const [source, setSource] = useState('facebook')
  const [medium, setMedium] = useState('cpc')
  const [campaign, setCampaign] = useState('')
  const [adGroup, setAdGroup] = useState('')
  const [content, setContent] = useState('')
  const [term, setTerm] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<UtmHistory[]>([])
  const [historyLabel, setHistoryLabel] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('utm_history')
    if (saved) setHistory(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (platform !== 'custom') {
      const preset = PLATFORM_PRESETS[platform]
      setSource(preset.source)
      setMedium(preset.medium)
    }
  }, [platform])

  useEffect(() => {
    buildUrl()
  }, [baseUrl, source, medium, campaign, adGroup, content, term])

  function buildUrl() {
    if (!baseUrl.trim()) { setGeneratedUrl(''); return }
    try {
      const url = new URL(baseUrl.trim().startsWith('http') ? baseUrl.trim() : 'https://' + baseUrl.trim())
      if (source) url.searchParams.set('utm_source', source)
      if (medium) url.searchParams.set('utm_medium', medium)
      if (campaign) url.searchParams.set('utm_campaign', campaign)
      if (content) url.searchParams.set('utm_content', content)
      if (term) url.searchParams.set('utm_term', term)
      // 광고그룹은 utm_content의 prefix로 활용하거나 별도 파라미터로 추가
      if (adGroup && !content) url.searchParams.set('utm_content', adGroup)
      else if (adGroup && content) url.searchParams.set('utm_content', `${adGroup}_${content}`)
      setGeneratedUrl(url.toString())
    } catch {
      setGeneratedUrl('')
    }
  }

  function handleCopy() {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSaveHistory() {
    if (!generatedUrl) return
    const label = historyLabel || `${PLATFORM_PRESETS[platform]?.label || platform} - ${campaign || '무제'}`
    const entry: UtmHistory = {
      id: Date.now().toString(),
      url: generatedUrl,
      label,
      createdAt: new Date().toLocaleDateString('ko-KR'),
    }
    const updated = [entry, ...history].slice(0, 20)
    setHistory(updated)
    localStorage.setItem('utm_history', JSON.stringify(updated))
    setHistoryLabel('')
  }

  function handleDeleteHistory(id: string) {
    const updated = history.filter(h => h.id !== id)
    setHistory(updated)
    localStorage.setItem('utm_history', JSON.stringify(updated))
  }

  function handleLoadHistory(item: UtmHistory) {
    try {
      const url = new URL(item.url)
      setBaseUrl(url.origin + url.pathname)
      setSource(url.searchParams.get('utm_source') || '')
      setMedium(url.searchParams.get('utm_medium') || '')
      setCampaign(url.searchParams.get('utm_campaign') || '')
      setContent(url.searchParams.get('utm_content') || '')
      setTerm(url.searchParams.get('utm_term') || '')
      setPlatform('custom')
    } catch {}
  }

  function handleReset() {
    setBaseUrl('')
    setCampaign('')
    setAdGroup('')
    setContent('')
    setTerm('')
    setGeneratedUrl('')
  }

  const params = [
    { label: 'utm_source', value: source },
    { label: 'utm_medium', value: medium },
    { label: 'utm_campaign', value: campaign },
    { label: 'utm_content', value: adGroup && content ? `${adGroup}_${content}` : adGroup || content },
    { label: 'utm_term', value: term },
  ].filter(p => p.value)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">UTM 생성기</h1>
        <p className="text-sm text-gray-500 mt-1">광고 매체 및 콘텐츠 유입 추적을 위한 UTM 파라미터 URL 생성</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 입력 영역 */}
        <div className="lg:col-span-2 space-y-5">

          {/* 기본 URL */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">기본 URL</h2>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://example.com/landing"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 매체 선택 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">매체 선택</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {Object.entries(PLATFORM_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setPlatform(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    platform === key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">utm_source *</label>
                <input
                  type="text"
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  placeholder="facebook"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">utm_medium *</label>
                <input
                  type="text"
                  value={medium}
                  onChange={e => setMedium(e.target.value)}
                  placeholder="cpc"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 캠페인 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">캠페인 정보</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  utm_campaign <span className="text-gray-400">(캠페인명)</span>
                </label>
                <input
                  type="text"
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  placeholder="예: 2024_spring_promo"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  광고그룹 <span className="text-gray-400">(utm_content prefix로 사용)</span>
                </label>
                <input
                  type="text"
                  value={adGroup}
                  onChange={e => setAdGroup(e.target.value)}
                  placeholder="예: adset_women_30s"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  utm_content <span className="text-gray-400">(광고소재 / 콘텐츠)</span>
                </label>
                <input
                  type="text"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="예: video_before_after"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {adGroup && content && (
                  <p className="text-xs text-blue-500 mt-1">→ utm_content = {adGroup}_{content}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  utm_term <span className="text-gray-400">(키워드)</span>
                </label>
                <input
                  type="text"
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  placeholder="예: 강남성형외과"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 생성된 URL */}
          {generatedUrl && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-blue-800">생성된 URL</h2>
                <div className="flex gap-2">
                  <a
                    href={generatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-100"
                  >
                    <ExternalLink className="w-3 h-3" /> 열기
                  </a>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-blue-700 break-all font-mono bg-white rounded-lg p-3 border border-blue-100">
                {generatedUrl}
              </p>

              {/* 파라미터 분해 */}
              {params.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {params.map(p => (
                    <span key={p.label} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs">
                      <span className="text-gray-400">{p.label}=</span>
                      <span className="text-blue-700 font-medium">{p.value}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* 히스토리 저장 */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={historyLabel}
                  onChange={e => setHistoryLabel(e.target.value)}
                  placeholder="저장 이름 (선택)"
                  className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveHistory}
                  className="px-3 py-1.5 text-xs bg-white border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50"
                >
                  히스토리 저장
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 히스토리 사이드바 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between mb-3"
            >
              <h2 className="text-sm font-semibold text-gray-700">
                최근 URL 히스토리
                {history.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {history.length}
                  </span>
                )}
              </h2>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {(showHistory || history.length === 0) && (
              <>
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    생성된 URL을 히스토리에 저장하면<br />여기에 표시됩니다.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {history.map(item => (
                      <div key={item.id} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{item.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.createdAt}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteHistory(item.id)}
                            className="text-gray-300 hover:text-red-400 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-1 font-mono">{item.url}</p>
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => { navigator.clipboard.writeText(item.url) }}
                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                          >
                            <Copy className="w-3 h-3" /> 복사
                          </button>
                          <span className="text-gray-200">|</span>
                          <button
                            onClick={() => handleLoadHistory(item)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            불러오기
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!showHistory && history.length > 0 && (
              <p className="text-xs text-gray-400">{history.length}개 저장됨. 클릭하여 펼치기</p>
            )}
          </div>

          {/* 사용 가이드 */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mt-4">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">파라미터 가이드</h3>
            <dl className="space-y-1.5 text-xs text-gray-500">
              <div>
                <dt className="font-medium text-gray-600">utm_source</dt>
                <dd>유입 출처: facebook, google, naver</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">utm_medium</dt>
                <dd>마케팅 채널: cpc, video, social, email</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">utm_campaign</dt>
                <dd>캠페인 이름 또는 코드</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">utm_content</dt>
                <dd>광고소재 구분 (A/B 테스트 등)</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">utm_term</dt>
                <dd>검색 키워드 (검색광고)</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
