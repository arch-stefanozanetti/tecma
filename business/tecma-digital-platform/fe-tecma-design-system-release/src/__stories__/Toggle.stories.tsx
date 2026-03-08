import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Toggle } from '../components/Toggle';
import { ToggleProps } from '../components/Toggle/Toggle';

// 👇 We create a “template” of how args map to rendering
const Template: Story<ToggleProps> = (args) => {
  const { disabled } = args;
  const [isToggled, setIsToggled] = useState(disabled || false);
  return <Toggle {...args} onChange={() => setIsToggled(!isToggled)} value={isToggled} />;
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const OnChange = Template.bind({});
OnChange.args = {
  onChange: () => {},
};
export const Value = Template.bind({});
Value.args = { value: false };
export const Color = Template.bind({});
Color.args = { color: 'primary' };
export const Disabled = Template.bind({});
Disabled.args = { disabled: true };
export const DisabledToggled = () => <Toggle onChange={() => undefined} value disabled />;
Disabled.args = { disabled: true, value: true };
export const Size = Template.bind({});
Size.args = { size: 'large' };
export const Label = Template.bind({});
Label.args = { label: 'toggle label' };
export const HelpText = Template.bind({});
HelpText.args = { helpText: 'hello' };
export const HelpTextErrored = Template.bind({});
HelpTextErrored.args = { helpText: 'hello', error: true };

// add your stories here

export default {
  title: 'Components/Toggle',
  component: Toggle,
  parameters: {
    componentSubtitle: 'A control used to switch between two states: often on or off.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=29-240',
    },
  },
  argTypes: {
    onChange: {
      description: 'The toggle on change handler',
      defaultValue: () => console.log('CLICKED'),
      action: 'clicked',
    },
    value: {
      description: 'The toggle value, boolean',
      defaultValue: false,
      control: 'boolean',
    },
    color: {
      description: 'Defines the toggle color, can be primary, secondary, info, warning, success, danger or transparent',
      defaultValue: 'primary',
      control: { type: 'radio' },
      options: ['primary', 'secondary', 'transparent', 'danger'],
    },
    disabled: {
      description: 'Disables the toggle',
      defaultValue: false,
      control: 'boolean',
    },
    size: {
      description: "Defines the toggle's size, can be `small`, `medium`, `large`",
      defaultValue: 'medium',
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
    },
    label: {
      description: 'A label to show on top of the toggle',
      defaultValue: '',
      control: 'text',
    },
    helpText: {
      description: 'The text to show as help',
      defaultValue: '',
      control: 'text',
    },
  },
} as Meta<typeof Toggle>;
