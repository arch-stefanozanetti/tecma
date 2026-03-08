import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { RadioButton } from '../components/RadioButton';
import { RadioButtonProps } from '../components/RadioButton/RadioButton';
import { Colors as ColorsType } from '../declarations';
import { SizeStandard } from '../declarations/size';

// 👇 We create a “template” of how args map to rendering
const Template: Story<RadioButtonProps> = (args) => {
  const { checked, label } = args;
  const [isChecked, setIsChecked] = useState(checked || false);
  return <RadioButton {...args} checked={isChecked} onChange={() => setIsChecked(!isChecked)} label={label || 'Text'} />;
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const Label = Template.bind({});
Label.args = { label: 'radio button label' };

export const LabelPosition = Template.bind({});
LabelPosition.args = { labelPosition: 'bottom' };

export const OnClick = Template.bind({});
OnClick.args = {
  onChange: () => {
    console.log('CLICKED');
  },
};

export const Checked = Template.bind({});
Checked.args = { checked: true };
Checked.parameters = {
  docs: { description: { story: 'Specifies whether the radio is selected' } },
};

export const Errored = Template.bind({});
Errored.args = { errored: true };

export const Disabled = Template.bind({});
Disabled.args = { disabled: true };

export const RadioCard = () => {
  const defaultParams: RadioButtonProps = {
    label: 'Text',
    type: 'radio-card',
    onChange: () => undefined,
    labelPosition: 'left',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <RadioButton {...defaultParams} label='Default' />
      <RadioButton {...defaultParams} checked label='Checked' />
      <RadioButton {...defaultParams} errored label='Error' />
      <RadioButton {...defaultParams} disabled label='Disabled' />
    </div>
  );
};
RadioCard.args = { type: 'radio-card', labelPosition: 'left' };

export const Sizes = () => {
  const sizes = ['small', 'medium', 'large'];
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'end' }}>
      {sizes.map((size) => (
        <RadioButton onChange={() => undefined} size={size as SizeStandard} checked label='text' key={size} />
      ))}
    </div>
  );
};
Sizes.parameters = {
  docs: {
    description: { story: "Defines the radio button's size, can be `small`, `medium`, `large`" },
  },
};

export const Colors = () => {
  const colors = ['default', 'primary', 'secondary', 'danger'];
  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {colors.map((color) => (
        <RadioButton onChange={() => undefined} color={color as ColorsType} checked label='text' key={color} />
      ))}
    </div>
  );
};
Colors.parameters = {
  docs: {
    description: {
      story: 'Defines the radio button color, can be default, primary, secondary, info, warning, success, danger',
    },
  },
};

export default {
  title: 'Components/RadioButton',
  component: RadioButton,
  parameters: {
    componentSubtitle: 'Radio buttons allow a user to select a single option from a list of predefined options.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=41-276',
    },
  },
  argTypes: {
    label: {
      description: 'The label to show close to the radio button',
      defaultValue: '',
      control: 'text',
    },
    labelPosition: {
      description: 'The label position',
      defaultValue: '',
      control: 'radio',
      options: ['top', 'bottom', 'left', 'right'],
    },
    onChange: {
      description: 'The function to perform on radioButton click',
      defaultValue: () => console.log('CLICKED'),
      action: 'clicked',
    },
    checked: {
      description: 'Specifies whether the radio is selected',
      defaultValue: false,
      control: 'boolean',
    },
    disabled: {
      description: 'Disables the radioButton',
      defaultValue: false,
      control: 'boolean',
    },
    type: {
      description: "Defines the radio button's type",
      defaultValue: '',
      control: { type: 'radio' },
      options: ['', 'radio-card'],
    },
    size: {
      description: "Defines the radio button's size, can be `small`, `medium`, `large`",
      defaultValue: 'medium',
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
    },
    errored: {
      description: 'If true, the radioButton is errored',
      defaultValue: false,
      control: 'boolean',
    },

    color: {
      description: 'Defines the radio button color, can be default, primary, secondary, info, warning, success, danger ',
      defaultValue: 'primary',
      control: { type: 'radio' },
      options: ['default', 'primary', 'secondary', 'danger'],
    },
  },
} as Meta<typeof RadioButton>;
