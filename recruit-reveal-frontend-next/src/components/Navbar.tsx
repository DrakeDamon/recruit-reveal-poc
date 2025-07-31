// src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Avatar, Dropdown } from 'antd';
import { SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useUserProfile } from '../contexts/UserProfileContext';

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { profile } = useUserProfile();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/login' });
    router.refresh();  // ensure UI updates
  };

  const userMenuItems = [
    {
      key: 'profile',
      label: <Link href="/profile">Profile</Link>,
      icon: <UserOutlined />
    },
    {
      key: 'settings',
      label: <Link href="/settings">Settings</Link>,
      icon: <SettingOutlined />
    },
    {
      type: 'divider' as const
    },
    {
      key: 'signout',
      label: <span onClick={handleSignOut}>Sign Out</span>,
      danger: true
    }
  ];

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="flex justify-between items-center">
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
        </ul>

        {status === 'authenticated' && session?.user && (
          <div className="flex items-center space-x-4">
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 px-3 py-2 rounded">
                <Avatar 
                  size="small" 
                  src={profile?.profile_photo_url || session.user.image || undefined}
                  icon={<UserOutlined />}
                />
                <span className="text-sm">
                  {profile?.name || session.user.name || session.user.email}
                </span>
              </div>
            </Dropdown>
          </div>
        )}
      </div>
    </nav>
  );
}
