'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { LayoutDashboard, Users, MessageCircle, BarChart2, LogOut, Activity, Calendar, Shield, ChevronDown, Film, Link2 } from 'lucide-react'
import { useClinic } from './ClinicContext'

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/leads', label: '고객(CDP) 관리', icon: Users },
  { href: '/chatbot', label: '챗봇 현황', icon: MessageCircle },
  { href: '/patients', label: '예약 / 결제 관리', icon: Calendar },
  { href: '/ads', label: '광고 성과 분석', icon: BarChart2 },
  { href: '/content', label: '브랜드 콘텐츠', icon: Film },
  { href: '/utm', label: 'UTM 생성기', icon: Link2 },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as any
  const isSuperAdmin = user?.role === 'superadmin'

  const { selectedClinicId, setSelectedClinicId, clinics } = useClinic()

  const selectedClinic = clinics.find(c => c.id === selectedClinicId)

  return (
    <aside className="w-60 h-screen flex flex-col border-r border-white/5 shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {/* 로고 */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Activity size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">MMI</p>
          <p className="text-xs text-slate-500">마케팅 인텔리전스</p>
        </div>
      </div>

      {/* 슈퍼어드민: 클리닉 스위처 */}
      {isSuperAdmin && (
        <div className="px-3 py-3 border-b border-white/5">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2 px-1">병원 선택</p>
          <div className="relative">
            <select
              value={selectedClinicId ?? ''}
              onChange={e => setSelectedClinicId(e.target.value ? Number(e.target.value) : null)}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 pr-8"
            >
              <option value="" className="bg-slate-900">전체 병원</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {selectedClinic && (
            <p className="text-[10px] text-brand-400 mt-1.5 px-1">{selectedClinic.name} 데이터 조회 중</p>
          )}
        </div>
      )}

      {/* 비슈퍼어드민: 담당 병원 표시 */}
      {!isSuperAdmin && user?.clinic_id && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">담당 병원</p>
          <p className="text-xs text-slate-300 font-medium">{user.name}</p>
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}

        {/* 슈퍼어드민 전용 메뉴 */}
        {isSuperAdmin && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest px-3">슈퍼어드민</p>
            </div>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname.startsWith('/admin')
                  ? 'bg-purple-600/20 text-purple-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Shield size={17} />
              어드민 관리
            </Link>
          </>
        )}
      </nav>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3">
        <div className="px-3 mb-2">
          <p className="text-xs text-white font-medium">{user?.name || user?.username}</p>
          <p className="text-[10px] text-slate-500">{isSuperAdmin ? '슈퍼어드민' : '병원 어드민'}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all"
        >
          <LogOut size={17} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
