// src/app/api/evaluate/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 1. Parse the incoming athlete data
  const athlete = await request.json();

  // 2. (TODO) Replace this stub with real evaluation logic
  // For now, return a hard-coded evaluation result
  const result = {
    fitProbability: 0.75,
    performanceScore: 0.65,
    combineScore: 0.35,
    upsideScore: 0.10,
    underdogBonus: 5,
    goals: [
      'Increase 40-yard dash speed',
      'Improve vertical jump',
    ],
    switches: 'Consider switching to RB',
    calendarAdvice: 'Plan campus visits during D1 contact periods.',
  };

  return NextResponse.json(result);
}
