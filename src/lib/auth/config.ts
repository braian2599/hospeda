import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),

  providers: [
    // ── Google OAuth ──
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),

    // ── Email + Contraseña del perfil ──
    CredentialsProvider({
      id: 'credentials',
      name: 'Email y contraseña',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;

        // Buscar un TenantUser activo con esa contraseña
        const tenantUsers = await db.tenantUser.findMany({
          where: { userId: user.id, activo: true, password: { not: null } },
          include: { tenant: { select: { id: true } } },
        });

        // Verificar contra cada perfil hasta encontrar match
        let matchedProfile: typeof tenantUsers[0] | null = null;
        for (const tu of tenantUsers) {
          if (tu.password) {
            const isValid = await bcrypt.compare(credentials.password, tu.password);
            if (isValid) {
              matchedProfile = tu;
              break;
            }
          }
        }

        if (!matchedProfile) return null;

        return {
          id: user.id,
          email: user.email,
          name: matchedProfile.nombreCompleto || user.name,
          image: user.image,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }

      if (trigger === 'update' && session) {
        token.tenantId = (session as Record<string, unknown>).tenantId as string | undefined;
        token.tenantRole = (session as Record<string, unknown>).tenantRole as string | undefined;
      }

      if (!token.tenantId && token.id) {
        const tenantUser = await db.tenantUser.findFirst({
          where: { userId: token.id as string, activo: true },
          select: { tenantId: true, rol: true },
        });
        if (tenantUser) {
          token.tenantId = tenantUser.tenantId;
          token.tenantRole = tenantUser.rol;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).tenantId = token.tenantId;
        (session.user as Record<string, unknown>).tenantRole = token.tenantRole;
      }
      return session;
    },
  },

  events: {},

  secret: process.env.NEXTAUTH_SECRET,
};