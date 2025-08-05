import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const user_id = searchParams.get('user_id');

    if (!email && !user_id) {
      return NextResponse.json({ error: 'Missing email or user_id' }, { status: 400 });
    }

    // Build query string for backend
    const backendParams = new URLSearchParams();
    if (email) backendParams.set('email', email);
    if (user_id) backendParams.set('user_id', user_id);

    const backendUrl = `${BACKEND_URL}/api/eval/latest?${backendParams.toString()}`;
    console.log(`🔗 Proxying to backend: ${backendUrl}`);

    const response = await fetch(backendUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error (${response.status}):`, errorText);
      return NextResponse.json({ error: 'Backend error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 