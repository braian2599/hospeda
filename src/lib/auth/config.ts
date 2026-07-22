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
        // Limpiar datos del tenant del usuario anterior para evitar sesión cruzada
        token.tenantId = undefined;
        token.tenantRole = undefined;
        token.tenantUserId = undefined;
      }

      if (trigger === 'update' && session) {
        // Si se pide limpiar el tenant (logout de perfil), borrar datos sin cerrar sesión
        if ((session as Record<string, unknown>).clearTenant) {
          token.tenantId = undefined;
          token.tenantRole = undefined;
          token.tenantUserId = undefined;
          return token;
        }
        const proposedTenantId = (session as Record<string, unknown>).tenantId as string | undefined;
        const proposedTenantUserId = (session as Record<string, unknown>).tenantUserId as string | undefined;
        if (proposedTenantId && token.id) {
          try {
            // Validar contra la DB: filtrar por tenantId Y por el perfil específico
            const whereClause: Record<string, unknown> = {
              userId: token.id as string,
              tenantId: proposedTenantId,
              activo: true,
            };
            if (proposedTenantUserId) {
              whereClause.id = proposedTenantUserId;
            }
            const tu = await db.tenantUser.findFirst({
              where: whereClause,
              select: { tenantId: true, rol: true, id: true },
            });
            if (tu) {
              token.tenantId = tu.tenantId;
              token.tenantRole = tu.rol;
              token.tenantUserId = tu.id;
            }
          } catch {</arg_value><arg_key>
          }
        }
      }

      // NO agregar fallback automático de tenantId aquí.
      // Si no hay tenantId, el SessionLoader llamará a /api/auth/me sin params
      // y el flujo normal (selector de hotel/perfil) se encargará.

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