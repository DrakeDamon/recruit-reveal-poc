'use client';

import { Form, Input, Button, message } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React from 'react';
import { useDarkMode } from '../../../components/DarkModeContext';

const SignupPage: React.FC = () => {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/register`, {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-theme={darkMode ? 'dark' : 'light'}
      className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-cyan-500 bg-clip-text text-transparent mb-2">Recruit Reveal</h1>
          <p className="text-white/90 text-lg font-medium">
            AI-Driven HS Football Recruiting
          </p>
        </div>

        {/* Auth Container */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Create Account</h2>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>

          <Form 
            form={form} 
            onFinish={onFinish} 
            layout="vertical"
            className="space-y-6"
          >
            <Form.Item 
              name="email" 
              rules={[
                { required: true, message: 'Email is required' }, 
                { type: 'email', message: 'Invalid email' }
              ]}
            >
              <Input 
                placeholder="Email" 
                size="large"
                className="bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-cyan-400"
              />
            </Form.Item>
            
            <Form.Item 
              name="password" 
              rules={[
                { required: true, message: 'Password is required' }, 
                { min: 6, message: 'Password must be at least 6 characters' }
              ]}
            >
              <Input.Password 
                placeholder="Password" 
                size="large"
                className="bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-cyan-400"
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                block
                size="large"
                className="bg-gradient-to-r from-blue-900 to-cyan-500 text-white h-12 text-lg font-semibold hover:shadow-lg transition-all"
              >
                Create Account
              </Button>
            </Form.Item>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-white/70">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;