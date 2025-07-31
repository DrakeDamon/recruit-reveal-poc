'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '../../contexts/UserProfileContext';
import Image from 'next/image';
import {
  Tabs,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Upload,
  Modal,
  message,
  Card,
  Radio,
  Spin,
  Alert
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  BellOutlined,
  CrownOutlined,
  CameraOutlined,
  DeleteOutlined,
  UploadOutlined
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

interface FormValues {
  name?: string;
  position?: string;
  graduation_year?: number;
  state?: string;
  height?: number;
  weight?: number;
  email_notifications?: boolean;
  privacy_setting?: string;
  profile_photo_url?: string;
  video_links?: string[];
}

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const { profile, loading, updateProfile } = useUserProfile();

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  const handleSave = async (tabKey: string, values: FormValues) => {
    if (!profile) return;

    setSaving(true);
    try {
      await updateProfile(values);
      message.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      message.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    // This would typically call a delete API endpoint
    message.info('Account deletion feature will be implemented soon');
    setDeleteModalVisible(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Alert
          message="Profile Not Found"
          description="Unable to load your profile data. Please try again."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Tabs defaultActiveKey="personal" type="card">
        <TabPane
          tab={<span><UserOutlined />Personal/Athlete Info</span>}
          key="personal"
        >
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={(values) => handleSave('personal', values)}
              initialValues={profile}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item
                  name="name"
                  label="Full Name"
                  rules={[{ required: true, message: 'Please enter your full name' }]}
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="position"
                  label="Primary Position"
                  rules={[{ required: true, message: 'Please select your position' }]}
                >
                  <Select>
                    <Option value="QB">QB - Quarterback</Option>
                    <Option value="WR">WR - Wide Receiver</Option>
                    <Option value="RB">RB - Running Back</Option>
                    <Option value="DB">DB - Defensive Back</Option>
                    <Option value="LB">LB - Linebacker</Option>
                    <Option value="TE">TE - Tight End</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="graduation_year"
                  label="Graduation Year"
                  rules={[{ required: true, message: 'Please enter your graduation year' }]}
                >
                  <InputNumber
                    min={2024}
                    max={2030}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Form.Item
                  name="state"
                  label="State"
                  rules={[{ required: true, message: 'Please select your state' }]}
                >
                  <Select showSearch>
                    {US_STATES.map(state => (
                      <Option key={state} value={state}>{state}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="height"
                  label="Height (inches)"
                >
                  <InputNumber
                    min={60}
                    max={84}
                    style={{ width: '100%' }}
                    placeholder="e.g., 72 for 6&apos;0&quot;"
                  />
                </Form.Item>

                <Form.Item
                  name="weight"
                  label="Weight (lbs)"
                >
                  <InputNumber
                    min={120}
                    max={350}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </div>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  className="w-full md:w-auto"
                >
                  Save Personal Info
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane
          tab={<span><SettingOutlined />Account</span>}
          key="account"
        >
          <Card>
            <Form layout="vertical">
              <Form.Item label="Email Address">
                <Input value={profile.email} disabled />
                <small className="text-gray-500">Email cannot be changed</small>
              </Form.Item>

              <Form.Item label="Password">
                <Button type="default">
                  Change Password
                </Button>
                <small className="text-gray-500 block mt-1">
                  You&apos;ll be redirected to reset your password
                </small>
              </Form.Item>

              <Form.Item label="Danger Zone" className="mt-8">
                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setDeleteModalVisible(true)}
                >
                  Delete Account
                </Button>
                <small className="text-red-500 block mt-1">
                  This action cannot be undone
                </small>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane
          tab={<span><BellOutlined />Preferences</span>}
          key="preferences"
        >
          <Card>
            <Form
              layout="vertical"
              onFinish={(values) => handleSave('preferences', values)}
              initialValues={{
                email_notifications: profile.email_notifications,
                privacy_setting: profile.privacy_setting
              }}
            >
              <Form.Item
                name="email_notifications"
                label="Email Notifications"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <small className="text-gray-500 block mb-4">
                Receive email notifications for evaluation reminders and progress updates
              </small>

              <Form.Item
                name="privacy_setting"
                label="Profile Visibility"
              >
                <Radio.Group>
                  <Radio value="public">Public - Visible to coaches and recruiters</Radio>
                  <Radio value="private">Private - Only visible to you</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                >
                  Save Preferences
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane
          tab={<span><CrownOutlined />Subscription</span>}
          key="subscription"
        >
          <Card>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Current Plan: Free</h3>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h4 className="font-semibold mb-2">Free Plan Includes:</h4>
                <ul className="text-left max-w-md mx-auto">
                  <li>• Basic evaluations</li>
                  <li>• Limited history tracking</li>
                  <li>• Standard support</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h4 className="font-semibold mb-2">Premium Plan Benefits:</h4>
                <ul className="text-left max-w-md mx-auto">
                  <li>• Unlimited evaluations</li>
                  <li>• Advanced analytics & trends</li>
                  <li>• Video analysis integration</li>
                  <li>• Priority support</li>
                  <li>• College match recommendations</li>
                </ul>
              </div>

              <Button type="primary" size="large">
                Upgrade to Premium - $19.99/month
              </Button>
            </div>
          </Card>
        </TabPane>

        <TabPane
          tab={<span><CameraOutlined />Media</span>}
          key="media"
        >
          <Card>
            <Form layout="vertical">
              <Form.Item label="Profile Photo">
                <Upload
                  name="profile_photo"
                  listType="picture-card"
                  showUploadList={false}
                  beforeUpload={() => false}
                >
                  {profile.profile_photo_url ? (
                    <Image
                      src={profile.profile_photo_url}
                      alt="Profile"
                      width={100}
                      height={100}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div>
                      <UploadOutlined />
                      <div style={{ marginTop: 8 }}>Upload Photo</div>
                    </div>
                  )}
                </Upload>
              </Form.Item>

              <Form.Item label="Highlight Videos">
                <TextArea
                  rows={4}
                  placeholder="Enter YouTube or Hudl video URLs (one per line)"
                  defaultValue={profile.video_links?.join('\n') || ''}
                />
                <small className="text-gray-500">
                  Add links to your highlight reels and game footage
                </small>
              </Form.Item>

              <Form.Item>
                <Button type="primary" loading={saving}>
                  Save Media
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="Delete Account"
        open={deleteModalVisible}
        onOk={handleDeleteAccount}
        onCancel={() => setDeleteModalVisible(false)}
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete your account? This action cannot be undone.</p>
        <p>All your evaluation data and profile information will be permanently removed.</p>
      </Modal>
    </div>
  );
} 