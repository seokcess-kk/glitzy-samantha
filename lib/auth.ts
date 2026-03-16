import type { NextAuthOptions, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { serverSupabase } from './supabase'

// 사용자 역할 타입
type UserRole = 'superadmin' | 'clinic_admin' | 'clinic_staff' | 'agency_staff'

// 확장된 User 타입
interface ExtendedUser extends User {
  role: UserRole
  clinic_id: number | null
  username: string
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<ExtendedUser | null> {
        if (!credentials?.username || !credentials?.password) return null

        // DB 사용자 조회
        const supabase = serverSupabase()
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('username', credentials.username)
          .eq('is_active', true)
          .single()

        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        return {
          id: String(user.id),
          name: user.username,
          email: `${user.username}@mmi.local`,
          role: user.role as UserRole,
          clinic_id: user.clinic_id,
          username: user.username,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }): JWT {
      if (user) {
        const extUser = user as ExtendedUser
        token.role = extUser.role
        token.clinic_id = extUser.clinic_id
        token.username = extUser.username || extUser.name || ''
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || ''
        session.user.role = token.role
        session.user.clinic_id = token.clinic_id
        session.user.username = token.username
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60,        // 1시간 (의료 시스템에 적절)
    updateAge: 15 * 60,     // 15분마다 세션 갱신
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
