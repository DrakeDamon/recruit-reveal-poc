'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useForm, FormProvider } from 'react-hook-form';
import { Button, message } from 'antd';
import { ProgressPills } from '@recruit/components/ProgressPills';
import InputBar from '@recruit/components/InputBar';
import ChatThread from '@recruit/components/ChatThread';
import { ReviewCard } from '@recruit/components/ReviewCard';
import Dashboard from '@recruit/components/Dashboard';
import { useDarkMode } from '@recruit/components/DarkModeContext';

export type FormValues = {
  name: string;
  position: string;
  grad_year: number;
  state: string;
  senior_yds?: number;
  senior_cmp?: number;
  senior_att?: number;
  senior_int?: number;
  senior_td_passes?: number;
  junior_yds?: number;
  junior_cmp?: number;
  junior_att?: number;
  junior_int?: number;
  junior_td_passes?: number;
  dash40?: number;
  vertical?: number;
  shuttle?: number;
  height_inches?: number;
  weight_lbs?: number;
  [key: string]: any;
};

// Match EvalData interface from Dashboard.tsx
interface EvalResult {
  predicted_tier: string;
  score: number;
  notes?: string;
  probability: number;
  performance_score: number;
  combine_score: number;
  upside_score: number;
  underdog_bonus?: number;
  goals: string[];
  switches?: string;
  calendar_advice?: string;
}

const steps: { key: keyof FormValues | 'review'; prompt: string }[] = [
  { key: 'name', prompt: 'Hi! What’s your name?' },
  { key: 'position', prompt: 'Great! Which position are you evaluating?' },
  { key: 'grad_year', prompt: 'What’s your graduation year?' },
  { key: 'state', prompt: 'Which state do you play in?' },
  { key: 'senior_yds', prompt: 'Enter your Senior Passing Yards.' },
  { key: 'senior_cmp', prompt: 'Enter your Senior Completions.' },
  { key: 'senior_att', prompt: 'Enter your Senior Attempts.' },
  { key: 'senior_int', prompt: 'Enter your Senior Interceptions.' },
  { key: 'senior_td_passes', prompt: 'Enter your Senior TD Passes.' },
  { key: 'junior_yds', prompt: 'Enter your Junior Passing Yards.' },
  { key: 'junior_cmp', prompt: 'Enter your Junior Completions.' },
  { key: 'junior_att', prompt: 'Enter your Junior Attempts.' },
  { key: 'junior_int', prompt: 'Enter your Junior Interceptions.' },
  { key: 'junior_td_passes', prompt: 'Enter your Junior TD Passes.' },
  { key: 'dash40', prompt: 'Enter your 40-yard Dash time.' },
  { key: 'vertical', prompt: 'Enter your Vertical Jump.' },
  { key: 'shuttle', prompt: 'Enter your Shuttle time.' },
  { key: 'height_inches', prompt: 'Enter your Height (inches).' },
  { key: 'weight_lbs', prompt: 'Enter your Weight (lbs).' },
  { key: 'review', prompt: 'Review & Submit?' },
];

export default function WizardPage() {
  const form = useForm<FormValues>();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<{ from: 'app' | 'user'; text: string }[]>([
    { from: 'app', text: steps[0].prompt }
  ]);
  const [impute, setImpute] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const { darkMode, toggleDarkMode } = useDarkMode();

  const handleNext = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    const key = steps[step].key;
    const raw = form.getValues()[key as string];
    setMessages(prev => [...prev, { from: 'user', text: String(raw) }]);
    form.resetField(key as string);
    const next = step + 1;
    setStep(next);
    if (next < steps.length) setMessages(prev => [...prev, { from: 'app', text: steps[next].prompt }]);
  };

  const handleSubmit = async () => {
    const data = form.getValues();
    try {
      setMessages(m => [
        ...m,
        { from: 'user', text: 'Submitting for evaluation…' }
      ]);

      // Call /api/evaluate with axios
      const response = await axios.post('/api/evaluate', { athlete_data: data }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const json = response.data;
      setEvalResult({
        predicted_tier: json.predicted_tier,
        score: json.score,
        notes: json.notes,
        probability: json.probability,
        performance_score: json.performance_score,
        combine_score: json.combine_score,
        upside_score: json.upside_score,
        underdog_bonus: json.underdog_bonus,
        goals: json.goals,
        switches: json.switches,
        calendar_advice: json.calendar_advice
      });

      setMessages(m => [
        ...m,
        { from: 'app', text: `🌟 Predicted Tier: ${json.predicted_tier}, Score: ${json.score}` }
      ]);
    } catch (err) {
      console.error(err);
      message.error('Failed to submit evaluation. Please try again.');
    }
  };

  const handleBack = () => setStep(s => Math.max(0, s - 1));
  const handleImpute = (checked: boolean) => setImpute(checked);

  if (evalResult) return <Dashboard evalData={evalResult} />;

  return (
    <div
      data-theme={darkMode ? 'dark' : 'light'}
      className="flex flex-col min-h-screen bg-[var(--bg-primary)] transition-colors"
    >
      <div className="max-w-xl w-full mx-auto flex flex-col flex-1 pt-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recruit Reveal Wizard</h2>
          <Button size="small" onClick={toggleDarkMode}>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
        <FormProvider {...form}>
          <ProgressPills total={steps.length} current={step} onClick={setStep} />
          <div className="flex-1 flex flex-col overflow-hidden min-h-[400px]">
            <ChatThread messages={messages} stagger={true} />
          </div>
          <div className="input-bar sticky bottom-0 bg-[var(--bg-primary)]">
            {step < steps.length - 1 ? (
              <InputBar
                step={step}
                impute={impute}
                onImputeToggle={handleImpute}
                onEnter={handleNext}
              />
            ) : (
              <ReviewCard
                answers={form.getValues()}
                onEdit={setStep}
                onSubmit={handleSubmit}
                stepKeys={steps.map(s => s.key as string)}
              />
            )}
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            {step > 0 && (
              <Button onClick={handleBack}>Back</Button>
            )}
            {step < steps.length - 1 && <Button type="primary" onClick={handleNext}>Next</Button>}
          </div>
        </FormProvider>
      </div>
    </div>
  );
}