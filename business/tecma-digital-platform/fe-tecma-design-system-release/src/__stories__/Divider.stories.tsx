import React from 'react';

import { Story, Meta } from '@storybook/react';

import Divider, { DividerProps } from '../components/Divider/Divider';

// 👇 We create a “template” of how args map to rendering
const Template: Story<DividerProps> = (args) => (
  <div>
    <p>Custom Text</p>
    <Divider {...args} />
    <p>Custom Text</p>
    <Divider {...args} />
  </div>
);

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Type = () => (
  <div style={{ display: 'flex' }}>
    <span>Custom Text</span>
    <Divider type='vertical' />
    <span>Custom Text</span>
    <Divider type='vertical' />
  </div>
);
Type.parameters = {
  docs: { description: { story: 'Defines the divider type, can be `horizontal` or `vertical` ' } },
};

export default {
  title: 'Components/Divider',
  component: Divider,
  parameters: {
    componentSubtitle: 'A divider line separates different content.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?type=design&node-id=709%3A6875&mode=design&t=z1xDJ5Wc1kTYP7Nn-1',
    },
  },
  argTypes: {
    type: {
      description: 'The direction type of divider',
      defaultValue: 'horizontal',
      control: { type: 'radio' },
      options: ['horizontal', 'vertical'],
    },
  },
} as Meta<typeof Divider>;
