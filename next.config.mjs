import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        // 옵티마의원 오프라인 QR (2609_earlybird 캠페인)
        // QR에 UTM 없이 인쇄되어 서버 단에서 UTM을 붙여 리다이렉트한다.
        // utm_source 가 이미 있는 유입(타 광고 채널)은 건드리지 않는다.
        // 캠페인 종료 시 이 규칙만 제거하면 됨 — permanent: false 유지(브라우저 캐시 방지).
        source: '/lp',
        has: [{ type: 'query', key: 'id', value: '(?<lpid>80971134)' }],
        missing: [{ type: 'query', key: 'utm_source' }],
        destination:
          '/lp?id=:lpid&utm_source=out_banner&utm_campaign=2609_earlybird&utm_content=2609_earlybird',
        permanent: false,
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
