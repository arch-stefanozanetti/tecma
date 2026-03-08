import React from 'react';

import { Story, Meta } from '@storybook/react';

import { Spinner } from '../components/Spinner';
import { SpinnerProps } from '../components/Spinner/Spinner';

// 👇 We create a “template” of how args map to rendering
const Template: Story<SpinnerProps> = (args) => <Spinner {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Size = Template.bind({});
Size.args = { size: 'large' };
export const Gradient = Template.bind({});
Gradient.args = { gradient: true };
export const Type = Template.bind({});
Type.args = { type: 'dotted' };

export default {
  title: 'Components/Spinner',
  component: Spinner,
  parameters: {
    componentSubtitle:
      'A visual indicator that a process is happening in the background but the interface is not yet ready for interaction.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=287-6222',
    },
  },
  argTypes: {
    size: {
      description: 'The spinner size',
      control: 'radio',
      defaultValue: 'medium',
      option: ['small', 'medium', 'large'],
    },
    gradient: {
      description: 'Add gradient to the circular spinner',
      defaultValue: false,
      control: 'boolean',
    },
    type: {
      description: 'The spinner type, which could be circular dotted circular-dotted',
      control: 'radio',
      defaultValue: 'circular',
      option: ['circular', 'dotted', 'dotted-circle'],
    },
  },
} as Meta<typeof Spinner>;
