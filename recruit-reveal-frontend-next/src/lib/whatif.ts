// recruit-reveal-frontend-next/src/lib/whatif.ts
export type DivisionLabel = 'D3/NAIA' | 'D2' | 'FCS' | 'Power 5';

export type SliderSpec = {
  key: string;            // backend feature key, e.g. "Forty_Yard_Dash"
  label: string;          // user-friendly label
  min: number;
  max: number;
  step: number;
  default?: number;
  help?: string;
  unit?: string;
  invert?: boolean;       // if true, lower is better; affects UI hint only
};

export type WhatIfSlidersResponse = {
  position: 'QB' | 'RB' | 'WR';
  sliders: SliderSpec[];
  meta?: Record<string, unknown>;
};

export type WhatIfRunRequest = {
  base: Record<string, number | string | null>;
  target_label: DivisionLabel;             // 'D3/NAIA' | 'D2' | 'FCS' | 'Power 5'
  threshold?: number;                      // default 0.5
  candidates: string[];                    // feature keys to adjust
};

export type WhatIfRunResult = {
  ok: boolean;
  position: 'QB' | 'RB' | 'WR';
  target_label: DivisionLabel;
  achieved: boolean;
  probability?: number;                    // P(target)
  changes?: Array<{ key: string; from?: number; to: number }>;
  tried?: number;                          // iterations
  message?: string;
  raw?: unknown;                           // passthrough for debugging
};

export async function getWhatIfSliders(pos: 'QB' | 'RB' | 'WR'): Promise<WhatIfSlidersResponse> {
  const r = await fetch(`/api/predict/whatif/${pos}/sliders`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Failed to get sliders: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function runWhatIf(
  pos: 'QB' | 'RB' | 'WR',
  payload: WhatIfRunRequest,
  signal?: AbortSignal
): Promise<WhatIfRunResult> {
  const r = await fetch(`/api/predict/whatif/${pos}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!r.ok) throw new Error(`What-If failed: ${r.status} ${r.statusText}`);
  return r.json();
}