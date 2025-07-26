// src/app/auth/signup/page.tsx
'use client';

import React, { useState } from 'react';
import { Button, Form, Input, message } from 'antd';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  interface FormValues {
    email: string;
    password: string;
    confirmPassword: string;
  }

  const onFinish = async (values: FormValues) => {
    if (values.password !== values.confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      if (res.ok) {
        message.success('Account created! You can now log in.');
        router.push('/auth/login');
      } else {
        const data = await res.json();
        message.error(data.error || 'Registration failed');
      }
    } catch (err) {
      message.error('Registration error');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Create an account</h1>
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
          rules={[{ required: true, message: 'Please enter a password' }]}
        >
          <Input.Password placeholder="Choose a strong password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Confirm Password"
          dependencies={['password']}
          hasFeedback
          rules={[{ required: true, message: 'Please confirm your password' }]}
        >
          <Input.Password placeholder="Re-enter your password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          Sign up
        </Button>
      </Form>
    </div>
  );
}
