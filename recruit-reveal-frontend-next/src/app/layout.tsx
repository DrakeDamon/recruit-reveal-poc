// src/app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth'; // Adjust the import path as necessary
import { DarkModeProvider } from '@recruit/components/DarkModeContext';
import Navbar from '../components/Navbar';
import { UserProfileProvider } from '../contexts/UserProfileContext';
import ProfileCompletionGuard from '../components/ProfileCompletionGuard';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Recruit Reveal',
  description: 'AI-driven HS recruiting platform',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers session={session}>
          <UserProfileProvider>
            <DarkModeProvider>
              <Navbar />
              <ProfileCompletionGuard>
                <main>{children}</main>
              </ProfileCompletionGuard>
            </DarkModeProvider>
          </UserProfileProvider>
        </Providers>
      </body>
    </html>
  );
}
