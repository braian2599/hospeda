import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { desbloqueoValido } from './desbloqueo-perfil';
import { rateLimit } from '@/lib/validation';
import { loginSchema, formatZodError } from '@/lib/validation-schemas';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),

  providers: [
    // ── Google OAuth ──
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      // Permite linkear Google a una cuenta existente registrada via email/password.
      // Sin esto, NextAuth lanza AccountNotLinkedError si el email ya existe.
      allowDangerousEmailAccountLinking: true,
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

        // ── Validación con Zod ──
        const zodResult = loginSchema.safeParse({
          email: credentials.email,
          password: credentials.password,
        });
        if (!zodResult.success) {
          throw new Error(formatZodError(zodResult.error));
        }

        // Rate limit: 10 intentos por email cada 15 minutos
        const rl = await rateLimit(`login:${credentials.email.toLowerCase().trim()}`, 10, 15 * 60 * 1000);
        if (!rl.allowed) {
          throw new Error(`Demasiados intentos. Esperá ${rl.retryAfterSeconds} segundos.`);
        }

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
        token.matchedProfileIds = (user as unknown as Record<string, unknown>).matchedProfileIds as string[] | undefined;
        // Limpiar datos del tenant del usuario anterior para evitar sesión cruzada
        delete token.tenantId;
        delete token.tenantRole;
        delete token.tenantUserId;
        delete token.tenantUserNombre;
      }

      if (trigger === 'update' && session) {
        // Si se pide limpiar el tenant (logout de perfil), borrar datos sin cerrar sesión
        if ((session as Record<string, unknown>).clearTenant) {
          delete token.tenantId;
          delete token.tenantRole;
          delete token.tenantUserId;
          delete token.tenantUserNombre;
          // No retornar acá — dejar que isSuperAdmin se calcule abajo
        }
        const proposedTenantId = (session as Record<string, unknown>).tenantId as string | undefined;
        const proposedTenantUserId = (session as Record<string, unknown>).tenantUserId as string | undefined;
        const desbloqueo = (session as Record<string, unknown>).desbloqueo;
        // Siempre con el perfil exacto: sin él, findFirst podía elegir
        // cualquier perfil de la cuenta en ese hotel (incluso uno con contraseña).
        if (proposedTenantId && proposedTenantUserId && token.id) {
          try {
            const tu = await db.tenantUser.findFirst({
              where: {
                id: proposedTenantUserId,
                userId: token.id as string,
                tenantId: proposedTenantId,
                activo: true,
              },
              // nombreCompleto se suma a la MISMA consulta. Con el nombre del
              // perfil adentro del JWT, cualquier ruta puede auditar "quién
              // hizo esto" sin ir a la base. Antes las rutas usaban
              // session.user.name, que es el nombre de la CUENTA.
              select: { tenantId: true, rol: true, id: true, nombreCompleto: true, password: true },
            });
            // Un perfil con contraseña solo entra con el comprobante de que se
            // escribió (src/lib/auth/desbloqueo-perfil.ts). El que ya está
            // abierto en esta sesión no lo necesita: es una recarga.
            const permitido = !!tu && (
              !tu.password
              || token.tenantUserId === tu.id
              || desbloqueoValido(desbloqueo, token.id as string, tu.id)
            );
            if (tu && permitido) {
              token.tenantId = tu.tenantId;
              token.tenantRole = tu.rol;
              token.tenantUserId = tu.id;
              token.tenantUserNombre = tu.nombreCompleto || null;
            } else if (tu) {
              console.warn(`[jwt:update] Perfil ${tu.id} con contraseña sin desbloquear: no se abre`);
            }
          } catch (err) {
            console.error('[jwt:update] Error al validar tenant en BD:', err);
          }
        }
      }

      // Determinar si es super-admin basado en la variable de entorno
      const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
        .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      token.isSuperAdmin = superAdminEmails.includes((token.email as string)?.toLowerCase());

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
        (session.user as Record<string, unknown>).tenantUserNombre = token.tenantUserNombre;
        (session.user as Record<string, unknown>).matchedProfileIds = token.matchedProfileIds;
        (session.user as Record<string, unknown>).isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
  },

  events: {},

  secret: process.env.NEXTAUTH_SECRET,
};