import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import Input, { getValidatorsPass, InputProps, ValidatorsResult } from '../components/Input/Input';

// 👇 We create a “template” of how args map to rendering
const Template: Story<InputProps> = (args) => <Input {...args} />;

// Stories

export const Password: Story<InputProps> = (args) => {
  const [value, setValue] = useState('');
  const [validatorResults, setValidatorResults] = useState<ValidatorsResult>();

  const validators = {
    atLeastANumber: 'At least one number',
    atLeastASymbol: 'A symbol between !-#_$%*.',
  };

  const allValidatorsPass = validatorResults ? Object.values(validatorResults).every((val) => val) : null;

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setValue(e?.target?.value);
    setValidatorResults(getValidatorsPass(e?.target?.value, validators));
  };

  return (
    <Input
      {...args}
      type='password'
      validators={validators}
      validatorResults={validatorResults}
      value={value}
      helpText={value?.length && !allValidatorsPass ? 'Password error' : undefined}
      onChange={handleChange}
      iconName={undefined}
      status={value?.length && !allValidatorsPass ? 'error' : undefined}
      onIconClick={undefined}
    />
  );
};

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const OnChange = Template.bind({});
OnChange.args = { onChange: () => undefined };
export const Size = Template.bind({});
Size.args = { size: 'medium' };
export const Type = Template.bind({});
Type.args = { type: 'text' };
export const Status = Template.bind({});
Status.args = { status: 'error' };
export const HelpText = Template.bind({});
HelpText.args = { helpText: 'hello' };
export const HelpTextErrored = Template.bind({});
HelpTextErrored.args = { helpText: 'hello', status: 'error' };

export const Label = Template.bind({});
Label.args = { label: 'Label' };
export const IconName = Template.bind({});
IconName.args = { iconName: 'user' };
export const OnIconClick = Template.bind({});
OnIconClick.args = {
  onIconClick: () => {
    console.log('clicked');
  },
};

export default {
  title: 'Components/Input',
  component: Input,
  parameters: {
    componentSubtitle: 'A form control that accepts a single line of text.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=41-447',
    },
  },
  argTypes: {
    placeholder: {
      description: 'The input placeholder',
      defaultValue: 'placeholder',
      control: 'text',
    },
    onChange: {
      description: 'The callback to perform on input change',
      defaultValue: undefined,
      action: 'changed',
    },
    size: {
      description: 'The input size',
      defaultValue: 'medium',
      control: 'radio',
      option: ['small', 'medium', 'large'],
    },
    type: {
      description: 'The input type',
      defaultValue: 'text',
      control: 'radio',
      option: ['text', 'number', 'password'],
    },
    status: {
      description: 'The input status',
      defaultValue: undefined,
      control: 'radio',
      option: ['error', 'warning'],
    },
    helpText: {
      description: 'The text to show when input is errored',
      defaultValue: '',
      control: 'text',
    },
    label: {
      description: 'The input label',
      defaultValue: '',
      control: 'text',
    },
    extraLabel: {
      description: 'The input label extra content',
      defaultValue: '',
      control: 'text',
    },
    required: {
      defaultValue: false,
      control: 'boolean',
    },
    iconName: {
      description: 'The icon to show',
      defaultValue: 'user',
      control: 'text',
    },
    onIconClick: {
      description: 'The callback to perform on icon click',
      defaultValue: undefined,
      action: 'changed',
    },
    validators: {
      description: 'Object of validation rules',
      defaultValue: undefined,
    },
    validatorResults: {
      description: 'Object of validations status (boolean)',
      defaultValue: undefined,
    },
  },
} as Meta<typeof Input>;
