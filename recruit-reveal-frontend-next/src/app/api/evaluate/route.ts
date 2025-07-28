import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const data = await req.json();
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Backend error');
    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}