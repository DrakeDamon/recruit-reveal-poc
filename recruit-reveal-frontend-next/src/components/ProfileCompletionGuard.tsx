'use client';

import { useState, useEffect } from 'react';
import { useUserProfile, useProfileCompletion } from '../contexts/UserProfileContext';
import ProfileSetupModal from './ProfileSetupModal';

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
}

export default function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const { profile, loading } = useUserProfile();
  const { needsProfileSetup } = useProfileCompletion();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!loading) {
      const hasShownSetup = localStorage.getItem('profileSetupComplete') === 'true';

      // Show modal if:
      // 1. User has no profile at all (new user) OR
      // 2. User has profile but it's incomplete (missing name/position)
      const shouldShowModal =
        (!profile || needsProfileSetup) && !hasShownSetup;

      if (shouldShowModal) {
        setShowModal(true);
      }
    }
  }, [profile, loading, needsProfileSetup]);

  const handleModalComplete = () => {
    localStorage.setItem('profileSetupComplete', 'true');
    setShowModal(false);
  };

  return (
    <>
      {children}
      <ProfileSetupModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onComplete={handleModalComplete}
      />
    </>
  );
} 