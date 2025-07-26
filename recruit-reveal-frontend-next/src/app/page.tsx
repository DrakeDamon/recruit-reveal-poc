// src/app/page.tsx
'use client';

import Dashboard from '../components/Dashboard';
import { Suspense } from 'react';

// Example data; in your real app you would fetch this from your backend.
const sampleEval = {
  probability: 0.68,
  performance_score: 0.60,
  combine_score: 0.25,
  upside_score: 0.10,
  underdog_bonus: 5,
  goals: [
    'Improve 40-yard dash to 4.6s',
    'Increase vertical jump by 2 inches',
    'Add 10 lbs of lean muscle',
  ],
  switches: 'Consider cross-training at defensive back based on agility metrics.',
  calendar_advice:
    'Reach out to coaches after June 15 of your sophomore year and plan campus visits during contact periods.',
};

export default function HomePage() {
  return (
    <Suspense>
      <Dashboard evalData={sampleEval} />
    </Suspense>
  );
}
