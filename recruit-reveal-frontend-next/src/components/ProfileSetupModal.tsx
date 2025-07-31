'use client';

import { useState } from 'react';
import { Modal, Form, Input, Select, Button, message } from 'antd';
import { useUserProfile } from '../contexts/UserProfileContext';

const { Option } = Select;

interface ProfileSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface FormValues {
  name: string;
  position: string;
}

export default function ProfileSetupModal({ visible, onClose, onComplete }: ProfileSetupModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { updateProfile } = useUserProfile();

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await updateProfile({
        name: values.name,
        position: values.position,
      });

      localStorage.setItem('profileSetupComplete', 'true');
      message.success('Profile setup completed!');
      onComplete?.();
      onClose();
    } catch (error) {
      console.error('Profile setup error:', error);
      message.error('Failed to setup profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Complete Your Profile"
      open={visible}
      onCancel={onClose}
      footer={null}
      maskClosable={false}
      closable={false}
    >
      <p className="mb-6 text-gray-600">
        Welcome to Recruit Reveal! Let&apos;s set up your profile to get started.
      </p>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label="Your Full Name"
          rules={[{ required: true, message: 'Please enter your full name' }]}
        >
          <Input placeholder="Enter your full name" />
        </Form.Item>

        <Form.Item
          name="position"
          label="Primary Position"
          rules={[{ required: true, message: 'Please select your position' }]}
        >
          <Select placeholder="Select your position">
            <Option value="QB">QB - Quarterback</Option>
            <Option value="WR">WR - Wide Receiver</Option>
            <Option value="RB">RB - Running Back</Option>
            <Option value="DB">DB - Defensive Back</Option>
            <Option value="LB">LB - Linebacker</Option>
            <Option value="TE">TE - Tight End</Option>
          </Select>
        </Form.Item>

        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            className="w-full"
          >
            Complete Setup
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
} 