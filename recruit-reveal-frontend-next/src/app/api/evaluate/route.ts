import { NextResponse } from 'next/server';

export async function POST(req) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
  console.log('Using BACKEND_URL:', backendUrl);
  const data = await req.json();
  try {
    console.log('Fetching:', `${backendUrl}/evaluate`);
    const res = await fetch(`${backendUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status} ${await res.text()}`);
    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Evaluate error:', error);
    return NextResponse.json({ error: `Evaluation failed: ${error.message}` }, { status: 500 });
  }
}