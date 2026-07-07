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
      allowDangerousEmailAccountLinking: true, // Permite linkear misma cuenta
    }),

    // ── Email + Password (credentials) ──
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
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
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
    // signOut: '/',  // Usa default
    // error: '/login?error=...',  // Custom error page si querés
  },

  callbacks: {
    // Agregar tenantId al token JWT
    async jwt({ token, user, trigger, session }) {
      // Primera vez que se loguea: adjuntar info del user
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }

      // Cuando se actualiza la sesión (ej: selección de tenant)
      if (trigger === 'update' && session) {
        token.tenantId = (session as Record<string, unknown>).tenantId as string | undefined;
        token.tenantRole = (session as Record<string, unknown>).tenantRole as string | undefined;
      }

      // Si no tiene tenantId, buscar el primero del usuario
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

    // Pasar datos del token a la sesión del cliente
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).tenantId = token.tenantId;
        (session.user as Record<string, unknown>).tenantRole = token.tenantRole;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, isNewUser }) {
      // Se ejecuta cuando un usuario se registra por primera vez vía OAuth
      // La creación del Tenant y TenantUser se hace en el register API
    },
  },

  // Sin esto no funciona credentials con JWT
  secret: process.env.NEXTAUTH_SECRET,
};