'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button, Form, Input } from 'antd';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    await signIn('credentials', {
      email: values.email,
      password: values.password,
      callbackUrl: '/',
    });
    setLoading(false);
  };

  return (
    <Form onFinish={onFinish} layout="vertical">
      <Form.Item
        name="email"
        label="Email"
        rules={[{ required: true, message: 'Email is required' }]}
      >
        <Input type="email" placeholder="coach@example.com" />
      </Form.Item>
      <Form.Item
        name="password"
        label="Password"
        rules={[{ required: true, message: 'Password is required' }]}
      >
        <Input.Password placeholder="••••••" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}>
        Sign in
      </Button>
    </Form>
  );
}
