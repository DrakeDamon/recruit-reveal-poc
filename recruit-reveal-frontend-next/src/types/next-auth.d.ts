// src/types/next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      /** The returned session will now always include an `id`. */
      id: string;
    } & DefaultSession['user'];
  }

  // And if you ever refer to `User` directly:
  interface User extends DefaultUser {
    id: string;
  }
}
