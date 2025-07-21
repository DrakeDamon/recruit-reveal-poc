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
  senior_ypg?: number;
  senior_td_passes?: number;
  senior_receptions?: number;
  senior_rushing_yards?: number;
  senior_interceptions?: number;
  senior_tackles?: number;  // LB
  senior_receiving_yards?: number;  // TE
  dash40?: number;
  vertical?: number;
  [key: string]: any;
};

interface InputBarProps {
  step: number;
  impute: boolean;
  onImputeToggle: (checked: boolean) => void;
}

const positions = ['QB', 'WR', 'RB', 'DB', 'LB', 'TE'] as const;
type Position = typeof positions[number];

const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'] as const;

type State = typeof states[number];

const InputBar: React.FC<InputBarProps> = ({ step, impute, onImputeToggle }) => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<FormValues>();
  const position = watch('position') as Position | undefined;

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
            >
              <Input {...field} placeholder="Enter your name" autoFocus />
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
            >
              <Select {...field} placeholder="Select position">
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
          rules={{
            required: 'Grad year is required',
            min: { value: new Date().getFullYear(), message: 'Invalid year' },
          }}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Graduation Year"
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
            >
              <Input {...field} type="number" placeholder="e.g., 2026" />
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
            >
              <Select {...field} placeholder="Select state" showSearch>
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
    case 4:
      if (position === 'QB') {
        return (
          <>
            <Controller
              name="senior_ypg"
              control={control}
              rules={{ min: { value: 0, message: 'Positive number' } }}
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Senior YPG"
                  validateStatus={fieldState.error ? 'error' : undefined}
                  help={fieldState.error?.message}
                >
                  <Input {...field} type="number" />
                </Form.Item>
              )}
            />
            <Controller
              name="senior_td_passes"
              control={control}
              rules={{ min: { value: 0, message: 'Positive number' } }}
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Senior TD Passes"
                  validateStatus={fieldState.error ? 'error' : undefined}
                  help={fieldState.error?.message}
                >
                  <Input {...field} type="number" />
                </Form.Item>
              )}
            />
          </>
        );
      } else if (position === 'WR') {
        return (
          <Controller
            name="senior_receptions"
            control={control}
            rules={{ min: { value: 0, message: 'Positive number' } }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Senior Receptions (Beta)"
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} type="number" />
              </Form.Item>
            )}
          />
        );
      } else if (position === 'RB') {
        return (
          <Controller
            name="senior_rushing_yards"
            control={control}
            rules={{ min: { value: 0, message: 'Positive number' } }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Senior Rushing Yards (Beta)"
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} type="number" />
              </Form.Item>
            )}
          />
        );
      } else if (position === 'DB') {
        return (
          <Controller
            name="senior_interceptions"
            control={control}
            rules={{ min: { value: 0, message: 'Positive number' } }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Senior Interceptions (Beta)"
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} type="number" />
              </Form.Item>
            )}
          />
        );
      } else if (position === 'LB') {
        return (
          <Controller
            name="senior_tackles"
            control={control}
            rules={{ min: { value: 0, message: 'Positive number' } }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Senior Tackles (Beta)"
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} type="number" />
              </Form.Item>
            )}
          />
        );
      } else if (position === 'TE') {
        return (
          <Controller
            name="senior_receiving_yards"
            control={control}
            rules={{ min: { value: 0, message: 'Positive number' } }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Senior Receiving Yards (Beta)"
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} type="number" />
              </Form.Item>
            )}
          />
        );
      }
      return (
        <Form.Item label={`${position} Stat (Beta)`}>
          <Input type="number" placeholder={`Enter your ${position} stat`} />
        </Form.Item>
      );
    case 5:
      return (
        <>
          <Controller
            name="dash40"
            control={control}
            rules={{ min: { value: 4, message: 'Minimum 4' } }}
            render={({ field, fieldState }) => (
              <Form.Item label="40-yard Dash (sec)" validateStatus={fieldState.error ? 'error' : undefined} help={fieldState.error?.message}>
                <Slider
                  {...field}
                  min={4}
                  max={6}
                  step={0.01}
                  value={impute ? undefined : field.value || 4.7}
                />
                {impute && <span>Imputed: ~4.4 (75% conf)</span>}
              </Form.Item>
            )}
          />
          <Controller
            name="vertical"
            control={control}
            rules={{ min: { value: 20, message: 'Minimum 20' } }}
            render={({ field, fieldState }) => (
              <Form.Item label="Vertical Jump (in)" validateStatus={fieldState.error ? 'error' : undefined} help={fieldState.error?.message}>
                <Slider {...field} min={20} max={40} value={field.value || 30} />
              </Form.Item>
            )}
          />
          <div className="flex items-center space-x-2">
            <Switch checked={impute} onChange={onImputeToggle} />
            <Tooltip title="We infer combine metrics via KNN (75% confidence)">
              <InfoCircleOutlined />
            </Tooltip>
            <span>Impute missing</span>
          </div>
        </>
      );
    default:
      return null;
  }
}

export default InputBar;