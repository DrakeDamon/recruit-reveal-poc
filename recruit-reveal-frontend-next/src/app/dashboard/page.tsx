'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Spin, Alert } from 'antd';
import Dashboard from '../../components/Dashboard';
import { useUserProfile } from '../../contexts/UserProfileContext';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { profile, loading: profileLoading } = useUserProfile();
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication first
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'loading' || profileLoading) {
      return; // Wait for authentication and profile to load
    }

    // Retrieve evaluation results from session storage
    try {
      const storedResult = sessionStorage.getItem('evalResult');
      if (!storedResult) {
        setError('No evaluation results found. Please complete the wizard first.');
        setTimeout(() => router.push('/wizard'), 2000);
        return;
      }

      const parsedResult = JSON.parse(storedResult);
      setEvalData(parsedResult);
    } catch (err) {
      console.error('Failed to parse evaluation results:', err);
      setError('Invalid evaluation data. Please try again.');
      setTimeout(() => router.push('/wizard'), 2000);
    } finally {
      setLoading(false);
    }
  }, [router, status, profileLoading]);

  // Show loading while authentication or profile is loading
  if (status === 'loading' || profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users
  if (status === 'unauthenticated') {
    return null; // Will redirect in useEffect
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Alert
          message="Error Loading Results"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (!evalData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Alert
          message="No Data Available"
          description="Redirecting to wizard..."
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return <Dashboard evalData={evalData} />;
}