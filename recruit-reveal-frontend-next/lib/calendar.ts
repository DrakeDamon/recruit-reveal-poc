// src/lib/calendar.ts
// Defines recruiting periods and their dates for display in the dashboard

export type PeriodType = 'dead' | 'quiet' | 'evaluation' | 'contact';

export interface RecruitingPeriod {
  type: PeriodType;
  title: string;
  dates: string;
  description: string;
}

// Example periods based on the 2024-25 Division I FBS/FCS calendar.
// You can extend this array or pull it from your backend as needed.
export const recruitingCalendar: RecruitingPeriod[] = [
  {
    type: 'dead',
    title: 'Dead period',
    dates: 'Aug 1–31 2024; Dec 2–8 2024; Dec 23 – Jan 5 2025; Jan 13–15 2025; Feb 3 – Mar 2 2025; May 25–28 2025; Jun 23 – Jul 31 2025',
    description:
      'During a dead period coaches cannot make in‑person contact with recruits or their parents at any location.',
  },
  {
    type: 'quiet',
    title: 'Quiet period',
    dates: 'Multiple short windows throughout the year',
    description:
      'Coaches may meet with athletes on campus, but cannot watch them compete or meet off campus.',
  },
  {
    type: 'evaluation',
    title: 'Evaluation period',
    dates: 'Sept 1 – Dec 1 2024 and other dates',
    description:
      'Coaches can watch athletes compete but cannot communicate with them off campus.',
  },
  {
    type: 'contact',
    title: 'Contact period',
    dates: 'Dec 6–19 2024; Apr 15 – May 24 2025',
    description:
      'All communication is allowed; athletes should maximize direct contact with coaches.',
  },
];
