'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Spin, Alert, Button } from 'antd';
import Dashboard from '../components/Dashboard';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'loading') {
      return; // Wait for authentication to load
    }

    // Fetch user's latest evaluation
    const fetchLatestEval = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/eval/latest?email=${encodeURIComponent(session.user.email)}`);

        if (response.status === 404) {
          // No evaluations found - user needs to complete wizard first
          setError('no_evaluations');
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch evaluation: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📊 Loaded evaluation data for dashboard:', data);
        setEvalData(data);

      } catch (err) {
        console.error('Failed to fetch latest evaluation:', err);
        setError('fetch_failed');
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.email) {
      fetchLatestEval();
    }
  }, [session, status, router]);

  // Show loading while authentication or data is loading
  if (status === 'loading' || loading) {
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

  // Handle no evaluations found
  if (error === 'no_evaluations') {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <div className="text-center max-w-lg">
          <Alert
            message="No Evaluation Found"
            description="You haven't completed an evaluation yet. Complete the wizard to see your recruit profile on the dashboard."
            type="info"
            showIcon
            className="mb-4"
          />
          <Button type="primary" size="large" onClick={() => router.push('/wizard')}>
            Start Evaluation
          </Button>
        </div>
      </div>
    );
  }

  // Handle fetch errors
  if (error === 'fetch_failed') {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Alert
          message="Error Loading Dashboard"
          description="Failed to load your evaluation data. Please try again."
          type="error"
          showIcon
          action={
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // Show dashboard with real evaluation data
  return <Dashboard evalData={evalData} />;
}
