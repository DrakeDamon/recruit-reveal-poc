// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();  // Instantiated inside for safety
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);  // Debug env
    const body = await request.json();
    console.log('Parsed body:', body);

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ message: 'Missing email or password' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,  // Changed to match schema field
      },
    });

    console.log('Created user:', user);
    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ message: 'Internal server error: ' + (error.message || 'Unknown') }, { status: 500 });
  } finally {
    await prisma.$disconnect();  // Optional, but fine
  }
}