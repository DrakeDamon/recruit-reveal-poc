'use client';
import React from 'react';
import { Controller } from 'react-hook-form';
import { Form, Input, Select, Slider, Switch, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

type InputBarProps = {
  step: number;
  form: any;  // useForm instance
  position: string;
  imputedValues?: Record<string, number>;
  impute: boolean;
  onImputeToggle: (checked: boolean) => void;
};

export function InputBar({ step, form, position, imputedValues, impute, onImputeToggle }: InputBarProps) {
  const { control, formState: { errors } } = form;

  const fields = {
    0: <Controller name="name" control={control} rules={{ required: 'Required' }} render={({ field }) => <Input placeholder="Enter your name" {...field} autoFocus />} />,
    1: <Controller name="position" control={control} rules={{ required: 'Required' }} render={({ field }) => (
      <Select placeholder="Select position" {...field}>
        <Select.Option value="QB">QB</Select.Option>
        <Select.Option value="WR">WR (Beta)</Select.Option>
        {/* ... */}
      </Select>
    )} />,
    2: <Controller name="grad_year" control={control} rules={{ required: 'Required', min: new Date().getFullYear() }} render={({ field }) => <Input type="number" placeholder="e.g., 2026" {...field} />} />,
    3: <Controller name="state" control={control} rules={{ required: 'Required' }} render={({ field }) => (
      <Select placeholder="Select state" showSearch {...field}>
        <Select.Option value="TX">TX</Select.Option>
        {/* ... */}
      </Select>
    )} />,
    4: position === 'QB' ? (
      <>
        <Controller name="senior_ypg" control={control} render={({ field }) => <Form.Item label="Senior YPG"><Input type="number" {...field} /></Form.Item>} />
        <Controller name="senior_td_passes" control={control} render={({ field }) => <Form.Item label="Senior TD Passes"><Input type="number" {...field} /></Form.Item>} />
      </>
    ) : ( // Placeholder for others
      <Form.Item label={`${position} Stat (Beta)`}><Input type="number" /></Form.Item>
    ),
    5: (
      <>
        <Controller name="40" control={control} render={({ field }) => (
          <Form.Item label="40yd Dash">
            <Slider {...field} defaultValue={imputedValues?.['40'] || 4.7} min={4} max={5} step={0.1} />
            {imputedValues?.['40'] && <span>Imputed: ~{imputedValues['40']} (75% conf)</span>}
          </Form.Item>
        )} />
        <Controller name="vertical" control={control} render={({ field }) => (
          <Form.Item label="Vertical Jump">
            <Slider {...field} defaultValue={imputedValues?.['vertical'] || 30} min={20} max={40} />
          </Form.Item>
        )} />
        <Tooltip title="We found 5 QBs with similar profiles; we’re 75% confident in this estimate.">
          <Switch checked={impute} onChange={onImputeToggle} /> Impute for me <InfoCircleOutlined />
        </Tooltip>
      </>
    ),
  };

  return (
    <Form layout="vertical">
      {fields[step]}
      {errors[Object.keys(errors)[0]] && <span className="text-red-500">{errors[Object.keys(errors)[0]].message}</span>}
    </Form>
  );
}