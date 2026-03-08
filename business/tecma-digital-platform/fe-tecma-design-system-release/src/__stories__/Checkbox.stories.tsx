import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import Checkbox, { CheckboxProps } from '../components/Checkbox/Checkbox';

// 👇 We create a “template” of how args map to rendering
const Template: Story<CheckboxProps> = (args) => <Checkbox {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const Label = Template.bind({});
Label.args = { label: 'checkbox label' };
Label.parameters = {
  docs: { description: { story: 'The label to show close to the checkbox' } },
};

export const LabelPlacement = () => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Checkbox label='top' labelPlacement='top' />
      <Checkbox label='bottom' labelPlacement='bottom' />
    </div>
    <div style={{ display: 'flex' }}>
      <Checkbox label='end' labelPlacement='end' />
      <Checkbox label='start' labelPlacement='start' />
    </div>
  </div>
);
LabelPlacement.parameters = {
  docs: {
    description: {
      story: 'You can change the placement of the label: `top`,`bottom`,`start`and `end`. ',
    },
  },
};

export const Icon = Template.bind({});
Icon.args = { icon: 'x-circle' };
Icon.parameters = {
  docs: { description: { story: 'An Icon to show instead of the classic checkbox.' } },
};

export const Size = () => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <Checkbox label='small' size='small' />
    <Checkbox label='medium' size='medium' />
    <Checkbox label='large' size='large' />
  </div>
);
Size.parameters = {
  docs: {
    description: {
      story: "Defines the checkbox's size, can be `small`, `medium`, `large`.",
    },
  },
};

export const Error = () => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <Checkbox color='error' />
    <Checkbox color='error' checked />
    <Checkbox color='error' disabled />
    <Checkbox color='error' checked disabled />
    <Checkbox status='error' helpText='hello' />
  </div>
);
Error.parameters = {
  docs: { description: { story: 'Use the color prop to show an errored checkbox' } },
};
Error.args = { color: 'error' };

export const HelpText = () => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <Checkbox status='error' helpText='hello' color='error' />
  </div>
);
HelpText.parameters = {
  docs: { description: { story: 'Use the help text for error' } },
};
HelpText.args = { color: 'error', status: 'error', helpText: 'hello' };

export const Disabled = () => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <Checkbox disabled />
    <Checkbox checked disabled />
  </div>
);
Disabled.parameters = {
  docs: { description: { story: 'Disables the checkbox' } },
};
Disabled.args = { disabled: true };

export const Indeterminate = () => {
  const [checked, setChecked] = useState<boolean[]>([true, false]);

  const handleChange1 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked([event.target.checked, event.target.checked]);
  };

  const handleChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked([event.target.checked, checked[1]]);
  };

  const handleChange3 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked([checked[0], event.target.checked]);
  };

  const children = (
    <div>
      <Checkbox checked={checked[0]} onChange={handleChange2} label='Check 1' />
      <Checkbox checked={checked[1]} onChange={handleChange3} label='Check 2' />
    </div>
  );

  return (
    <div>
      <Checkbox checked={checked[0] && checked[1]} indeterminate={checked[0] !== checked[1]} onChange={handleChange1} label='Parent' />
      {children}
    </div>
  );
};

Indeterminate.parameters = {
  docs: {
    description: {
      story: "A checkbox input can only have two states in a form: checked or unchecked. It either submits its value or doesn't.",
    },
  },
};

export default {
  title: 'Components/Checkbox',
  component: Checkbox,
  argTypes: {
    label: {
      description: 'The label to show close to the checkbox',
      defaultValue: '',
      control: 'text',
    },
    size: {
      description: "Defines the checkbox's size, can be `small`, `medium`, `large`",
      defaultValue: 'medium',
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
    },
    icon: {
      description: 'An icon to show instead of classic checkbox',
      defaultValue: '',
      control: 'text',
    },
    checkedIcon: {
      description: 'An icon to show when checkbox is checked',
      defaultValue: '',
      control: 'text',
    },
    onChange: {
      description: 'You can control the checkbox with the `checked` and `onChange` props',
      defaultValue: undefined,
      action: 'clicked',
    },
    indeterminate: {
      description: "A checkbox input can only have two states in a form: checked or unchecked. It either submits its value or doesn't.",
    },
    labelPlacement: {
      description: 'You can change the placement of the label',
      defaultValue: 'right',
      control: 'text',
    },
    disabled: {
      description: 'Disables the checkbox',
      defaultValue: false,
      control: 'boolean',
    },
    checked: {
      description: 'If true, the checkbox is checked',
      defaultValue: undefined,
      control: 'boolean',
    },
    color: {
      description: 'The color of the component.',
      defaultValue: 'default',
      control: { type: 'radio' },
      options: ['default', 'error'],
    },
  },
  parameters: {
    componentSubtitle: 'An input for choosing from predefined options.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=39-13835',
    },
  },
} as Meta<typeof Checkbox>;
