'use client';
import React from 'react';
import { Button } from 'antd';

export function ReviewCard({ answers, onEdit, onSubmit, stepKeys, loading }: { answers: Record<string, any>; onEdit: (step: number) => void; onSubmit: () => void; stepKeys: string[]; loading?: boolean }) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">Review Your Answers</h3>
      {stepKeys.slice(0, -1).map((key, i) => (
        <div key={key} className="flex justify-between mb-1">
          <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
          <span>{String(answers[key])}</span>
          <Button type="link" onClick={() => onEdit(i)}>Edit</Button>
        </div>
      ))}
      <Button type="primary" onClick={onSubmit} loading={loading}>
        {loading ? 'Evaluating...' : 'Submit'}
      </Button>
    </div>
  );
}