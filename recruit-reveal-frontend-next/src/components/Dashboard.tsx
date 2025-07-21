'use client';
import { useState, useRef } from 'react';
import { Card, Table, Progress, Alert, Button, Tag } from 'antd';
import html2canvas from 'html2canvas';
import { motion } from 'framer-motion';
import mixpanel from 'mixpanel-browser';  // Mock analytics

mixpanel.init('YOUR_TOKEN');  // For share tracking

export default function Dashboard({ evalData }: { evalData: any }) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const handleShare = async (platform: 'tiktok' | 'ig') => {
    if (loading || !dashboardRef.current) return;
    setLoading(true);
    mixpanel.track('share_clicked', { platform });
    const canvas = await html2canvas(dashboardRef.current);
    const image = canvas.toDataURL('image/png');
    const utm = '?utm_source=' + platform + '_share&utm_campaign=underdog_week';
    const link = document.createElement('a');
    link.href = image;
    link.download = `${platform}-share${utm}.png`;
    link.click();
    console.log('Share link with UTM: recruitreveal.com/results' + utm);  // For tracking
    setLoading(false);
  };

  const goalsColumns = [
    { title: 'Goal', dataIndex: 'goal' },
    { title: 'Priority', dataIndex: 'priority' },
  ];

  return (
    <motion.div ref={dashboardRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-4">
      <Card title="Division Fit">
        <Progress type="circle" percent={evalData.probability * 100} />
        {evalData.underdog_bonus && (
          <Tag className="bg-red-600 text-white px-2 py-1 rounded-full flex items-center space-x-1 mt-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 1l3 5h6l-4 5 1 7-7-3-7 3 1-7-4-5h6z" /></svg>
            Underdog Alert +{evalData.underdog_bonus}pt
          </Tag>
        )}
      </Card>
      <Card title="Goals">
        <Table columns={goalsColumns} dataSource={evalData.goals.map((g: string, i: number) => ({ goal: g, priority: i + 1, key: i }))} pagination={false} />
      </Card>
      {evalData.switches && <Alert message="Switch Suggestion" description={evalData.switches} type="warning" />}
      <Card title="Calendar Advice">
        {evalData.calendar_advice}
      </Card>
      <div className="flex gap-2">
        <Button loading={loading} onClick={() => handleShare('tiktok')}>Share to TikTok</Button>
        <Button loading={loading} onClick={() => handleShare('ig')}>Share to IG Story</Button>
      </div>
    </motion.div>
  );
}