// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '../../../../../lib/prisma'; // Adjust the import path as necessary

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password_hash: hashed },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


