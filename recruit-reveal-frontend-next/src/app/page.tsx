// src/app/page.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Dashboard from '../components/Dashboard'; // Adjust the import path as necessary
import { authOptions } from '../app/api/auth/[...nextauth]/route'; // Adjust the import path as necessary

export default async function HomePage() {
  // 🚨 Pass your NextAuth config here:
  const session = await getServerSession(authOptions);

  // If user is not signed in, send them to login
  if (!session) {
    redirect('/auth/login');
    return null;   // required to satisfy TS/JSX
  }

  // TODO: fetch real evaluation data, or reuse your stub
  const evalData = {
    probability: 0.75,
    performance_score: 0.65,
    combine_score: 0.35,
    upside_score: 0.10,
    underdog_bonus: 5,
    goals: ['Increase 40-yard dash speed', 'Improve vertical jump'],
    switches: 'Consider switching to RB',
    calendar_advice: 'Plan visits during D1 contact periods.',
  };

  return <Dashboard evalData={evalData} />;
}
