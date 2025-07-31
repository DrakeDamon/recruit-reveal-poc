// src/components/Dashboard.tsx
'use client';

import { useRef, useState } from 'react';
import { Card, Row, Col, Progress, Table, Tag, Alert, Timeline, Button } from 'antd';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import mixpanel from 'mixpanel-browser';
import { recruitingCalendar } from '../../lib/calendar'; // Adjust the import path as needed
import { useDarkMode } from './DarkModeContext';

mixpanel.init('YOUR_TOKEN'); // optional analytics

interface EvalData {
  score: number;
  predicted_tier: string;
  notes?: string;
  probability: number;
  performance_score: number;
  combine_score: number;
  upside_score: number;
  underdog_bonus?: number;
  goals: string[];
  switches?: string;
  calendar_advice?: string;
  position?: 'QB' | 'RB' | 'WR';  // Position-specific display logic
  playerName?: string;  // Display player name in results
}

export default function Dashboard({ evalData }: { evalData: EvalData | null }) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();

  // Check if user has evaluation data
  const hasEvalData = evalData && evalData.score !== undefined;

  // Show error state if no evaluation data
  if (!hasEvalData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No Evaluation Data</h2>
          <p className="text-gray-600 mb-4">
            You need to complete an evaluation first to see your dashboard.
          </p>
          <Button type="primary" onClick={() => window.location.href = '/wizard'}>
            Start Evaluation
          </Button>
        </div>
      </div>
    );
  }

  // Position-specific display helper
  const getPositionDisplayName = () => {
    const positionNames = {
      QB: 'Quarterback',
      RB: 'Running Back', 
      WR: 'Wide Receiver'
    };
    return positionNames[evalData!.position || 'QB'];
  };

  // Position-specific tier context
  const getTierContext = () => {
    if (evalData!.position === 'WR') {
      return 'Based on combine metrics only (full WR analysis coming soon)';
    }
    return `Comprehensive ${getPositionDisplayName()} evaluation`;
  };

  const handleShare = async (platform: 'tiktok' | 'ig') => {
    if (loading || !dashboardRef.current) return;
    setLoading(true);
    mixpanel.track('share_clicked', { platform });
    const canvas = await html2canvas(dashboardRef.current);
    const image = canvas.toDataURL('image/png');
    const utm = `?utm_source=${platform}_share&utm_campaign=underdog_week`;
    const link = document.createElement('a');
    link.href = image;
    link.download = `${platform}-share${utm}.png`;
    link.click();
    setLoading(false);
  };

  const goalsColumns = [
    { title: 'Goal', dataIndex: 'goal' },
    { title: 'Priority', dataIndex: 'priority' },
  ];

  return (
    <div
      data-theme={darkMode ? 'dark' : 'light'}
      className="flex flex-col min-h-screen bg-[var(--bg-primary)] transition-colors"
    >
      <motion.div
        ref={dashboardRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 space-y-4"
      >
        {/* Header with dark mode toggle */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {evalData!.playerName && `${evalData!.playerName}'s `}Recruit Profile
            </h1>
            <p className="text-lg text-[var(--text-primary)] opacity-80">
              {getPositionDisplayName()} • {evalData!.predicted_tier}
            </p>
            <p className="text-sm text-[var(--text-primary)] opacity-60">
              {getTierContext()}
            </p>
          </div>
          <Button size="small" onClick={toggleDarkMode}>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
        <Row gutter={[16, 16]}>
          {/* Top metrics */}
          <Col xs={24} md={12} lg={6}>
            <Card 
              title="Overall Division Fit"
              className="bg-[var(--bg-primary)] border-[var(--accent)]"
            >
              <Progress type="dashboard" percent={Math.round(evalData!.probability * 100)} />
              {evalData!.underdog_bonus && (
                <Tag color="magenta" className="mt-2">
                  Underdog +{evalData!.underdog_bonus} pt
                </Tag>
              )}
            </Card>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Card title="Performance Score">
              <Progress
                type="circle"
                percent={Math.round(evalData!.performance_score * 100)}
                status="normal"
              />
            </Card>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Card title="Combine Score">
              <Progress
                type="circle"
                percent={Math.round(evalData!.combine_score * 100)}
                status="normal"
              />
            </Card>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Card title="Upside Score">
              <Progress
                type="circle"
                percent={Math.round(evalData!.upside_score * 100)}
                status="normal"
              />
            </Card>
          </Col>
        </Row>

        {/* Goals and suggestions */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Goals">
              <Table
                columns={goalsColumns}
                dataSource={evalData!.goals.map((goal, i) => ({
                  key: i,
                  goal,
                  priority: i + 1,
                }))}
                pagination={false}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            {evalData!.switches && (
              <Alert
                message="Position Switch Suggestion"
                description={evalData!.switches}
                type="warning"
                showIcon
              />
            )}
            {evalData!.calendar_advice && (
              <Alert
                className="mt-4"
                message="Calendar Advice"
                description={evalData!.calendar_advice}
                type="info"
                showIcon
              />
            )}
          </Col>
        </Row>

        {/* Recruiting Calendar */}
        <Card title="Recruiting Calendar">
          <Timeline mode="left">
            {recruitingCalendar.map((period, idx) => (
              <Timeline.Item
                key={idx}
                color={
                  period.type === 'dead'
                    ? 'red'
                    : period.type === 'quiet'
                    ? 'blue'
                    : period.type === 'evaluation'
                    ? 'orange'
                    : 'green'
                }
                label={period.dates}
              >
                <strong>{period.title}</strong>
                <div>{period.description}</div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>

        {/* Share buttons */}
        <div className="flex gap-2">
          <Button loading={loading} onClick={() => handleShare('tiktok')}>
            Share to TikTok
          </Button>
          <Button loading={loading} onClick={() => handleShare('ig')}>
            Share to IG Story
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
