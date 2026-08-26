import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import type { Role } from "@prisma/client";

export type AuthorizedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function authorizeCredentials(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedUser | null> {
  const email = credentials.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  if (!user.emailVerifiedAt) return null;

  const valid = await verifyPassword(credentials.password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const email = raw?.email as string | undefined;
        const password = raw?.password as string | undefined;
        if (!email || !password) return null;
        return authorizeCredentials({ email, password });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as AuthorizedUser).id;
        token.role = (user as AuthorizedUser).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
