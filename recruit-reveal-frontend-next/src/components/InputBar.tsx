'use client';
import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Form, Input, Select, Slider, Switch, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

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

interface InputBarProps {
  step: number;
  impute: boolean;
  onImputeToggle: (checked: boolean) => void;
  onEnter: () => void;
}

const positions = ['QB', 'WR', 'RB', 'DB', 'LB', 'TE'] as const;
const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'] as const;

const InputBar: React.FC<InputBarProps> = ({ step, impute, onImputeToggle, onEnter }) => {
  const { control } = useFormContext<FormValues>();
  // Simplified: assumes 1 input per step; customize for multipos fields if needed
  switch (step) {
    case 0:
      return (
        <Controller
          name="name"
          control={control}
          rules={{ required: 'Name is required' }}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Name"
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
              className="w-full"
            >
              <Input {...field} placeholder="Enter your name" autoFocus onPressEnter={onEnter} />
            </Form.Item>
          )}
        />
      );
    case 1:
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
    case 2:
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
    case 3:
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
    // For other stat/combine steps, repeat pattern as above or customize per your field/position mapping.
    default:
      // If you want to show a number input for all other steps:
      const stepMap = [
        'senior_yds', 'senior_cmp', 'senior_att', 'senior_int', 'senior_td_passes',
        'junior_yds', 'junior_cmp', 'junior_att', 'junior_int', 'junior_td_passes',
        'dash40', 'vertical', 'shuttle', 'height_inches', 'weight_lbs'
      ];
      const fieldName = stepMap[step - 4];
      if (!fieldName) return null;
      return (
        <Controller
          name={fieldName}
          control={control}
          render={({ field }) => (
            <Form.Item label={fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} className="w-full">
              <Input {...field} type="number" placeholder={fieldName.replace(/_/g, ' ')} onPressEnter={onEnter} />
            </Form.Item>
          )}
        />
      );
  }
};

export default InputBar;
