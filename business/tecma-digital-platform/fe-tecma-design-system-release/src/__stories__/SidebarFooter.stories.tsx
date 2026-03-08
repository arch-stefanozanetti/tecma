import React from 'react';

import { Story, Meta } from '@storybook/react';

import { SidebarFooter } from '../components/Sidebar/components/SidebarFooter';
import { SidebarFooterProps } from '../components/Sidebar/components/SidebarFooter/SidebarFooter';

// 👇 We create a “template” of how args map to rendering
const Template: Story<SidebarFooterProps> = (args) => <SidebarFooter {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const IconName = Template.bind({});
IconName.args = { iconName: 'home' };

export default {
  title: 'Components/Sidebar/SidebarFooter',
  component: SidebarFooter,
  argTypes: {
    iconName: {
      description: 'An icon to show',
      defaultValue: 'user',
      control: { type: 'select' },
    },
    children: {
      description: 'Any html element',
      defaultValue: <div>I am teh Footer</div>,
    },
  },
} as Meta<typeof SidebarFooter>;
