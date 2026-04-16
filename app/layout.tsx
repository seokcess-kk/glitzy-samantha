import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Samantha — Medical Marketing Intelligence',
    template: '%s | Samantha',
  },
  description: '병원 마케팅, 데이터로 진단합니다. Patients first, always.',
  openGraph: {
    title: 'Samantha — Medical Marketing Intelligence',
    description: '병원 마케팅, 데이터로 진단합니다. Patients first, always.',
    siteName: 'Samantha',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Samantha — Medical Marketing Intelligence',
    description: '병원 마케팅, 데이터로 진단합니다. Patients first, always.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
