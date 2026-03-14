'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { ClinicProvider } from '@/components/ClinicContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ClinicProvider>
      <div className="flex h-screen overflow-hidden">

        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 사이드바 — 모바일: 슬라이드인, 데스크탑: 항상 표시 */}
        <div className={`
          w-60 shrink-0 fixed md:static inset-y-0 left-0 z-30
          transition-transform duration-200 ease-in-out
          md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 모바일 상단 바 */}
          <div
            className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              aria-label="메뉴 열기"
            >
              <Menu size={20} />
            </button>
            <p className="text-sm font-bold text-white">MMI</p>
          </div>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </div>

      </div>
    </ClinicProvider>
  )
}
