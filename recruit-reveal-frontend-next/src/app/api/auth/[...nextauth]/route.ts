import NextAuth from 'next-auth';
import { type AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '../../../../../lib/prisma'; // Adjust the import path as necessary
import bcrypt from 'bcrypt';

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  // cast 'jwt' to the correct literal type so TS doesn’t complain
  session: { strategy: 'jwt' as const },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'coach@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // credentials may be undefined; guard against that
        if (!credentials) return null;
        const { email, password } = credentials;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.password_hash);
        return valid ? { id: user.id, email: user.email } : null;
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
};

// Export handlers for GET and POST
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
