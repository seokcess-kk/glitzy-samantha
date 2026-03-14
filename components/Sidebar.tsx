'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { LayoutDashboard, Users, MessageCircle, BarChart2, LogOut, Activity, Calendar, Shield, Film, Link2, Scan, Newspaper, Settings, ChevronUp, User } from 'lucide-react'
import { useClinic } from './ClinicContext'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { href: '/',        label: '대시보드',          icon: LayoutDashboard },
  { href: '/leads',   label: '고객(CDP) 관리',    icon: Users           },
  { href: '/chatbot', label: '챗봇 현황',          icon: MessageCircle   },
  { href: '/patients',label: '예약 / 결제 관리',   icon: Calendar        },
  { href: '/ads',     label: '광고 성과 분석',     icon: BarChart2       },
  { href: '/content', label: '브랜드 콘텐츠 분석', icon: Film            },
  { href: '/monitor', label: '콘텐츠 모니터링',    icon: Scan            },
  { href: '/press',   label: '언론보도',            icon: Newspaper       },
]

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as any
  const isSuperAdmin = user?.role === 'superadmin'

  const { selectedClinicId, setSelectedClinicId, clinics } = useClinic()
  const selectedClinic = clinics.find(c => c.id === selectedClinicId)

  return (
    <aside className="w-60 h-screen flex flex-col border-r border-white/5 shrink-0 bg-[#0b0b18]">
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
          <Select
            value={selectedClinicId?.toString() ?? ''}
            onValueChange={v => setSelectedClinicId(v ? Number(v) : null)}
          >
            <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-sm">
              <SelectValue placeholder="전체 병원" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체 병원</SelectItem>
              {clinics.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              onClick={onClose}
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
              href="/utm"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname.startsWith('/utm')
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Link2 size={17} />
              UTM 생성기
            </Link>
            <Link
              href="/admin"
              onClick={onClose}
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

      {/* 사용자 메뉴 */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors text-left" aria-label="사용자 메뉴">
              <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
                {(user?.name || user?.username)?.[0]?.toUpperCase() || <User size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{user?.name || user?.username}</p>
                <p className="text-[10px] text-slate-500">{isSuperAdmin ? '슈퍼어드민' : '병원 어드민'}</p>
              </div>
              <ChevronUp size={14} className="text-slate-500 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel>
              {user?.name || user?.username}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="opacity-50">
              <Settings size={14} />
              설정 (준비 중)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-red-400 hover:text-red-300 focus:text-red-300"
            >
              <LogOut size={14} />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
