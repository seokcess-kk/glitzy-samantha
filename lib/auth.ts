import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { serverSupabase } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
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
          role: user.role,
          clinic_id: user.clinic_id,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.clinic_id = (user as any).clinic_id
        token.username = user.name || ''
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).role = token.role
        ;(session.user as any).clinic_id = token.clinic_id
        ;(session.user as any).username = token.username
      }
      return session
    },
  },
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
