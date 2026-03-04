'use client'
import { useState, useEffect } from 'react'
import { Plus, Building2, Users, ToggleLeft, ToggleRight, Check, AlertCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium z-50 ${type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />} {message}
    </div>
  )
}

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [tab, setTab] = useState<'clinics' | 'users'>('clinics')
  const [clinics, setClinics] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  // 병원 폼
  const [clinicForm, setClinicForm] = useState({ name: '', slug: '' })
  const [savingClinic, setSavingClinic] = useState(false)

  // 사용자 폼
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'clinic_admin', clinic_id: '' })
  const [savingUser, setSavingUser] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user])

  const fetchAll = async () => {
    const [cRes, uRes] = await Promise.all([
      fetch('/api/admin/clinics').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
    ])
    setClinics(Array.isArray(cRes) ? cRes : [])
    setUsers(Array.isArray(uRes) ? uRes : [])
  }

  useEffect(() => { fetchAll() }, [])

  const handleClinicSave = async () => {
    if (!clinicForm.name || !clinicForm.slug) return setToast({ msg: '병원명과 슬러그를 입력해주세요.', type: 'error' })
    setSavingClinic(true)
    try {
      const res = await fetch('/api/admin/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clinicForm),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setClinicForm({ name: '', slug: '' })
      setToast({ msg: '병원이 등록되었습니다.', type: 'success' })
      fetchAll()
    } catch (e: any) {
      setToast({ msg: e.message || '등록 실패', type: 'error' })
    } finally {
      setSavingClinic(false)
    }
  }

  const handleUserSave = async () => {
    if (!userForm.username || !userForm.password) return setToast({ msg: '아이디와 비밀번호를 입력해주세요.', type: 'error' })
    setSavingUser(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userForm, clinic_id: userForm.clinic_id ? Number(userForm.clinic_id) : null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setUserForm({ username: '', password: '', role: 'clinic_admin', clinic_id: '' })
      setToast({ msg: '계정이 생성되었습니다.', type: 'success' })
      fetchAll()
    } catch (e: any) {
      setToast({ msg: e.message || '생성 실패', type: 'error' })
    } finally {
      setSavingUser(false)
    }
  }

  const toggleUser = async (id: number, is_active: boolean) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    fetchAll()
  }

  if (user?.role !== 'superadmin') return null

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">어드민 관리</h1>
        <p className="text-sm text-slate-400 mt-1">병원 고객사 등록 및 계정 관리 (슈퍼어드민 전용)</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('clinics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'clinics' ? 'bg-brand-600 text-white' : 'glass-card text-slate-400 hover:text-white'}`}
        >
          <Building2 size={14} /> 병원 관리 ({clinics.length})
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'users' ? 'bg-brand-600 text-white' : 'glass-card text-slate-400 hover:text-white'}`}
        >
          <Users size={14} /> 계정 관리 ({users.length})
        </button>
      </div>

      {tab === 'clinics' && (
        <div className="space-y-6">
          {/* 병원 등록 폼 */}
          <div className="glass-card p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Plus size={16} /> 신규 병원 등록</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">병원명 *</label>
                <input
                  type="text"
                  value={clinicForm.name}
                  onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 미래성형외과"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">슬러그 (영문소문자) *</label>
                <input
                  type="text"
                  value={clinicForm.slug}
                  onChange={e => setClinicForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="예: mirae"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleClinicSave}
                  disabled={savingClinic}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
                >
                  {savingClinic ? '등록 중...' : '병원 등록'}
                </button>
              </div>
            </div>
          </div>

          {/* 병원 목록 */}
          <div className="glass-card p-6">
            <h2 className="font-semibold text-white mb-4">병원 목록</h2>
            {clinics.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">등록된 병원이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-white/5">
                    <th className="text-left py-2 font-medium">ID</th>
                    <th className="text-left py-2 font-medium">병원명</th>
                    <th className="text-left py-2 font-medium">슬러그</th>
                    <th className="text-left py-2 font-medium">등록일</th>
                    <th className="text-left py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((c: any) => (
                    <tr key={c.id} className="border-b border-white/5">
                      <td className="py-3 text-slate-500 text-xs">#{c.id}</td>
                      <td className="py-3 text-white font-medium">{c.name}</td>
                      <td className="py-3 text-slate-400 font-mono text-xs">{c.slug}</td>
                      <td className="py-3 text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString('ko')}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                          {c.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-6">
          {/* 계정 생성 폼 */}
          <div className="glass-card p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Plus size={16} /> 신규 계정 생성</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">아이디 *</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="로그인 아이디"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">비밀번호 *</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="초기 비밀번호"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">역할 *</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="clinic_admin" className="bg-slate-900">병원 어드민</option>
                  <option value="superadmin" className="bg-slate-900">슈퍼어드민</option>
                </select>
              </div>
              {userForm.role === 'clinic_admin' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">담당 병원 *</label>
                  <select
                    value={userForm.clinic_id}
                    onChange={e => setUserForm(f => ({ ...f, clinic_id: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="" className="bg-slate-900">선택</option>
                    {clinics.map((c: any) => (
                      <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleUserSave}
                disabled={savingUser}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-all"
              >
                {savingUser ? '생성 중...' : '계정 생성'}
              </button>
            </div>
          </div>

          {/* 계정 목록 */}
          <div className="glass-card p-6">
            <h2 className="font-semibold text-white mb-4">계정 목록</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-white/5">
                  {['아이디', '역할', '담당 병원', '생성일', '상태', '활성화'].map(h => (
                    <th key={h} className="text-left py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="py-3 text-white font-medium">{u.username}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'superadmin' ? 'bg-purple-500/20 text-purple-400' : 'bg-brand-600/20 text-brand-400'}`}>
                        {u.role === 'superadmin' ? '슈퍼어드민' : '병원어드민'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 text-xs">{u.clinic?.name || '-'}</td>
                    <td className="py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('ko')}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                        {u.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="py-3">
                      <button onClick={() => toggleUser(u.id, u.is_active)} className="text-slate-400 hover:text-white transition-colors">
                        {u.is_active ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
