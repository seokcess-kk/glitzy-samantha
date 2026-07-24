import type { Metadata } from 'next'

export const metadata: Metadata = { title: '리드 큐' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
