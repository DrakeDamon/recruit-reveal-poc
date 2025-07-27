// src/app/auth/login/page.tsx
'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button, Form, Input, message } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      message.error('Invalid email or password');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Sign in to Recruit Reveal</h1>
      <Form onFinish={onFinish} layout="vertical">
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true, message: 'Please enter your email' }]}
        >
          <Input type="email" placeholder="coach@example.com" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please enter your password' }]}
        >
          <Input.Password placeholder="••••••" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          Sign in
        </Button>
      </Form>

      {/* Signup link */}
      <p className="mt-4 text-center">
        Don’t have an account?{' '}
        <Link
          href="/auth/signup"
          className="text-blue-600 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
