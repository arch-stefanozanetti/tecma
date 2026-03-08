import React from 'react';

import { Story, Meta } from '@storybook/react';

import { IconName } from '../components/Icon/IconName';
import { Tab, TabProps } from '../components/Tab/Tab';

// 👇 We create a “template” of how args map to rendering
const Template: Story<TabProps> = (args) => {
  const tabItems = [
    { title: 'hello', iconName: 'user' as IconName, content: 'hi, I am the hello button content' },
    {
      title: 'bonjour',
      iconName: 'home' as IconName,
      content: 'hi, I am the bonjour button content',
    },
  ];
  const { items } = args;
  const isNotEmptyItems = items.filter((item) => Object.keys(item).length > 0).length > 0;

  return <Tab {...args} items={isNotEmptyItems ? items : tabItems} />;
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export default {
  title: 'Components/Tab',
  component: Tab,
  parameters: {
    componentSubtitle:
      'Tabbed interfaces are a way of navigating between multiple panels, reducing clutter and fitting more into a smaller space.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=49-467',
    },
  },
  argTypes: {
    items: {
      description: 'The tabs to show',
      defaultValue: [{}, {}],
      control: 'array',
    },
  },
} as Meta<typeof Tab>;
