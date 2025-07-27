// src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/login' });
    router.refresh();  // ensure UI updates
  };

  return (
    <nav className="bg-gray-800 text-white p-4">
      <ul className="flex space-x-6">
        <li>
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </li>

        {status === 'authenticated' && (
          <>
            <li>
              <Link href="/wizard" className="hover:underline">
                Evaluate
              </Link>
            </li>
          </>
        )}

        {status === 'unauthenticated' && (
          <>
            <li>
              <Link href="/auth/login" className="hover:underline">
                Log In
              </Link>
            </li>
            <li>
              <Link href="/auth/signup" className="hover:underline">
                Sign Up
              </Link>
            </li>
          </>
        )}

        {status === 'authenticated' && (
          <li>
            <button
              onClick={handleSignOut}
              className="hover:underline focus:outline-none"
            >
              Sign Out
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
