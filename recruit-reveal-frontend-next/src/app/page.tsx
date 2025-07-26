// src/app/page.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../app/api/auth/[...nextauth]/route'; // Adjust the import path as necessary
import Dashboard from '../components/Dashboard'; // Adjust the import path as necessary

// You can make this an async server component
export default async function HomePage() {
  // Check for an active session
  const session = await getServerSession(authOptions);

  // If no session, redirect to login
  if (!session) {
    redirect('/auth/login');
    return null; // Return to satisfy TypeScript; redirect will already have occurred
  }

  // TODO: Replace this with fetching evaluation data for the logged-in user
  const evalData = {
    probability: 0.68,
    performance_score: 0.60,
    combine_score: 0.25,
    upside_score: 0.10,
    underdog_bonus: 5,
    goals: ['Improve 40-yard dash', 'Increase vertical jump'],
    switches: 'Consider defensive back.',
    calendar_advice: 'Plan visits during contact periods.',
  };

  return <Dashboard evalData={evalData} />;
}
