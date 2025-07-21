'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm, FormProvider } from 'react-hook-form';
import ChatThread from '@recruit/components/ChatThread';
import { ProgressPills } from '@recruit/components/ProgressPills';
import { ReviewCard } from '@recruit/components/ReviewCard';
import Dashboard from '@recruit/components/Dashboard';
import InputBar from '@recruit/components/InputBar';
import { Button } from 'antd';
import { FormValues } from '@recruit/components/InputBar';

export default function WizardPage() {
  const form = useForm<FormValues>();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<{ from: 'app' | 'user'; text: string }[]>([
    { from: 'app', text: 'Hi! What’s your name?' },
  ]);
  const [impute, setImpute] = useState(false);
  const [evalData, setEvalData] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);

  type StepType = { key: keyof FormValues; prompt: string };
  const steps: StepType[] = [
    { key: 'name', prompt: 'Hi! What’s your name?' },
    { key: 'position', prompt: 'Great! Which position are you evaluating?' },
    { key: 'grad_year', prompt: 'What’s your graduation year?' },
    { key: 'state', prompt: 'Which state do you play in?' },
    { key: 'senior_ypg', prompt: 'Enter your Senior YPG.' },
    { key: 'dash40', prompt: 'Now your 40-yard dash time.' },
    { key: 'review', prompt: 'Review & Submit?' },
  ];

  useEffect(() => {
    const saved = localStorage.getItem('darkMode') === 'true';
    setDarkMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const addMessage = (msg: { from: 'app' | 'user'; text: string }) =>
    setMessages((prev) => [...prev, msg]);

  const handleNext = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    const key = steps[step].key;
    const raw = form.getValues()[key];
    addMessage({ from: 'user', text: String(raw) });
    const next = step + 1;
    setStep(next);
    if (next < steps.length) addMessage({ from: 'app', text: steps[next].prompt });
  };

  const handleSubmit = () => {
    axios.post('/api/evaluate', form.getValues())
      .then((res) => setEvalData(res.data))
      .catch(console.error);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleImpute = (checked: boolean) => {
    setImpute(checked);
    if (checked) {
      form.setValue('dash40', 4.4);
      form.setValue('vertical', 31);
    } else {
      form.resetField('dash40');
      form.resetField('vertical');
    }
  };

  if (evalData) return <Dashboard evalData={evalData} />;

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className="max-w-md mx-auto p-4">
      <Button onClick={() => setDarkMode((d) => !d)}>Toggle Dark Mode</Button>
      <FormProvider {...form}>
        <ProgressPills total={steps.length} current={step} onClick={setStep} />
        <ChatThread messages={messages} stagger={true} />
        {step < steps.length - 1 ? (
          <InputBar step={step} impute={impute} onImputeToggle={handleImpute} />
        ) : (
          <ReviewCard answers={form.getValues()} onEdit={setStep} onSubmit={handleSubmit} stepKeys={steps.map((s) => s.key as string)} />
        )}
        {step < steps.length - 1 && (
          <div className="flex gap-2 mt-2">
            <Button type="primary" onClick={handleNext}>Next</Button>
            <Button onClick={handleBack}>Back</Button>
          </div>
        )}
      </FormProvider>
    </div>
  );
}