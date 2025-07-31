// src/app/api/evaluate/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Extract athlete data and position from request
    const body = await request.json();

    // Use fallback backend URL if environment variable not set
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL ||
      'http://localhost:3001';

    // Ensure position is included in the payload for backend processing
    const payload = {
      ...body,
      // Position is critical for backend evaluation logic
      position: body.position || 'QB'
    };

    // Forward evaluation request to Express backend
    const resp = await fetch(`${BACKEND}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error(`Backend evaluation failed: ${resp.status} ${resp.statusText}`);
    }

    // Return evaluation results to frontend
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });

  } catch (error) {
    console.error('Evaluation API error:', error);
    return NextResponse.json(
      { error: 'Evaluation service unavailable' },
      { status: 500 }
    );
  }
}
