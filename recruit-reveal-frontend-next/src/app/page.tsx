// src/app/page.tsx
'use client';
import { useState } from 'react';
import ChatThread from '@recruit/components/ChatThread';
import { Input } from 'antd';

export default function Home() {
  const [messages, setMessages] = useState([
    { from: 'app', text: 'Hi! What’s your name?' },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [step, setStep] = useState(1);

  const handleSubmit = () => {
    if (!currentInput.trim()) return;
    setMessages([...messages, { from: 'user', text: currentInput }]);
    // Mock next step (replace with full wizard logic)
    if (step === 1) {
      setMessages((prev) => [
        ...prev,
        { from: 'app', text: 'Great! Which position are you evaluating?' },
      ]);
      setStep(2);
    }
    setCurrentInput('');
  };

  return (
    <div className="min-h-screen p-4 bg-gray-100 dark:bg-gray-900 flex flex-col">
      <main className="flex-grow flex flex-col items-center justify-start">
        <div className="w-full max-w-2xl">
          <ChatThread messages={messages} />
        </div>
      </main>
      <footer className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t dark:border-gray-700">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onPressEnter={handleSubmit}
            placeholder={step === 1 ? 'Enter your name' : 'Select position (e.g., QB)'}
            className="flex-grow"
          />
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}