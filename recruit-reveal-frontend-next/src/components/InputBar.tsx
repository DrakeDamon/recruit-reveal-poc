'use client';
import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Form, Input, Select } from 'antd';

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

interface InputBarProps {
  step: number;
  steps: { key: keyof FormValues | 'review'; prompt: string; category?: string }[];
  onEnter: () => void;
}

const positions = ['QB', 'RB', 'WR'] as const;
const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'] as const;

const InputBar: React.FC<InputBarProps> = ({ step, steps, onEnter }) => {
  const { control, watch } = useFormContext<FormValues>();
  
  // Get the current step configuration
  const currentStep = steps[step];
  if (!currentStep) return null;

  const { key } = currentStep;

  // Render different input types based on the field key
  switch (key as string) {
    case 'Player_Name':
      return (
        <Controller
          name="Player_Name"
          control={control}
          rules={{ required: 'Name is required' }}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Name"
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
              className="w-full"
            >
              <Input 
                {...field} 
                placeholder="Enter your name" 
                autoFocus 
                onPressEnter={onEnter}
                className="form-input"
              />
            </Form.Item>
          )}
        />
      );

    case 'position':
      return (
        <Controller
          name="position"
          control={control}
          rules={{ required: 'Position is required' }}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Position"
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
              className="w-full"
            >
              <Select {...field} placeholder="Select position" showSearch onKeyDown={(e) => e.key === 'Enter' && onEnter()}>
                {positions.map((pos) => (
                  <Select.Option key={pos} value={pos}>
                    {pos}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        />
      );

    case 'grad_year':
      return (
        <Controller
          name="grad_year"
          control={control}
          rules={{ required: 'Grad year is required', min: { value: new Date().getFullYear(), message: 'Invalid year' } }}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Graduation Year"
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
              className="w-full"
            >
              <Input {...field} type="number" placeholder="e.g., 2026" onPressEnter={onEnter} />
            </Form.Item>
          )}
        />
      );

    case 'state':
      return (
        <Controller
          name="state"
          control={control}
          rules={{ required: 'State is required' }}
          render={({ field, fieldState }) => (
            <Form.Item
              label="State"
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
              className="w-full"
            >
              <Select {...field} placeholder="Select state" showSearch onKeyDown={(e) => e.key === 'Enter' && onEnter()}>
                {states.map((st) => (
                  <Select.Option key={st} value={st}>
                    {st}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        />
      );

    case 'review':
      return null; // Review step is handled by ReviewCard component

    default:
      // For all other fields (stats, combine, etc.), render appropriate input
      if (key === 'review') {
        return null;
      }

      // Get proper field label
      const fieldLabel = String(key).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      const placeholder = `Enter ${String(key).replace(/_/g, ' ').toLowerCase()}`;

      return (
        <Controller
          name={key as string}
          control={control}
          render={({ field, fieldState }) => (
            <Form.Item
              label={fieldLabel}
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
              className="w-full"
            >
              <Input
                {...field}
                value={field.value || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  // Convert to number for numeric fields, keep as string for text fields
                  if (key === 'Player_Name') {
                    field.onChange(value);
                  } else {
                    field.onChange(value ? Number(value) : undefined);
                  }
                }}
                type={key === 'Player_Name' ? 'text' : 'number'}
                placeholder={placeholder}
                autoFocus
                onPressEnter={onEnter}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </Form.Item>
          )}
        />
      );
  }
};

export default InputBar;
