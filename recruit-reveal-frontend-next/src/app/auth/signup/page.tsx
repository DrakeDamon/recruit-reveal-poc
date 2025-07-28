'use client';

import { Form, Input, Button, message } from 'antd';
import { useRouter } from 'next/navigation';
import React from 'react';

const SignupPage: React.FC = () => {
  const router = useRouter();
  const [form] = Form.useForm();

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        message.success('Account created! Redirecting to login...');
        router.push('/auth/login');
      } else {
        const errorData = await res.json();
        message.error(errorData.message || 'Registration failed');
      }
    } catch (err) {
      message.error('An unexpected error occurred');
    }
  };
  

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: '2rem' }}>
      <h2>Sign Up</h2>
      <Form form={form} onFinish={onFinish} layout="vertical">
        <Form.Item name="email" rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Invalid email' }]}>
          <Input placeholder="Email" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'Password must be at least 6 characters' }]}>
          <Input.Password placeholder="Password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Sign Up
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default SignupPage;