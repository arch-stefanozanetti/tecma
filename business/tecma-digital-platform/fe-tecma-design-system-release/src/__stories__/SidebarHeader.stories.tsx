import React from 'react';

import { Story, Meta } from '@storybook/react';

import { SidebarHeader } from '../components/Sidebar';
import { SidebarHeaderProps } from '../components/Sidebar/components/SidebarHeader/SidebarHeader';

// 👇 We create a “template” of how args map to rendering
const Template: Story<SidebarHeaderProps> = (args) => <SidebarHeader {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
Basic.args = {
  toggleIconOnClose: 'menu',
  toggleIconOnOpen: 'emoji-happy',
  onToggle: () => console.log('toggled'),
  isOpen: true,
  headerIcon: 'facebook',
};
export const ToggleIcon = Template.bind({});
ToggleIcon.args = { toggleIconOnClose: 'home', toggleIconOnOpen: 'home' };
export const OnToggle = Template.bind({});
OnToggle.args = { onToggle: () => console.log('toggled!') };
export const IsOpen = Template.bind({});
IsOpen.args = { isOpen: false };
export const HeaderIcon = Template.bind({});
HeaderIcon.args = { headerIcon: 'user-circle' };
export const ToggleLabel = Template.bind({});
ToggleLabel.args = { toggleLabel: 'hello' };

export default {
  title: 'Components/Sidebar/SidebarHeader',
  component: SidebarHeader,
  argTypes: {
    toggleIconOnClose: {
      description: "The icon on witch the user click to toggle the sidebar when  it's closed",
      defaultValue: 'hamburger',
      control: { type: 'select' },
    },
    toggleIconOnOpen: {
      description: "The icon on witch the user click to toggle the sidebar when  it's open",
      defaultValue: 'home',
      control: { type: 'select' },
    },
    onToggle: {
      description: 'The handler to be performed when clicking on the sidebar toggle',
      action: 'clicked',
    },
    isOpen: {
      description: 'Defines whether the sidebar is open or closed',
      defaultValue: false,
      control: 'boolean',
    },
    headerIcon: {
      description: 'If provided, show an icon on top of the sidebar',
      defaultValue: 'user',
      control: { type: 'select' },
    },
    toggleLabel: {
      description: 'The label to show close to the toggleIcon',
      defaultValue: 'hello',
      control: 'text',
    },
  },
} as Meta<typeof SidebarHeader>;
