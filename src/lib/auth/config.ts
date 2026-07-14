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

        // Buscar TenantUsers activos con contraseña
        const tenantUsers = await db.tenantUser.findMany({
          where: { userId: user.id, activo: true, password: { not: null } },
        });

        // Verificar contra cada perfil y recolectar TODOS los que coincidan
        const matchedProfileIds: string[] = [];
        let firstMatch = tenantUsers[0] || null;
        for (const tu of tenantUsers) {
          if (tu.password) {
            const isValid = await bcrypt.compare(credentials.password, tu.password);
            if (isValid) {
              if (matchedProfileIds.length === 0) firstMatch = tu;
              matchedProfileIds.push(tu.id);
            }
          }
        }

        if (matchedProfileIds.length === 0) return null;

        return {
          id: user.id,
          email: user.email,
          name: firstMatch?.nombreCompleto || user.name,
          image: user.image,
          matchedProfileIds,
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
        // Guardar IDs de perfiles que coincidieron con la contraseña
        token.matchedProfileIds = (user as Record<string, unknown>).matchedProfileIds as string[] | undefined;
      }

      if (trigger === 'update' && session) {
        const proposedTenantId = (session as Record<string, unknown>).tenantId as string | undefined;
        const proposedTenantUserId = (session as Record<string, unknown>).tenantUserId as string | undefined;
        if (proposedTenantId && token.id) {
          try {
            // Validar contra la DB: el usuario debe pertenecer a ese tenant
            const tu = await db.tenantUser.findFirst({
              where: { userId: token.id as string, tenantId: proposedTenantId, activo: true },
              select: { tenantId: true, rol: true, id: true },
            });
            if (tu) {
              token.tenantId = tu.tenantId;
              token.tenantRole = tu.rol;
              token.tenantUserId = tu.id;
            }
          } catch {
            // Si la DB no responde, confiar en los datos que ya vienen del update
            // Esto evita que un cold start cierre la sesión
            token.tenantId = proposedTenantId;
            token.tenantRole = (session as Record<string, unknown>).tenantRole as string | undefined;
            token.tenantUserId = proposedTenantUserId;
          }
        }
      }

      if (!token.tenantId && token.id) {
        try {
          const tenantUser = await db.tenantUser.findFirst({
            where: { userId: token.id as string, activo: true },
            select: { tenantId: true, rol: true },
          });
          if (tenantUser) {
            token.tenantId = tenantUser.tenantId;
            token.tenantRole = tenantUser.rol;
          }
        } catch {
          // DB no disponible → no bloquear la sesión
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).tenantId = token.tenantId;
        (session.user as Record<string, unknown>).tenantRole = token.tenantRole;
        (session.user as Record<string, unknown>).tenantUserId = token.tenantUserId;
        (session.user as Record<string, unknown>).matchedProfileIds = token.matchedProfileIds;
      }
      return session;
    },
  },

  events: {},

  secret: process.env.NEXTAUTH_SECRET,
};