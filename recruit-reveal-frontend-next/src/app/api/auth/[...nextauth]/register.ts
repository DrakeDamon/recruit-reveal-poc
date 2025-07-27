// src/app/api/auth/register/route.ts

import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '../../../../../lib/prisma';

export async function POST(request: Request) {
  // 1. Read raw text so we can inspect it
  const raw = await request.text();
  console.log('[register] raw request body:', raw);

  // 2. Parse JSON manually to catch any errors
  let data: { email?: string; password?: string };
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('[register] JSON parse error:', err);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  console.log('[register] parsed JSON:', data);

  const { email, password } = data;
  if (!email || !password) {
    console.log('[register] missing email or password');
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  try {
    // 3. Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    console.log('[register] existing user lookup:', existing);
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    // 4. Hash & create
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password_hash: hashed },
    });
    console.log('[register] created user:', user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[register] Server error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
