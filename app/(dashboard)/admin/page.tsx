'use client'
import { useState, useEffect } from 'react'
import { Plus, Building2, Users, ToggleLeft, ToggleRight } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [clinics, setClinics] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  // Dialog 상태
  const [clinicDialogOpen, setClinicDialogOpen] = useState(false)
  const [userDialogOpen, setUserDialogOpen] = useState(false)

  // 병원 폼
  const [clinicForm, setClinicForm] = useState({ name: '', slug: '' })
  const [savingClinic, setSavingClinic] = useState(false)

  // 사용자 폼
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'clinic_admin', clinic_id: '' })
  const [savingUser, setSavingUser] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

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
    if (!clinicForm.name || !clinicForm.slug) {
      toast.error('병원명과 슬러그를 입력해주세요.')
      return
    }
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
      setClinicDialogOpen(false)
      toast.success('병원이 등록되었습니다.')
      fetchAll()
    } catch (e: any) {
      toast.error(e.message || '등록 실패')
    } finally {
      setSavingClinic(false)
    }
  }

  const handleUserSave = async () => {
    if (!userForm.username || !userForm.password) {
      toast.error('아이디와 비밀번호를 입력해주세요.')
      return
    }
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
      setUserDialogOpen(false)
      toast.success('계정이 생성되었습니다.')
      fetchAll()
    } catch (e: any) {
      toast.error(e.message || '생성 실패')
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">어드민 관리</h1>
        <p className="text-sm text-slate-400 mt-1">병원 고객사 등록 및 계정 관리 (슈퍼어드민 전용)</p>
      </div>

      <Tabs defaultValue="clinics" className="space-y-6">
        <TabsList className="glass-card p-1">
          <TabsTrigger value="clinics" className="data-[state=active]:bg-brand-600 data-[state=active]:text-white">
            <Building2 size={14} className="mr-2" /> 병원 관리 ({clinics.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-brand-600 data-[state=active]:text-white">
            <Users size={14} className="mr-2" /> 계정 관리 ({users.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinics" className="space-y-6">
          {/* 병원 등록 Dialog */}
          <Dialog open={clinicDialogOpen} onOpenChange={setClinicDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>신규 병원 등록</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">병원명 *</Label>
                  <Input
                    type="text"
                    value={clinicForm.name}
                    onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="예: 미래성형외과"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">슬러그 (영문소문자) *</Label>
                  <Input
                    type="text"
                    value={clinicForm.slug}
                    onChange={e => setClinicForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    placeholder="예: mirae"
                  />
                  <p className="text-xs text-slate-500">URL에 사용됩니다. 영문 소문자, 숫자, 하이픈만 허용</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setClinicDialogOpen(false)}>취소</Button>
                <Button onClick={handleClinicSave} disabled={savingClinic} className="bg-brand-600 hover:bg-brand-700">
                  {savingClinic ? '등록 중...' : '병원 등록'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 병원 목록 */}
          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">병원 목록</h2>
              <Button onClick={() => setClinicDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
                <Plus size={14} /> 병원 등록
              </Button>
            </div>
            {clinics.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">등록된 병원이 없습니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-xs text-slate-500 font-medium">ID</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">병원명</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">슬러그</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">등록일</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinics.map((c: any) => (
                    <TableRow key={c.id} className="border-b border-white/5">
                      <TableCell className="text-slate-500 text-xs">#{c.id}</TableCell>
                      <TableCell className="text-white font-medium">{c.name}</TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs">{c.slug}</TableCell>
                      <TableCell className="text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString('ko')}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? 'success' : 'secondary'}>
                          {c.is_active ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* 계정 생성 Dialog */}
          <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>신규 계정 생성</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">아이디 *</Label>
                    <Input
                      type="text"
                      value={userForm.username}
                      onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="로그인 아이디"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">비밀번호 *</Label>
                    <Input
                      type="password"
                      value={userForm.password}
                      onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="초기 비밀번호"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">역할 *</Label>
                  <Select value={userForm.role} onValueChange={v => setUserForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinic_admin">병원 어드민</SelectItem>
                      <SelectItem value="superadmin">슈퍼어드민</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {userForm.role === 'clinic_admin' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">담당 병원 *</Label>
                    <Select value={userForm.clinic_id} onValueChange={v => setUserForm(f => ({ ...f, clinic_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinics.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setUserDialogOpen(false)}>취소</Button>
                <Button onClick={handleUserSave} disabled={savingUser} className="bg-brand-600 hover:bg-brand-700">
                  {savingUser ? '생성 중...' : '계정 생성'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 계정 목록 */}
          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">계정 목록</h2>
              <Button onClick={() => setUserDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
                <Plus size={14} /> 계정 생성
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['아이디', '역할', '담당 병원', '생성일', '상태', '활성화'].map(h => (
                    <TableHead key={h} className="text-xs text-slate-500 font-medium">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id} className="border-b border-white/5">
                    <TableCell className="text-white font-medium">{u.username}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'superadmin' ? 'default' : 'info'} className={u.role === 'superadmin' ? 'bg-purple-500/20 text-purple-400 border-0' : ''}>
                        {u.role === 'superadmin' ? '슈퍼어드민' : '병원어드민'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">{u.clinic?.name || '-'}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('ko')}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'success' : 'secondary'}>
                        {u.is_active ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleUser(u.id, u.is_active)}
                        className="text-slate-400 hover:text-white transition-colors"
                        aria-label={u.is_active ? '계정 비활성화' : '계정 활성화'}
                      >
                        {u.is_active ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
