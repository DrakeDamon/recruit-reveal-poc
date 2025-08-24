'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface UserProfile {
  id: number;
  email: string;
  name: string;
  position: string;
  graduation_year?: number;
  state?: string;
  height?: number;
  weight?: number;
  profile_photo_url?: string;
  video_links?: string[];
  privacy_setting: string;
  email_notifications: boolean;
  profile_complete: boolean;
  createdAt: string;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  isProfileComplete: boolean;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (status !== 'authenticated' || !session?.user?.email) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/profile/get?email=${session.user.email}`);

      if (!response.ok) {
        if (response.status === 404) {
          // User doesn't have a profile yet - this is normal for new users
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const profileData = await response.json();
      setProfile(profileData);
      return profileData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      console.error('Error fetching user profile:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [status, session?.user?.email]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    if (!session?.user?.email) {
      throw new Error('No authenticated session');
    }

    try {
      const response = await fetch(`/api/profile/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session.user.email,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.statusText}`);
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [session?.user?.email]);

  const refetch = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  // Auto-fetch on authentication status change
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      fetchProfile();
    } else if (status === 'unauthenticated') {
      // Clear profile data on logout
      setProfile(null);
      setError(null);
      setLoading(false);
    }
  }, [status, session?.user?.email, fetchProfile]);

  const isProfileComplete = profile?.profile_complete || false;

  const value: UserProfileContextType = {
    profile,
    loading,
    error,
    refetch,
    updateProfile,
    isProfileComplete,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextType {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}

// Custom hook for profile completion status
export function useProfileCompletion() {
  const { profile, isProfileComplete } = useUserProfile();

  const needsProfileSetup = profile && (!profile.name || !profile.position);

  return {
    isProfileComplete,
    needsProfileSetup,
    profile,
  };
} 