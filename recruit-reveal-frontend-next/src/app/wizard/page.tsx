'use client';

import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { Button, message } from 'antd';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProgressPills } from '../../components/ProgressPills';
import InputBar from '../../components/InputBar';
import ChatThread from '../../components/ChatThread';
import { ReviewCard } from '../../components/ReviewCard';
import Dashboard from '../../components/Dashboard';
import { useDarkMode } from '../../components/DarkModeContext';
import ProfileSetupModal from '../../components/ProfileSetupModal';
import { useUserProfile, useProfileCompletion } from '../../contexts/UserProfileContext';

export type FormValues = {
  Player_Name: string;
  position: 'QB' | 'RB' | 'WR';
  grad_year: number;
  state: string;
  // QB specific fields (stats)
  senior_ypg?: number;
  senior_tds?: number;
  senior_comp_pct?: number;
  senior_ypc?: number;
  senior_yds?: number;
  senior_cmp?: number;
  senior_att?: number;
  senior_int?: number;
  senior_td_passes?: number;
  junior_yds?: number;
  junior_ypg?: number;
  // RB specific fields (stats)
  senior_touches?: number;
  senior_avg?: number;
  senior_rush_rec?: number;
  senior_rush_rec_yds?: number;
  senior_rush_td?: number;
  senior_rush_yds?: number;
  // WR specific fields (stats)
  senior_rec?: number;
  senior_rec_yds?: number;
  senior_rec_td?: number;
  junior_rec?: number;
  junior_rec_yds?: number;
  junior_rec_td?: number;
  // Physical measurements
  height_inches?: number;
  weight_lbs?: number;
  // Combine metrics (all optional - will be imputed by Synapse)
  forty_yard_dash?: number;
  vertical_jump?: number;
  shuttle?: number;
  broad_jump?: number;
  bench_press?: number;
  [key: string]: string | number | undefined;
};

// Mock evaluation result for testing
const mockEvalResult = {
  predicted_tier: 'FCS',
  score: 69.3,
  notes: 'Balanced profile with room for improvement',
  probability: 0.693,
  performance_score: 0.70,
  combine_score: 0.65,
  upside_score: 0.10,
  underdog_bonus: 0.05,
  goals: ['Improve 40-yard dash to 4.5s', 'Increase senior TD passes'],
  switches: 'Consider switching to WR for better Power5 fit',
  calendar_advice: 'Schedule campus visits during April 15-May 24, 2025 contact period',
  position: 'QB' as 'QB' | 'RB' | 'WR'
};

export default function WizardPage() {
  const form = useForm<FormValues>();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedPosition, setSelectedPosition] = useState<'QB' | 'RB' | 'WR' | null>(null);
  const [messages, setMessages] = useState<{ from: 'app' | 'user'; text: string }[]>([]);
  const [evalResult, setEvalResult] = useState<typeof mockEvalResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { data: session } = useSession();
  const { profile, loading: profileLoading } = useUserProfile();
  const { isProfileComplete, needsProfileSetup } = useProfileCompletion();

  // Generate dynamic welcome message based on user status
  const getWelcomeMessage = () => {
    if (session && profile?.name) {
      return `🏈 Welcome back, ${profile.name}! Let's evaluate your potential!`;
    } else if (session) {
      return '🏈 Welcome! Ready to evaluate your potential?';
    } else {
      return '🏈 Welcome! Ready to evaluate your potential?';
    }
  };

  // Define which questions are settings (should be auto-skipped if profile has data)
  const settingsFields = ['Player_Name', 'position', 'grad_year', 'state'];

  // Define position-specific steps in strict order: [settings, stats, combine]
  const positionSteps = {
    QB: [
      // Settings (will be auto-skipped if profile has data)
      { key: 'Player_Name', prompt: getWelcomeMessage(), category: 'settings' },
      { key: 'position', prompt: '🎯 Awesome! Which position do you play?', category: 'settings' },
      { key: 'grad_year', prompt: '📅 What year will you graduate and take the next step?', category: 'settings' },
      { key: 'state', prompt: '🗺️ Which state do you play in?', category: 'settings' },
      // Stats (never auto-skipped)
      { key: 'senior_yds', prompt: '🚀 Let\'s dive into your senior year passing yards - show me those numbers!', category: 'stats' },
      { key: 'senior_cmp', prompt: '🎯 How many completions did you rack up in your senior year?', category: 'stats' },
      { key: 'senior_att', prompt: '💪 Total passing attempts in your senior season?', category: 'stats' },
      { key: 'senior_int', prompt: '📊 Senior year interceptions (every QB throws a few!)?', category: 'stats' },
      { key: 'senior_td_passes', prompt: '🔥 Senior year touchdown passes?', category: 'stats' },
      { key: 'junior_yds', prompt: '⭐ Junior year passing yards - building that foundation!', category: 'stats' },
      // Combine (never auto-skipped)
      { key: 'forty_yard_dash', prompt: '💨 40-yard dash time - show me that speed!', category: 'combine' },
      { key: 'vertical_jump', prompt: '🦘 Vertical jump', category: 'combine' },
      { key: 'shuttle', prompt: '⚡ Shuttle time', category: 'combine' },
      { key: 'height_inches', prompt: '📏 Height', category: 'combine' },
      { key: 'weight_lbs', prompt: '⚖️ Weight', category: 'combine' },
      { key: 'review', prompt: '🌟 Ready to see your potential? Let\'s reveal your recruit profile!', category: 'review' }
    ],
    RB: [
      // Settings (will be auto-skipped if profile has data)
      { key: 'Player_Name', prompt: getWelcomeMessage(), category: 'settings' },
      { key: 'position', prompt: '🎯 Awesome! Which position do you play?', category: 'settings' },
      { key: 'grad_year', prompt: '📅 What year will you graduate and take the next step?', category: 'settings' },
      { key: 'state', prompt: '🗺️ Which state do you play in?', category: 'settings' },
      // Stats (never auto-skipped)
      { key: 'senior_rush_yds', prompt: '🏃‍♂️ Senior year rushing yards - how many yards did you rack up?', category: 'stats' },
      { key: 'senior_touches', prompt: '👐 Total touches in your senior season', category: 'stats' },
      { key: 'senior_avg', prompt: '📊 Average yards per carry in your senior season?', category: 'stats' },
      { key: 'senior_rush_rec', prompt: '🤲 Senior year receptions - dual threat ability!', category: 'stats' },
      { key: 'senior_rush_rec_yds', prompt: '📡 Senior receiving yards', category: 'stats' },
      { key: 'senior_rush_td', prompt: '🏆 Total touchdowns in your senior year?', category: 'stats' },
      { key: 'junior_ypg', prompt: '⭐ Junior year yards per game - consistency matters!', category: 'stats' },
      // Combine (never auto-skipped)
      { key: 'forty_yard_dash', prompt: '💨 40-yard dash time - show me that speed!', category: 'combine' },
      { key: 'vertical_jump', prompt: '🦘 Vertical jump', category: 'combine' },
      { key: 'shuttle', prompt: '⚡ Shuttle time', category: 'combine' },
      { key: 'height_inches', prompt: '📏 Height', category: 'combine' },
      { key: 'weight_lbs', prompt: '⚖️ Weight', category: 'combine' },
      { key: 'review', prompt: '🌟 Ready to see your potential? Let\'s reveal your recruit profile!', category: 'review' }
    ],
    WR: [
      // Settings (will be auto-skipped if profile has data)
      { key: 'Player_Name', prompt: getWelcomeMessage(), category: 'settings' },
      { key: 'position', prompt: '🎯 Awesome! Which position do you play?', category: 'settings' },
      { key: 'grad_year', prompt: '📅 What year will you graduate and take the next step?', category: 'settings' },
      { key: 'state', prompt: '🗺️ Which state do you play in?', category: 'settings' },
      // Stats (never auto-skipped)
      { key: 'senior_rec', prompt: '🏈 Senior year receptions - show me those catches!', category: 'stats' },
      { key: 'senior_rec_yds', prompt: '📏 Senior year receiving yards', category: 'stats' },
      { key: 'senior_rec_td', prompt: '🎯 Senior year receiving touchdowns', category: 'stats' },
      { key: 'junior_rec', prompt: '⭐ Junior year receptions', category: 'stats' },
      { key: 'junior_rec_yds', prompt: '📊 Junior year receiving yards', category: 'stats' },
      { key: 'junior_rec_td', prompt: '🔥 Junior year receiving touchdowns', category: 'stats' },
      // Combine (never auto-skipped)
      { key: 'forty_yard_dash', prompt: '💨 40-yard dash time - show me that speed!', category: 'combine' },
      { key: 'vertical_jump', prompt: '🦘 Vertical jump', category: 'combine' },
      { key: 'shuttle', prompt: '⚡ Shuttle time', category: 'combine' },
      { key: 'height_inches', prompt: '📏 Height', category: 'combine' },
      { key: 'weight_lbs', prompt: '⚖️ Weight', category: 'combine' },
      { key: 'review', prompt: '🌟 Ready to see your potential? We\'ll analyze your combine metrics!', category: 'review' }
    ],
    DEFAULT: [] as { key: keyof FormValues | 'review'; prompt: string; category: string }[]
  };

  // Initialize with first few universal steps before position selection
  const initialSteps = [
    { key: 'Player_Name' as keyof FormValues, prompt: getWelcomeMessage() },
    { key: 'position' as keyof FormValues, prompt: '🎯 Awesome! Which position do you play?' }
  ];
  const [currentSteps, setCurrentSteps] = useState<{ key: keyof FormValues | 'review'; prompt: string; category: string }[]>(initialSteps.map(step => ({ ...step, category: 'settings' })));

  // Initialize messages and auto-fill form data based on profile
  useEffect(() => {
    if (profile && !profileLoading) {
      // Use personalized welcome message for logged in users
      const welcomeMessage = profile.name
        ? `🏈 Welcome back, ${profile.name}! Ready to evaluate your potential?`
        : '🏈 Welcome! Ready to evaluate your potential?';

      const initialMessages: { from: 'app' | 'user'; text: string }[] = [
        { from: 'app', text: welcomeMessage }
      ];
      setMessages(initialMessages);
      
      // Pre-fill form with ALL available profile data to avoid re-asking
      const profileData: Partial<FormValues> = {};
      let startStep = 0;

      if (profile.name) {
        profileData.Player_Name = profile.name;
        startStep = Math.max(startStep, 1); // Skip name question
      }

      if (profile.position) {
        profileData.position = profile.position as 'QB' | 'RB' | 'WR';
        setSelectedPosition(profile.position as 'QB' | 'RB' | 'WR');
        startStep = Math.max(startStep, 2); // Skip position question
      }

      if (profile.graduation_year) {
        profileData.grad_year = profile.graduation_year;
        startStep = Math.max(startStep, 3); // Skip grad year question
      }

      if (profile.state) {
        profileData.state = profile.state;
        startStep = Math.max(startStep, 4); // Skip state question
      }

      if (profile.height) {
        profileData.height_inches = profile.height;
      }

      if (profile.weight) {
        profileData.weight_lbs = profile.weight;
      }

      // Set all the form values at once
      Object.entries(profileData).forEach(([key, value]) => {
        form.setValue(key as string, value);
      });

              // If we have position, update the steps for that position and skip ONLY to first stat question
        if (profile.position) {
          const positionStepsList = buildSteps(profile.position as 'QB' | 'RB' | 'WR');
          setCurrentSteps(positionStepsList);

          // Find first stats question (never skip stats/combine, only settings)
          let nextStep = 0;
          for (let i = 0; i < positionStepsList.length; i++) {
            const step = positionStepsList[i];
            if (step.category === 'stats') {
              nextStep = i;
              break;
            }
            // Only skip settings that have profile data
            if (step.category === 'settings' && profileData[step.key as keyof FormValues]) {
              continue;
            } else if (step.category === 'settings') {
              nextStep = i;
              break;
            }
          }

          setStep(nextStep);

          // Show the first stats question prompt
          if (nextStep < positionStepsList.length && positionStepsList[nextStep]) {
            setTimeout(() => {
              setMessages(prev => [...prev, { from: 'app', text: positionStepsList[nextStep].prompt }]);
            }, 300);
          }
        } else {
        // No position set, start from where we left off
        setStep(startStep);
        if (startStep < initialSteps.length) {
          setTimeout(() => {
            setMessages(prev => [...prev, { from: 'app', text: initialSteps[startStep].prompt }]);
          }, 300);
        }
      }
    } else if (!profileLoading && needsProfileSetup) {
      setShowProfileSetup(true);
    } else if (!profileLoading && !profile) {
      // Not logged in - show generic welcome
      const initialMessages: { from: 'app' | 'user'; text: string }[] = [
        { from: 'app', text: '🏈 Welcome! Ready to evaluate your potential?' }
      ];
      setMessages(initialMessages);
    }
  }, [profile, profileLoading, needsProfileSetup, form]);

  // Update steps when position changes - critical for dynamic question flow
  useEffect(() => {
    if (selectedPosition && step === 1) {
      const newSteps = buildSteps(selectedPosition);
      setCurrentSteps(newSteps);
      // Add user response to chat thread
      setMessages(prev => [...prev, { from: 'user', text: selectedPosition }]);
      setStep(2);
      // Immediately show next question prompt to maintain chat flow
      if (newSteps[2]?.prompt) {
        setTimeout(() => {
          setMessages(prev => [...prev, { from: 'app', text: newSteps[2].prompt }]);
        }, 300);
      }
    }
  }, [selectedPosition, step]);

  // Build steps based on selected position
  const buildSteps = (position: 'QB' | 'RB' | 'WR') => {
    return positionSteps[position] || positionSteps.DEFAULT;
  };

  // Show profile setup modal if needed
  if (showProfileSetup) {
    return (
      <ProfileSetupModal
        visible={showProfileSetup}
        onClose={() => setShowProfileSetup(false)}
        onComplete={() => setShowProfileSetup(false)}
      />
    );
  }

  // Show loading while profile is loading
  if (profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  const handleNext = async () => {
    // Validate current field only (not entire form)
    const currentStep = currentSteps[step];
    if (!currentStep) return;

    const fieldName = currentStep.key as string;
    const valid = await form.trigger(fieldName);
    if (!valid) return;

    const key = currentStep.key;
    const value = form.getValues()[key as keyof FormValues];

    // Handle position selection specially - triggers step array rebuild
    if (key === 'position') {
      setSelectedPosition(value as 'QB' | 'RB' | 'WR');
      return; // Position change is handled in useEffect
    } else {
      // Add user input to chat thread for visual continuity
      setMessages(prev => [...prev, { from: 'user', text: String(value) }]);
    }

    const nextStep = step + 1;
    setStep(nextStep);

    // Show next question prompt with slight delay for better UX
    if (nextStep < currentSteps.length) {
      const nextPrompt = currentSteps[nextStep]?.prompt;
      if (nextPrompt) {
        setTimeout(() => {
          setMessages(prev => [...prev, { from: 'app', text: nextPrompt }]);
        }, 300);
      }
    }
  };

  const handleBack = () => {
    const prevStep = Math.max(0, step - 1);
    setStep(prevStep);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Get all form data including position
      const formData = form.getValues();

      // Call the evaluation API with position data
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          position: selectedPosition, // Ensure position is included
        }),
      });

      if (!response.ok) {
        throw new Error(`Evaluation failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Store evaluation result and redirect to dashboard
      sessionStorage.setItem('evalResult', JSON.stringify({
        ...result,
        position: selectedPosition,
        playerName: formData.Player_Name,
      }));

      // Redirect to dashboard page with results
      router.push('/dashboard');

    } catch (error) {
      console.error('Evaluation submission failed:', error);
      message.error('Failed to evaluate profile. Please try again.');
      // Fallback to mock data for development
      setEvalResult({ ...mockEvalResult, position: selectedPosition || 'QB' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (evalResult) {
    return <Dashboard evalData={evalResult} />;
  }

  return (
    <div
      data-theme={darkMode ? 'dark' : 'light'}
      className="flex flex-col min-h-screen bg-[var(--bg-primary)] transition-colors"
    >
      <div className="max-w-xl w-full mx-auto flex flex-col flex-1 pt-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold cyber-title">Recruit Reveal</h2>
          <Button size="small" onClick={toggleDarkMode}>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
        <FormProvider {...form}>
          <ProgressPills total={currentSteps.length} current={step} onClick={setStep} />
          <div className="flex-1 flex flex-col overflow-hidden min-h-[400px]">
            <ChatThread messages={messages} stagger={true} />
          </div>
          <div className="input-bar sticky bottom-0 bg-[var(--bg-primary)]">
            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 mb-2">
                                  Step: {step}, Steps length: {currentSteps.length}, Current step key: {currentSteps[step]?.key}, Current step category: {currentSteps[step]?.category}
              </div>
            )}
            
            {currentSteps[step]?.key === 'review' ? (
              <ReviewCard
                answers={form.getValues()}
                onEdit={setStep}
                onSubmit={handleSubmit}
                stepKeys={currentSteps.map(s => s.key as string)}
                loading={isSubmitting}
              />
            ) : (
              <InputBar
                step={step}
                steps={currentSteps}
                onEnter={handleNext}
              />
            )}
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            {step > 0 && (
              <Button onClick={handleBack}>Back</Button>
            )}
            {currentSteps[step]?.key !== 'review' && (
              <Button type="primary" onClick={handleNext}>Next</Button>
            )}
          </div>
        </FormProvider>
      </div>
    </div>
  );
}