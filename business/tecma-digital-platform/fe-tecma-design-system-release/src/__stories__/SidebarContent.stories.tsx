import React from 'react';

import { Story, Meta } from '@storybook/react';

import { SidebarContent } from '../components/Sidebar/components/SidebarContent';
import { SidebarContentProps } from '../components/Sidebar/components/SidebarContent/SidebarContent';

// 👇 We create a “template” of how args map to rendering
const Template: Story<SidebarContentProps> = (args) => <SidebarContent {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Items = Template.bind({});
Items.args = {
  itemsOnTop: [
    {
      icon: 'user',
      label: 'user',
      onClick: () => {
        console.log('user');
      },
    },
    {
      icon: 'home',
      label: 'home',
      onClick: () => {
        console.log('home');
      },
    },
    { icon: 'home', label: 'home', onClick: () => console.log('home') },
  ],
};

export default {
  title: 'Components/Sidebar/SidebarContent',
  component: SidebarContent,
  argTypes: {
    itemsOnTop: {
      description: 'An array of objects to show as Sidebar item on top of the Sidebar Content',
      defaultValue: [{ icon: 'user', label: 'user', onClick: () => console.log('user') }],
    },
  },
} as Meta<typeof SidebarContent>;
