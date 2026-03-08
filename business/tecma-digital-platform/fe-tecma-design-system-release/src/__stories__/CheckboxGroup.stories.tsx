import React from 'react';

import { Story, Meta } from '@storybook/react';

import { Checkbox } from '../components/Checkbox';
import CheckboxGroup, { CheckboxGroupProps } from '../components/CheckboxGroup/CheckboxGroup';

// 👇 We create a “template” of how args map to rendering
const Template: Story<CheckboxGroupProps> = (args) => (
  <CheckboxGroup {...args}>
    <Checkbox label='check 1' />
    <Checkbox label='check 2' />
    <Checkbox label='check 3' />
  </CheckboxGroup>
);

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Label = Template.bind({});
Label.args = { label: 'Checkbox group' };
Label.parameters = {
  docs: {
    description: {
      story: 'Label to show as checkbox group legend.',
    },
  },
};

export const HelpText = () => (
  <div style={{ display: 'flex', gap: '2rem' }}>
    <CheckboxGroup label='Group with helptext' helpText='Hi, i am the helptext'>
      <Checkbox label='check 1' />
      <Checkbox label='check 2' />
      <Checkbox label='check 3' />
    </CheckboxGroup>
    <CheckboxGroup label='Group with helptext errored' error required helpText='Hi, i am the helptext errored'>
      <Checkbox label='check 1' />
      <Checkbox label='check 2' />
      <Checkbox label='check 3' />
    </CheckboxGroup>
  </div>
);
HelpText.parameters = {
  docs: {
    description: {
      story: 'A text to show as help.',
    },
  },
};

export const Orientation = () => (
  <div style={{ display: 'flex', gap: '2rem' }}>
    <CheckboxGroup label='Vertical group' helpText='Hi, i am the helptext'>
      <Checkbox label='check 1' />
      <Checkbox label='check 2' />
      <Checkbox label='check 3' />
    </CheckboxGroup>
    <CheckboxGroup label='Horizontal group' orientation='horizontal' helpText='Hi, i am the helptext'>
      <Checkbox label='check 1' />
      <Checkbox label='check 2' />
      <Checkbox label='check 3' />
    </CheckboxGroup>
  </div>
);
Orientation.parameters = {
  docs: {
    description: {
      story: 'The checkbox orientation.',
    },
  },
};

export default {
  title: 'Components/CheckboxGroup',
  component: CheckboxGroup,
  parameters: {
    componentSubtitle: 'The Checkbox Group allows the user to select one or more options from a set.',
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {
    label: {
      description: 'Label to show as checkbox group legend',
      defaultValue: 'Checkbox group',
      control: 'text',
    },
    helpText: {
      description: 'A text to show as help.',
      defaultValue: 'An help text',
      control: 'text',
    },
    orientation: {
      description: 'The checkbox orientation',
      defaultValue: 'vertical',
      control: { type: 'radio' },
      options: ['vertical', 'horizontal'],
    },
  },
} as Meta<typeof CheckboxGroup>;
